var crypto = require('crypto');
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
var cookieParser = require('cookie-parser');
var errorHandler = require('errorhandler');
var methodOverride = require('method-override');
var _ = require('lodash');
var Q = require('q');


var test = {status: 'new'};
var config = require('./config');

var ClientInterface = require('./gate-connector');

var app = express();
var server = http.Server(app);
var io = require('socket.io')(server);

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


server.listen(app.get('port'));

//http.createServer(app).listen(app.get('port'), function(){
//  console.log('Express server listening on port ' + app.get('port'));
//});


var exphbs = require('express-handlebars');
app.engine('.hbs', exphbs({defaultLayout: 'main', extname: '.hbs'}));
app.set('view engine', '.hbs');

app.use(logger('dev'));
app.use(bodyParser());
app.use(methodOverride());
app.use(cookieParser('Some Secret!!!'));

var sessionStore = new rs(config.redis);

var sessionMiddleware = expressSession({
  store: sessionStore,
  secret: 'Some Secret!!!',
  resave: true,
  saveUninitialized: true,
  cookieParser: cookieParser('Some Secret!!!')
});

app.use(sessionMiddleware);


// Enable CORS
app.use(function(req, res, next) {
  res.header('Access-Control-Allow-Origin', 'http://127.0.0.1:8000');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Credentials', "true");

  next();
});

app.use('/public',  express.static(__dirname + '/public'));
app.use('/bower_components',  express.static(__dirname + '/bower_components'));

var connections = {};

io.on('connection', function(socket) {
  console.log('a user connected');

  socket.on('check-token', function(externalToken) {
    console.log('check-token: ', externalToken);

    var conn = new ClientInterface(externalToken, function() {
      console.info('Checking user...');

      conn.user_exists(function(exists) {
        console.info('user exists ', exists);
        if (exists) {
          io.emit('check-token', {message: 'Please run mobile application and go through face recognition.'});
        } else {
          io.emit('check-token', {error: 'You are not registered yet!'});
        }
      });
    });

    connections[socket.id] = conn;
  });

  socket.on('run-auth', function(msg) {
    console.log('run-auth: ', msg);

    var conn = connections[socket.id];
    conn.run_auth(function(result) {
      console.log('!!! RESULT - ' + JSON.stringify(result));

      var data = socket.handshake || socket.request;
      var cookies = cookie.parse(data.headers.cookie);
      var sid = cookieParser.signedCookie(cookies['connect.sid'], 'Some Secret!!!');

      sessionStore.get(sid, function(error, sess) {
        sess.user = 1;

        sessionStore.set(sid, sess, function(error, result) {})
      })

      io.emit('status', result);
    });

    io.emit('run-auth');
  });

  socket.on('check-status', function(msg) {
    console.log('check-status: ', msg);
    var conn = connections[socket.id];
    var status = conn.get_current_status();
    io.emit('status', status);
  });

  socket.on('disconnect', function() {
    console.log('user disconnected');

    if (connections[socket.id]) {
      var conn = connections[socket.id];
      conn.finish();
      delete connections[socket.id];
    } else {
      console.error('socket id undefined');
    }
  });

});

app.get('/', function(req, res) {
  res.render('index', {});
});

app.get('/login', function(req, res, next) {

  req.session.test = true;
  //req.session.user = 1;
  //req.session.client_id = 1;

  console.info('LOGIN ', req.session);


  var externalToken = req.query['external_token'];
  var redirectURI = req.path;;
  var returnURL = req.query['return_url'];

  if (returnURL) {
    var params = returnURL.split('&');

    for(var i = 0; i < params.length; i++) {
      var item = params[i].split('=');

      if (item[0] == 'redirect_uri') {
        redirectURI = decodeURIComponent(item[1]);
        break;
      }
    }

  }

  if (externalToken) {

    res.render('checkToken', {
      externalToken: externalToken,
      url: returnURL
    });

    // currently externalToken is email!
    // andriy.lobashchuk@vakoms.com.ua

    //var conn = new ClientInterface(externalToken, function() {
    //  console.log('!!! READY');
    //  conn.user_exists(function(exists) {
    //    console.log('!!! EXISTS? - ' + exists);
    //    if(exists) {
    //      /** run auth process */
    //      conn.run_auth(function(result) {
    //        console.log('!!! RESULT - ' + JSON.stringify(result));
    //      });
    //    } else {
    //      /** show registration form */
    //      res.render('createUser', {message: 'You are not registered yet!'});
    //    }
    //  });
    //});

    //gate.findUserByToken(externalToken, function(error, user) {
    //
    //  if (user && user.externalToken === 'external-token-fail') {
    //    delete req.session.user;
    //    res.render('checkToken', {
    //      externalToken: externalToken,
    //      error: error,
    //      user: user,
    //      message: 'Please run mobile application and go through face recognition.',
    //      auth: false,
    //      url: redirectURI
    //    });
    //  } else if (error) {
    //    delete req.session.user;
    //    res.render('createUser', {message: 'You are not registered yet!'});
    //  } else {
    //    req.session.user = user.id
    //    res.render('checkToken', {
    //      externalToken: externalToken,
    //      error: error,
    //      user: user,
    //      message: 'Please run mobile application and go through face recognition.',
    //      auth: true,
    //      url: returnURL
    //    });
    //  }
    //});

  } else {
    res.render('login');
  }

});

