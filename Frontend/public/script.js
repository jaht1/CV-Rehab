/* Initialize websocket connection to localhost server */
// , { transports: ['websocket', 'polling']}

const socket = io("http://localhost:5000");
let pc = null;
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
/*
function stop() {
  pc.onsignalingstatechange = null;
  pc.onconnectionstatechange = null;
  pc.onnegotiationneeded = null;
  pc.onicecandidate = null;
  pc.ontrack = null;
  pc.getSenders().forEach(function (sender) {
    sender.track.stop();
  });
  pc.getSenders().forEach((sender) => {
    console.log("STOP SENDER", sender);
    pc.removeTrack(sender);
    sender.setStreams();
    sender.track?.stop();
  });
  pc.getReceivers().forEach((receiver) => {
    receiver.track?.stop();
  });
  pc.getTransceivers().forEach((transceiver) => {
    pc.removeTrack(transceiver.sender);
    transceiver.sender.setStreams();
    transceiver.sender.track?.stop();
    transceiver.stop();
  });

  pc.close();
  console.log(pc.sdp);
}

window.onbeforeunload = function (event) {
  try {
    console.log("REFRESHING");
    stop();
  } catch (error) {
    console.log("error deleting...", error);
  }
};

window.addEventListener("beforeunload", function (event) {
  // Perform actions before the page is unloaded or refreshed
  // You can show a confirmation dialog or perform cleanup tasks here
  // Note: Returning a string will prompt the user with a confirmation dialog
  // event.preventDefault(); // Uncomment this line to prevent the default browser dialog
  console.log("test...");
});
*/
async function createPeerConnection() {
  // create a peer connection
  var configuration = {
    offerToReceiveAudio: false,
    offerToReceiveVideo: true,
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    iceTransportPolicy: "relay",
  };
  pc = new RTCPeerConnection({
    configuration,
  });

  addEventListeners();
  // Set up the offer
}


function addEventListeners() {
  pc.ontrack = e => {
    console.log('pc.ontrack')
    videoElement.srcObject = e.streams[0];
    hangupButton.disabled = false;
    return false;
  }

  pc.addEventListener("track", function () {
    console.log("Track event received:");
    // Handle track event...
  });

  pc.addEventListener("icegatheringstatechange", function () {
    console.log("iceGatheringState:", pc.iceGatheringState);
  });

  // Event listener for iceconnectionstatechange event
  pc.addEventListener("iceconnectionstatechange", function () {
    console.log("iceConnectionState:", pc.iceConnectionState);
  });

  // Event listener for signalingstatechange event
  pc.addEventListener("signalingstatechange", function () {
    console.log("signalingState:", pc.signalingState);
    if (pc.signalingState == "closed") {
      console.log("SIGNALINGSTATE CLOSED. DELETING PC.");
      try {
        stream.getTracks().forEach((track) => {
          track.stop();
        });
      } catch (error) {
        console.log("couldnt clsoe track");
      }
    }
  });


}
async function renegotiate() {
  try {
      // Create a new offer
      console.log('Renegtiating...')
      const offer = await pc.createOffer();

      // Set the local description to the new offer
      await pc.setLocalDescription(offer);

      // Send the new offer to the remote peer through your signaling channel
      // (code to send offer to the server)
  } catch (error) {
      console.error("Error during renegotiation:", error);
  }
}
async function createOffer() {
  try {
    // Create offer

    const offer = await pc.createOffer();

    // Set local description
    await pc.setLocalDescription(offer);
    console.log("Inside createoffer !!!");
    // Send the offer to the server
    const { sdp, type } = pc.localDescription;
    await socket.emit("offer", { sdp, type });
  } catch (error) {
    console.error("Error creating offer and setting local description:", error);
  }
}

// Wait for website to be loaded
document.addEventListener("DOMContentLoaded", async (event) => {
  console.log("DOM loaded");
  await createPeerConnection();

  /*video = document.getElementById("videoElement");
  canvas = document.getElementById("canvasOutput");
  context = canvas.getContext("2d");*/

  // Access user's webcam
  await navigator.mediaDevices
    .getUserMedia({
      audio: false,
      video: true,
    })
    .then((stream) => {
      // Stream user's video
      console.log("Got user permission for camera");

      const videoElement = document.getElementById("videoElement");
      videoElement.srcObject = stream;
      return stream;
    })
    .then((stream) => {
      stream.getTracks().forEach(function (track) {
        pc.addTrack(track, stream);
      });
    })
    .then(() => {
      console.log("creating offer");
      return createOffer();
    })
    .then(() => {
      //console.log("PRINTING SETUP");
      //console.log(pc.localDescription.sdp);
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
      //console.log("Received answer from server:", answer);
    })
    .then(() => {
      // Check if tracks are added
      const senders = pc.getSenders();
      senders.forEach((sender) => {
        console.log("Sender track:", sender.track);
        if (sender.track.kind === "video") {
          const videoElement = document.getElementById("remoteVideo");
          videoElement.srcObject = new MediaStream([sender.track]);
        }
      });
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
