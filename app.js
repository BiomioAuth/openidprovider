'use strict';

var express = require('express');
var expressSession = require('express-session');
var http = require('http');
var path = require('path');
var cors = require('cors');
var cookie = require('cookie');
var cookieParser = require('cookie-parser');
var querystring = require('querystring');
var rs = require('connect-redis')(expressSession);
var extend = require('extend');
var bodyParser = require('body-parser');
var errorHandler = require('errorhandler');
var _ = require('lodash');
var favicon = require('serve-favicon');
var fs = require('fs');
var BiomioNode = require('biomio-node');

//var https = require('https');
//var privateKey  = fs.readFileSync('/etc/ssl/certs/biom.io.key', 'utf8');
//var certificate = fs.readFileSync('/etc/ssl/certs/biom.io.crt', 'utf8');
//var credentials = {key: privateKey, cert: certificate};


var app = express();
var server = http.Server(app);
var io = require('socket.io')(server);

var gateConnections = {};
var socketConnections = {};
var config = require('./config');
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
        loggedIn: function (req, res, next) {
            if (req.session.user) {
                next();
            } else {
                var params = {};

                if (req.parsedParams && req.parsedParams['external_token'] !== undefined) {
                    params.external_token = req.parsedParams['external_token'];
                }

                params.return_url = req.parsedParams ? req.path + '?' + querystring.stringify(req.parsedParams) : req.originalUrl;
                //console.log('XX', params.return_url);
                res.redirect(this.settings.login_url + '?' + querystring.stringify(params));
            }
        }
    },
    app: app
};

var oidc = require('./services/openidConnect').oidc(options);

if ('development' == app.get('env')) {
    app.use(errorHandler());
}

/* configure template engine */
var exphbs = require('express-handlebars');
var hbs = exphbs.create({
    // Specify helpers which are only registered on this instance.
    defaultLayout: 'main',
    extname: '.hbs'
});
app.engine('.hbs', hbs.engine);
app.set('view engine', '.hbs');

/* set middlewares */
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));
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

app.use(function (req, res, next) {
    console.info('REQ:', req.method, req.originalUrl);
    next();
});

app.set('port', process.env.PORT || 5000);

server.listen(app.get('port'));

console.info(JSON.stringify(config, null, 2));

try {
    var privateKey = fs.readFileSync(__dirname + '/' + config.appSecretFile).toString();
} catch (e) {
    console.error('Can\'t find/read file "private.key"!');
    process.exit(1);
}

var gateOptions = {
    gateURL: config.gate.websocketUrl,
    appId: config.appId,
    appKey: privateKey,
    appType: 'extension', // probe | extension | hybrid
    onTry: function (data) {
        console.info('onTry ', data);
        return ["true"];
    },

    /* optional parameters */
    osId: 'linux',
    headerOid: 'clientHeader',
    devId: 'node_js_lib'
};

function runAuth(user, socket) {
    var runAuthParams = {
        userId: user.clientId,
        sessionId: user.sessionId,
        clientId: user.externalToken,
        resources: config.resources
    };

    var conn = gateConnections[user.sessionId];

    conn.rpc('auth', runAuthParams, function (message) {
        console.info('RUN AUTH STATUS: ' + JSON.stringify(message));

        switch (message.msg.rpcStatus) {
            case 'complete':
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

                socket.emit('complete', message.msg.data);
                break;
            case 'inprogress':
                socket.emit('inprogress', message.msg.data);
                break;
            case 'fail':
                var err = message.msg.data;
                if (err.code === 'NOT_REGISTERED') {
                    socket.emit('not_exists');
                } else {
                    socket.emit('fail', message.msg.data);
                }
                break;
            default:
                throw Error('Unhandled RPC status: ', message.msg.rpcStatus);
        }
    });

}

