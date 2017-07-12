'use strict';

const querystring = require('querystring');

var login = function(req, res, next) {
    return function(req, res, next) {
        var returnURL = req.query['return_url'];
        var sessionId = req.sessionID;

        var queryParams = querystring.parse(`return_url=${returnURL}`, null, null);
        console.info('***', JSON.stringify(queryParams, null, 2));

        res.render('app', {
            clientId: queryParams.client_id,
            externalToken: queryParams.external_token,
            scope: queryParams.scope,
            providerId: queryParams.provider_id,
            webResourceId: queryParams.webresource_id,
            returnUrl: returnURL,
            sessionId: sessionId,
            qrUrl: process.env.HOST + '/session/' + sessionId,
            certificateUrl: 'https://idp-dev.biom.io:460/' //hardcoded for now, should be taken from env
        });
    };
};

var loggedInPolicy = function(req, res, next) {
    console.info('loggedIn called: ', req.session);
    if (req.session.user) {
        next();
    } else {
        var params = {};

        if (req.parsedParams && req.parsedParams['external_token'] !== undefined) {
            params.external_token = req.parsedParams['external_token'];
        }

        params.return_url = req.parsedParams ? req.path + '?' + querystring.stringify(req.parsedParams) : req.originalUrl;

        res.redirect('/login?' + querystring.stringify(params));
    }
};


module.exports = {
    login: login,
    loggedInPolicy: loggedInPolicy
};