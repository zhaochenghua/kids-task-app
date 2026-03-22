/* ============================================================
   儿童每日任务打卡积分助手 - 服务端 (支持多端实时同步)
   ============================================================ */

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');
const AVATAR_FILE = path.join(__dirname, 'avatars.json');

// 中间件
app.use(express.json());
app.use(express.static(__dirname));

// 数据存储
let appData = {
  children: [],
  currentChildId: null,
  lastModified: Date.now()
};

// 头像数据存储（单独文件，避免影响主数据读写性能）
let avatarData = {
  avatars: {},  // key: childId, value: base64 avatar data
  lastModified: 0
};

// 加载头像数据
function loadAvatarData() {
  try {
    if (fs.existsSync(AVATAR_FILE)) {
      const data = JSON.parse(fs.readFileSync(AVATAR_FILE, 'utf8'));
      avatarData = { ...avatarData, ...data };
      console.log('📂 头像数据已加载');
    } else {
      avatarData = { avatars: {}, lastModified: Date.now() };
      saveAvatarData();
      console.log('🆕 已创建头像数据文件');
    }
  } catch (e) {
    console.error('加载头像数据失败:', e);
  }
}

// 保存头像数据
function saveAvatarData() {
  try {
    avatarData.lastModified = Date.now();
    fs.writeFileSync(AVATAR_FILE, JSON.stringify(avatarData, null, 2));
  } catch (e) {
    console.error('保存头像数据失败:', e);
  }
}

// 获取孩子的头像
function getChildAvatar(childId) {
  return avatarData.avatars[childId] || null;
}

// 设置孩子的头像
function setChildAvatar(childId, avatarBase64) {
  if (avatarBase64) {
    avatarData.avatars[childId] = avatarBase64;
  } else {
    delete avatarData.avatars[childId];
  }
  saveAvatarData();
}

// 合并数据（将头像数据合并到孩子数据中返回给客户端）
function mergeDataWithAvatars() {
  const mergedData = JSON.parse(JSON.stringify(appData));
  mergedData.children = mergedData.children.map(child => ({
    ...child,
    avatar: getChildAvatar(child.id)
  }));
  return mergedData;
}

// 加载数据
function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      appData = { ...appData, ...data };
      console.log('📂 数据已加载');
    } else {
      // 初始化默认数据
      const defaultChildId = generateId();
      appData = {
        children: [{
          id: defaultChildId,
          name: '小朋友',
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
        }],
        currentChildId: defaultChildId,
        lastModified: Date.now()
      };
      saveData();
      console.log('🆕 已创建默认数据');
    }
  } catch (e) {
    console.error('加载数据失败:', e);
  }
}

// 保存数据
function saveData() {
  try {
    appData.lastModified = Date.now();
    fs.writeFileSync(DATA_FILE, JSON.stringify(appData, null, 2));
  } catch (e) {
    console.error('保存数据失败:', e);
  }
}

// 生成唯一ID
function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

// 获取今天的日期字符串
function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// API 路由

// 获取所有数据（包含头像）
app.get('/api/data', (req, res) => {
  res.json(mergeDataWithAvatars());
});

// 更新数据（处理头像分离存储）
app.post('/api/data', (req, res) => {
  const { avatars, ...mainData } = req.body;
  
  // 保存主数据（不含头像）
  appData = { ...mainData, lastModified: Date.now() };
  saveData();
  
  // 单独保存头像数据
  if (avatars) {
    avatarData.avatars = avatars;
    saveAvatarData();
  }
  
  // 广播合并后的数据给所有连接的客户端
  const mergedData = mergeDataWithAvatars();
  io.emit('dataUpdated', mergedData);
  res.json({ success: true, data: mergedData });
});

// 获取特定孩子的数据（包含头像）
app.get('/api/child/:id', (req, res) => {
  const child = appData.children.find(c => c.id === req.params.id);
  if (child) {
    const childWithAvatar = { ...child, avatar: getChildAvatar(child.id) };
    res.json(childWithAvatar);
  } else {
    res.status(404).json({ error: '孩子未找到' });
  }
});

// 更新特定孩子的数据（处理头像分离存储）
app.post('/api/child/:id', (req, res) => {
  const index = appData.children.findIndex(c => c.id === req.params.id);
  if (index !== -1) {
    const { avatar, ...childData } = req.body;
    
    // 更新主数据（不含头像）
    appData.children[index] = { ...childData, id: req.params.id };
    appData.lastModified = Date.now();
    saveData();
    
    // 单独更新头像
    if (avatar !== undefined) {
      setChildAvatar(req.params.id, avatar);
    }
    
    const mergedData = mergeDataWithAvatars();
    io.emit('dataUpdated', mergedData);
    res.json({ success: true, child: { ...appData.children[index], avatar: getChildAvatar(req.params.id) } });
  } else {
    res.status(404).json({ error: '孩子未找到' });
  }
});

