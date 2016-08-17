/*var validate = function (req, next) {
  console.info('VALIDATE USER');
  delete req.session.error;

  if (req.body.externalToken) {

    return next(null, {id: 1});
  } else {

    return next(null, {id: 1});
  }

};

var validateSuccess = function (req, res, next) {
  res.redirect(req.param('return_url')||'/user');
};

var validateFail = function (err, req, res, next) {
  req.session.error = err.message;
  res.redirect(req.path);
};
 */
var logout = function(req, res, next) {
  return function(req, res, next) {
    //req.session.destroy();
    //
    ////res.redirect('/');
  }
};

var login = function(req, res, next) {
  return function(req, res, next) {
    var externalToken = req.query['external_token'];
    var redirectURI = req.path;
    var sessionID = req.sessionID;
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
      res.render('checkToken', {
        externalToken: externalToken,
        url: returnURL
      });
    } else {
      res.render('login', {
        url: returnURL,
        sessionID: sessionID,
        qrUrl: 'http://biom.io:' + process.env.PORT + '/session/' + sessionID
     });
    }
  }
};


module.exports = {
  login: login,
  logout: logout
}