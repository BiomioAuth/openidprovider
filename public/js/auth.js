
var App = (function() {

  var flow = 'email'; // email or token
  var redirectBackTimeout = 3000;
  var socket = io();
  var registerUrl = '/user/create/';
  var $id;
  var redirectUrl;
  var $messageHolder;
  var $timer;
  var timerInstance;

  var init = function(options) {
    flow = options.flow === 'token' ? 'token' : 'email';
    $id = options.idHolder;
    redirectUrl = options.redirectUrl;
    $messageHolder = options.messageHolder;
    $timer = options.timerHolder;

    initSocket();
  };

  var initSocket = function() {
    socket.on('check-token', function (response) {
      console.info('check-token: ', response);
      if (response) {
        console.info('run auth');
        socket.emit('run-auth', $id.val());
      } else {
        register();
      }
    });

    socket.on('status', function (response) {
      console.info('status: ', response);

      showMessage(response.msg);

      if (response.timeout == null) {
        hideTimer();
      }

      switch(response.status) {
        case 'error':
          hideTimer();
          showMessage(response.msg + '<a href="#" onclick="App.tryAgain();" class="btn btn-primary btn-sm"> Try again</a>');
          break;
        case 'completed':
          hideTimer();
          showMessage(response.msg + '<br> You will be returned back to site');
          redirect();
          break;
        case 'in_progress':
          showMessage(response.msg);
          setTimer(response.timeout);
          break;
        case 'not_exists':
          register();
          break;
        case null: break;
        default: break;
      }

    });
  };

  var run = function() {
    console.info('run');
    var id = $id.val();
    /* validate form */
    if (!id) {
      alert('Email can`t be empty!');
      return false;
    }

    /* hide form */
    $('form').fadeOut();

    socket.emit('check-token', id);
  };

  var tryAgain = function() {
    if (flow === 'token') {
      clearMessage();
      hideTimer();
      var id = $id.val();
      socket.emit('check-token', id);
    } else {
      clearMessage();
      hideTimer();
      $('form').fadeIn();
    }
  };

  var register = function() {
    if (flow === 'token') {
      showMessage('You are not registered, please register first. <br> <a href="' + registerUrl + '" class="btn btn-primary btn-sm">Register</a>');
    } else {
      showMessage('You are not registered, please register first. <br> <a href="' + registerUrl + '" class="btn btn-primary btn-sm">Register</a>  <a href="#" onclick="App.tryAgain();return false;" class="btn btn-primary btn-sm">Try another email</a>');
    }
  };

  var redirect = function(msg) {
    if (msg) {
      showMessage(msg);
    }

    setTimeout(function () {
      document.location.replace(redirectUrl);
    }, redirectBackTimeout);
  };

  var setTimer = function(duration) {
    $timer.show();

    var start = Date.now();
    var diff;
    var minutes;
    var seconds;

    function timer() {
      diff = duration - (((Date.now() - start) / 1000) | 0);

      minutes = (diff / 60) | 0;
      seconds = (diff % 60) | 0;

      minutes = minutes < 10 ? "0" + minutes : minutes;
      seconds = seconds < 10 ? "0" + seconds : seconds;

      $timer.text(minutes + ":" + seconds);

      if (diff <= 0) {
        start = Date.now() + 1000;
        hideTimer();
        showMessage('Time is out! Need more time? <a href="#" onclick="App.tryAgain();" class="btn btn-primary btn-sm"> Try again</a>');
      }
    };

    timer();
    timerInstance = setInterval(timer, 1000);
  };

  var hideTimer = function () {
    clearInterval(timerInstance);
    $timer.text('').hide();
  };

  var showMessage = function(message) {
    var html = '<p class="msg text-info text-center bg-info">' + message + '</p>';
    $messageHolder.html(html);
  };

  var clearMessage = function() {
    $messageHolder.html('');
  };

  return {
    init: init,
    run: run,
    tryAgain: tryAgain
  }

})();