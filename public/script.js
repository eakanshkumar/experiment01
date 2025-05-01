const socket = io();
let peerConnection;
let remoteStream;
let startTime;
let dataUsage = 0;
let participants = new Map();

const constraintsMap = {
  '144': { video: { width: { exact: 256 }, height: { exact: 144 } }, audio: true },
  '360': { video: { width: { exact: 640 }, height: { exact: 360 } }, audio: true },
  '480': { video: { width: { exact: 854 }, height: { exact: 480 } }, audio: true },
  '720': { video: { width: { exact: 1280 }, height: { exact: 720 } }, audio: true }
};

const usernameInput = document.getElementById('username');
const roomIDInput = document.getElementById('room-id');
const roomPasswordInput = document.getElementById('room-password');
const joinBtn = document.getElementById('join-btn');
const errorDiv = document.getElementById('error');
const qualitySelect = document.getElementById('quality');
const videoCallDiv = document.getElementById('video-call');
const joinScreen = document.getElementById('join-screen');
const remoteVideo = document.getElementById('remote-video');
const timerSpan = document.getElementById('timer');
const endCallBtn = document.getElementById('end-call');
const bandwidthSelect = document.getElementById('bandwidth');
const dataUsageSpan = document.getElementById('data-usage');
const participantsList = document.getElementById('participants');

joinBtn.onclick = async () => {
  const username = usernameInput.value.trim();
  const roomID = roomIDInput.value.trim();
  const password = roomPasswordInput.value.trim();
  const quality = qualitySelect.value;

  if (!username || !roomID || !password) {
    errorDiv.innerText = 'All fields are required';
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia(constraintsMap[quality]);
    setupPeer(stream);
    socket.emit('join', { roomID, password, username });
    joinScreen.style.display = 'none';
    videoCallDiv.style.display = 'block';
  } catch (err) {
    errorDiv.innerText = 'Permission denied or unsupported browser';
  }
};

function setupPeer(stream) {
  peerConnection = new RTCPeerConnection();
  stream.getTracks().forEach(track => peerConnection.addTrack(track, stream));

  peerConnection.ontrack = event => {
    if (!remoteStream) {
      remoteStream = new MediaStream();
      remoteVideo.srcObject = remoteStream;
    }
    event.streams[0].getTracks().forEach(track => remoteStream.addTrack(track));
  };

  peerConnection.onicecandidate = e => {
    if (e.candidate) socket.emit('ice-candidate', e.candidate);
  };
}

function startCallTimer() {
  startTime = Date.now();
  setInterval(() => {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const mins = String(Math.floor(elapsed / 60)).padStart(2, '0');
    const secs = String(elapsed % 60).padStart(2, '0');
    timerSpan.innerText = `${mins}:${secs}`;
    dataUsage += 300;
    dataUsageSpan.innerText = `${(dataUsage / 1024).toFixed(1)} MB`;
  }, 1000);
}

endCallBtn.onclick = () => {
  if (peerConnection) peerConnection.close();
  remoteVideo.srcObject = null;
  socket.disconnect();
  window.location.reload();
};

socket.on('wrong-password', () => errorDiv.innerText = 'Incorrect room password');
socket.on('other-user', async () => {
  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  socket.emit('offer', offer);
  startCallTimer();
});
socket.on('offer', async offer => {
  await peerConnection.setRemoteDescription(offer);
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);
  socket.emit('answer', answer);
  startCallTimer();
});
socket.on('answer', answer => peerConnection.setRemoteDescription(answer));
socket.on('ice-candidate', candidate => peerConnection.addIceCandidate(new RTCIceCandidate(candidate)));

socket.on('user-left', id => {
  participants.delete(id);
  updateParticipants();
  if (peerConnection) peerConnection.close();
  remoteVideo.srcObject = null;
});
socket.on('room-users', users => {
  participants = new Map(users.map(u => [u.id, u.name]));
  updateParticipants();
});

function updateParticipants() {
  participantsList.innerHTML = '';
  for (const [id, name] of participants) {
    const li = document.createElement('li');
    li.innerText = name;
    participantsList.appendChild(li);
  }
}
