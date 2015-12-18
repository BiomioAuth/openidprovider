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


module.exports = {
  login: login,
  logout: logout
}