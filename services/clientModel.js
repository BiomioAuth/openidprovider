"use strict";

var config = require('../config');
var request = require('request');

var ClientModel = (function() {

/*
    {
      "id": 1,
      "name": "Client (has LDAP)",
      "redirect_uris": [
        "http://oidc.surge.sh/callback.html"
      ],
      "key": "56ce9a6a93c17d2c867c5c293482b8f9",
      "secret": "85a879a19387afe791039a88b354a374",
      "user": "biomio.vk.test@gmail.com",
      "credentialsFlow": false,
      "createdAt": "2015-09-21T09:51:44.164Z",
      "updatedAt": "2015-09-21T09:51:44.164Z"
    }
*/

  var findOne = function(condition, cb) {
    var endpoint = config.api + '/get_client_info/' + condition.id;
    request.post({url: endpoint}, function(err, httpResponse, body) {

      try {
        body = JSON.parse(body);
      } catch(Ex) {
        console.error(Ex);
        cb(ex, null);
        return;
      }

      if (!err && body) {
        body.key = condition.id;
        body.credentialsFlow = false;
        body.user = "biomio.vk.test@gmail.com";

        cb(null, body);
      } else {
        cb(err, null);
      }
    });
  }

  return {
    findOne: findOne
  }
})();

module.exports = ClientModel;