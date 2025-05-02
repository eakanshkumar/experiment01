const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);


app.use(express.static(path.join(__dirname, 'public')));


app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ---------------- your socket.io logic ----------------

const rooms = {};

io.on("connection", (socket) => {
  socket.on("join", ({ roomId, password, username }) => {
    if (!rooms[roomId]) {
      rooms[roomId] = { password, users: [] };
    }

    if (rooms[roomId].password !== password) {
      socket.emit("error", "Incorrect password");
      return;
    }

    socket.join(roomId);
    rooms[roomId].users.push(username);
    socket.roomId = roomId;

    const otherUsers = Array.from(io.sockets.adapter.rooms.get(roomId) || []);
    if (otherUsers.length > 1) {
      socket.to(roomId).emit("joined");
    }
  });

  socket.on("offer", (data) => {
    socket.to(socket.roomId).emit("offer", data);
  });

  socket.on("answer", (data) => {
    socket.to(socket.roomId).emit("answer", data);
  });

  socket.on("candidate", (data) => {
    socket.to(socket.roomId).emit("candidate", data);
  });

  socket.on("disconnect", () => {
    if (socket.roomId && rooms[socket.roomId]) {
      rooms[socket.roomId].users = rooms[socket.roomId].users.filter(u => u !== socket.id);
      if (rooms[socket.roomId].users.length === 0) {
        delete rooms[socket.roomId];
      }
    }
  });
});

// ✅ Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
