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

// Wait for website to be loaded
document.addEventListener("DOMContentLoaded", async (event) => {
  const videoElement = document.getElementById("videoElement");

  video = document.getElementById("videoElement");
  canvas = document.getElementById("canvasOutput");
  context = canvas.getContext("2d");

  // create a peer connection
  var configuration = {
    offerToReceiveAudio: false,
    offerToReceiveVideo: true,
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
  };
  pc = new RTCPeerConnection({
    configuration 
  });
  await pc.createDataChannel("video");
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  // Send the offer to the server
  const { sdp, type } = pc.localDescription;
  socket.emit("offer", { sdp, type });

  // Access user's webcam
  await navigator.mediaDevices
    .getUserMedia({
      audio: false,
      video: true,
    })
    .then((stream) => {
      // Stream user's video
      console.log("Got user permission for camera");
      videoElement.srcObject = stream;
      return stream;
    })
    .then((stream) => {
      for (const track of stream.getTracks()) {
        pc.addTrack(track, stream);
        console.log("stream:", stream);
        socket.emit("add_track", pc.videoTrack);
      }

      // Add track to peer connection
      /*await addTrack(stream, pc)
        .then(() => {
          console.log("Tracks added successfully");
          socket.emit("add_track", stream);
        })
        .catch((error) => {
          console.error("Error adding tracks:", error);
        });
*/
      // Check for tracks after adding them
      const senders = pc.getSenders();
      const videoTrack = senders.find((sender) => sender.kind === "video");

      // Create offer
      // Describes the media capabilities of the client
    })
    .then(() => {
      console.log("PRINTING SETUP");
      console.log(pc.localDescription.sdp)
      socket.emit("print_setup");
    });
});

function addTrack(stream, pc) {
  /**
   * Function to add stream to PC
   * Waits for the stream to be added
   */
  return new Promise((resolve, reject) => {
    stream.getTracks().forEach((track) => pc.addTrack(track));
    setTimeout(() => {
      const senders = pc.getSenders();
      const videoTrack = senders.find(
        (sender) => sender.track && sender.track.kind === "video"
      );

      if (videoTrack) {
        console.log("Found video track:", videoTrack.track);
        resolve(videoTrack.track);
      } else {
        console.log("No video tracks found");
        reject(new Error("No video tracks found"));
      }
    }, 1000);
    // Once all tracks are added, resolve the Promise
    resolve();
  });
}

socket.on("answer", function (data) {
  /**
   * Function that receives offer back from server
   *
   */
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
      //test();
    })
    .catch((error) => {
      console.error("Error setting remote description:", error);
    });
});

function test() {
  const senders = pc.getSenders();

  // Access specific track (assuming one video track)
  const videoTrack = senders.find((sender) => sender.kind === "video");

  if (videoTrack) {
    console.log("Found video track:", videoTrack);
    // You can access track properties or manipulate the track here
  } else {
    console.log("No video track found");
  }
}
