var Face = function (params) {
  "use strict";

  var self = this;

  self.stack = [];
  self.ctx = null;
  self.debug = params.debug || false;
  self.samplesCount = params.samplesCount || 3;
  self.validateFrameCount = params.validateFrameCount || 10;
  self.allowedDeltaSq = params.allowedDeltaSq || 0.25;
  self.allowedDeltaCenter = params.allowedDeltaCenter || 0.1
  self.$element = params.$element;
  self.samples = [];
  self.finish = false;
  self.photos = []; // store photos from webcam

  /** init DOM structure */
  var html = {};
  html.video = $("<video/>", {id: "webcam", width: "400", height: "300", style: "display:none;"});
  html.canvas = $("<div/>", {style: "width:400px;height:300px;margin: 0px auto;"})
      .append($("<canvas />", {id: "canvas", width: "400", height: "300"}))
      .append($("<div />", {id: "no_rtc", class: "alert alert-error", style: "display:none;"}));

  html.faceBoundFail = $("<div />", {class: "face-bound-fail"});
  html.faceBoundSuccess = $("<div />", {class: "face-bound-success"});
  html.faceSamples = $("<div />", {class: "face-samples"})
      .append($("<div />", {class: "face-samples--progress"}))
      .append($("<div />", {class: "face-samples--text"}))

  self.$element
    .append(html.video)
    .append(html.canvas)
    .append(html.faceBoundFail)
    .append(html.faceBoundSuccess)
    .append(html.faceSamples);

  /** save used DOM elements in variables */
  self.$canvas = $('#canvas', self.$element);
  self.$nortc = $('#no_rtc', self.$element);
  self.$samplesText = $('.face-samples--text', self.$element);
  self.$samplesProgress = $('.face-samples--progress', self.$element);
  self.$faceBoundFail = $('.face-bound-fail', self.$element);
  self.$faceBoundSuccess = $('.face-bound-success', self.$element);

  self.$samplesText.text('0/' + self.samplesCount);

  var options, ctx, canvasWidth, canvasHeight;
  var img_u8, work_canvas, work_ctx, ii_sum, ii_sqsum, ii_tilted, edg, ii_canny;
  var classifier = jsfeat.haar.frontalface;
  var max_work_size = 160;

  var video = document.getElementById('webcam');
  var canvas = document.getElementById('canvas');

  /** start the process */
  Face.getResources(video, function(err, resolutions) {
    if (!err && resolutions) {
      onDimensionsReady(resolutions.width, resolutions.height);
    } else {
      console.info('compatibility error: ', err);
      self.$canvas.hide();
      self.$nortc.html('<h4>WebRTC not available.</h4>').show();
    }
  });

  var onDimensionsReady = function(videoWidth, videoHeight) {

    canvas.width = 400;
    canvas.height = 300;

    canvasWidth  = canvas.width;
    canvasHeight = canvas.height;
    ctx = canvas.getContext('2d');

    ctx.fillStyle = "rgb(0,255,0)";
    ctx.strokeStyle = "rgb(0,255,0)";

    var scale = Math.min(max_work_size/videoWidth, max_work_size/videoHeight);
    var w = (videoWidth*scale)|0;
    var h = (videoHeight*scale)|0;
    //console.info('***', w, h, scale);
    img_u8 = new jsfeat.matrix_t(w, h, jsfeat.U8_t | jsfeat.C1_t);
    edg = new jsfeat.matrix_t(w, h, jsfeat.U8_t | jsfeat.C1_t);
    work_canvas = document.createElement('canvas');
    work_canvas.width = w;
    work_canvas.height = h;
    work_ctx = work_canvas.getContext('2d');
    ii_sum = new Int32Array((w+1)*(h+1));
    ii_sqsum = new Int32Array((w+1)*(h+1));
    ii_tilted = new Int32Array((w+1)*(h+1));
    ii_canny = new Int32Array((w+1)*(h+1));

    options = {
      min_scale: 2,
      scale_factor: 1.15,
      use_canny: false,
      edges_density: 0.13,
      equalize_histogram: true
    };

    compatibility.requestAnimationFrame(tick);
  };

  function tick() {
    compatibility.requestAnimationFrame(tick);

    if (video.readyState === video.HAVE_ENOUGH_DATA) {

      ctx.drawImage(video, 0, 0, canvasWidth, canvasHeight);

      work_ctx.drawImage(video, 0, 0, work_canvas.width, work_canvas.height);
      var imageData = work_ctx.getImageData(0, 0, work_canvas.width, work_canvas.height);

      jsfeat.imgproc.grayscale(imageData.data, work_canvas.width, work_canvas.height, img_u8);

      // possible options
      if(options.equalize_histogram) {
        jsfeat.imgproc.equalize_histogram(img_u8, img_u8);
      }
      //jsfeat.imgproc.gaussian_blur(img_u8, img_u8, 3);

      jsfeat.imgproc.compute_integral_image(img_u8, ii_sum, ii_sqsum, classifier.tilted ? ii_tilted : null);

      if(options.use_canny) {
        jsfeat.imgproc.canny(img_u8, edg, 10, 50);
        jsfeat.imgproc.compute_integral_image(edg, ii_canny, null, null);
      }

      jsfeat.haar.edges_density = options.edges_density;
      var rects = jsfeat.haar.detect_multi_scale(ii_sum, ii_sqsum, ii_tilted, options.use_canny ? ii_canny : null, img_u8.cols, img_u8.rows, classifier, options.scale_factor, options.min_scale);
      rects = jsfeat.haar.group_rectangles(rects, 1);

      validateFace(ctx, rects, canvasWidth/img_u8.cols, 1);
    }
  }

  /**
   * Check if face in focus and get a picture
   * @param ctx
   * @param rects
   * @param sc
   * @param max
   */
  function validateFace(ctx, rects, sc, max) {
    if (!rects.length) return;
    if (self.finish) return;
    if (self.debug) drawFaces(ctx, rects, sc, max);

    var boundarySq = 250*250;
    var width = rects[0].width * sc;
    var height = rects[0].height * sc;
    var x = rects[0].x * sc;
    var y = rects[0].y * sc;

    /** 1. check square  */
    var faceSq = width * height;
    var deltaSq = Math.abs((boundarySq - faceSq)/boundarySq);

    if (deltaSq <= self.allowedDeltaSq) {

      /** 2. check boundary  */
      var center = {x: x+(width/2), y: y+(height/2)};
      var boundaryCenter = {x: 200, y: 150};

      var deltaCenterX = Math.abs(boundaryCenter.x - center.x);
      var deltaCenterY = Math.abs(boundaryCenter.y - center.y);

      if (deltaCenterX > deltaCenterY) {
        var deltaCenter = deltaCenterX/boundaryCenter.x;
      } else {
        var deltaCenter = deltaCenterY/boundaryCenter.y;
      }

      if (deltaCenter <= self.allowedDeltaCenter) {

        self.$faceBoundFail.hide();
        self.$faceBoundSuccess.show();

        /** 3. if ok - put into stack  */
        self.stack.push('+');
        console.info(self.stack.toString());
      } else {
        self.stack = [];
        self.$faceBoundSuccess.hide();
        self.$faceBoundFail.show();
      }

      /** 3. check stack  */
      if (self.stack.length >= self.validateFrameCount) {
        console.info('Done!');
        self.stack = [];
        self.stack.length = 0;

        /** 4. if ok - take a photo */
        self.samples.push('*');
        takePhoto();
        var progress = 400 / self.samplesCount;

        self.$samplesProgress.width(self.$samplesProgress.width() + progress);
        self.$samplesText.text(self.samples.length + '/' + self.samplesCount);

        if (self.samples.length >= self.samplesCount) {
          self.$samplesProgress.width(400);
          self.finish = true;
          self.onSubmit(self.photos);
          console.info('FINISH!');
        }
      }

    } else {
      self.stack = [];
      self.$faceBoundSuccess.hide();
      self.$faceBoundFail.show();
    }
  }

  /**
   * highlight faces
   * @param ctx
   * @param rects
   * @param sc
   * @param max
   */
  function drawFaces(ctx, rects, sc, max) {
    var on = rects.length;
    if (on && max) {
      jsfeat.math.qsort(rects, 0, on - 1, function (a, b) {
        return (b.confidence < a.confidence);
      })
    }
    var n = max || on;
    n = Math.min(n, on);
    var r;
    for (var i = 0; i < n; ++i) {
      r = rects[i];
      ctx.strokeRect((r.x * sc) | 0, (r.y * sc) | 0, (r.width * sc) | 0, (r.height * sc) | 0);
    }
  }

  /**
   * Get a photo from canvas and save it in data
   */
  function takePhoto() {
    var image = canvas.toDataURL();
    self.photos.push(image);
    console.info('image: ', image);
  };


  $(window).unload(function() {
    self.video.pause();
    self.video.src = null;
  });
};

/**
 * get web camera resolutions, if web camera is available
 * @param video - DOM element
 * @param done - result callback
 */
Face.getResources = function(video, done) {
  var attempts = 0;

  function getResolutions() {
    if(video.videoWidth > 0 && video.videoHeight > 0) {
      console.info('getRes', video.videoWidth, video.videoHeight);
      video.removeEventListener('loadeddata', handler);
      done(null, {width: video.videoWidth, height: video.videoHeight});
    } else {
      if(attempts < 10) {
        attempts++;
        setTimeout(getResolutions, 200);
      } else {
        done(null, {width: 320, height: 240});
      }
    }
  }

  function handler() {
    getResolutions();
  }

  compatibility.getUserMedia({video: true}, function(stream) {
    try {
      video.src = compatibility.URL.createObjectURL(stream);
    } catch (error) {
      video.src = stream;
    }

    setTimeout(function() {
      video.play();
    }, 500);

  }, function (error) {
    console.info('compatibility error: ', error);
    done(error);
  });

  video.addEventListener('loadeddata', handler);
}

Face.prototype.onSubmit = function(data) {
  console.info('Please override onSubmit method to handle data!');
  return data;
};