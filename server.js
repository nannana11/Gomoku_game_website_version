const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// 存储游戏房间
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
        
        // 初始化房间（如果不存在）
        if (!rooms[roomId]) {
            rooms[roomId] = {
                players: [],
                started: false
            };
        }
        
        rooms[roomId].players.push(socket.id);
        
        // 分配颜色（黑方先手）
        if (rooms[roomId].players.length === 1) {
            // 第一个玩家 = 黑方
            socket.emit('player_assigned', { player: 'black' });
            io.to(roomId).emit('update_status', '等待对手加入...');
        } else if (rooms[roomId].players.length === 2) {
            // 第二个玩家 = 白方
            socket.emit('player_assigned', { player: 'white' });
            io.to(roomId).emit('update_status', '游戏已开始，等待黑方落子...');
            
            // 通知双方游戏开始
            io.to(roomId).emit('game_start', {});
            rooms[roomId].started = true;
        }
    });

    // 处理落子事件
    socket.on('make_move', (data) => {
        if (!rooms[data.roomId] || !rooms[data.roomId].started) {
            console.error(`Room ${data.roomId} not started`);
            return;
        }
        
        // 发送给房间内所有玩家（包括自己）
        io.to(data.roomId).emit('opponent_move', {
            x: data.x,
            y: data.y,
            color: data.color
        });
    });

    // 处理游戏结束
    socket.on('game_over', (data) => {
        io.to(data.roomId).emit('game_ended', data.winner);
        delete rooms[data.roomId]; // 清理房间
    });

    socket.on('disconnect', () => {
        console.log('用户断开连接:', socket.id);
        
        // 清理房间
        for (let roomId in rooms) {
            const room = rooms[roomId];
            if (room.players.includes(socket.id)) {
                // 通知对方
                io.to(roomId).emit('opponent_disconnected');
                
                // 清理房间
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
