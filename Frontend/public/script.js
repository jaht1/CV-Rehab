

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
    console.log(event.streams[0])
    document.getElementById('remoteVideo').srcObject = event.streams[0];
    console.log('started stream at ', Date.now())
    connectionOutput("connected")
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

async function start(){
  // Check if any of the radio buttons are checked
  var leftChecked = document.getElementById("left").checked;
  var rightChecked = document.getElementById("right").checked;
  var shoulder;
  if (leftChecked == true){
    shoulder = 'left'
  }
  else {
    shoulder = 'right'
  }
  console.log('shoulder is ', shoulder)
  // Assign shoulder choice in backend
  socket.emit("assign_shoulder", shoulder)
  pc = await createPeerConnection();

  
  
  // Access user's webcam
  await navigator.mediaDevices
    .getUserMedia({
      audio: false,
      video: {frameRate: { ideal: 10, max: 10 }, // frame rate constraints
    },
    })
    .then((stream) => {
      // Stream user's video
      console.log("Got user permission for camera");
      connectionOutput("connecting")
/*
      const videoElement = document.getElementById("videoElement");
      videoElement.srcObject = stream;*/
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
        // wait for ICE gathering to complete - important!
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

function connectionOutput(status) {
  const connectionStatus = document.getElementById("connectionStatus");
  if (status == 'connecting'){
    
    connectionStatus.innerHTML = `<div class="spinner-container">
    <div class="spinner-border text-primary" role="status"></div>
    <div class="loading-text">Loading...</div>
  </div>
  `
  }
  if (status == 'connected'){
    
    connectionStatus.innerHTML = ``
  }
}

// Wait for website to be loaded
document.addEventListener("DOMContentLoaded", async (event) => {
  console.log("DOM loaded");
  
});


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
    .catch((error) => {
      console.error("Error setting remote description:", error);
    });
});

