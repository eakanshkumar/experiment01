const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

const roomPasswords = {}; // { roomID: password }
const userNames = {};     // { socket.id: username }

io.on('connection', socket => {
  socket.on('join', ({ roomID, password, username }) => {
    if (roomPasswords[roomID]) {
      if (roomPasswords[roomID] !== password) {
        socket.emit('wrong-password');
        return;
      }
    } else {
      roomPasswords[roomID] = password;
    }

    userNames[socket.id] = username;
    socket.join(roomID);

    const usersInRoom = Array.from(io.sockets.adapter.rooms.get(roomID) || []);
    const otherUser = usersInRoom.find(id => id !== socket.id);

    if (otherUser) {
      socket.emit('other-user', otherUser);
      socket.to(otherUser).emit('user-joined', socket.id);
      socket.to(otherUser).emit('user-joined-name', username);
    }

    socket.on('disconnect', () => {
      socket.to(roomID).emit('user-left');
      delete userNames[socket.id];
    });
  });

  socket.on('offer', payload => {
    io.to(payload.target).emit('offer', payload);
  });

  socket.on('answer', payload => {
    io.to(payload.target).emit('answer', payload);
  });

  socket.on('ice-candidate', incoming => {
    io.to(incoming.target).emit('ice-candidate', incoming.candidate);
  });
});

server.listen(3000, () => console.log('Server is running on port 3000'));
