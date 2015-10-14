var ClientInterface = require('./client_interface');

var client_interface = new ClientInterface('andriy.lobashchuk@vakoms.com.ua', function () {
    console.log('!!! READY');
    client_interface.user_exists(function (exists) {
        console.log('!!! EXISTS? - ' + exists);
        if (exists) {
            client_interface.run_auth(function (result) {
                console.log('!!! RESULT - ' + JSON.stringify(result));
            });
        }
    });
});

// Parallel test..
//var client_interface2 = new ClientInterface('biomio.vk.test@gmail.com', function () {
//    console.log('!!! READY');
//    client_interface2.user_exists(function (exists) {
//        console.log('!!! EXISTS? - ' + exists);
//        if (exists) {
//            client_interface2.run_auth(function (result) {
//                console.log('!!! RESULT - ' + JSON.stringify(result));
//            });
//        }
//    });
//});