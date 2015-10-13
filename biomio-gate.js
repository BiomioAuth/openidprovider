var _ = require('lodash');

var BiomioGate = function() {
  var users = [
    {
      id: 1,
      externalToken: 'external-token-success',
      email: 'success@test.dev',
      given_name: "Harry",
      middle_name: "B.",
      family_name: "Hernandez"

    },
    {
      id: 2,
      externalToken: 'external-token-fail',
      email: 'fail@test.dev',
      given_name: "Antone",
      middle_name: "J.",
      family_name: "Clark"
    },
    //{
    //  id: 3,
    //  externalToken: 'external-token-new',
    //  email: 'new@test.dev',
    //  given_name: "mavis",
    //  middle_name: "S.",
    //  family_name: "Donoghue"
    //}
  ];


  var findUserByEmail = function(email, callback) {
    var user = _.findWhere(users, {email: email});
    console.info('gate: user: ', user);
    if (user) {
      callback(null, user);
    } else {
      callback('User not found!');
    }
  };

  var findUserByToken = function(externalToken, callback) {
    var user = _.findWhere(users, {externalToken: externalToken});
    console.info('gate: user: ', user);
    if (user) {
      callback(null, user);
    } else {
      callback('User not found!');
    }
  };

  var userInfo = function(req, res, next) {

    return function (req, res, next) {
      var user = _.findWhere(users, {id: req.session.user});

      if(req.check.scopes.indexOf('profile') != -1) {
        res.json(user);
      } else {
        res.json({email: user.email});
      }
    }

  };

  return {
    findUserByEmail: findUserByEmail,
    findUserByToken: findUserByToken,
    userInfo: userInfo
  }
}


module.exports = new BiomioGate();