var validateUser = function (req, next) {
  console.info('VALIDATE USER');
  delete req.session.error;

  if (req.body.externalToken) {

    //gate.findUserByToken(req.body.externalToken, function(error, user) {
    //  return next(error, user);
    //});
    return next(null, {id: 1});
  } else {

    //gate.findUserByEmail(req.body.email, function(error, user) {
    //  return next(error, user);
    //});

    return next(null, {id: 1});
  }

};

app.post('/login', oidc.login(validateUser),
  function (req, res, next) {
    res.redirect(req.param('return_url')||'/user');
  },
  function (err, req, res, next) {
    req.session.error = err.message;
    res.redirect(req.path);
  }
);

app.all('/logout', oidc.removetokens(), function(req, res, next) {
    req.session.destroy();
    res.redirect('/login');
});

//authorization endpoint
app.get('/user/authorize', oidc.auth());

//token endpoint
app.post('/user/token', oidc.token());

//user consent form
app.get('/user/consent', function(req, res, next) {
  res.render('consent', {scopes: req.session.scopes});
});

//process user consent form
app.post('/user/consent', oidc.consent());

//user creation form
app.get('/user/create', function(req, res, next) {
  res.render('createUser', {error: req.session.error});
});

////process user creation
//app.post('/user/create', oidc.use({policies: {loggedIn: false}, models: 'user'}), function(req, res, next) {
//  delete req.session.error;
//  req.model.user.findOne({email: req.body.email}, function(err, user) {
//      if(err) {
//          req.session.error = err;
//      } else if(user) {
//          req.session.error = 'User already exists.';
//      }
//      if(req.session.error) {
//          res.redirect(req.path);
//      } else {
//          req.body.name = req.body.given_name + ' ' + (req.body.middle_name ? req.body.middle_name + ' ' : '') + req.body.family_name;
//          req.model.user.create(req.body, function(err, user) {
//             if(err || !user) {
//                 req.session.error = err ? err : 'User could not be created.';
//                 res.redirect(req.path);
//             } else {
//                 req.session.user = user.id;
//                 res.redirect('/user');
//             }
//          });
//      }
//  });
//});

//app.get('/user', oidc.check(), function(req, res, next){
//  res.send('<h1>User Page</h1><div><a href="/client">See registered clients of user</a></div>');
//});

//User Info Endpoint
//app.get('/api/user', oidc.userInfo());

/*app.get('/api/user', oidc.check('openid', /profile|email/), gate.userInfo());*/

//Client register form
app.get('/client/register', oidc.use('client'), function(req, res, next) {

  var mkId = function() {
    var key = crypto.createHash('md5').update(req.session.user + '-' + Math.random()).digest('hex');

    req.model.client.findOne({key: key}, function(err, client) {
      if(!err && !client) {

        var secret = crypto.createHash('md5').update(key + req.session.user + Math.random()).digest('hex');
        req.session.register_client = {};
        req.session.register_client.key = key;
        req.session.register_client.secret = secret;

        res.render('createClient', {error: req.session.error, key: key, secret: secret});

      } else if(!err) {
          mkId();
      } else {
          next(err);
      }
    });
  };

  mkId();
});

//process client register
app.post('/client/register', oidc.use('client'), function(req, res, next) {
  delete req.session.error;
  req.body.key = req.session.register_client.key;
  req.body.secret = req.session.register_client.secret;
  req.body.user = req.session.user;
  req.body.redirect_uris = req.body.redirect_uris.split(/[, ]+/);

  req.model.client.create(req.body, function(err, client) {
    if(!err && client) {
      res.redirect('/client/' + client.id);
    } else {
      next(err);
    }
  });
});

