var createForm = function(req, res, next) {
  return function(req, res, next) {
    res.render('createUser', {error: req.session.error});
  }
};

var consentForm = function(req, res, next) {
  return function(req, res, next) {
    res.render('consent', {scopes: req.session.scopes});
  }
};

module.exports = {
  createForm: createForm,
  consentForm: consentForm
}