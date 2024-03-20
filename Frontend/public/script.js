/* Initialize websocket connection to localhost server */
// , { transports: ['websocket', 'polling']}
const socket = io("http://localhost:5000");

socket.on("connect_error", (err) => {
  // the reason of the error, for example "xhr poll error"
  console.log(err.message);

  // some additional description, for example the status code of the initial HTTP response
  console.log(err.description);

  // some additional context, for example the XMLHttpRequest object
  console.log(err.context);
});

// check for connection
socket.on("connect", function () {
  console.log("Connected...!", socket.connected);
});

/* Access web camera from index.html */
// Ask user permission
if (navigator.mediaDevices.getUserMedia) {
  navigator.mediaDevices
    .getUserMedia({ video: true })
    .then(function (stream) {
      // Stream user's video
      console.log("Got user permission for camera");
      video.srcObject = stream;
      video.play();
    })
    .catch(function (err0r) {
      console.log(err0r);
      console.log("Something went wrong!");
    });
}
var startTime = null;
var endTime = null;
let video, canvas, context;
const reader = new FileReader();
const frameOutput = document.getElementById("frameOutput");

const convertToBinary = (frameData) => {};

const captureVideoFrame = () => {
  framerate = 10
  context.drawImage(video, 0, 0, video.clientWidth, video.clientHeight);
  canvas = document.getElementById("canvasOutput");
  var imageArrayBuffer;
  canvas.toBlob(function(blob) {
    
    reader.onloadend = function() {
        imageArrayBuffer = reader.result;
        socket.emit("process_frame", imageArrayBuffer);
    };
    reader.readAsArrayBuffer(blob);
}, 'image/png');
startTime = performance.now();
  socket.emit("process_frame", imageArrayBuffer);
  
};

// TODO: fix blob
function displayProcessedFrame(frame) {
  // Revoke the previous object URL to free up memory
  if (frameOutput.src) {
    URL.revokeObjectURL(frameOutput.src);
  }
  var blob = new Blob([frame], { type: "image/png" });
  // Create an object URL for blob
  var frameData = URL.createObjectURL(blob);

  // Display blob
  frameOutput.src = frameData;
  
}

/* Video frame processing */
// Wait for website to be loaded
document.addEventListener("DOMContentLoaded", (event) => {
  video = document.getElementById("videoElement");
  canvas = document.getElementById("canvasOutput");
  context = canvas.getContext("2d");

  video.addEventListener("loadedmetadata", () => {
    // Set canvas dimensions once based on the video element
    canvas.width = video.clientWidth;
    canvas.height = video.clientHeight;
    console.log("metadata");
    
    captureVideoFrame();
  });
  socket.on("response_back", function (frame) {
    endTime = performance.now(); // End timing

    console.log(`Response received in ${(endTime - startTime) / 1000} seconds`);
    displayProcessedFrame(frame);
    captureVideoFrame();
  });
  socket.on("print_response", function (degreeStr) {
    console.log("got response " + string);
    document.getElementById("degreeOutput").innerHTML = degreeStr;
  });
});