app.get('/client', oidc.use('client'), function(req, res, next){
  req.model.client.find({user: req.session.user}, function(err, clients) {
    res.render('clients', {clients: clients});
  });
});

app.get('/client/:id', oidc.use('client'), function(req, res, next) {
  req.model.client.findOne({user: req.session.user, id: req.params.id}, function(err, client) {
    if(err) {
      next(err);
    } else if(client) {
      res.render('client', {client: client});
    } else {
      res.render('client', {error: 'No Client Fount! <a href="/client">Go back</a>'});
    }
  });
});

 //app.get('/user/foo', oidc.check('foo'), function(req, res, next){
 // res.send('<h1>Page Restricted by foo scope</h1>');
 //});
 //
 //app.get('/user/bar', oidc.check('bar'), function(req, res, next){
 //res.send('<h1>Page restricted by bar scope</h1>');
 //});
 //
 //app.get('/user/and', oidc.check('bar', 'foo'), function(req, res, next){
 //res.send('<h1>Page restricted by "bar and foo" scopes</h1>');
 //});
 //
 //app.get('/user/or', oidc.check(/bar|foo/), function(req, res, next){
 //res.send('<h1>Page restricted by "bar or foo" scopes</h1>');
 //});

//app.get('/test/clear', function(req, res, next) {
//    test = {status: 'new'};
//    res.redirect('/test');
//});
//
//app.get('/test', oidc.use({policies: {loggedIn: false}, models: 'client'}), function(req, res, next) {
//    var html='<h1>Test Auth Flows</h1>';
//    var resOps = {
//            "/user/foo": "Restricted by foo scope",
//            "/user/bar": "Restricted by bar scope",
//            "/user/and": "Restricted by 'bar and foo' scopes",
//            "/user/or": "Restricted by 'bar or foo' scopes",
//            "/api/user": "User Info Endpoint"
//    };
//    var mkinputs = function(name, desc, type, value, options) {
//        var inp = '';
//        switch(type) {
//        case 'select':
//            inp = '<select id="'+name+'" name="'+name+'">';
//            for(var i in options) {
//                inp += '<option value="'+i+'"'+(value&&value==i?' selected':'')+'>'+options[i]+'</option>';
//            }
//            inp += '</select>';
//            inp = '<div><label for="'+name+'">'+(desc||name)+'</label>'+inp+'</div>';
//            break;
//        default:
//            if(options) {
//                for(var i in options) {
//                    inp +=  '<div>'+
//                                '<label for="'+name+'_'+i+'">'+options[i]+'</label>'+
//                                '<input id="'+name+'_'+i+' name="'+name+'" type="'+(type||'radio')+'" value="'+i+'"'+(value&&value==i?' checked':'')+'>'+
//                            '</div>';
//                }
//            } else {
//                inp = '<input type="'+(type||'text')+'" id="'+name+'"  name="'+name+'" value="'+(value||'')+'">';
//                if(type!='hidden') {
//                    inp = '<div><label for="'+name+'">'+(desc||name)+'</label>'+inp+'</div>';
//                }
//            }
//        }
//        return inp;
//    };
//    switch(test.status) {
//    case "new":
//        req.model.client.find().populate('user').exec(function(err, clients){
//            var inputs = [];
//            inputs.push(mkinputs('response_type', 'Auth Flow', 'select', null, {code: 'Auth Code', "id_token token": 'Implicit'}));
//            var options = {};
//            clients.forEach(function(client){
//                options[client.key+':'+client.secret]=client.user.id+' '+client.user.email+' '+client.key+' ('+client.redirect_uris.join(', ')+')';
//            });
//            inputs.push(mkinputs('client_id', 'Client Key', 'select', null, options));
//            //inputs.push(mkinputs('secret', 'Client Secret', 'text'));
//            inputs.push(mkinputs('scope', 'Scopes', 'text'));
//            inputs.push(mkinputs('nonce', 'Nonce', 'text', 'N-'+Math.random()));
//            test.status='1';
//            res.send(html+'<form method="GET">'+inputs.join('')+'<input type="submit"/></form>');
//        });
//        break;
//    case '1':
//        req.query.redirect_uri=req.protocol+'://'+req.headers.host+req.path;
//        extend(test, req.query);
//        req.query.client_id = req.query.client_id.split(':')[0];
//        test.status = '2';
//        res.redirect('/user/authorize?'+querystring.stringify(req.query));
//        break;
//    case '2':
//        extend(test, req.query);
//        if(test.response_type == 'code') {
//            test.status = '3';
//            var inputs = [];
//            //var c = test.client_id.split(':');
//            inputs.push(mkinputs('code', 'Code', 'text', req.query.code));
//            /*inputs.push(mkinputs('grant_type', null, 'hidden', 'authorization_code'));
//            inputs.push(mkinputs('client_id', null, 'hidden', c[0]));
//            inputs.push(mkinputs('client_secret', null, 'hidden', c[1]));
//            inputs.push(mkinputs('redirect_uri', null, 'hidden', test.redirect_uri));*/
//            res.send(html+'<form method="GET">'+inputs.join('')+'<input type="submit" value="Get Token"/></form>');
//        } else {
//            test.status = '4';
//            html += "Got: <div id='data'></div>";
//            var inputs = [];
//            //var c = test.client_id.split(':');
//            inputs.push(mkinputs('access_token', 'Access Token', 'text'));
//            inputs.push(mkinputs('page', 'Resource to access', 'select', null, resOps));
//
//            var after =
//                "<script>" +
//                    "document.getElementById('data').innerHTML = window.location.hash; " +
//                    "var h = window.location.hash.split('&'); " +
//                    "for(var i = 0; i < h.length; i++) { " +
//                        "var p = h[i].split('='); " +
//                        "if(p[0]=='access_token') { " +
//                            "document.getElementById('access_token').value = p[1]; " +
//                            "break; " +
//                        "} " +
//                    "}" +
//                "</script>";
//            /*inputs.push(mkinputs('grant_type', null, 'hidden', 'authorization_code'));
//            inputs.push(mkinputs('client_id', null, 'hidden', c[0]));
//            inputs.push(mkinputs('client_secret', null, 'hidden', c[1]));
//            inputs.push(mkinputs('redirect_uri', null, 'hidden', test.redirect_uri));*/
//            res.send(html+'<form method="GET">'+inputs.join('')+'<input type="submit" value="Get Resource"/></form>'+after);
//        }
//        break;
//    case '3':
//        test.status = '4';
//        test.code = req.query.code;
//        var query = {
//                grant_type: 'authorization_code',
//                code: test.code,
//                redirect_uri: test.redirect_uri
//        };
//        var post_data = querystring.stringify(query);
//        var post_options = {
//            port: app.get('port'),
//            path: '/user/token',
//            method: 'POST',
//            headers: {
//                'Content-Type': 'application/x-www-form-urlencoded',
//                'Content-Length': post_data.length,
//                'Authorization': 'Basic '+Buffer(test.client_id, 'utf8').toString('base64'),
//                'Cookie': req.headers.cookie
//            }
//        };
//
//        // Set up the request
//        var post_req = http.request(post_options, function(pres) {
//            pres.setEncoding('utf8');
//            var data = '';
//            pres.on('data', function (chunk) {
//                data += chunk;
//            });
//            pres.on('end', function(){
//                try {
//                    data = JSON.parse(data);
//                    html += "Got: <pre>"+JSON.stringify(data)+"</pre>";
//                    var inputs = [];
//                    //var c = test.client_id.split(':');
//                    inputs.push(mkinputs('access_token', 'Access Token', 'text', data.access_token));
//                    inputs.push(mkinputs('page', 'Resource to access', 'select', null, resOps));
//                    /*inputs.push(mkinputs('grant_type', null, 'hidden', 'authorization_code'));
//                    inputs.push(mkinputs('client_id', null, 'hidden', c[0]));
//                    inputs.push(mkinputs('client_secret', null, 'hidden', c[1]));
//                    inputs.push(mkinputs('redirect_uri', null, 'hidden', test.redirect_uri));*/
//                    res.send(html+'<form method="GET">'+inputs.join('')+'<input type="submit" value="Get Resource"/></form>');
//                } catch(e) {
//                    res.send('<div>'+data+'</div>');
//                }
//            });
//        });
//
//        // post the data
//        post_req.write(post_data);
//        post_req.end();
//        break;
////res.redirect('/user/token?'+querystring.stringify(query));
//    case '4':
//        test = {status: 'new'};
//        res.redirect(req.query.page+'?access_token='+req.query.access_token);
//    }
//});
//
//
// var clearErrors = function(req, res, next) {
//   delete req.session.error;
//   next();
// };


