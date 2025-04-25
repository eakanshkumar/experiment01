const socket = io();

let localStream;
let peerConnection;
const config = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
let roomID = null;

const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');

document.getElementById('joinBtn').onclick = async () => {
  roomID = document.getElementById('roomInput').value.trim();
  if (!roomID) return alert('Please enter a Room ID');

  document.getElementById('room-selection').style.display = 'none';
  document.getElementById('video-chat').style.display = 'block';

  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  localVideo.srcObject = localStream;

  socket.emit('join', roomID);
};

socket.on('other-user', async userID => {
  await createPeerConnection(userID);
  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);

  socket.emit('offer', {
    target: userID,
    caller: socket.id,
    sdp: offer
  });
});

socket.on('user-joined', async userID => {
  await createPeerConnection(userID);
});

socket.on('offer', async incoming => {
  await createPeerConnection(incoming.caller);
  await peerConnection.setRemoteDescription(new RTCSessionDescription(incoming.sdp));

  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);

  socket.emit('answer', {
    target: incoming.caller,
    sdp: answer
  });
});

socket.on('answer', async message => {
  await peerConnection.setRemoteDescription(new RTCSessionDescription(message.sdp));
});

socket.on('ice-candidate', async incoming => {
  try {
    await peerConnection.addIceCandidate(new RTCIceCandidate(incoming));
  } catch (err) {
    console.error('Error adding ICE candidate:', err);
  }
});

async function createPeerConnection(userID) {
  if (peerConnection) return;

  peerConnection = new RTCPeerConnection(config);

  localStream.getTracks().forEach(track => {
    peerConnection.addTrack(track, localStream);
  });

  peerConnection.ontrack = event => {
    remoteVideo.srcObject = event.streams[0];
  };

  peerConnection.onicecandidate = event => {
    if (event.candidate) {
      socket.emit('ice-candidate', {
        target: userID,
        candidate: event.candidate
      });
    }
  };
}

document.getElementById('leaveBtn').onclick = () => {
  if (peerConnection) peerConnection.close();
  if (localStream) localStream.getTracks().forEach(track => track.stop());
  location.reload();
};