// 添加新孩子
app.post('/api/children', (req, res) => {
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
  appData.children.push(newChild);
  appData.lastModified = Date.now();
  saveData();
  const mergedData = mergeDataWithAvatars();
  io.emit('dataUpdated', mergedData);
  res.json({ success: true, child: { ...newChild, avatar: null } });
});

// 删除孩子
app.delete('/api/children/:id', (req, res) => {
  if (appData.children.length <= 1) {
    return res.status(400).json({ error: '至少保留一个孩子' });
  }
  appData.children = appData.children.filter(c => c.id !== req.params.id);
  if (appData.currentChildId === req.params.id) {
    appData.currentChildId = (appData.children[0] && appData.children[0].id) || null;
  }
  // 删除孩子的头像数据
  setChildAvatar(req.params.id, null);
  appData.lastModified = Date.now();
  saveData();
  const mergedData = mergeDataWithAvatars();
  io.emit('dataUpdated', mergedData);
  res.json({ success: true });
});

// 获取孩子的头像
app.get('/api/avatar/:childId', (req, res) => {
  const avatar = getChildAvatar(req.params.childId);
  if (avatar) {
    res.json({ success: true, childId: req.params.childId, avatar });
  } else {
    res.json({ success: true, childId: req.params.childId, avatar: null });
  }
});

// 更新孩子的头像
app.post('/api/avatar/:childId', (req, res) => {
  const { avatar } = req.body;
  const child = appData.children.find(c => c.id === req.params.childId);
  
  if (!child) {
    return res.status(404).json({ error: '孩子未找到' });
  }
  
  setChildAvatar(req.params.childId, avatar);
  const mergedData = mergeDataWithAvatars();
  io.emit('dataUpdated', mergedData);
  
  res.json({ 
    success: true, 
    childId: req.params.childId,
    avatar: getChildAvatar(req.params.childId)
  });
});

// 获取所有头像数据
app.get('/api/avatars', (req, res) => {
  res.json({ success: true, avatars: avatarData.avatars });
});

// 任务打卡
app.post('/api/checkin', (req, res) => {
  const { childId, taskId, checked } = req.body;
  const child = appData.children.find(c => c.id === childId);
  
  if (!child) {
    return res.status(404).json({ error: '孩子未找到' });
  }
  
  const task = child.tasks.find(t => t.id === taskId);
  if (!task) {
    return res.status(404).json({ error: '任务未找到' });
  }
  
  const t = today();
  if (!child.dailyChecks[t]) {
    child.dailyChecks[t] = {};
  }
  
  const wasChecked = child.dailyChecks[t][taskId];
  child.dailyChecks[t][taskId] = checked;
  
  // 更新积分
  if (checked && !wasChecked) {
    child.totalScore += task.points;
  } else if (!checked && wasChecked) {
    child.totalScore = Math.max(0, child.totalScore - task.points);
  }
  
  appData.lastModified = Date.now();
  saveData();
  const mergedData = mergeDataWithAvatars();
  io.emit('dataUpdated', mergedData);
  
  res.json({ 
    success: true, 
    child: { ...child, avatar: getChildAvatar(childId) },
    pointsChanged: checked && !wasChecked ? task.points : (!checked && wasChecked ? -task.points : 0)
  });
});

// Socket.IO 连接处理
io.on('connection', (socket) => {
  console.log('🔌 客户端已连接:', socket.id);
  
  // 发送当前数据给新连接的客户端（包含头像）
  socket.emit('dataUpdated', mergeDataWithAvatars());
  
  socket.on('disconnect', () => {
    console.log('🔌 客户端已断开:', socket.id);
  });
  
  // 客户端请求同步数据
  socket.on('requestSync', () => {
    socket.emit('dataUpdated', mergeDataWithAvatars());
  });
  
  // 客户端更新数据（处理头像分离存储）
  socket.on('updateData', (data) => {
    const { avatars, ...mainData } = data;
    
    // 保存主数据
    appData = { ...mainData, lastModified: Date.now() };
    saveData();
    
    // 单独保存头像数据
    if (avatars) {
      avatarData.avatars = avatars;
      saveAvatarData();
    }
    
    // 广播合并后的数据给所有其他客户端
    const mergedData = mergeDataWithAvatars();
    socket.broadcast.emit('dataUpdated', mergedData);
  });
});

// 启动服务器
loadData();
loadAvatarData();
server.listen(PORT, () => {
  console.log(`
🌟 儿童每日任务打卡积分助手服务端已启动！
📱 访问地址: http://localhost:${PORT}
💾 数据文件: ${DATA_FILE}
🖼️  头像文件: ${AVATAR_FILE}
🔌 WebSocket: ws://localhost:${PORT}
  `);
});
