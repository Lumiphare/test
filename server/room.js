  const express = require('express');
  const http = require('http');
  const socketIo = require('socket.io');
  const cors = require('cors');
  const os = require('os');
  const GameLogic = require('./game');

  const app = express();
  app.use(cors());

  const server = http.createServer(app);

  // 获取本地 IP 地址
  function getLocalIPAddress() {
    const interfaces = os.networkInterfaces();
    for (const interfaceName in interfaces) {
      if (interfaceName.toLowerCase().includes('wlan') || interfaceName.toLowerCase().includes('wi-fi') || interfaceName.toLowerCase().includes('en0')) {
        for (const iface of interfaces[interfaceName]) {
          if (iface.family === 'IPv4' && !iface.internal) {
            return iface.address;
          }
        }
      }
    }
    return 'localhost'; // 如果找不到，默认使用 localhost
  }

  const localIP = getLocalIPAddress();
  console.log(`Local IP Address: ${localIP}`);

  const io = socketIo(server, {
    cors: {
      origin: [`http://${localIP}:8080`, "http://localhost:8080"],
      methods: ["GET", "POST"]
    }
  });

  const roomTimers  = new Map();

  const rooms = {};

  const gameStates = new Map();

  const gameLogic = new GameLogic(io, rooms, gameStates);

  function getRoomList() {
    return Object.entries(rooms).map(([roomNumber, roomData]) => {
      return {
        roomNumber,
        state: roomData.state,
        playerCount: roomData.players.length
      };
    });
  }

  io.on('connection', (socket) => {
    // console.log('New client connected');

    socket.emit('roomListUpdate', getRoomList());

    socket.on('createRoom', (roomNumber) => {
      while (rooms[roomNumber]) {
        roomNumber = Math.random().toString(36).substring(2, 6);
      }
      rooms[roomNumber] = {
        state: 'waiting',
        players: []
      };
      socket.emit('roomCreated', roomNumber);
      io.emit('roomListUpdate', getRoomList());
    });

    socket.on('joinRoom', ({ roomNumber, username }) => {
      if (!rooms[roomNumber]) {
        rooms[roomNumber] = {
          state: 'waiting',
          players: []
        };
      }
      if (rooms[roomNumber].state === 'inProgress') {
        socket.emit('joinFailed', {
          reason: '房间正在游戏中，无法加入',
        });
        return;
      }
      if (rooms[roomNumber].players.length < 4) {
        rooms[roomNumber].players.push({ id: socket.id, username, isReady: false });
        socket.join(roomNumber);
        io.to(roomNumber).emit('roomUpdate', rooms[roomNumber].players);
      } else {
        socket.emit('roomFull', '房间已满');
      }
    });

    socket.on('playCards', (data) => gameLogic.handlePlayCards(socket, data));
    socket.on('challenge', (data) => gameLogic.handleChallenge(socket, data));

    socket.on('toggleReady', ({ roomNumber, isReady }) => {
      const room = rooms[roomNumber];
      if (!room) return;
    
      const player = room.players.find(p => p.id === socket.id);
      if (!player) return;
    
      player.isReady = isReady;
    
      // 当有玩家取消准备且倒计时正在进行
      if (!isReady && roomTimers.has(roomNumber)) {
        clearTimeout(roomTimers.get(roomNumber)); // 清除定时器
        roomTimers.delete(roomNumber);
        
        // 重置所有玩家准备状态
        // room.forEach(p => p.isReady = false);

        roomTimers.delete(roomNumber); // 确保删除定时器引用
        io.to(roomNumber).emit('cancelCountdown'); // 新增取消倒计时事件
      }
    
      // 触发状态更新
      io.to(roomNumber).emit('roomUpdate', room.players);
    
      // 检查是否满足开始条件
      if (room.players.every(p => p.isReady) && room.players.length >= 2) {
        startCountdown(roomNumber); // 统一倒计时入口
      }
    });

    function startCountdown(roomNumber) {
      if (roomTimers.has(roomNumber)) return;
    
      const timer = setTimeout(() => {
        roomTimers.delete(roomNumber);
        io.to(roomNumber).emit('readyStart');
      }, 3000); // 3秒倒计时

      roomTimers.set(roomNumber, timer);
    }
    // TODO 1. 开始游戏后不能加入房间 2.断线重连 3.手机适配

    socket.on('goStart', (roomNumber) => {
      gameLogic.startGame(roomNumber);
    });

    socket.on('leaveRoom', (roomNumber) => {
      const room = rooms[roomNumber];
      if (room) {
        room.players = room.players.filter(p => p.id !== socket.id);
        socket.leave(roomNumber);
        io.to(roomNumber).emit('roomUpdate', room.players);
        // 如果房间没人了，删除房间
        if (room.players.length === 0) {
          delete rooms[roomNumber];
        }
        io.emit('roomListUpdate', getRoomList());
      }
    });
    
    socket.on('disconnect', () => {
      for (const roomNumber in rooms) {
        const room = rooms[roomNumber];
        room.players = room.players.filter(p => p.id !== socket.id);
        io.to(roomNumber).emit('roomUpdate', room.players);
        if (room.players.length === 0) {
          delete rooms[roomNumber];
        }
      }
      io.emit('roomListUpdate', getRoomList());
      // console.log('Client disconnected');
    });
  });

  server.listen(4000, () => console.log('Server is running on port 4000')); 