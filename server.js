const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// 存储游戏房间（关键修复：使用房间ID作为键）
const rooms = {};

// 添加 UTF-8 编码设置
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res, path) => {
    if (path.endsWith('.html')) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
    }
  }
}));

// 首页路由
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

io.on('connection', (socket) => {
    console.log('用户连接:', socket.id);

    // 加入房间
    socket.on('join_room', (roomId) => {
        socket.join(roomId);
        
        // ✅ 修复：使用房间ID作为键，确保房间状态独立
        if (!rooms[roomId]) {
            rooms[roomId] = {
                players: [],
                started: false
            };
        }
        
        rooms[roomId].players.push(socket.id);
        
        // 检查房间人数
        if (rooms[roomId].players.length === 2) {
            // ✅ 修复：正确发送游戏开始事件
            io.to(roomId).emit('game_start', {});
            io.to(roomId).emit('update_status', '游戏开始！');
            rooms[roomId].started = true;
        } else {
            // 分配颜色（黑方先手）
            const playerColor = rooms[roomId].players.length === 1 ? 'black' : 'white';
            socket.emit('player_assigned', { player: playerColor });
            io.to(roomId).emit('update_status', '等待对手加入...');
        }
    });

    // 处理落子事件
    socket.on('make_move', (data) => {
        // ✅ 修复：确保房间存在
        if (!rooms[data.roomId] || !rooms[data.roomId].started) {
            console.error(`Room ${data.roomId} not started`);
            return;
        }
        
        // ✅ 修复：发送给房间内所有玩家（包括自己）
        io.to(data.roomId).emit('opponent_move', {
            x: data.x,
            y: data.y,
            color: data.color
        });
    });

    // 处理游戏结束
    socket.on('game_over', (data) => {
        // ✅ 修复：正确发送游戏结束事件
        io.to(data.roomId).emit('game_ended', data.winner);
        delete rooms[data.roomId]; // 清理房间
    });

    socket.on('disconnect', () => {
        console.log('用户断开连接:', socket.id);
        
        // ✅ 修复：清理房间状态
        for (let roomId in rooms) {
            const room = rooms[roomId];
            if (room.players.includes(socket.id)) {
                io.to(roomId).emit('opponent_disconnected');
                delete rooms[roomId];
                break;
            }
        }
    });
});

// 获取端口
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`服务器运行在端口 ${PORT}`);
});
