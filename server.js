/* ============================================================
   儿童每日任务打卡积分助手 - 服务端 (SQLite 版本)
   ============================================================ */

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const db = require('./db');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;

// 中间件
app.use(express.json({ limit: '10mb' }));
app.use(express.static(__dirname));

// 生成唯一ID
function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

// 获取今天的日期字符串
function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// 合并数据（将头像数据合并到孩子数据中返回给客户端）
async function mergeDataWithAvatars() {
  const appData = await db.getAllData();
  const avatars = await db.getAllAvatars();
  
  const mergedData = JSON.parse(JSON.stringify(appData));
  mergedData.children = mergedData.children.map(child => ({
    ...child,
    avatar: avatars[child.id] || null
  }));
  mergedData.avatars = avatars;
  
  return mergedData;
}

// API 路由

// 获取所有数据（包含头像）
app.get('/api/data', async (req, res) => {
  try {
    const data = await mergeDataWithAvatars();
    res.json(data);
  } catch (error) {
    console.error('获取数据失败:', error);
    res.status(500).json({ error: '获取数据失败' });
  }
});

// 更新数据（处理头像分离存储）
app.post('/api/data', async (req, res) => {
  try {
    const { avatars, ...mainData } = req.body;
    
    // 保存主数据（不含头像）
    await db.saveAllData(mainData);
    
    // 单独保存头像数据
    if (avatars) {
      for (const [childId, avatarBase64] of Object.entries(avatars)) {
        if (avatarBase64) {
          await db.saveAvatar(childId, avatarBase64);
        } else {
          await db.deleteAvatar(childId);
        }
      }
    }
    
    // 广播合并后的数据给所有连接的客户端
    const mergedData = await mergeDataWithAvatars();
    io.emit('dataUpdated', mergedData);
    res.json({ success: true, data: mergedData });
  } catch (error) {
    console.error('保存数据失败:', error);
    res.status(500).json({ error: '保存数据失败' });
  }
});

// 获取特定孩子的数据（包含头像）
app.get('/api/child/:id', async (req, res) => {
  try {
    const data = await db.getAllData();
    const avatars = await db.getAllAvatars();
    const child = data.children.find(c => c.id === req.params.id);
    
    if (child) {
      const childWithAvatar = { ...child, avatar: avatars[child.id] || null };
      res.json(childWithAvatar);
    } else {
      res.status(404).json({ error: '孩子未找到' });
    }
  } catch (error) {
    console.error('获取孩子数据失败:', error);
    res.status(500).json({ error: '获取数据失败' });
  }
});

// 更新特定孩子的数据（处理头像分离存储）
app.post('/api/child/:id', async (req, res) => {
  try {
    const { avatar, ...childData } = req.body;
    
    // 更新主数据（不含头像）
    await db.updateChild(req.params.id, childData);
    
    // 单独更新头像
    if (avatar !== undefined) {
      if (avatar) {
        await db.saveAvatar(req.params.id, avatar);
      } else {
        await db.deleteAvatar(req.params.id);
      }
    }
    
    const mergedData = await mergeDataWithAvatars();
    io.emit('dataUpdated', mergedData);
    
    const avatars = await db.getAllAvatars();
    res.json({ 
      success: true, 
      child: { ...childData, id: req.params.id, avatar: avatars[req.params.id] || null }
    });
  } catch (error) {
    console.error('更新孩子数据失败:', error);
    res.status(500).json({ error: '更新数据失败' });
  }
});

// 添加新孩子
app.post('/api/children', async (req, res) => {
  try {
    const newChild = {
      id: generateId(),
      name: req.body.name || '新孩子',
      bonusPoints: 5,
      tasks: [
        { id: generateId(), name: '早起刷牙洗脸', emoji: '🦷', points: 2, color: '#4ECDC4' },
        { id: generateId(), name: '整理书包', emoji: '🎒', points: 2, color: '#A29BFE' },
        { id: generateId(), name: '完成作业', emoji: '📚', points: 5, color: '#FF6B6B' },
        { id: generateId(), name: '阅读 30 分钟', emoji: '📖', points: 3, color: '#FDCB6E' },
        { id: generateId(), name: '运动锻炼', emoji: '🏃', points: 3, color: '#55EFC4' },
        { id: generateId(), name: '整理房间', emoji: '🧹', points: 2, color: '#FD79A8' },
      ],
      dailyChecks: {},
      scoreHistory: [],
      totalScore: 0,
      lifetimeScore: 0,
      streak: 0,
      lastCompleteDate: null,
    };
    
    await db.addChild(newChild);
    
    // 保存默认任务
    for (const task of newChild.tasks) {
      await db.saveAllData({
        children: [{
          ...newChild,
          tasks: [task]
        }],
        currentChildId: newChild.id
      });
    }
    
    const mergedData = await mergeDataWithAvatars();
    io.emit('dataUpdated', mergedData);
    res.json({ success: true, child: { ...newChild, avatar: null } });
  } catch (error) {
    console.error('添加孩子失败:', error);
    res.status(500).json({ error: '添加孩子失败' });
  }
});

