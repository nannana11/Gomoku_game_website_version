const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// 存储游戏房间
const rooms = {};

// 静态文件服务
app.use(express.static(path.join(__dirname, 'public')));

// 首页路由
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

io.on('connection', (socket) => {
    console.log('用户连接:', socket.id);

    // 加入房间
    socket.on('join_room', (roomId) => {
        socket.join(roomId);

        // 检查房间人数
        const room = io.sockets.adapter.rooms.get(roomId);
        if (room && room.size === 2) {
            io.to(roomId).emit('game_start', { player: 'white' });
            io.to(roomId).emit('update_status', '游戏开始！');
        } else {
            socket.emit('player_assigned', { player: 'black' });
            io.to(roomId).emit('update_status', '等待对手加入...');
        }
    });

    // 处理落子事件
    socket.on('make_move', (data) => {
        io.to(data.roomId).emit('opponent_move', {
            x: data.x,
            y: data.y,
            color: data.color
        });
    });

    // 处理游戏结束
    socket.on('game_over', (data) => {
        io.to(data.roomId).emit('game_ended', data.winner);
    });

    socket.on('disconnect', () => {
        console.log('用户断开连接:', socket.id);
        // 查找用户所在的房间并通知其他玩家
        for (let roomId in rooms) {
            const room = io.sockets.adapter.rooms.get(roomId);
            if (room && room.has(socket.id)) {
                io.to(roomId).emit('opponent_disconnected');
                delete rooms[roomId];
                break;
            }
        }
    });
});

// 获取端口（Railway自动设置）
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`服务器运行在端口 ${PORT}`);
});