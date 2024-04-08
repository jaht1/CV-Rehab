const socket = io("http://localhost:5000");

/* peerconnection variables */
let pc = null;
let shoulder = null;
streamLoaded = false;

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

function createPeerConnection() {
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
  if (!shoulder) {
    pc = createPeerConnection();
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
      stream.getTracks().forEach(function (track) {
        // First time detection
        if (initializing == true) {
          pc.addTrack(track, stream);
          console.log("adding track...");
          speaking('Preparing measurement of the ' + shoulder + ' shoulder')
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
        return createOffer();
      }
    });
}

function createOffer() {
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
  ids = ["left", "right"];

  label = document.getElementById(id).parentElement;
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
  let count = 5;
  speaking("Starting measurement in the count of " + count);
  await new Promise((resolve) => setTimeout(resolve, 2000)); 

  for (let i = count; i > 0; i--) {
    console.log(i);
    await speaking(i);
    if (i == 1) {
      
      await speaking('Measuring NOW')
    }
    // Wait inbetween counts - necessary for the voice to speak all counts
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  await socket.emit("get_logs");
}

socket.on("log", function (output) {
  console.log("output");
  speaking(output);
});
