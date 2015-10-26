var express = require('express');
var expressSession = require('express-session');
var http = require('http');
var path = require('path');
var cookie = require('cookie');
var querystring = require('querystring');
var rs = require('connect-redis')(expressSession);
var extend = require('extend');
var logger = require('morgan');
var bodyParser = require('body-parser');
var multer = require('multer');
var cookieParser = require('cookie-parser');
var errorHandler = require('errorhandler');
var methodOverride = require('method-override');
var _ = require('lodash');
//var Q = require('q');
var favicon = require('serve-favicon');

var app = express();
var server = http.Server(app);
var io = require('socket.io')(server);

var connections = {};
var config = require('./config');
var GateConnector = require('./gate-connector');
var client = require('./controllers/client');
var user = require('./controllers/user');
var auth = require('./controllers/auth');

var options = {
  login_url: '/login',
  consent_url: '/user/consent',
  scopes: {
    foo: 'Access to foo special resource',
    bar: 'Access to bar special resource'
  },
  connections: {
    def: {
      adapter: 'redis',
      host: config.redis.host,
      port: config.redis.port
    }
  },
  policies: {
    loggedIn: function(req, res, next) {
      if(req.session.user) {
        next();
      } else {
        var params = {};

        if (req.parsedParams && req.parsedParams['external_token'] !== undefined) {
         params.external_token = req.parsedParams['external_token'];
        }

        params.return_url = req.parsedParams ? req.path + '?' + querystring.stringify(req.parsedParams) : req.originalUrl;

        res.redirect(this.settings.login_url + '?' + querystring.stringify(params));
      }
    }
  },
  app: app
};

var oidc = require('./openid-connect').oidc(options);

app.set('port', process.env.PORT || 5000);

if ('development' == app.get('env')) {
  app.use(errorHandler());
}

var exphbs = require('express-handlebars');
app.engine('.hbs', exphbs({defaultLayout: 'main', extname: '.hbs'}));
app.set('view engine', '.hbs');

app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
//app.use(multer({ dest: './public/uploads/'}));
app.use(express.static(path.join(__dirname, 'public')));
app.use(favicon(__dirname + '/public/favicon.ico'));

app.use(methodOverride());
app.use(cookieParser(config.session.secret));

var sessionStore = new rs(config.redis);

var sessionMiddleware = expressSession({
  store: sessionStore,
  secret: config.session.secret,
  resave: true,
  saveUninitialized: true,
  cookieParser: cookieParser(config.session.secret)
});

app.use(sessionMiddleware);


/** Enable CORS */
app.use(function(req, res, next) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  //res.header('Access-Control-Allow-Credentials', "true");
  next();
});

server.listen(app.get('port'));

io.on('connection', function(socket) {
  console.info('a user connected');

  socket.on('check-token', function(externalToken) {
    console.log('check-token: ', externalToken);

    /** if instance is exist - finish it! */
    if(connections[socket.id]) {
      console.info('FINISH');
      connections[socket.id].finish();
      delete connections[socket.id];
    }

    var conn = new GateConnector(externalToken, function() {

      conn.user_exists(function(exists) {
        console.info('user exists ', exists);
        io.emit('check-token', exists);
      });

      connections[socket.id] = conn;
    });

  });

  socket.on('run-auth', function(msg) {
    console.log('run-auth: ', msg);

    var conn = connections[socket.id];

    try {
      /* callback will be called few times: in_progress, completed */
      conn.run_auth(function (result) {
        console.log('RUN AUTH STATUS: ' + JSON.stringify(result));

        if (result.status === 'completed') {
          var data = socket.handshake || socket.request;
          var cookies = cookie.parse(data.headers.cookie);
          var sid = cookieParser.signedCookie(cookies[config.session.cookie], config.session.secret);

          sessionStore.get(sid, function (error, sess) {
            console.info('session get: ', error, sess);
            //sess.user = 1; //conn._on_behalf_of;
            sess.user = conn._on_behalf_of;

            sessionStore.set(sid, sess, function (error, result) { });
          });
        }

        io.emit('status', result);
      });

    } catch(ex) {
      console.warn('EXCEPTION: ', ex);
    }

  });

  socket.on('error', function(response) {
    console.warn('SOCKET ON ERROR: ', response);
  });

  socket.on('disconnect', function() {
    console.log('user disconnected');

    if (connections[socket.id]) {
      var conn = connections[socket.id];
      conn.finish();
      delete connections[socket.id];
    } else {
      console.warn('socket id undefined');
    }
  });

});

app.get('/', function(req, res) {
  res.render('index', {});
});

app.get('/login', auth.login);

//app.post('/login', oidc.login(auth.validate), auth.validateSuccess, auth.validateFail);

app.all('/logout', oidc.removetokens(), auth.logout);

//authorization endpoint
app.get('/user/authorize', oidc.auth());

//token endpoint
app.post('/user/token', oidc.token());

//user consent form
app.get('/user/consent', user.consentForm);

app.post('/user/consent', oidc.consent());

//user creation form
app.get('/user/create', user.createForm);

/** Client routes */
app.get('/client/register', oidc.use('client'), client.registerForm);

app.post('/client/register', oidc.use('client'), client.registerAction);

app.get('/client', oidc.use('client'), client.get);

app.get('/client/:id', oidc.use('client'), client.getAll);
