

const socket = io("http://localhost:5000");
let pc = null;

// Error logs 
socket.on("connect_error", (err) => {
  console.log(err.message);
  console.log(err.description);
  console.log(err.context);
});

// check for connection
socket.on("connect", function () {
  console.log("Connected...!", socket.connected);
});

async function createPeerConnection() {
  // create a peer connection
  var configuration = {
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }],

  };
  pc = new RTCPeerConnection({
    configuration,
  });

  addEventListeners();
  return pc;
}

function addEventListeners() {

  pc.addEventListener("track", function (event) {
    console.log("TRACK EVENT RECEIVED!!");
    console.log(event.streams[0])
    document.getElementById('remoteVideo').srcObject = event.streams[0];
    console.log('started stream at ', Date.now())
    // Handle track event...
  });

  pc.addEventListener("icegatheringstatechange", function () {
    console.log("iceGatheringState:", pc.iceGatheringState);
    if (pc.iceConnectionState === "connected") {
      // ICE connection is established
      console.log("ICE connection established.");
    }
  });

  // Event listener for iceconnectionstatechange event
  pc.addEventListener("iceconnectionstatechange", function () {
    console.log("iceConnectionState:", pc.iceConnectionState);
  });
  pc.addEventListener("connectionstatechange", (event) => {
    if (pc.connectionState === "connected") {
      console.log("peers connected!");
    }
  });
  // Event listener for signalingstatechange event
  pc.addEventListener("signalingstatechange", function () {
    console.log("signalingState:", pc.signalingState);
 
  });
}

async function createOffer() {
  try {
    console.log("in createOffer");
    // Create offer
    return pc
      .createOffer({offerToReceiveAudio: false, offerToReceiveVideo: true})
      .then(function (offer) {
        // set localdescription
        return pc.setLocalDescription(offer);
      })
      .then(function () {
        // wait for ICE gathering to complete - important!!
        return new Promise(function (resolve) {
          if (pc.iceGatheringState === "complete") {
            // if ICE gathering is already complete - resolve immediately
            resolve();
          } else {
            // wait for ice gathering to complete if not already
            function checkState() {
              if (pc.iceGatheringState === "complete") {
                console.log("icegathering complete");
                // If ICE gathering becomes complete, remove the listener and resolve
                pc.removeEventListener("icegatheringstatechange", checkState);
                resolve();
              }
            }
            // event listener for ICE gathering state change
            pc.addEventListener("icegatheringstatechange", checkState);
          }
        });
      })
      .then(function () {
        const { sdp, type } = pc.localDescription;
        socket.emit("offer", { sdp, type });
      });
  } catch (error) {
    console.error("Error creating offer and setting local description:", error);
  }
}

// Wait for website to be loaded

document.addEventListener("DOMContentLoaded", async (event) => {
  console.log("DOM loaded");
  pc = await createPeerConnection();

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
        console.log("local video: ", track);
      });
    })
    .then(() => {
      console.log("creating offer");
      return createOffer();
    })
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
      console.log("Remote description set successfully!", answer);
      //console.log("Received answer from server:", answer);
    })
    .then(() => {
      const receivers = pc.getReceivers();

      console.log("Remote tracks:");
      receivers.forEach((receiver) => {
        console.log("Sender track:", receiver.track);
        if (receiver.track.kind === "video") {
          //const videoElement = document.getElementById("remoteVideo");
          //videoElement.srcObject = new MediaStream([receiver.track]);
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
