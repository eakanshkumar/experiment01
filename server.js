const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

const rooms = new Map();

io.on('connection', socket => {
  socket.on('join', ({ roomID, password, username }) => {
    if (!rooms.has(roomID)) {
      rooms.set(roomID, { password, users: new Map() });
    }
    const room = rooms.get(roomID);

    if (room.password !== password) {
      socket.emit('wrong-password');
      return;
    }

    socket.join(roomID);
    room.users.set(socket.id, username);

    io.to(roomID).emit('room-users', Array.from(room.users.entries()).map(([id, name]) => ({ id, name })));
    socket.to(roomID).emit('other-user', socket.id);

    socket.on('offer', offer => socket.to(roomID).emit('offer', offer));
    socket.on('answer', answer => socket.to(roomID).emit('answer', answer));
    socket.on('ice-candidate', candidate => socket.to(roomID).emit('ice-candidate', candidate));

    socket.on('disconnect', () => {
      room.users.delete(socket.id);
      io.to(roomID).emit('user-left', socket.id);
      io.to(roomID).emit('room-users', Array.from(room.users.entries()).map(([id, name]) => ({ id, name })));
      if (room.users.size === 0) rooms.delete(roomID);
    });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
