// Node.js + Socket.io backend with player assignment, paddle collision, scoring, and rooms
const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const { nanoid } = require('nanoid');

const PORT = process.env.PORT || 3000;
const app = express();
const server = http.createServer(app);
const io = socketIO(server);

app.use(express.static('public'));

const ROOMS = {}; // roomCode: { players: {}, ball, scores, ... }

function createRoom() {
  const roomCode = nanoid(6);
  ROOMS[roomCode] = {
    players: {},
    ball: { x: 300, y: 200, vx: 3, vy: 3 },
    scores: [5, 5, 5, 5], // Each player starts with 5 points
    gameRunning: true
  };
  return roomCode;
}

function assignSide(num) {
  return ['top', 'bottom', 'left', 'right'][num];
}

io.on('connection', (socket) => {
  let currentRoom = null;
  let playerSide = null;

  socket.on('createRoom', () => {
    const roomCode = createRoom();
    socket.emit('roomCreated', roomCode);
  });

  socket.on('joinRoom', (roomCode) => {
    if (!ROOMS[roomCode]) {
      socket.emit('noRoom');
      return;
    }
    const room = ROOMS[roomCode];
    const numPlayers = Object.keys(room.players).length;
    if (numPlayers >= 4) {
      socket.emit('roomFull');
      return;
    }
    playerSide = assignSide(numPlayers);
    room.players[socket.id] = {
      id: socket.id,
      side: playerSide,
      paddle: { x: 260, y: 160 },
      scoreIdx: numPlayers
    };
    currentRoom = roomCode;
    socket.join(roomCode);
    io.in(roomCode).emit('players', room.players);
    io.in(roomCode).emit('scores', room.scores);
  });

  socket.on('move', (paddle) => {
    if (!currentRoom) return;
    const room = ROOMS[currentRoom];
    if (room && room.players[socket.id]) {
      room.players[socket.id].paddle = paddle;
      io.in(currentRoom).emit('players', room.players);
    }
  });

  socket.on('disconnect', () => {
    if (!currentRoom) return;
    const room = ROOMS[currentRoom];
    if (room && room.players[socket.id]) {
      delete room.players[socket.id];
      io.in(currentRoom).emit('players', room.players);
    }
  });
});

// Ball movement and collision, per room
setInterval(() => {
  Object.keys(ROOMS).forEach((roomCode) => {
    const room = ROOMS[roomCode];
    if (!room.gameRunning) return;
    let { ball, players, scores } = room;

    ball.x += ball.vx;
    ball.y += ball.vy;

    // Paddle collision
    Object.values(players).forEach((player) => {
      if (player.side === 'top' && ball.y - 10 < 20 && ball.x >= player.paddle.x && ball.x <= player.paddle.x + 80) {
        ball.vy *= -1;
        ball.y = 20 + 10;
      }
      if (player.side === 'bottom' && ball.y + 10 > 380 && ball.x >= player.paddle.x && ball.x <= player.paddle.x + 80) {
        ball.vy *= -1;
        ball.y = 380 - 10;
      }
      if (player.side === 'left' && ball.x - 10 < 20 && ball.y >= player.paddle.y && ball.y <= player.paddle.y + 80) {
        ball.vx *= -1;
        ball.x = 20 + 10;
      }
      if (player.side === 'right' && ball.x + 10 > 580 && ball.y >= player.paddle.y && ball.y <= player.paddle.y + 80) {
        ball.vx *= -1;
        ball.x = 580 - 10;
      }
    });

    // Out of bounds, lose point
    if (ball.y < 0) { // Top missed
      let idx = Object.values(players).find(p => p.side === 'top')?.scoreIdx;
      if (idx !== undefined) scores[idx]--;
      resetBall(ball);
    }
    if (ball.y > 400) { // Bottom missed
      let idx = Object.values(players).find(p => p.side === 'bottom')?.scoreIdx;
      if (idx !== undefined) scores[idx]--;
      resetBall(ball);
    }
    if (ball.x < 0) { // Left missed
      let idx = Object.values(players).find(p => p.side === 'left')?.scoreIdx;
      if (idx !== undefined) scores[idx]--;
      resetBall(ball);
    }
    if (ball.x > 600) { // Right missed
      let idx = Object.values(players).find(p => p.side === 'right')?.scoreIdx;
      if (idx !== undefined) scores[idx]--;
      resetBall(ball);
    }

    // Game over
    if (scores.some(s => s <= 0)) {
      room.gameRunning = false;
      io.in(roomCode).emit('gameOver', scores);
    }

    io.in(roomCode).emit('ball', ball);
    io.in(roomCode).emit('scores', scores);
  });
}, 1000 / 60);

function resetBall(ball) {
  ball.x = 300;
  ball.y = 200;
  ball.vx = (Math.random() > 0.5 ? 3 : -3);
  ball.vy = (Math.random() > 0.5 ? 3 : -3);
}

server.listen(PORT, () => console.log(`Server started on port ${PORT}`));