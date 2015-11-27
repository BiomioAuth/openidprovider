var fs = require('fs');
var BiomioNode = require('biomio-node');
var config = {
  gateURL: 'wss://gate.biom.io:8090/websocket',
  appId: 'd33e41bdbc3cd534ceb2e87eec5e9852',
  appSecretFile: 'private-development.key',
  resources: [
    {
      rProperties: "",
      //rType: "input"
      rType: "user_input"
    }
  ]
}

var env = process.env.NODE_ENV || 'production';

try {
  var privateKey = fs.readFileSync(__dirname + '/' + config.appSecretFile).toString();
} catch (e) {
  console.error('Can\'t find/read file "private.key"!');
  process.exit(1);
}

console.info(JSON.stringify(config, null, 2));
console.info(privateKey);

var options = {
  gateURL: config.gateURL,
  appId: config.appId,
  appKey: privateKey,
  appType: 'hybrid',
  /* optional parameters */
  osId: 'linux',
  headerOid: 'clientHeader',
  devId: 'node_js_lib'
}

var clientId = 'test.open.id.provider@gmail.com';

/** establish connection to Gate */
var conn = new BiomioNode(clientId, options);

conn.on('ready', function() {
  console.info('Connection to Gate is ready!');

  /* run auth... */
  var clientId = 'test.open.id.provider@gmail.com';
  var sessionId = 'session-xxx';

  setTimeout(function() {
    conn.rpc('auth', sessionId, clientId, function(message) {
      console.info('done: ', message);
    });
  }, 2000);

});

conn.on('getResources', function(done) {
  console.info("get resources");
  done(config.resources);
});

conn.on('try:text_credentials', function(data, done) {
  console.info("TRY: \n", data);

  done('I resolve this try ', data.tryId);

});