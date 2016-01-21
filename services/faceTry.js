"use strict";

/**
 * Try handler: face
 * @param io
 * @param data
 * @param done
 */
module.exports = function(io, data, done) {

  var sessionId = data.sessionId;

  if (!io.sockets.connected[sessionId]) {
    console.warn('socketId: ' + sessionId + ' not found!');
    done('User session not found!');
    return;
  }

  var fields = {
    //rProperties: JSON.parse(data.resource.rProperties),
    rProperties: data.resource.rProperties,
    rType: data.resource.rType,
    samples: data.samples
  };

  io.sockets.connected[sessionId].emit('try:face', fields);

  io.sockets.connected[sessionId].on('face', function (data) {
    console.info('face', data.length);
    done(null, data);
  });

  io.sockets.connected[sessionId].on('resource:face', function (data) {
    console.info('resource:face', data);
    done(null, data);
  });
}