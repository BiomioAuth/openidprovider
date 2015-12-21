'use strict';

var querystring = require('querystring');

var login = function(req, res, next) {
  return function(req, res, next) {

    var externalToken = req.query['external_token'];
    var redirectURI = req.path;

    var returnURL = req.query['return_url'];

    if (returnURL) {
      var params = returnURL.split('&');

      for (var i = 0; i < params.length; i++) {
        var item = params[i].split('=');

        if (item[0] == 'redirect_uri') {
          redirectURI = decodeURIComponent(item[1]);
          break;
        }
      }
    }

    if (externalToken) {
      res.render('auth', {
        externalToken: externalToken,
        url: returnURL
      });
    } else {
      res.render('login', {
        url: returnURL
      });
    }
  }
};

var loggedInPolicy = function(req, res, next) {
    console.info('loggedIn called: ', req.session);
    if(req.session.user) {
      next();
    } else {
      var params = {};

      if (req.parsedParams && req.parsedParams['external_token'] !== undefined) {
        params.external_token = req.parsedParams['external_token'];
      }

      params.return_url = req.parsedParams ? req.path + '?' + querystring.stringify(req.parsedParams) : req.originalUrl;

      res.redirect('/login?' + querystring.stringify(params));
    }
}


module.exports = {
  login: login,
  loggedInPolicy: loggedInPolicy
}