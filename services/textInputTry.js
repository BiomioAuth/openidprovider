"use strict";

/**
 * Try handler: text_input
 * @param io - current socket connection
 * @param data
 * @param done - callback function
 */
module.exports = function(io, data, done) {

  var sessionId = data.sessionId;

  if (!io.sockets.connected[sessionId]) {
    console.warn('socketId: ' + sessionId + ' not found!');
    done('User session not found!');
    return;
  }

  var fields = {
    rProperties: JSON.parse(data.resource.rProperties),
    rType: data.resource.rType
  };

  io.sockets.connected[sessionId].emit('try:text_input', fields);
  //io.sockets.connected[sessionId].emit('state-wait');
  //io.sockets.connected[sessionId].emit('try:face', fields);
  //io.sockets.connected[sessionId].emit('state-timer', {msg: 'Please run mobile app', timeout: 300});

  io.sockets.connected[sessionId].on('text_input', function (credentials) {

    /** reformat data: [{field: '', value},{...}] */
    for (var i=0; i < credentials.length; i++) {
      credentials[i]['field'] = credentials[i]['name'];
      delete credentials[i]['name'];
    }

    for (var i=0; i < credentials.length; i++) {
      credentials[i] = JSON.stringify(credentials[i]);
    }

    done(null, credentials);
  });

}