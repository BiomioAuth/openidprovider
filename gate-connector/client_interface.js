/**
 * Created by alobashchuk on 10/12/15.
 */
var StateMachine = require('javascript-state-machine');
var logger = require('./logger_impl');
var internal_state_machine = require('./state_machine_impl');

function ClientInterface(client_key, ready_callback) {
    this._client_key = client_key;
    this._ready_callback = ready_callback;
    this._STATE_INITIALIZE = 'initialize_state';
    this._STATE_READY = 'ready_state';
    this._STATE_RPC_CALL_AUTH = 'rpc_call_auth_state';
    this._STATE_RPC_CALL_USER_CHECK = 'rpc_call_user_check';
    this._STATE_FINISH = 'finish_state';
    this._on_behalf_of = null;
    this._status = null;
    this._result = false;
    this._msg = null;
    this._timeout = null;
    this._client_callback = null;
    this._state_machine = StateMachine.create({
        initial: 'none',
        events: [
            {name: '_initialize', from: 'none', to: this._STATE_INITIALIZE},
            {
                name: '_ready',
                from: [this._STATE_INITIALIZE, this._STATE_RPC_CALL_AUTH, this._STATE_RPC_CALL_USER_CHECK],
                to: this._STATE_READY
            },
            {name: '_rpc_auth', from: this._STATE_READY, to: this._STATE_RPC_CALL_AUTH},
            {name: '_check_user', from: this._STATE_READY, to: this._STATE_RPC_CALL_USER_CHECK},
            {name: '_finish', from: '*', to: this._STATE_FINISH}
        ],
        callbacks: {
            on_initialize: this._onInitialize,
            on_ready: this._onReady,
            on_rpc_auth: this._onRpcCallAuth,
            on_check_user: this._onCheckUser,
            on_finish: this._onFinish
        }
    });
    var self = this;
    this._state_machine._initialize('Initializing internal state machine.', self);
}

ClientInterface.prototype._onInitialize = function (event, from, to, msg, self) {
    if (typeof  msg != 'undefined' && msg) {
        logger.log('info', msg);
    } else {
        logger.log('info', 'Initializing internal state machine.');
    }
    if (!internal_state_machine.is_ready()) {
        internal_state_machine.add_ready_callback(self._get_internal_ready_callback(self));
        if (internal_state_machine.is_disconnected()) {
            internal_state_machine.connect('Initializing socket connection');
        }
    } else {
        self._get_internal_ready_callback(self)();
    }
};

ClientInterface.prototype._get_internal_ready_callback = function (self) {
    return function (error) {
        if (typeof error != 'undefined' && error) {
            logger.log('warn', 'Error during initialization: ', error.error);
            self._state_machine._finish('Error during initialization: ' + error.error);
        } else {
            self._state_machine._ready('Client interface is ready.', self);
        }
    };
};

ClientInterface.prototype._onReady = function (event, from, to, msg, curr_this) {
    logger.log('info', msg);
    if (from == curr_this._STATE_INITIALIZE) {
        curr_this._ready_callback();
    }
};

ClientInterface.prototype._onRpcCallAuth = function (event, from, to, msg, curr_this) {
    logger.log('info', msg);
    internal_state_machine.run_verification(curr_this._on_behalf_of);
};

ClientInterface.prototype._onCheckUser = function (event, from, to, msg, curr_this) {
    logger.log('info', msg);
    internal_state_machine.check_if_user_exists(curr_this._client_key, curr_this._get_rpc_response_callback(curr_this));
};

ClientInterface.prototype._onFinish = function (event, from, to, msg, curr_this) {
    logger.log('info', msg);
    internal_state_machine.unsubscribe_from_responses(curr_this._on_behalf_of);
};

ClientInterface.prototype._get_rpc_response_callback = function (self) {
    return function (response) {
        var client_cbk = self._client_callback;
        logger.log('info', 'Received RPC response: ', response);
        var result = false;
        var switch_to_ready = true;
        if ('error' in response) {
            if (client_cbk != null) {
                if (self._state_machine.is(self._STATE_RPC_CALL_USER_CHECK)) {
                    client_cbk(false);
                } else {
                    client_cbk({result: false, status: 'error', msg: response.error});
                }
            }
            self._state_machine._finish('Received error from internal state machine: ' + response.error, self);
        }
        if (self._state_machine.is(self._STATE_RPC_CALL_USER_CHECK)) {
            self._client_callback = null;
            for (var i = 0; i < response.keys.length; i++) {
                if (response.keys[i] == 'exists') {
                    if (!response.values[i]) {
                        result = false;
                        break;
                    }
                } else if (response.keys[i] == 'email') {
                    self._on_behalf_of = response.values[i];
                    internal_state_machine.subscribe_for_responses(self._on_behalf_of, self._get_rpc_response_callback(self));
                    result = true;
                }

            }
        } else if (self._state_machine.is(self._STATE_RPC_CALL_AUTH)) {
            if (response.keys.indexOf('error') != -1) {
                self._result = false;
                self._status = 'error';
                self._msg = response.values[0];
                self._timeout = null;
            } else if (response.status == 'inprogress') {
                self._status = 'in_progress';
                self._timeout = response.values[1];
                self._msg = response.values[0];
                self._result = false;
            } else {
                self._result = true;
                self._status = 'completed';
                self._timeout = null;
                self._msg = 'Authentication was successful';
            }
            if (self._status == 'complete' || self._status == 'error') {
                self._client_callback = null;
            }else{
                switch_to_ready = false;
            }
            result = self.get_current_status();
        }
        if(switch_to_ready){
            self._state_machine._ready('Finished RPC processing, becoming READY.', self);
        }
        if(client_cbk != null){
            setTimeout(function(){
                client_cbk(result);
            }, 1);
        }
    };
};


ClientInterface.prototype.user_exists = function (response_callback) {
    var self = this;
    if (self._state_machine.is(self._STATE_FINISH)) {
        logger.log('warn', 'Client interface is not initialized. See logs.');
        response_callback(false);
    } else {
        self._client_callback = response_callback;
        self._state_machine._check_user('Check if user - ' + self._client_key + ' exists.', self);
    }
};

ClientInterface.prototype.run_auth = function (response_callback) {
    var self = this;
    if (self._state_machine.is(self._STATE_FINISH)) {
        logger.log('warn', 'Client interface is not initialized. See logs.');
        response_callback({result: false, status: 'error', msg: 'Client interface is not initialized. See logs.'});
    } else {
        if (self._on_behalf_of == null) {
            self._status = 'not_exists';
            self._result = false;
            self._msg = 'It is required to check if user exists first.';
            self._timeout = null;
            response_callback(self.get_current_status());
        } else {
            self._client_callback = response_callback;
            self._state_machine._rpc_auth('Running authentication on behalf of - ' + self._on_behalf_of, self);
        }
    }
};

ClientInterface.prototype.get_current_status = function () {
    return {
        result: this._result,
        status: this._status,
        msg: this._msg,
        timeout: this._timeout
    };
};

module.exports = ClientInterface;
