/**
 * Created by alobashchuk on 10/12/15.
 */
var ClientInterface = require('./client_interface');

var client_interface = new ClientInterface('andriy.lobashchuk@vakoms.com.ua', function(){
    console.log('!!! READY');
    client_interface.user_exists(function(exists){
        console.log('!!! EXISTS? - ' + exists);
        if(exists){
            client_interface.run_auth(function(result){
                console.log('!!! RESULT - ' + JSON.stringify(result));
            });
        }
    });
});