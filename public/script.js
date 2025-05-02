const socket = io();

const roomInput = document.getElementById("roomInput");
const passwordInput = document.getElementById("passwordInput");
const nameInput = document.getElementById("nameInput");
const joinBtn = document.getElementById("joinBtn");
const leaveBtn = document.getElementById("leaveBtn");
const remoteVideo = document.getElementById("remoteVideo");

let peerConnection;
let localStream;

joinBtn.onclick = async () => {
  const roomId = roomInput.value;
  const password = passwordInput.value;
  const username = nameInput.value;

  if (!roomId || !password || !username) {
    alert("Please fill all fields.");
    return;
  }

  joinBtn.disabled = true;

  localStream = await navigator.mediaDevices.getUserMedia({
    video: {
      width: { exact: 320 },
      height: { exact: 240 },
      frameRate: { ideal: 20, max: 20 },
    },
    audio: true
  });

  socket.emit("join", { roomId, password, username });
};

socket.on("joined", async () => {
  peerConnection = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
  });

  localStream.getTracks().forEach((track) => {
    peerConnection.addTrack(track, localStream);
  });

  peerConnection.ontrack = (event) => {
    remoteVideo.srcObject = event.streams[0];
  };

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit("candidate", event.candidate);
    }
  };

  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  socket.emit("offer", offer);
  leaveBtn.style.display = "block";
});

socket.on("offer", async (offer) => {
  peerConnection = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
  });

  localStream.getTracks().forEach((track) => {
    peerConnection.addTrack(track, localStream);
  });

  peerConnection.ontrack = (event) => {
    remoteVideo.srcObject = event.streams[0];
  };

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit("candidate", event.candidate);
    }
  };

  await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);
  socket.emit("answer", answer);
});

socket.on("answer", async (answer) => {
  await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
});

socket.on("candidate", async (candidate) => {
  try {
    await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
  } catch (err) {
    console.error("Error adding candidate:", err);
  }
});

leaveBtn.onclick = () => {
  if (peerConnection) {
    peerConnection.close();
  }
  window.location.reload();
};
