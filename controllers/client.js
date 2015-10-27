var crypto = require('crypto');

var registerForm = function(req, res, next) {
  return function(req, res, next) {
    var mkId = function () {
      var key = crypto.createHash('md5').update(req.session.user + '-' + Math.random()).digest('hex');

      req.model.client.findOne({key: key}, function (err, client) {
        if (!err && !client) {

          var secret = crypto.createHash('md5').update(key + req.session.user + Math.random()).digest('hex');
          req.session.register_client = {};
          req.session.register_client.key = key;
          req.session.register_client.secret = secret;

          res.render('createClient', {error: req.session.error, key: key, secret: secret});

        } else if (!err) {
          mkId();
        } else {
          next(err);
        }
      });
    };

    mkId();
  }
};

var registerAction = function(req, res, next) {
  return function(req, res, next) {
    delete req.session.error;
    req.body.key = req.session.register_client.key;
    req.body.secret = req.session.register_client.secret;
    req.body.user = req.session.user;
    req.body.redirect_uris = req.body.redirect_uris.split(/[, ]+/);

    req.model.client.create(req.body, function (err, client) {
      if (!err && client) {
        res.redirect('/client/' + client.id);
      } else {
        next(err);
      }
    });
  }
};

var getAll = function(req, res, next) {
  req.model.client.findOne({user: req.session.user, id: req.params.id}, function(err, client) {
    if(err) {
      next(err);
    } else if(client) {
      res.render('client', {client: client});
    } else {
      res.render('client', {error: 'No Client Fount! <a href="/client">Go back</a>'});
    }
  });
};

var get = function(req, res, next) {
  req.model.client.find({user: req.session.user}, function(err, clients) {
    res.render('clients', {clients: clients});
  });
};

module.exports = {
  registerForm: registerForm,
  registerAction: registerAction,
  getAll: getAll,
  get: get
}