const socket = io("http://localhost:5000");

/* peerconnection variables */
let pc = null;
let shoulder = null;
let detectionStream;
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

/*  WEBRTC  */

async function createPeerConnection() {
  // create a peer connection
  var configuration = {
    iceServers: [{ urls: ["stun:stun.l.google.com:19302"] }],
  };
  pc = new RTCPeerConnection(configuration);

  addEventListeners();
  return pc;
}

function addEventListeners() {
  pc.addEventListener("track", function (event) {
    // Display stream when track event is received
    displayStream(event);
  });

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      console.log("New ICE Candidate:", event.candidate);
    }
  };

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
    if (pc.iceConnectionState === "failed") {
      pc.restartIce();
    }
  });
  pc.addEventListener("connectionstatechange", (event) => {
    console.log("Connectionstatechange:", pc.connectionState);
    if (pc.connectionState === "connected") {
      console.log("peers connected!");
      connectionOutput("connected");
      enableButtons();
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
  // This defines if track gets directly added to the pc
  // or if a previous track gets replaced
  initializing = false;

  const mediaStreamPromise = navigator.mediaDevices.getUserMedia({
    audio: false,
    video: { frameRate: { ideal: 10, max: 10 } },
  });

  // Check for first initialization
  if (!shoulder) {
    pc = await createPeerConnection();
    initializing = true;
  }
  shoulder = shoulder_choice;
  // Assign shoulder choice in backend
  socket.emit("assign_shoulder", shoulder);

  // Access user's webcam
  const mediaStream = await mediaStreamPromise;
  detectionStream = mediaStream;

  mediaStream.getTracks().forEach(function (track) {
    // First time detection
    if (initializing == true) {
      pc.addTrack(track, mediaStream);
      console.log("adding track...");
      speaking("Preparing measurement of the " + shoulder + " shoulder");
    }
    // Redetection
    else {
      // If detection is already ongoing, replace tracks with new
      replaceTrack(track);
      startCountdown();
    }
  });
  // Create offer only if start is clicked for the first time
  if (initializing == true) {
    connectionOutput("connecting");
    console.log("creating offer");
    // Disable buttons until peers are connected
    disableButtons();
    try {
      await createOffer();
    } catch (error) {
      // Handle errors during offer creation
      console.error("Error creating offer:", error);
    }
  }
}

function createOffer() {
  try {
    console.log("Creating offer");
    // Create offer
    // iceRestart: true
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
  startCountdown();
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
    if (sender.track && sender.track.id === newTrack.id) {
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
  console.log("Inside answer");
  const answer = new RTCSessionDescription(data);
  pc.setRemoteDescription(answer)
    .then(() => {
      console.log("Remote description set successfully!", answer);
    })
    .catch((error) => {
      console.error("Error setting remote description:", error);
    });
});

socket.on("log", function (output) {
  /**
   * Receives last measurements log data
   */
  console.log("output");
  speaking(output);
});

/* TEXT-TO-SPEECH */

/* TTS variables */
let utterance = null;
let synthesis = null;
let speechInProgress = false;
synthesis = window.speechSynthesis;


async function speaking(text) {
  utterance = new SpeechSynthesisUtterance();

  utterance.lang = "en-US"
  utterance.pitch = 1;
  utterance.rate = 1;
  utterance.volume = 0.8;
  utterance.text = text;
  await synthesis.speak(utterance);
}

async function startCountdown() {
  // countdown value
  let count = 10;
  speaking("Starting measurement in the count of " + count);
  await new Promise((resolve) => setTimeout(resolve, 2000));

  for (let i = count; i > 0; i--) {
    console.log(i);
    speaking(i);
    if (i == 1) {
      await speaking("Measuring now");
    }
    // Wait inbetween counts - necessary for the voice to speak all counts
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  socket.emit("get_logs");
}

/* Functions for HTML/UI */

function disableButtons() {
  /**
   * Disable buttons for the duration of the initializing
   * process of the peerconnection
   *
   */
  console.log("Disabling buttons");
  const buttons = document.querySelectorAll("#switchShoulders label");
  console.log("buttons!!");

  buttons.forEach((label) => {
    label.classList.add("btn");
    label.classList.add("btn-primary");
    label.classList.add("disabled");
  });
}

function enableButtons() {
  /**
   * Enables buttons after initialization process
   */
  const buttons = document.querySelectorAll("#switchShoulders label");

  buttons.forEach((label) => {
    label.classList.remove("disabled");
  });
}
function changeButton(id) {
  /**
   * Changes how the button looks like after clicking
   */
  ids = ["left", "right"];

  label = document.getElementById(id).parentElement;
  // Toggle the "btn" class
  label.classList.add("btn");
  label.classList.add("btn-primary");
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
