'use strict';
var request = require('request');
var crypto = require('crypto');

/**
 * Proxy methods to AI API
 * @type {{sign_up: Function, update_name: Function, add_mobile_device: Function, generate_device_code: Function, check_status: Function}}
 */
var Register = (function() {

  //var URL = 'https://biom.io:4433/api/register/';
  var URL = 'https://biom.io:4433/api/profile.php/';

  function getClientKeys(clientId) {

    /** @todo: hardcoded for now */
    return {
      publicKey: 'sjP54d8vb2hf9uk',
      privateKey: 'gBf3Vfc_k1ya2_f1_F6Gsl_d30zikv'
    }
  };

  function generateHmac (data, privateKey, algorithm, encoding) {
    encoding = encoding || "base64";
    algorithm = algorithm || "sha256";
    return crypto.createHmac(algorithm, privateKey).update(data).digest(encoding);
  }

  /**
   * Create user with email
   * @param req
   * @param res
   */
  var signUp = function(req, res) {

    var email = req.body.email || null;
    var clientId = req.body.clientId || null;

    if (!clientId || !email) {
      return res.send(400, {error: 'email and clientId are required!'});
    }

    var keys = getClientKeys(clientId);
    var time = new Date().getTime();
    var data = {
      time: time,
      public_key: keys.publicKey,
      email: email
    };

    var hash = generateHmac(JSON.stringify(data), keys.privateKey);
    data.hash = hash;

    request.post({url: URL + 'sign_up', json: true, body: data}, function(err, httpResponse, body) {
      console.log(err, httpResponse.statusCode, body);

      return res.send(httpResponse.statusCode, err || body);
    });

  };

  /**
   * Update user first_name and last_name
   * @param req
   * @param res
   */
  var update = function(req, res) {

  };

  /**
   * Add mobile device with name
   * @param req
   * @param res
   */
  var addMobileDevice = function(req, res) {

  };

  /**
   * Generate verification code for mobile device
   * @param req
   * @param res
   */
  var generateDeviceCode = function(req, res) {

  };

  /**
   * Check status: if device is activated
   * @param req
   * @param res
   */
  var checkStatus = function(req, res) {

  };

  return {
    signUp: signUp,
    update: update,
    addMobileDevice: addMobileDevice,
    generateDeviceCode: generateDeviceCode,
    checkStatus: checkStatus
  }
})();

module.exports = Register;