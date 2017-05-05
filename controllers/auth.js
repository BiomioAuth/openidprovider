'use strict';

const querystring = require('querystring');

var login = function(req, res, next) {
    return function(req, res, next) {

        var returnURL = req.query['return_url'];
        var sessionId = req.sessionID;

        // if (returnURL) {
        //     var params = returnURL.split('&');

        //     for (var i = 0; i < params.length; i++) {
        //         var item = params[i].split('=');

        //         if (item[0] == 'redirect_uri') {
        //             redirectURI = decodeURIComponent(item[1]);
        //             break;
        //         }
        //     }
        // }

        let queryParams = querystring.parse(`return_url=${returnURL}`, null, null);
        console.info('***', JSON.stringify(queryParams, null, 2));

        res.render('app', {
            clientId: queryParams.client_id,
            externalToken: queryParams.external_token,
            scope: queryParams.scope,
            redirect_uri: queryParams.redirect_uri,
            sessionId: sessionId,
            qrUrl: process.env.HOST + '/session/' + sessionId
        });

        // if (externalToken) {
        //     res.render('checkToken', {
        //         externalToken: externalToken,
        //         url: returnURL
        //     });
        // } else {
        //     res.render('login', {
        //         url: returnURL
        //     });
        // }
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
}


module.exports = {
    login: login,
    loggedInPolicy: loggedInPolicy
}