var logout = function(req, res, next) {
  req.session.destroy();
  res.redirect('/login');
};

var validate = function (req, next) {
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

var validateSuccess = function (req, res, next) {
  res.redirect(req.param('return_url')||'/user');
};

var validateFail = function (err, req, res, next) {
  req.session.error = err.message;
  res.redirect(req.path);
};

var login = function(req, res, next) {

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
  } else {
    res.render('login');
  }
};

module.exports = {
  login: login,
  logout: logout,
  validate: validate,
  validateSuccess: validateSuccess,
  validateFail:validateFail
}