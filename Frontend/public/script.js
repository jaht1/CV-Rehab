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

/* Video frame processing */
// Wait for website to be loaded
document.addEventListener("DOMContentLoaded", (event) => {
  const streamOutput = document.getElementById("videoElement");

  video = document.getElementById("videoElement");
  canvas = document.getElementById("canvasOutput");
  context = canvas.getContext("2d");

  // Access user's webcam
  navigator.mediaDevices
    .getUserMedia({ video: true })
    .then((stream) => {
      // Stream user's video
      console.log("Got user permission for camera");
      streamOutput.srcObject = stream;
      return stream;
    })
    .then((stream) => {
      // create a peer connection
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }], // Example STUN server
      });
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      
      // Handle ICE candidates
      // Potential network pathways to server
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          // Send candidate to the backend
          sendToBackend({ iceCandidate: event.candidate });
        }
      };

      // create offer
      // Describes the media capabilities of the client
    pc.createOffer()
    .then(offer => pc.setLocalDescription(offer))
    .then(() => {
      // Send offer to server for frame processing
      //sendToBackend({ offer: pc.localDescription });
      // Send the offer to backend
      
      sdp = pc.localDescription.sdp
      type = pc.localDescription.type
      console.log('Sending to backend', sdp)
      socket.emit('offer', { sdp: sdp, type: type });
    });
    });
  // Add the video stream to the peer connection
  
});

function sendToBackend(data) {
  // Implement this function to send data to your backend
  // For example, using WebSocket or AJAX
  console.log('send to backend function')
}
/*video.addEventListener("loadedmetadata", () => {
    // Set canvas dimensions once based on the video element
    canvas.width = video.clientWidth;
    canvas.height = video.clientHeight;
    console.log("metadata");
    
    captureVideoFrame();
  });
  socket.on("response_back", function (frame) {
    endTime = performance.now(); // End timing

    //console.log(`Response received in ${(endTime - startTime) / 1000} seconds`);
    displayProcessedFrame(frame);
    captureVideoFrame();
  });
  socket.on("print_response", function (degreeStr) {
    console.log("got response " + string);
    document.getElementById("degreeOutput").innerHTML = degreeStr;
  });*/
