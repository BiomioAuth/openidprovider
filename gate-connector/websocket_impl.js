/**
 * Created by alobashchuk on 9/30/15.
 */
var WebSocketClient = require('websocket').client;
var logger = require('./logger_impl');
var socket_helper = require('./socket_helper');
var db_storage = require('./sqlite_iml');
var rsa_sign = require('jsrsasign');

var connection_client = new WebSocketClient();
var message_listener_func;
var error_callback_func;

var current_connection = {connected: false};

var keep_alive_interval;
var refresh_token_interval;
var connection_data = {
    token: '',
    refresh_token: '',
    session_ttl: '',
    connection_ttl: '',
    rsa_key: '',
    app_id: ''
};

var send_client_hello = function () {
    db_storage.get_app_data(function (existing_app_data) {
        var request;
        socket_helper.setup_defaults();
        if (existing_app_data.hasOwnProperty('app_id') && existing_app_data.hasOwnProperty('app_key')) {
            connection_data.app_id = existing_app_data.app_id;
            logger.log('info', 'Getting regular handshake request with app_id: ', connection_data.app_id);
            connection_data.rsa_key = existing_app_data.app_key;
            socket_helper.set_app_id(existing_app_data.app_id);
            request = socket_helper.get_handshake_request();
        } else {
            logger.log('info', 'Getting registration handshake.');
            request = socket_helper.get_handshake_request('TEST_SECRET');
        }
        connection_client._send_request(request);
    });
};

var refresh_token = function () {
    if (connection_data.session_ttl > 0) {
        refresh_token_interval = setInterval(function () {
            logger.log('info', 'Refresh Token nop');
            if (current_connection.connected) {
                connection_client._send_request(socket_helper.get_nop_request(connection_data.refresh_token));
            } else {
                clearInterval(refresh_token_interval);
            }
        }, (connection_data.session_ttl - 4000));
    }
};


var keep_alive = function () {
    if (connection_data.connection_ttl > 0) {
        keep_alive_interval = setInterval(function () {
            logger.log('info', 'Keep Alive nop, connection connected: ', current_connection.connected);
            if (current_connection.connected) {
                connection_client._send_request(socket_helper.get_nop_request(connection_data.token));
            } else {
                clearInterval(keep_alive_interval);
            }
        }, (connection_data.connection_ttl - 4000));
    }
};

connection_client.on('connectFailed', function (error) {
    logger.log('error', 'Failed to connect to server:', error.toString());
    error_callback_func(error);
});

connection_client.on('connect', function (connection) {
    logger.log('info', 'Connection established');
    current_connection = connection;
    connection.on('error', function (error) {
        logger.log('error', 'Connection Error:', error.toString());
        error_callback_func(error);
    });
    connection.on('close', function () {
        logger.log('info', 'Connection closed.');
        error_callback_func();
    });
    connection.on('message', function (message) {
        var message_data = message.utf8Data;
        logger.log('info', 'Received message:', message_data);
        message_listener_func(message_data);
    });

    connection_client._send_request = function (request) {
        if (connection.connected) {
            logger.log('info', 'Sending request through socket:', request);
            connection.sendUTF(request);
            socket_helper.increase_request_counter();
            clearInterval(keep_alive_interval);
            keep_alive();
        } else {
            logger.log('warn', 'Socket is not connected.');
        }
    };

    send_client_hello();
});

exports.set_connection_data = function (connection_data_json) {
    connection_data.token = connection_data_json.header.token;
    connection_data.refresh_token = connection_data_json.msg['refreshToken'];
    connection_data.session_ttl = connection_data_json.msg['sessionttl'] * 1000;
    connection_data.connection_ttl = connection_data_json.msg['connectionttl'] * 1000;
    if ('key' in connection_data_json.msg && 'fingerprint' in connection_data_json.msg) {
        var app_id = connection_data_json.msg['fingerprint'];
        var app_key = connection_data_json.msg.key;
        logger.log('info', 'Received app ID and app KEY from server: ', app_id, app_key);
        db_storage.save_data(app_id, app_key);
        socket_helper.set_app_id(app_id);
    }
};

exports.set_nop_tokens = function (connection_data_json) {
    if (connection_data.token != connection_data_json.header.token) {
        connection_data.token = connection_data_json.header.token;
        clearInterval(refresh_token_interval);
        refresh_token();
    }
};

exports.start_connection_loops = function () {
    clearInterval(refresh_token_interval);
    clearInterval(keep_alive_interval);
    keep_alive();
    refresh_token();
};

exports.send_digest_request = function () {
    var rsa_key = new rsa_sign.RSAKey();
    rsa_key.readPrivateKeyFromPEMString(connection_data.rsa_key);
    logger.log('debug', 'RSAKey: ', rsa_key);
    var signature = rsa_key.signString(socket_helper.get_header_string(connection_data.token), 'sha1');
    logger.log('info', 'Generated digest: ', signature);
    connection_client._send_request(socket_helper.get_digest_request(signature, connection_data.token));
};

exports.reset_connection_data = function () {
    connection_data = {
        token: '',
        refresh_token: '',
        session_ttl: '',
        connection_ttl: ''
    };
};

exports.initialize_connection = function (message_listener, error_callback) {
    message_listener_func = message_listener;
    error_callback_func = error_callback;
    connection_client.connect(socket_helper.SOCKET_URL);
};

exports.send_ack_request = function () {
    connection_client._send_request(socket_helper.get_ack_request(connection_data.token));
};

exports.send_check_user_request = function (client_key) {
    connection_client._send_request(socket_helper.get_rpc_check_user_exists_request(connection_data.token, client_key,
        {client_key: client_key}));
};

exports.send_rpc_auth_request = function(on_behalf_of){
    connection_client._send_request(socket_helper.get_rpc_auth_request(connection_data.token, on_behalf_of,
        {email: on_behalf_of, auth_code: 'NO_REST'}));
};
