'use strict';

var express = require('express');
var expressSession = require('express-session');
var http = require('http');
var path = require('path');
var cors = require('cors');
var cookie = require('cookie');
var cookieParser = require('cookie-parser');
var rs = require('connect-redis')(expressSession);
var bodyParser = require('body-parser');
var errorHandler = require('errorhandler');
var _ = require('lodash');
var favicon = require('serve-favicon');
var fs = require('fs');
var BiomioNode = require('biomio-node');

var app = express();
var server = http.Server(app);
var io = require('socket.io')(server);

var config = require('./config');
var client = require('./controllers/client');
var clientModel = require('./services/clientModel');
var user = require('./controllers/user');
var auth = require('./controllers/auth');

var env = process.env.NODE_ENV || 'production';


var options = {
  login_url: '/login',
  consent_url: '/user/consent',
  connections: {
    def: {
      adapter: 'redis',
      host: config.redis.host,
      port: config.redis.port
    }
  },
  policies: {
    loggedIn: auth.loggedInPolicy
  },
  client: clientModel, // custom client's model
  app: app
};

var openId = require('./services/openIdConnect').oidc(options);
var textInputTry = require('./services/textInputTry');
var faceTry = require('./services/faceTry');

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

try {
  var privateKey = fs.readFileSync(__dirname + '/' + config.appSecretFile).toString();
} catch (e) {
  console.error('Can\'t find/read file "private.key"!');
  process.exit(1);
}

console.info(config);

var gateOptions = {
  gateURL: config.gate.websocketUrl,
  appId: config.appId,
  appKey: privateKey,
  appType: 'hybrid',
  /* optional parameters */
  osId: 'linux',
  headerOid: 'clientHeader',
  devId: 'open_id_provider'
}

/** establish connection to Gate */
var conn = new BiomioNode(gateOptions);

conn.on('ready', function() {
  console.info('Connection to Gate is ready!');

  /* run socket to enduser */
  initUsersSocket();
});

conn.on('getResources', function(done) {
  // @todo: looks like we will not use this handler in feature
  done(config.resources);
});

conn.on('try:face', function(data, done) {
  console.info("TRY: \n", data);

  //resource =                 {
  //  rProperties = 1280x720;
  //  rType = "front-cam";
  //};
  //samples = 1;
  //tType = face;


  faceTry(io, data, done);
});

conn.on('try:text_input', function(data, done) {
  console.info("TRY: \n", data);
  textInputTry(io, data, done);
});

/**
 * Handle requests from users (frontend part)
 */
var initUsersSocket = function() {
  io.on('connection', function(socket) {
    console.info('user connected: ', socket.id);


    /** Get response from user with information of webcamera */
    socket.on('resource:face', function (data) {
      console.info('XXXXXX resource:face', data);

      var sessionId = socket.id;
      var clientId = 'test.open.id.provider@gmail.com'; //hardcoded for now, it should goes from url request

      var rpcParams = {
        sessionId: sessionId,
        clientId: clientId
      };

      if (data) {
        rpcParams.resources = {"front-cam": "640x480"};
      } else {
        rpcParams.resources = {"input": ""};
      }

      console.log('run-auth: ', rpcParams);

      /* callback will be called few times: inprogress, completed */
      conn.rpc('auth', rpcParams, function(message) {
        console.log("RUN AUTH STATUS: \n" + JSON.stringify(message, null, 2));

        switch(message.msg.rpcStatus) {
          case 'completed':
            var data = socket.handshake || socket.request;
            var cookies = cookie.parse(data.headers.cookie);
            var sid = cookieParser.signedCookie(cookies[config.session.cookie], config.session.secret);

            sessionStore.get(sid, function (error, sess) {
              console.info('session get: ', error, sess);
              sess.user = conn._on_behalf_of;

              /** LDAP agent can return some information of user - save it in the user's session */
              if (typeof message.msg.user_data !== 'undefined') {
                sess.userData = message.msg.user_data;
              }

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
          case 'fail':
            console.error(message.msg.data.error);
            break;
          default:
            throw Error('Unhandled RPC status: ', message.msg.rpcStatus);
        }

      });


      // Emulate try:face request from Gate
      var fields = {
        sessionId: socket.id,
        resource: {
          rProperties: "640x480",
          rType: 'front-cam'
        },
        samples: 2
      };

      setTimeout(function() {
        faceTry(io, fields, function(err, result) {
          console.info('XXXXXX try:face result received: ', err, result.length);
        });
      }, 3000);
      // END Emulate

    });


    socket.on('run-auth', function(email) {

      /* @todo: remember email (if exists) in user socket session */

      /** display "wait" screen */
      io.emit('state-wait');

      /** Get webcamera resolutions, if it exists and enduser allows access to it */
      io.emit('resource:face');

    });

    socket.on('error', function(response) {
      console.warn('SOCKET ERROR: ', response);
    });

    socket.on('disconnect', function() {
      console.log('user disconnected: ', socket.id);
    });

  });
};



/**
 * Common routes
 */

app.get('/', function(req, res) {
  var user = req.session.user || null;
  res.render('index', {user: user});
});

app.get('/login', auth.login());

app.all('/logout', openId.removetokens(), function(req, res) {
  sessionStore.destroy(req.session.id, function (error, sess) {
    console.info('session destroy: ', error, sess);
    req.session.destroy();
    res.redirect('/');
  });
});

//authorization endpoint
app.get('/user/authorize', openId.auth());

//token endpoint
app.post('/user/token', openId.token());

//user consent form
app.get('/user/consent', user.consentForm());
app.post('/user/consent', openId.consent());

//user creation form
//app.get('/user/create', user.createForm());

app.get('/api/user', openId.check('openid', /profile|email/), openId.use({models: ['access']}), function(req, res) {

  var access_token = req.param('access_token');
  if (!access_token) {
    access_token = (req.headers['authorization'] || '').indexOf('Bearer ') === 0 ? req.headers['authorization'].replace('Bearer', '').trim() : false;
  }
  req.model.access
    .findOne({token: access_token})
    .exec(function (err, access) {
      if (!err && access) {
        res.send({user: access.user});
      } else {
        res.send(400, {})
      }
    });

});



// TEST API
//clientModel.findOne({id: 'g0_9uVoeK4b048a'}, function(err, client) {
//  console.info(err, client);
//})

//// test consent page
//app.get('/c', function(req, res) {
//  var scopes = {};
//  scopes['openid'] = {explain: 'Informs the Authorization Server that the Client is making an OpenID Connect request.'};
//  scopes['profile'] = {explain: 'Access to the End-User\'s default profile Claims.'};
//
//  scopes['email'] = {explain: 'Access to the email and email_verified Claims.'};
//  scopes['address'] = {explain: 'Access to the address Claim.'};
//  scopes['phone'] =  {explain: 'Access to the phone_number and phone_number_verified Claims.'};
//  scopes['offline_access'] = {explain: 'Grants access to the End-User\'s UserInfo Endpoint even when the End-User is not present (not logged in).'};
//
//  res.render('consent', {scopes: scopes});
//});