const socket = io();

let localStream;
let peerConnection;
const config = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

const roomInput = document.getElementById('roomInput');
const joinBtn = document.getElementById('joinBtn');
const leaveBtn = document.getElementById('leaveBtn');

const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');

joinBtn.onclick = async () => {
  const roomID = roomInput.value.trim();
  if (!roomID) return alert('Please enter a room ID');

  document.getElementById('room-selection').style.display = 'none';
  document.getElementById('video-chat').style.display = 'block';

  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  localVideo.srcObject = localStream;

  socket.emit('join', roomID);

  socket.on('other-user', userID => {
    callUser(userID);
  });

  socket.on('user-joined', userID => {
    console.log('User joined:', userID);
  });

  socket.on('offer', async incoming => {
    await createPeerConnection(incoming.caller);
    await peerConnection.setRemoteDescription(new RTCSessionDescription(incoming.sdp));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    socket.emit('answer', {
      target: incoming.caller,
      sdp: peerConnection.localDescription
    });
  });

  socket.on('answer', message => {
    peerConnection.setRemoteDescription(new RTCSessionDescription(message.sdp));
  });

  socket.on('ice-candidate', incoming => {
    const candidate = new RTCIceCandidate(incoming);
    peerConnection.addIceCandidate(candidate);
  });
};

leaveBtn.onclick = () => {
  if (peerConnection) peerConnection.close();
  if (localStream) localStream.getTracks().forEach(track => track.stop());
  localVideo.srcObject = null;
  remoteVideo.srcObject = null;
  location.reload();
};

async function callUser(userID) {
  await createPeerConnection(userID);

  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);

  socket.emit('offer', {
    target: userID,
    caller: socket.id,
    sdp: peerConnection.localDescription
  });
}

async function createPeerConnection(userID) {
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