// 删除孩子
app.delete('/api/children/:id', async (req, res) => {
  try {
    const data = await db.getAllData();
    
    if (data.children.length <= 1) {
      return res.status(400).json({ error: '至少保留一个孩子' });
    }
    
    await db.deleteChild(req.params.id);
    await db.deleteAvatar(req.params.id);
    
    const mergedData = await mergeDataWithAvatars();
    io.emit('dataUpdated', mergedData);
    res.json({ success: true });
  } catch (error) {
    console.error('删除孩子失败:', error);
    res.status(500).json({ error: '删除孩子失败' });
  }
});

// 获取孩子的头像
app.get('/api/avatar/:childId', async (req, res) => {
  try {
    const avatars = await db.getAllAvatars();
    const avatar = avatars[req.params.childId];
    res.json({ success: true, childId: req.params.childId, avatar: avatar || null });
  } catch (error) {
    console.error('获取头像失败:', error);
    res.status(500).json({ error: '获取头像失败' });
  }
});

// 更新孩子的头像
app.post('/api/avatar/:childId', async (req, res) => {
  try {
    const { avatar } = req.body;
    const data = await db.getAllData();
    const child = data.children.find(c => c.id === req.params.childId);
    
    if (!child) {
      return res.status(404).json({ error: '孩子未找到' });
    }
    
    if (avatar) {
      await db.saveAvatar(req.params.childId, avatar);
    } else {
      await db.deleteAvatar(req.params.childId);
    }
    
    const mergedData = await mergeDataWithAvatars();
    io.emit('dataUpdated', mergedData);
    
    res.json({ 
      success: true, 
      childId: req.params.childId,
      avatar: avatar || null
    });
  } catch (error) {
    console.error('更新头像失败:', error);
    res.status(500).json({ error: '更新头像失败' });
  }
});

// 获取所有头像数据
app.get('/api/avatars', async (req, res) => {
  try {
    const avatars = await db.getAllAvatars();
    res.json({ success: true, avatars });
  } catch (error) {
    console.error('获取头像数据失败:', error);
    res.status(500).json({ error: '获取头像数据失败' });
  }
});

// 任务打卡
app.post('/api/checkin', async (req, res) => {
  try {
    const { childId, taskId, checked } = req.body;
    const data = await db.getAllData();
    const child = data.children.find(c => c.id === childId);
    
    if (!child) {
      return res.status(404).json({ error: '孩子未找到' });
    }
    
    const task = child.tasks.find(t => t.id === taskId);
    if (!task) {
      return res.status(404).json({ error: '任务未找到' });
    }
    
    const t = today();
    const wasChecked = child.dailyChecks[t] && child.dailyChecks[t][taskId];
    
    // 保存打卡记录
    await db.checkinTask(childId, taskId, t, checked);
    
    // 更新积分
    let pointsChanged = 0;
    if (checked && !wasChecked) {
      pointsChanged = task.points;
      child.totalScore += task.points;
    } else if (!checked && wasChecked) {
      pointsChanged = -task.points;
      child.totalScore = Math.max(0, child.totalScore - task.points);
    }
    
    await db.updateChild(childId, { totalScore: child.totalScore });
    
    const mergedData = await mergeDataWithAvatars();
    io.emit('dataUpdated', mergedData);
    
    res.json({ 
      success: true, 
      child: { ...child, avatar: (await db.getAllAvatars())[childId] || null },
      pointsChanged
    });
  } catch (error) {
    console.error('打卡失败:', error);
    res.status(500).json({ error: '打卡失败' });
  }
});

// Socket.IO 连接处理
io.on('connection', (socket) => {
  console.log('🔌 客户端已连接:', socket.id);
  
  // 发送当前数据给新连接的客户端（包含头像）
  mergeDataWithAvatars().then(data => {
    socket.emit('dataUpdated', data);
  }).catch(err => {
    console.error('发送初始数据失败:', err);
  });
  
  socket.on('disconnect', () => {
    console.log('🔌 客户端已断开:', socket.id);
  });
  
  // 客户端请求同步数据
  socket.on('requestSync', async () => {
    try {
      const data = await mergeDataWithAvatars();
      socket.emit('dataUpdated', data);
    } catch (error) {
      console.error('同步数据失败:', error);
    }
  });
  
  // 客户端更新数据（处理头像分离存储）
  socket.on('updateData', async (data) => {
    try {
      const { avatars, ...mainData } = data;
      
      // 保存主数据
      await db.saveAllData(mainData);
      
      // 单独保存头像数据
      if (avatars) {
        for (const [childId, avatarBase64] of Object.entries(avatars)) {
          if (avatarBase64) {
            await db.saveAvatar(childId, avatarBase64);
          } else {
            await db.deleteAvatar(childId);
          }
        }
      }
      
      // 广播合并后的数据给所有其他客户端
      const mergedData = await mergeDataWithAvatars();
      socket.broadcast.emit('dataUpdated', mergedData);
    } catch (error) {
      console.error('处理客户端更新失败:', error);
    }
  });
});

// 启动服务器
async function startServer() {
  try {
    await db.initDatabase();
    
    server.listen(PORT, () => {
      console.log(`
🌟 儿童每日任务打卡积分助手服务端已启动！(SQLite 版本)
📱 访问地址: http://localhost:${PORT}
💾 数据库: data.db
🔌 WebSocket: ws://localhost:${PORT}
      `);
    });
  } catch (error) {
    console.error('启动服务器失败:', error);
    process.exit(1);
  }
}

startServer();
