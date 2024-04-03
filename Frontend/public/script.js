const socket = io("http://localhost:5000");
let pc = null;
let shoulder = null;
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
    displayStream(event);
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
      connectionOutput("connected");
    }
  });
  // Event listener for signalingstatechange event
  pc.addEventListener("signalingstatechange", function () {
    console.log("signalingState:", pc.signalingState);
  });
}



async function start(shoulder_choice) {
  /**
   * Function that initiates the peer connection
   * Communicates with the backend through sockets
   */

  // Boolean to check if track is being added for the first time
  initializing = false;

  // Check for first initialization
  if (shoulder == null) {
    pc = await createPeerConnection();
    initializing = true;
  }
  shoulder = shoulder_choice;
  // Assign shoulder choice in backend
  socket.emit("assign_shoulder", shoulder);

  // Access user's webcam
  await navigator.mediaDevices
    .getUserMedia({
      audio: false,
      video: {
        frameRate: { ideal: 10, max: 10 }, // frame rate constraints, these can eventually be increased
      },
    })
    .then((stream) => {
      console.log("Got user permission for camera");
      return stream;
    })
    .then((stream) => {
      stream.getTracks().forEach(function (track) {
        // First time detection
        if (initializing == true) {
          pc.addTrack(track, stream);
          console.log("adding track...");
        }
        // Redetection
        else {
          // If detection is already ongoing, replace tracks with new
          replaceTrack(track);
        }
      });
    })
    .then(() => {
      // Create offer only if start is clicked for the first time
      if (initializing == true) {
        connectionOutput("connecting");
        console.log("creating offer");
        return createOffer();
      }
    });
}

async function createOffer() {
  try {
    console.log("in createOffer");
    // Create offer
    return pc
      .createOffer({ offerToReceiveAudio: false, offerToReceiveVideo: true })
      .then(function (offer) {
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

function displayStream(event) {
  /**
   * Displays track stream
   */
  var remoteVideo = document.getElementById("remoteVideo");
  remoteVideo.srcObject = event.streams[0];
}

async function replaceTrack(newTrack) {
  /**
   * Function that replaces previous tracks with current
   */
  const senders = pc.getSenders();

  // Loop through the senders
  // track associated with the track you want to replace
  senders.forEach(async (sender) => {
    // Check if the sender's track matches the one you want to replace
    if (sender.track && sender.track.id === trackToReplace.id) {
      try {
        // Replace the track with the new one
        await sender.replaceTrack(newTrack);
        console.log("Track replaced successfully");
      } catch (error) {
        console.error("Error replacing track:", error);
      }
    }
  });
}

/* SOCKET FUNCTIONS */

socket.on("answer", function (data) {
  /**
   * Function that receives offer back from server
   *
   */
  const answer = new RTCSessionDescription(data);
  pc.setRemoteDescription(answer)
    .then(() => {
      console.log("Remote description set successfully!", answer);
    })
    .catch((error) => {
      console.error("Error setting remote description:", error);
    });
});




/* Functions for HTML/UI */

function changeButton(id) {
  /**
   * Changes how the button looks like after clicking
   */
    ids = ['left', 'right']

    label = document.getElementById(id).parentElement
    // Toggle the "btn" class
    label.classList.add("btn");
    label.classList.add("btn-secondary");
    label.classList.add("active");

    for (const otherId of ids) {
      // Check if the current ID is not the same as the one provided
      if (otherId !== id) {
        // Get the parent label element of the other button
        const otherLabel = document.getElementById(otherId).parentElement;
        // Remove the "active" class from the other button
        otherLabel.classList.remove("active");
      }
    }
}

function connectionOutput(status) {
  /**
   * Function to display the current connection status for the client
   */
  const connectionStatus = document.getElementById("connectionStatus");
  if (status == "connecting") {
    connectionStatus.innerHTML = `<div class="spinner-container">
    <div class="spinner-border text-primary" role="status"></div>
    <div class="loading-text">Loading...</div>
  </div>
  `;
  }
  if (status == "connected") {
    connectionStatus.innerHTML = ``;
  }
}

/*
window.addEventListener("beforeunload", async function (event) {
  // Empty PC on apge refresh
  event.preventDefault(); // This line is optional
  //socket.emit('pc_reset')
  resetPeerConnection();
  return (event.returnValue = "Are you sure you want to leave this page?");
});

async function resetPeerConnection() {
  await pc.getSenders().forEach((sender) => {
    if (sender.track) {
      sender.track.stop();
    }
  });
  console.log("Peerconnection reset");
  // Close the RTCPeerConnection instance
  await pc.close();

  // Create a new RTCPeerConnection instance
}
*/
