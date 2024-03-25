/* Initialize websocket connection to localhost server */
// , { transports: ['websocket', 'polling']}

const socket = io("http://localhost:5000");
let pc;
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
  const videoElement = document.getElementById("videoElement");

  video = document.getElementById("videoElement");
  canvas = document.getElementById("canvasOutput");
  context = canvas.getContext("2d");

  // Access user's webcam
  navigator.mediaDevices
    .getUserMedia({ video: true })
    .then((stream) => {
      // Stream user's video
      console.log("Got user permission for camera");
      videoElement.srcObject = stream;
      //socket.emit('add_track',stream)
      return stream;
    })
    .then((stream) => {
      // create a peer connection
      pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }], // Example STUN server
      });
      
      // Push tracks from local stream to peer connection
      //stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      stream.getTracks().forEach((track)=> {
        pc.addTrack(track, stream)
      })
      

      // Create offer
      // Describes the media capabilities of the client
      pc.createOffer()
        .then((offer) => pc.setLocalDescription(offer))
        .then(() => {
          // Send offer to server
          sdp = pc.localDescription.sdp;
          type = pc.localDescription.type;
          socket.emit("offer", { sdp: sdp, type: type });
        });
        
    });
});


socket.on("answer", function (data) {
  /**
   * Function that receives offer back from server
   *
   */
  //console.log("Received answer from server!!!!", data);
  const answer = new RTCSessionDescription(data);
  pc.setRemoteDescription(answer)
    .then(() => {
      console.log("Remote description set successfully!");
      // Create answer for server
      return pc.createAnswer;
    })
    .then((localDescription) => {
      // Set local description
      return pc.setLocalDescription(localDescription);
    })
    .then(() => {
      // Send local description (answer) back to the server
      socket.emit("answer", pc.localDescription);
      
    })
    .catch((error) => {
      console.error("Error setting remote description:", error);
    });
});
