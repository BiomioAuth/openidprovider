"use strict";

var _ = require('lodash');

/**
 * Currently we keep clients locally, but in feature we are going to get them from API
 */
var ClientModel = (function() {

  var clients = [
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
  ];

  var findOne = function(condition, cb) {
    var index = _.findIndex(clients, condition);

    if (index === -1) {
      cb(null, null);
    } else {
      cb(null, clients[index]);
    }
  }

  return {
    findOne: findOne
  }
})();

module.exports = ClientModel;