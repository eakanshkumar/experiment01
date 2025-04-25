const socket = io();
let localStream;
let peerConnection;
let roomID;
const remoteVideo = document.getElementById('remoteVideo');

document.getElementById('joinBtn').onclick = async () => {
  const roomIDInput = document.getElementById('roomInput').value.trim();
  const passwordInput = document.getElementById('passwordInput').value.trim();
  const usernameInput = document.getElementById('usernameInput').value.trim();

  if (!roomIDInput || !passwordInput || !usernameInput) {
    return alert('Please enter all fields (Name, Room ID, and Password)');
  }

  roomID = roomIDInput;
  const password = passwordInput;
  const username = usernameInput;

  document.getElementById('room-selection').style.display = 'none';
  document.getElementById('video-chat').style.display = 'block';

  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });

  socket.emit('join', { roomID, password, username });
};

socket.on('wrong-password', () => {
  alert('Incorrect password. Please try again.');
  location.reload();
});

socket.on('other-user', async (userID) => {
  createPeerConnection(userID);
  localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);

  socket.emit('offer', { target: userID, caller: socket.id, sdp: peerConnection.localDescription });
});

socket.on('offer', async (incoming) => {
  createPeerConnection(incoming.caller);
  await peerConnection.setRemoteDescription(new RTCSessionDescription(incoming.sdp));
  localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);

  socket.emit('answer', { target: incoming.caller, sdp: peerConnection.localDescription });
});

socket.on('answer', (message) => {
  peerConnection.setRemoteDescription(new RTCSessionDescription(message.sdp));
});

socket.on('ice-candidate', (incoming) => {
  const candidate = new RTCIceCandidate(incoming);
  peerConnection.addIceCandidate(candidate);
});

function createPeerConnection(userID) {
  peerConnection = new RTCPeerConnection();

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit('ice-candidate', {
        target: userID,
        candidate: event.candidate
      });
    }
  };

  peerConnection.ontrack = (event) => {
    remoteVideo.srcObject = event.streams[0];
  };
}

function endCall() {
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }
  remoteVideo.srcObject = null;
  document.getElementById('video-chat').style.display = 'none';
  document.getElementById('room-selection').style.display = 'block';
}
