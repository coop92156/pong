// Enhanced client with lobby, room code, player sides, paddle control, scoring, game over
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const socket = io();

let myId = null;
let mySide = null;
let players = {};
let ball = { x: 300, y: 200 };
let scores = [5, 5, 5, 5];
let gameOver = false;
const colors = { top: 'red', bottom: 'blue', left: 'green', right: 'yellow' };

document.getElementById('createRoomBtn').onclick = () => {
  socket.emit('createRoom');
};
socket.on('roomCreated', (code) => {
  document.getElementById('roomCodeDisplay').innerText = `Room Code: ${code}`;
  socket.emit('joinRoom', code);
});
document.getElementById('joinRoomBtn').onclick = () => {
  const code = document.getElementById('roomCodeInput').value.trim();
  socket.emit('joinRoom', code);
};

socket.on('noRoom', () => alert('Room not found.'));
socket.on('roomFull', () => alert('Room is full.'));

socket.on('players', (data) => {
  players = data;
  myId = socket.id;
  if (players[myId]) mySide = players[myId].side;
});

socket.on('ball', (data) => {
  ball = data;
});

socket.on('scores', (data) => {
  scores = data;
  updateScores();
});

socket.on('gameOver', (data) => {
  gameOver = true;
  document.getElementById('gameOver').style.display = '';
  let losingIdx = data.findIndex(s => s <= 0);
  let losingSide = ['Top', 'Bottom', 'Left', 'Right'][losingIdx];
  document.getElementById('gameOver').innerText = `Game Over! ${losingSide} lost.`;
});

function updateScores() {
  let html = '';
  ['Top', 'Bottom', 'Left', 'Right'].forEach((side, i) => {
    html += `<span style="color:${colors[side.toLowerCase()]};font-weight:bold;">${side}: ${scores[i]}</span> &nbsp; `;
  });
  document.getElementById('scores').innerHTML = html;
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  // Draw paddles
  Object.values(players).forEach((player) => {
    ctx.fillStyle = colors[player.side];
    if (player.side === 'top')
      ctx.fillRect(player.paddle.x, 10, 80, 10);
    if (player.side === 'bottom')
      ctx.fillRect(player.paddle.x, 380, 80, 10);
    if (player.side === 'left')
      ctx.fillRect(10, player.paddle.y, 10, 80);
    if (player.side === 'right')
      ctx.fillRect(580, player.paddle.y, 10, 80);
  });
  // Draw ball
  ctx.fillStyle = 'white';
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, 10, 0, Math.PI * 2);
  ctx.fill();
  requestAnimationFrame(draw);
}
draw();

// Paddle control
canvas.onmousemove = (e) => {
  if (!mySide || gameOver) return;
  let rect = canvas.getBoundingClientRect();
  let x = e.clientX - rect.left;
  let y = e.clientY - rect.top;
  let paddle = {};
  if (mySide === 'top' || mySide === 'bottom') {
    paddle.x = Math.max(0, Math.min(520, x - 40)); // Range for 80px paddle
    paddle.y = (mySide === 'top') ? 10 : 380;
  } else if (mySide === 'left' || mySide === 'right') {
    paddle.y = Math.max(0, Math.min(320, y - 40));
    paddle.x = (mySide === 'left') ? 10 : 580;
  }
  socket.emit('move', paddle);
};