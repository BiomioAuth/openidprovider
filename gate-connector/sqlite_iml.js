/**
 * Created by alobashchuk on 10/9/15.
 */
var sqlite3 = require('sqlite3').verbose();
var logger = require('./logger_impl');
var db;
var current_callback;

function create_table() {
    logger.log('info', 'Initializing table...');
    db.run("CREATE TABLE IF NOT EXISTS app_data (app_id TEXT, app_key TEXT)", insert_mockup_rows);
}

function insert_mockup_rows() {
    logger.log('info', 'Inserting mockup data...');
    db.all("SELECT app_id, app_key FROM app_data", function (err, rows) {
        if (!rows.length) {
            db.run("INSERT INTO  app_data (app_id, app_key) VALUES (?, ?)", '549e8e69946cc0c2c8f863b68c37148d', "-----BEGIN RSA PRIVATE KEY----- MIICXAIBAAKBgQDOqbRQZGQX+8a7SqzLMUOQTBeo62xt8FFTSBtp5nE7G6Cp7x7r 47/gMQLoDsl3pTPOgZyxwHkndJZ6Bo/YX1v7GzZqmsOevt0JEi8bau6iuSFyrmUt aI4FPRnBXJttT0PIyZNNL3hgj13JqAuw1JJUsCd/AzZQ5K9Px31JlWUv4wIDAQAB AoGAZMw3C2L7wwrlkmJIx05+8rl6bMRu/WxSbjlkTZG9NqQyB9B+l3VdF98v2Lml oDquexGSuMv1C758yoW60UEpnf71VqBqxws1O8/cnOixqZe5oiEcz+Ss2MbQWbV9 0nvjt8RnUWaSc7mjiFTzBHrFNXOCH/7wx1lCJi7+RrPG3jECQQDkduOG5oMGqR6h VKjKO3muPiXyq9aPCRz/0wBTxdnwvE3fdALkZotCrT68Z1NG6LRO0iJKm+BI2bSG Uty2Sl/ZAkEA55IlNFodAlJXRWcC5zA5CnpGJvIa9M6dvp3owE+Kj9qCe1o2VApo HYxJiHmME/S7GYW1AEqfTKv9SeQ/OJ00GwJAejwB0BNU1yN09+xLwqe/mrI1q3i0 +yJtGZLTAf9Bc8PMBloTkhArQile/35o1+95SRK0tiZgAZo5NATxgbaZQQJAed1e OOvHYmZkyQBJ9dJZ4lqwumQkrXpiZ2MAjtwNJmEu062I87c6TXp7ZBfbENF0+Rx1 QX8D0Dyeohk88BVCywJBAIqBCksFVEQtDg6JrmxyebgrdDmNjaStXL/4y4XSAK5v XqChRg3ZpJre+vnYDQPpiaw3NItj/pB6jPhdzQ2JBz4= -----END RSA PRIVATE KEY-----");
        }
        if (current_callback != null) {
            current_callback();
        }
    });
}

function close_db() {
    logger.log('info', 'Closing database connection');
    db.close();
}

function initialize_db(callback) {
    logger.log('Initializing database...');
    current_callback = callback;
    db = new sqlite3.Database('app_data.db', create_table);
}

exports.get_app_data = function (callback) {
    initialize_db(function () {
        current_callback = null;
        var connection_data = {};
        logger.log('info', 'Retrieving connection data:', connection_data);
        db.all("SELECT app_id, app_key FROM app_data", function (err, rows) {
            rows.forEach(function (row) {
                connection_data.app_id = row.app_id;
                connection_data.app_key = row.app_key;
            });
            logger.log('info', 'Retrieved connection data:', connection_data);
            close_db();
            callback(connection_data);
        });
    });
};

exports.save_data = function (app_id, app_key) {
    initialize_db(function () {
        current_callback = null;
        logger.log('info', 'Saving data into db:', app_id, app_key);
        db.all('SELECT rowid AS id FROM app_data', function (err, rows) {
            if (rows.length) {
                rows.forEach(function (row) {
                    db.run('UPDATE app_data SET app_id = ?, app_key = ? WHERE id = ?', app_id, app_key, row.id);
                });
            } else {
                db.run("INSERT INTO app_data (app_id, app_key) VALUES (?, ?)", app_id, app_key);
            }
            close_db();
        });
    });
};