exports.SOCKET_URL = "wss://gate.biom.io:8090/websocket";

var PROTO_VERSION = "1.0",
    APP_ID = null,
    OS_ID = 'linux',
    APP_TYPE = 'extension',
    HEADER_OID = 'clientHeader',
    DEV_ID = 'node_js_lib',

    RPC_PGP_NAMESPACE = 'pgp_extension_plugin',
    RPC_AUTH_CLIENT_NAMESPACE = 'auth_client_plugin',


    RPC_GET_PASS_PHRASE_METHOD = 'get_pass_phrase',
    RPC_GET_PUBLIC_KEY_METHOD = 'get_users_public_pgp_keys',
    RPC_PROCESS_AUTH_METHOD = 'process_auth',
    RPC_CHECK_USER_EXISTS_METHOD = 'check_user_exists',

    REQUEST_HEADER,
    RPC_REQUEST,
    REGISTRATION_REQUEST,
    ACK_REQUEST,
    NOP_REQUEST,
    REGULAR_REQUEST,
    REGULAR_DIGEST_REQUEST,
    BYE_REQUEST;

exports.setup_defaults = function () {
    REQUEST_HEADER = {
        protoVer: PROTO_VERSION,
        seq: 0,
        oid: HEADER_OID,
        appType: APP_TYPE,
        osId: OS_ID,
        devId: DEV_ID
    };

    if (APP_ID != null && APP_ID.length) {
        REQUEST_HEADER.appId = APP_ID;
    }

    RPC_REQUEST = {
        msg: {
            oid: 'rpcReq',
            onBehalfOf: 'STRING_USER_EMAIL',
            namespace: 'ONE OF constant namespaces',
            call: 'STRING_METHOD_NAME',
            data: {
                keys: [],
                values: []
            }
        },
        header: REQUEST_HEADER
    };

    REGISTRATION_REQUEST = {
        msg: {
            oid: "clientHello",
            secret: "STRING_VALUE"
        },
        header: REQUEST_HEADER
    };

    ACK_REQUEST = {
        msg: {
            oid: 'ack'
        },
        header: REQUEST_HEADER // + token
    };

    NOP_REQUEST = {
        msg: {
            oid: 'nop'
        },
        header: REQUEST_HEADER // + token = refresh_token
    };

    REGULAR_REQUEST = {
        msg: {
            oid: "clientHello"
        },
        header: REQUEST_HEADER

    };

    REGULAR_DIGEST_REQUEST = {
        msg: {
            oid: "auth",
            key: "STRING"
        },
        header: REQUEST_HEADER
    };

    BYE_REQUEST = {
        msg: {
            oid: "bye"
        },
        header: REQUEST_HEADER
    };
};

exports.set_app_id = function (app_id) {
    APP_ID = app_id;
    exports.setup_defaults();
};

/**
 * Generates handshake request.
 * @param {string=} secret - user defined secret
 * @returns {string}
 */
exports.get_handshake_request = function (secret) {
    var request = REGULAR_REQUEST;
    if (typeof secret !== 'undefined') {
        request = REGISTRATION_REQUEST;
        request.msg.secret = secret;
    }
    return JSON.stringify(request);
};

exports.get_ack_request = function (token) {
    var request = ACK_REQUEST;
    request.header.token = token;
    return JSON.stringify(request);
};

/**
 * Generates digest request.
 * @param {string} key - digest.
 * @param {string} token
 * @returns {string}
 */
exports.get_digest_request = function (key, token) {
    var request = REGULAR_DIGEST_REQUEST;
    request.msg.key = key;
    request.header.token = token;
    request = JSON.stringify(request.msg);
    request = '{"msg":' + request + ',"header":' + exports.get_header_string(token) + '}';
    return request;
};

/**
 * Generates custom request based on request type.
 * @param {string} request type.
 * @param {string} token
 * @returns {string}
 */
exports.get_custom_request = function (request, token) {
    request.header.token = token;
    return JSON.stringify(request);
};

exports.get_nop_request = function (token) {
    var request = NOP_REQUEST;
    request.header.token = token;
    return JSON.stringify(request);
};

/**
 * Increases socket requests counter.
 */
exports.increase_request_counter = function () {
    REQUEST_HEADER.seq += 2;
};

/**
 * Generates header for digest.
 * @param {string} token
 * @returns {string}
 */
exports.get_header_string = function (token) {
    var header = REQUEST_HEADER;
    header.token = token;
    header = '{"oid":"' + header.oid + '","seq":' + header.seq + ',"protoVer":"'
    + header.protoVer + '","appType":"' + header.appType + '","appId":"' + header.appId
    + '","osId":"' + header.osId + '","devId":"' + header.devId + '","token":"' + header.token + '"}';
    return header;
};

/**
 * Generates RPC request with given data dictionary.
 * @param {string} token
 * @param {string} method - RPC method type (name).
 * @param {string} onBehalfOf - current user email.
 * @param {Object} keyValueDict - RPC method input values
 * @returns {string}
 */
exports.get_rpc_request = function (token, method, onBehalfOf, keyValueDict) {
    var request = RPC_REQUEST;
    request.header.token = token;
    request.msg.call = method;
    request.msg.onBehalfOf = onBehalfOf;
    request.msg.call = RPC_PGP_NAMESPACE;
    request.msg.data = {
        keys: [],
        values: []
    };
    for (var key in keyValueDict) {
        if (keyValueDict.hasOwnProperty(key)) {
            request.msg.data.keys.push(key);
            request.msg.data.values.push(keyValueDict[key]);
        }
    }
    return JSON.stringify(request);
};

exports.get_rpc_auth_request = function (token, onBehalfOf, keyValueDict) {
    var request = RPC_REQUEST;
    request.header.token = token;
    request.msg.namespace = RPC_AUTH_CLIENT_NAMESPACE;
    request.msg.call = RPC_PROCESS_AUTH_METHOD;
    request.msg.onBehalfOf = onBehalfOf;
    request.msg.data = {
        keys: [],
        values: []
    };
    for (var key in keyValueDict) {
        if (keyValueDict.hasOwnProperty(key)) {
            request.msg.data.keys.push(key);
            request.msg.data.values.push(keyValueDict[key]);
        }
    }
    return JSON.stringify(request);
};

exports.get_rpc_check_user_exists_request = function (token, client_key, keyValueDict) {
    var request = RPC_REQUEST;
    request.header.token = token;
    request.msg.namespace = RPC_AUTH_CLIENT_NAMESPACE;
    request.msg.call = RPC_CHECK_USER_EXISTS_METHOD;
    request.msg.onBehalfOf = client_key;
    request.msg.data = {
        keys: [],
        values: []
    };
    for (var key in keyValueDict) {
        if (keyValueDict.hasOwnProperty(key)) {
            request.msg.data.keys.push(key);
            request.msg.data.values.push(keyValueDict[key]);
        }
    }
    return JSON.stringify(request);
};
