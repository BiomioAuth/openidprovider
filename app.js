var express = require('express');
var expressSession = require('express-session');
var http = require('http');
var path = require('path');
var cors = require('cors');
var cookie = require('cookie');
var cookieParser = require('cookie-parser');
var querystring = require('querystring');
var Promise = require("bluebird");
var rs = require('connect-redis')(expressSession);
var extend = require('extend');
var bodyParser = require('body-parser');
var errorHandler = require('errorhandler');
var _ = require('lodash');
var favicon = require('serve-favicon');
var fs = require('fs');
var BiomioNode = require('biomio-node');

var app = express();
var server = http.Server(app);
var io = require('socket.io')(server);

var connections = {};
var config = require('./config');
var client = require('./controllers/client');
var user = require('./controllers/user');
var auth = require('./controllers/auth');

var env = process.env.NODE_ENV || 'production';

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
      console.info('loggedIn called');
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

var oidc = require('./services/openid-connect').oidc(options);

if ('development' == app.get('env')) {
  app.use(errorHandler());
}

/* configure template engine */
var exphbs = require('express-handlebars');
app.engine('.hbs', exphbs({defaultLayout: 'main', extname: '.hbs'}));
app.set('view engine', '.hbs');

/* set middlewares */
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(favicon(__dirname + '/public/favicon.ico'));
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

app.set('port', process.env.PORT || 5000);

server.listen(app.get('port'));

console.info(config);

try {
  var privateKey = fs.readFileSync(__dirname + '/' + config.appSecretFile).toString();
} catch (e) {
  console.error('Can\'t find/read file "private.key"!');
  process.exit(1);
}

console.info(privateKey);

var gateOptions = {
  gateURL: config.gate.websocketUrl,
  appId: config.appId,
  appKey: privateKey,
  appType: 'hybrid', // probe | extension | hybrid

  /* optional parameters */
  osId: 'linux',
  headerOid: 'clientHeader',
  devId: 'node_js_lib'
}

var clientId = 'test.open.id.provider@gmail.com';

/** establish connection to Gate */
var conn = new BiomioNode(clientId, gateOptions);

conn.on('ready', function() {
  console.info('Connection to Gate is ready!');

  /* run auth... */
  initUsersSocket();
});

conn.on('getResources', function(done) {
  done(config.resources);
});

conn.on('try:text_credentials', function(data, done) {
  console.info("TRY: \n", data);

  /**
   * get user's socket connection (sessionId)
   * generate form and display it to user
   */
  var sessionId = data.sessionId;

  if (!io.sockets.connected[sessionId]) {
    console.warn('socketId: ' + sessionId + ' not found!');
    done('User session not found!');
  }

  console.info('user: '+ sessionId +' request credentials');

  /* @todo: fields must goes from try request */
  var fields = {
    "rType": "input",
    "rProperties": {
      "message": "Enter your login information",
      "fields":[
        {"label": "username", "type": "text:alphanum:1:25"},
        {"label": "password", "type": "password:alphanum:1"}
      ]
    }
  };

  io.sockets.connected[sessionId].emit('try:text_credentials', fields);

  io.sockets.connected[sessionId].on('text_credentials', function (credentials) {
    console.info('user: '+ sessionId +' get credentials ', credentials);

    data.oid = "textCredentialsSamples";

    done(null, {tryReq: data, tryResult: credentials});
  });

});

/**
 * Handle requests from users (frontend part)
 */
var initUsersSocket = function() {
  io.on('connection', function(socket) {
    console.info('user connected: ', socket.id);

    socket.on('run-auth', function(email) {

      /* @todo: remember email (if exists) in user socket session */

      var sessionId = socket.id;
      var clientId = 'test.open.id.provider@gmail.com'; //hardcoded for now, it should goes from url request

      console.log('run-auth: ', clientId, sessionId);

      /* callback will be called few times: inprogress, completed */
      conn.rpc('auth', sessionId, clientId, function(message) {
        console.log("RUN AUTH STATUS: \n" + JSON.stringify(message, null, 2));

        switch(message.msg.rpcStatus) {
          case 'completed':
            var data = socket.handshake || socket.request;
            var cookies = cookie.parse(data.headers.cookie);
            var sid = cookieParser.signedCookie(cookies[config.session.cookie], config.session.secret);

            sessionStore.get(sid, function (error, sess) {
              console.info('session get: ', error, sess);
              sess.user = conn._on_behalf_of;

              sessionStore.set(sid, sess, function (error, result) {
                error && console.error(error);
              });
            });

            break;
          case 'inprogress':
            if (!message.msg.data.timeout) {
              io.emit('state-timer', message.msg);
            }

            break;
          default:
            throw Error('Unhandled RPC status: ', message.msg.rpcStatus);
        }

      });

      io.emit('state-wait');

    });

    socket.on('error', function(response) {
      console.warn('SOCKET ERROR: ', response);
    });

    socket.on('disconnect', function() {
      console.log('user disconnected: ', socket.id);
    });

  });
};



app.get('/', function(req, res) {
  var user = req.session.user || null;
  res.render('index', {user: user});
});

/* test face recognition */
app.get('/face', function(req, res) {
  res.render('face');
});

app.get('/login', auth.login());

//app.all('/logout', oidc.removetokens(), auth.logout(), function(req, res)
app.all('/logout', function(req, res) {
  sessionStore.destroy(req.session.id, function (error, sess) {
    console.info('session destroy: ', error, sess);
    req.session.destroy();
    res.redirect('/');
  });
});

//authorization endpoint
app.get('/user/authorize', oidc.auth());

//token endpoint
app.post('/user/token', oidc.token());

//user consent form
app.get('/user/consent', user.consentForm());

app.post('/user/consent', oidc.consent());

//user creation form
app.get('/user/create', user.createForm());

