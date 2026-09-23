const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

const rooms = {};

io.on("connection", (socket) => {
  console.log("A player connected");

  socket.on("joinRoom", (roomCode) => {
    roomCode = roomCode.toUpperCase().trim();

    if (!rooms[roomCode]) {
      rooms[roomCode] = {
        players: [],
        board: ["", "", "", "", "", "", "", ""],
        turn: "X",
        winner: null
      };
    }

    const room = rooms[roomCode];

    if (room.players.length >= 2) {
      socket.emit("roomFull");
      return;
    }

    const symbol = room.players.length === 0 ? "X" : "O";

    room.players.push({
      socketId: socket.id,
      symbol: symbol
    });

    socket.join(roomCode);
    socket.roomCode = roomCode;
    socket.symbol = symbol;

    socket.emit("joined", {
      symbol: symbol,
      board: room.board,
      turn: room.turn
    });

    io.to(roomCode).emit("playersUpdate", {
      count: room.players.length
    });

    if (room.players.length === 2) {
      io.to(roomCode).emit("gameStart");
    }
  });

  socket.on("makeMove", (index) => {
    const roomCode = socket.roomCode;
    const room = rooms[roomCode];

    if (!room) return;
    if (room.winner) return;
    if (room.players.length < 2) return;
    if (socket.symbol !== room.turn) return;
    if (room.board[index] !== "") return;

    room.board[index] = socket.symbol;

    const winner = checkWinner(room.board);

    if (winner) {
      room.winner = winner;
    } else if (room.board.every((cell) => cell !== "")) {
      room.winner = "DRAW";
    } else {
      room.turn = room.turn === "X" ? "O" : "X";
    }

    io.to(roomCode).emit("gameUpdate", {
      board: room.board,
      turn: room.turn,
      winner: room.winner
    });
  });

  socket.on("disconnect", () => {
    const roomCode = socket.roomCode;

    if (!roomCode || !rooms[roomCode]) return;

    const room = rooms[roomCode];

    room.players = room.players.filter(
      (player) => player.socketId !== socket.id
    );

    if (room.players.length === 0) {
      delete rooms[roomCode];
    } else {
      io.to(roomCode).emit("playerLeft");
    }

    console.log("A player disconnected");
  });
});

function checkWinner(board) {
  const winningLines = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6]
  ];

  for (const [a, b, c] of winningLines) {
    if (
      board[a] &&
      board[a] === board[b] &&
      board[a] === board[c]
    ) {
      return board[a];
    }
  }

  return null;
}

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});