io.on('connection', function (socket) {
    var sessionId;
    console.info('a user connected');

    socket.on('run-auth', function (user) {
        runAuth(user, socket);
    });

    socket.on('cancel', function (user) {
        var conn = gateConnections[sessionId];
        var cancelAuthParams = {
            userId: user.clientId,
            sessionId: user.sessionId,
            clientId: user.externalToken,
            resources: config.resources
        };

        if (conn) {
            conn.rpc('cancel', cancelAuthParams, function () {
                console.info('cancel sent');
            });
        }
    });

    socket.on('hello', function (sessId) {
        sessionId = sessId;
        socketConnections[sessionId] = socket;
        var conn = new BiomioNode(gateOptions);

        conn.on('ready', function () {
            console.info('Connection to Gate is ready!', sessionId);
            gateConnections[sessionId] = conn;
            socket.emit('server_hello');
        });
    });


    socket.on('error', function (response) {
        console.warn('SOCKET ON ERROR: ', response);
    });

    socket.on('disconnect', function () {
        console.log('user disconnected');

        if (gateConnections[sessionId]) {
            var conn = gateConnections[sessionId];
            conn.finish(sessionId);
            delete gateConnections[sessionId];
        } else {
            console.warn('gate connection not found');
        }

        if (socketConnections[sessionId]) {
            delete socketConnections[sessionId];
        } else {
            console.warn('socket connection not found');
        }
    });

    /** Get response from user with information of webcamera */
    // socket.on('resource:face', function(data) {
    //     console.info('XXXXXX resource:face', data);

    //     var sessionId = socket.id;
    //     var clientId = 'test.open.id.provider@gmail.com'; //hardcoded for now, it should goes from url request

    //     var rpcParams = {
    //         sessionId: sessionId,
    //         clientId: clientId
    //     };

    //     //if (data) {
    //     //  rpcParams.resources = {"front-cam": "640x480"};
    //     //} else {
    //     //  rpcParams.resources = {"input": ""};
    //     //}

    //     console.log('run-auth: ', rpcParams);

    //     /* callback will be called few times: inprogress, completed */
    //     conn.rpc('auth', rpcParams, function(message) {
    //         console.log("RUN AUTH STATUS: \n" + JSON.stringify(message, null, 2));

    //         switch (message.msg.rpcStatus) {
    //             case 'completed':
    //                 var data = socket.handshake || socket.request;
    //                 var cookies = cookie.parse(data.headers.cookie);
    //                 var sid = cookieParser.signedCookie(cookies[config.session.cookie], config.session.secret);

    //                 sessionStore.get(sid, function(error, sess) {
    //                     console.info('session get: ', error, sess);
    //                     sess.user = conn._on_behalf_of;

    //                     /** LDAP agent can return some information of user - save it in the user's session */
    //                     if (typeof message.msg.user_data !== 'undefined') {
    //                         sess.userData = message.msg.user_data;
    //                     }

    //                     sessionStore.set(sid, sess, function(error, result) {
    //                         error && console.error(error);
    //                     });
    //                 });

    //                 break;
    //             case 'inprogress':

    //                 if (!message.msg.data.timeout) {
    //                     io.emit('state-timer', message.msg);
    //                 }

    //                 break;
    //             case 'fail':
    //                 console.error(message.msg.data.error);
    //                 break;
    //             default:
    //                 throw Error('Unhandled RPC status: ', message.msg.rpcStatus);
    //         }

    //     });


    //     //// Emulate try:face request from Gate
    //     //var fields = {
    //     //  sessionId: socket.id,
    //     //  resource: {
    //     //    rProperties: "640x480",
    //     //    rType: 'front-cam'
    //     //  },
    //     //  samples: 2
    //     //};
    //     //
    //     //setTimeout(function() {
    //     //  faceTry(io, fields, function(err, result) {
    //     //    console.info('XXXXXX try:face result received: ', err, result.length);
    //     //  });
    //     //}, 3000);
    //     //// END Emulate

    // });


});

app.get('/', function (req, res) {
    var user = req.session.user || null;
    res.render('index', {user: user});
});

app.get('/login', auth.login());

//app.all('/logout', oidc.removetokens(), auth.logout(), function(req, res)
app.all('/logout', function (req, res) {
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


/** Client routes */
app.get('/client/register', oidc.use('client'), client.registerForm());

//app.post('/client/register', oidc.use('client'), client.registerAction());
app.get('/client/register', client.registerAction());

app.post('/session/:sessionID', function (req, res) {
    var conn = new BiomioNode(gateOptions);
    var sessionId = req.params.sessionID;

    conn.on('ready', function () {
        var getUserParams = {
            userId: '',
            sessionId: sessionId,
            clientId: req.body['app_id'],
            resources: config.resources
        };

        conn.rpc('get_user', getUserParams, function (result) {
            if (result && result.msg) {
                socketConnections[sessionId].emit('run-auth', result.msg.data);
            }
        });
    });
    res.send();
});