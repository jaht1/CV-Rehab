
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

      // Access specific candidate data
      console.log("Candidate type:", event.candidate.type);
      console.log("Candidate protocol:", event.candidate.protocol);
      console.log("Candidate address:", event.candidate.address);
      // ... and more as needed
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

  // Check for first initialization
  if (!shoulder) {
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
      detectionStream = stream;
      return stream;
    })
    .then((stream) => {
      stream.getTracks().forEach(function (track) {
        // First time detection
        if (initializing == true) {
          pc.addTrack(track, stream);
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
    })
    .then(() => {
      // Create offer only if start is clicked for the first time
      if (initializing == true) {
        connectionOutput("connecting");
        console.log("creating offer");
        // Disable buttons until peers are connected
        disableButtons();
        return createOffer();
      }
    });
}

function createOffer() {
  console.log("Creating offer");

  // Start a timeout for ICE gathering to reduce latency
  // Gathering will continue in the background
  const iceGatheringTimeout = setTimeout(() => {
    console.log("ICE gathering timeout reached. Sending offer.");
    const { sdp, type } = pc.localDescription;
    socket.emit("offer", { sdp, type });
  }, 500);

  // Create offer
  return pc
    .createOffer({ offerToReceiveAudio: false, offerToReceiveVideo: true })
    .then((offer) => {
      // Set offer as local description
      pc.setLocalDescription(offer)
    })
    .then(() => {
      return new Promise((resolve) => {
          function checkState() {
            // Check when all icecandidates have been gathered
            if (pc.iceGatheringState === "complete") {
              console.log("icegathering complete");
              // Remove timeout and event listener
              clearTimeout(iceGatheringTimeout);
              pc.removeEventListener("icegatheringstatechange", checkState);
              resolve();
            }
          }
          pc.addEventListener("icegatheringstatechange", checkState);
      });
  });
}


function displayStream(event) {
  /**
   * Displays track stream
   */
  var remoteVideo = document.getElementById("remoteVideo");
  remoteVideo.srcObject = event.streams[0];
  startCountdown();
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
function textToSpeech() {
  try {
    synthesis = window.speechSynthesis;

    // Get the first `en` language voice in the list
    var voice = synthesis.getVoices().filter(function (voice) {
      return voice.lang === "en";
    })[0];

    utterance = new SpeechSynthesisUtterance();

    // Set utterance properties
    utterance.voice = voice;
    utterance.pitch = 1;
    utterance.rate = 1;
    utterance.volume = 0.8;
  } catch {
    console.log("Text-to-speech not supported.");
  }
}

// Initiate TTS function
textToSpeech();

async function speaking(text) {
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
    await speaking(i);
    if (i == 1) {
      await speaking("Measuring now");
    }
    // Wait inbetween counts - necessary for the voice to speak all counts
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  await socket.emit("get_logs");
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
