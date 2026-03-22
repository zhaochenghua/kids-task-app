/* ============================================================
   儿童每日任务打卡积分助手 - 应用逻辑 (服务器同步版本)
   ============================================================ */

'use strict';

// ============================================================
// 常量 & 配置
// ============================================================

const WEEKDAYS      = ['周日','周一','周二','周三','周四','周五','周六'];
const MONTHS        = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];

// 任务卡片颜色池
const TASK_COLORS = [
  '#FF6B6B','#4ECDC4','#A29BFE','#FDCB6E',
  '#55EFC4','#FD79A8','#74B9FF','#00CEC9',
  '#E17055','#6C5CE7','#00B894','#E84393',
];

// 可选 Emoji 列表
const EMOJI_LIST = [
  '📚','✏️','🎒','🏃','🛁','🦷','🥗','🥛',
  '🎵','🎨','🧩','🎮','🌿','🐾','🌞','💪',
  '🧹','🛏️','👕','🍎','💧','😴','📖','🎯',
  '🏊','🚴','⚽','🎸','🎹','🖥️','🧪','🌈',
  '🦁','🐶','🐱','🐸','🦋','🌸','⭐','🏆',
];

// 鼓励语
const PRAISE_WORDS = [
  '太棒了！', '真厉害！', '做到了！', '超级棒！',
  '好样的！', '了不起！', '加油加油！', '完美！',
  '你最棒！', '继续努力！', '棒棒哒！', '厉害了！',
];

// ============================================================
// 音效系统 (Web Audio API)
// ============================================================

const audioContext = new (window.AudioContext || window.webkitAudioContext)();

// 播放音效函数
function playSound(type) {
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }

  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  const now = audioContext.currentTime;

  switch (type) {
    case 'check': // 任务打卡成功
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(523.25, now); // C5
      oscillator.frequency.exponentialRampToValueAtTime(1046.5, now + 0.1); // C6
      gainNode.gain.setValueAtTime(0.3, now);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
      oscillator.start(now);
      oscillator.stop(now + 0.3);
      break;

    case 'uncheck': // 取消打卡
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(440, now); // A4
      oscillator.frequency.exponentialRampToValueAtTime(220, now + 0.15); // A3
      gainNode.gain.setValueAtTime(0.2, now);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
      oscillator.start(now);
      oscillator.stop(now + 0.2);
      break;

    case 'complete': // 全部完成
      // 播放胜利音效序列
      playNote(523.25, 0.1, 0.2); // C5
      playNote(659.25, 0.1, 0.2); // E5
      playNote(783.99, 0.1, 0.2); // G5
      playNote(1046.50, 0.3, 0.4); // C6
      return;

    case 'click': // 按钮点击
      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(800, now);
      gainNode.gain.setValueAtTime(0.1, now);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
      oscillator.start(now);
      oscillator.stop(now + 0.05);
      break;

    case 'add': // 添加任务/孩子
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(659.25, now); // E5
      oscillator.frequency.exponentialRampToValueAtTime(880, now + 0.15); // A5
      gainNode.gain.setValueAtTime(0.2, now);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
      oscillator.start(now);
      oscillator.stop(now + 0.2);
      break;

    case 'delete': // 删除
      oscillator.type = 'sawtooth';
      oscillator.frequency.setValueAtTime(300, now);
      oscillator.frequency.exponentialRampToValueAtTime(100, now + 0.2);
      gainNode.gain.setValueAtTime(0.15, now);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
      oscillator.start(now);
      oscillator.stop(now + 0.2);
      break;

    case 'switch': // 切换孩子
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(440, now);
      gainNode.gain.setValueAtTime(0.15, now);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
      oscillator.start(now);
      oscillator.stop(now + 0.1);
      break;
  }
}

// 播放单个音符辅助函数
function playNote(frequency, duration, delay) {
  const osc = audioContext.createOscillator();
  const gain = audioContext.createGain();
  osc.connect(gain);
  gain.connect(audioContext.destination);

  const now = audioContext.currentTime + delay;
  osc.type = 'sine';
  osc.frequency.value = frequency;
  gain.gain.setValueAtTime(0.3, now);
  gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

  osc.start(now);
  osc.stop(now + duration);
}

// ============================================================
// 工具函数
// ============================================================

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getFullYear()}年${MONTHS[d.getMonth()]}${d.getDate()}日 ${WEEKDAYS[d.getDay()]}`;
}

function formatDateShort(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return `${MONTHS[d.getMonth()]}${d.getDate()}日`;
}

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function escapeHtml(str) {
  return str.replace(/&/g,'&').replace(/</g,'<').replace(/>/g,'>');
}

// 获取孩子的头像首字母
function getChildInitial(name) {
  return name ? name.charAt(0) : '?';
}

// ============================================================
// 服务器通信层
// ============================================================

let socket = null;
let appData = null;
let isConnected = false;
let pendingUpdates = [];

// 初始化 Socket.IO 连接
function initSocket() {
  socket = io();

  socket.on('connect', () => {
    console.log('✅ 已连接到服务器');
    isConnected = true;
    // 请求同步数据
    socket.emit('requestSync');
  });

  socket.on('disconnect', () => {
    console.log('❌ 与服务器断开连接');
    isConnected = false;
  });

  // 接收服务器数据更新
  socket.on('dataUpdated', (data) => {
    console.log('📥 收到数据更新');
    appData = data;
    currentChild = getCurrentChild();
    ensureTodayChecks();
    renderAll();
  });
}

// 发送数据更新到服务器
function syncToServer() {
  if (isConnected && socket) {
    // 分离头像数据，避免大数据影响主数据同步性能
    const avatars = {};
    if (appData && appData.children) {
      appData.children.forEach(child => {
        if (child.avatar) {
          avatars[child.id] = child.avatar;
        }
      });
    }
    
    // 发送主数据（不含头像）和单独的头像数据
    const mainData = JSON.parse(JSON.stringify(appData));
    // 从主数据中移除头像，减少传输大小
    mainData.children.forEach(child => {
      delete child.avatar;
    });
    
    socket.emit('updateData', { ...mainData, avatars });
  }
}

// API 调用辅助函数
async function apiCall(method, endpoint, data = null) {
  try {
    const options = {
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (data) options.body = JSON.stringify(data);

    const response = await fetch(`/api${endpoint}`, options);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (e) {
    console.error('API 调用失败:', e);
    return null;
  }
}

// ============================================================
// 应用状态
// ============================================================

let currentChild = null;
let allDoneShownToday = false;

// 获取当前孩子
function getCurrentChild() {
  if (!appData) return null;
  return appData.children.find(c => c.id === appData.currentChildId) || appData.children[0];
}

// 切换孩子
function switchChild(childId) {
  if (!appData) return;
  appData.currentChildId = childId;
  syncToServer();
  currentChild = getCurrentChild();
  allDoneShownToday = false;
  ensureTodayChecks();
  renderAll();
}

// 添加新孩子
async function addChild(name) {
  const result = await apiCall('POST', '/children', { name });
  if (result && result.success) {
    // 初始化积分系统
    const child = result.child;
    if (child) {
      child.lifetimeScore = 0;  // 总积分
      // dailyScore 是计算得出的，不需要存储
    }
    return child;
  }
  return null;
}

// 获取今日积分（计算得出）
function getDailyScore(child) {
  if (!child) return 0;
  const t = today();
  const checks = child.dailyChecks[t] || {};
  let daily = 0;
  child.tasks.forEach(task => {
    if (checks[task.id]) {
      daily += task.points;
    }
  });
  // 检查是否全部完成，加上奖励
  const total = child.tasks.length;
  const done = child.tasks.filter(tk => checks[tk.id]).length;
  if (done === total && total > 0) {
    daily += parseInt(child.bonusPoints) || 0;
  }
  return daily;
}

// 初始化孩子的积分系统 (用于旧数据迁移)
function initChildScoreSystem(child) {
  if (!child.lifetimeScore && child.lifetimeScore !== 0) {
    child.lifetimeScore = child.totalScore || 0;
  }
  // 保持 totalScore 兼容旧代码
  if (!child.totalScore) {
    child.totalScore = 0;
  }
  
  // 初始化阅读数据（兼容旧数据）
  if (!child.readingBook) {
    child.readingBook = null;
  }
  
  // 初始化阅读历史（兼容旧数据）
  if (!child.readingHistory) {
    child.readingHistory = [];
  }
}

// 获取累计阅读书籍数量
function getTotalBooksRead(child) {
  if (!child) return 0;
  return (child.readingHistory || []).length;
}

// 删除孩子
async function removeChild(childId) {
  if (appData.children.length <= 1) return false;

  const result = await apiCall('DELETE', `/children/${childId}`);
  if (result && result.success) {
    appData.children = appData.children.filter(c => c.id !== childId);
    if (appData.currentChildId === childId) {
      appData.currentChildId = appData.children[0].id;
    }
    syncToServer();
    return true;
  }
  return false;
}

// 确保今日打卡记录存在
function ensureTodayChecks() {
  if (!currentChild) return;
  const t = today();
  if (!currentChild.dailyChecks[t]) {
    currentChild.dailyChecks[t] = {};
    currentChild.tasks.forEach(task => {
      currentChild.dailyChecks[t][task.id] = false;
    });
    syncToServer();
  }
}

// ============================================================
// DOM 引用
// ============================================================

const $ = id => document.getElementById(id);

const els = {
  app:              $('app'),
  dateDisplay:      $('dateDisplay'),
  totalScore:       $('totalScore'),
  childName:        $('childName'),
  
  // 头像相关
  childAvatarDisplay: $('childAvatarDisplay'),
  childAvatarInitial: $('childAvatarInitial'),
  childAvatarImg:     $('childAvatarImg'),
  avatarPreview:      $('avatarPreview'),
  avatarPlaceholder:  $('avatarPlaceholder'),
  avatarImage:        $('avatarImage'),
  uploadAvatarBtn:    $('uploadAvatarBtn'),
  removeAvatarBtn:    $('removeAvatarBtn'),
  avatarFileInput:    $('avatarFileInput'),
  
  progressFill:     $('progressFill'),
  progressText:     $('progressText'),
  streakInfo:       $('streakInfo'),
  taskList:         $('taskList'),
  emptyHint:        $('emptyHint'),

  // 阅读功能相关
  readingSection:   $('readingSection'),
  readingCardBtn:   $('readingCardBtn'),
  readingStats:     $('readingStats'),
  readingBookName:  $('readingBookName'),
  readingBookPages: $('readingBookPages'),
  readingBtnProgress: $('readingBtnProgress'),

  // 庆祝
  celebrateOverlay: $('celebrateOverlay'),
  celebrateEmoji:   $('celebrateEmoji'),
  celebrateText:    $('celebrateText'),
  celebrateSub:     $('celebrateSub'),

  // 全部完成
  allDoneOverlay:   $('allDoneOverlay'),
  bonusPoints:      $('bonusPoints'),
  allDoneClose:     $('allDoneClose'),

  // 设置
  openSettings:     $('openSettings'),
  settingsModal:    $('settingsModal'),
  closeSettings:    $('closeSettings'),
  selectChild:      $('selectChild'),
  inputChildName:   $('inputChildName'),
  inputBonus:       $('inputBonus'),
  taskEditorList:   $('taskEditorList'),
  addTaskBtn:       $('addTaskBtn'),
  clearAllScores:   $('clearAllScores'),
  saveSettings:     $('saveSettings'),
  
  // 阅读书目设置
  readingBookNameInput:       $('readingBookNameInput'),
  readingBookAuthorInput:     $('readingBookAuthorInput'),
  readingBookTotalPagesInput: $('readingBookTotalPagesInput'),
  readingBookCurrentPagesInput: $('readingBookCurrentPagesInput'),
  saveReadingBookBtn:         $('saveReadingBookBtn'),
  clearReadingBookBtn:        $('clearReadingBookBtn'),

  // 孩子顺序调整
  moveChildUp:                $('moveChildUp'),
  moveChildDown:              $('moveChildDown'),
  childOrderNumber:           $('childOrderNumber'),

  // 历史
  openHistory:      $('openHistory'),
  historyModal:     $('historyModal'),
  closeHistory:     $('closeHistory'),
  historyTotalScore:$('historyTotalScore'),
  historyList:      $('historyList'),

  // 孩子切换
  switchChild:      $('switchChild'),
  childSwitchModal: $('childSwitchModal'),
  closeChildSwitch: $('closeChildSwitch'),
  childList:        $('childList'),
  addChildBtn:      $('addChildBtn'),

  // 并列视图
  splitViewBtn:     $('splitViewBtn'),
  splitViewContainer: $('splitViewContainer'),

  // 并列显示选择面板
  splitSelectModal: $('splitSelectModal'),
  closeSplitSelect: $('closeSplitSelect'),
  splitSelectList:  $('splitSelectList'),
  confirmSplitSelect: $('confirmSplitSelect'),

  // 左右切换按钮
  navPrev:          $('navPrev'),
  navNext:          $('navNext'),

  // 确认框
  confirmModal:     $('confirmModal'),
  confirmText:      $('confirmText'),
  confirmYes:       $('confirmYes'),
  confirmNo:        $('confirmNo'),
};

// ============================================================
// 渲染函数
// ============================================================

function renderAll() {
  if (!appData || !currentChild) return;
  renderHeader();
  renderHero();
  renderTasks();
  renderReading();
  updateNavButtons();
}

// 渲染孩子头像（主界面）
function renderChildAvatar() {
  if (!currentChild || !els.childAvatarDisplay) return;
  
  const avatarUrl = currentChild.avatar;
  const initial = getChildInitial(currentChild.name);
  
  if (avatarUrl) {
    els.childAvatarImg.src = avatarUrl;
    els.childAvatarImg.style.display = 'block';
    els.childAvatarInitial.style.display = 'none';
  } else {
    els.childAvatarImg.style.display = 'none';
    els.childAvatarInitial.style.display = 'flex';
    els.childAvatarInitial.textContent = initial;
  }
}

// 更新左右切换按钮的显示状态
function updateNavButtons() {
  if (!appData || !els.navPrev || !els.navNext) return;

  // 如果只有一个孩子，隐藏切换按钮
  if (appData.children.length <= 1) {
    els.navPrev.classList.add('hidden');
    els.navNext.classList.add('hidden');
    return;
  }

  // 显示切换按钮
  els.navPrev.classList.remove('hidden');
  els.navNext.classList.remove('hidden');
}

// 切换到上一个孩子
function switchToPrevChild() {
  if (!appData || appData.children.length <= 1) return;

  const currentIndex = appData.children.findIndex(c => c.id === appData.currentChildId);
  const prevIndex = currentIndex > 0 ? currentIndex - 1 : appData.children.length - 1;
  const prevChildId = appData.children[prevIndex].id;

  playSound('switch');
  switchChild(prevChildId);
  
  // 加载阅读书目到设置面板（为下次打开设置做准备）
  loadReadingBookToSettings();
}

// 切换到下一个孩子
function switchToNextChild() {
  if (!appData || appData.children.length <= 1) return;

  const currentIndex = appData.children.findIndex(c => c.id === appData.currentChildId);
  const nextIndex = currentIndex < appData.children.length - 1 ? currentIndex + 1 : 0;
  const nextChildId = appData.children[nextIndex].id;

  playSound('switch');
  switchChild(nextChildId);
  
  // 加载阅读书目到设置面板（为下次打开设置做准备）
  loadReadingBookToSettings();
}

function renderHeader() {
  const now = new Date();
  els.dateDisplay.textContent =
    `${now.getFullYear()}年${MONTHS[now.getMonth()]}${now.getDate()}日 ${WEEKDAYS[now.getDay()]}`;
  // 显示总积分
  els.totalScore.textContent = currentChild.lifetimeScore !== undefined ? currentChild.lifetimeScore : (currentChild.totalScore || 0);
}

function renderHero() {
  els.childName.textContent = currentChild.name + ' 加油！';
  
  // 渲染头像
  renderChildAvatar();

  const t = today();
  const checks = currentChild.dailyChecks[t] || {};
  const total = currentChild.tasks.length;
  const done  = currentChild.tasks.filter(task => checks[task.id]).length;
  const pct   = total > 0 ? Math.round((done / total) * 100) : 0;
  
  // 计算今日积分
  const dailyScore = getDailyScore(currentChild);
  // 获取总积分
  const lifetimeScore = currentChild.lifetimeScore !== undefined ? currentChild.lifetimeScore : (currentChild.totalScore || 0);

  els.progressFill.style.width = pct + '%';
  els.progressText.textContent = `今日完成 ${done} / ${total} 项任务 · 今日 ${dailyScore} 分`;
  els.streakInfo.textContent   = `🔥 连续打卡 ${currentChild.streak} 天 · 总积分 ${lifetimeScore}`;
}

function renderTasks() {
  const t = today();
  const checks = currentChild.dailyChecks[t] || {};

  if (currentChild.tasks.length === 0) {
    els.taskList.innerHTML = '';
    els.emptyHint.style.display = 'block';
    return;
  }
  els.emptyHint.style.display = 'none';

  els.taskList.innerHTML = currentChild.tasks.map((task, idx) => {
    const isDone = !!checks[task.id];
    const color  = task.color || TASK_COLORS[idx % TASK_COLORS.length];
    return `
      <div class="task-card ${isDone ? 'done' : ''} task-card-enter"
           style="--task-color: ${color}"
           data-id="${task.id}"
           role="button"
           tabindex="0"
           aria-label="${task.name}，${task.points}积分${isDone ? '，已完成' : ''}">
        <div class="task-emoji">${task.emoji || '⭐'}</div>
        <div class="task-info">
          <div class="task-name">${escapeHtml(task.name)}</div>
          <div class="task-points">奖励 <span>${task.points}</span> 积分</div>
        </div>
        <div class="task-check">${isDone ? '✅' : ''}</div>
      </div>
    `;
  }).join('');

  // 绑定点击事件
  els.taskList.querySelectorAll('.task-card').forEach(card => {
    card.addEventListener('click', () => handleTaskClick(card.dataset.id));
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') handleTaskClick(card.dataset.id);
    });
  });
}

// ============================================================
// 阅读功能
// ============================================================

function renderReading() {
  if (!currentChild) return;
  
  const readingBook = currentChild.readingBook;
  
  // 计算已读完的书籍数量
  const readingHistory = currentChild.readingHistory || [];
  const totalBooksRead = readingHistory.length;
  
  // 更新左侧统计显示（可点击查看历史）
  const readingStatsEl = document.getElementById('readingStats');
  if (readingStatsEl) {
    if (totalBooksRead > 0) {
      readingStatsEl.style.display = 'flex';
      readingStatsEl.innerHTML = `
        <div class="reading-stats-item" onclick="showReadingHistory()" style="cursor:pointer">
          <div class="reading-stats-content">
            <div class="reading-stats-label">累计阅读</div>
            <div class="reading-stats-value">📚 ${totalBooksRead} <span class="reading-stats-unit">本</span></div>
          </div>
        </div>
      `;
    } else {
      readingStatsEl.style.display = 'none';
    }
  }
  
  // 始终显示阅读区域
  if (els.readingSection) els.readingSection.style.display = 'block';

  if (!readingBook || !readingBook.name) {
    // 没有正在读的书，显示提示状态
    if (els.readingBookName) {
      els.readingBookName.textContent = '📚 添加一本书开始阅读吧';
    }
    if (els.readingBookPages) {
      els.readingBookPages.textContent = '点击卡片前往设置添加';
    }
    // 隐藏进度条
    const progressFill = document.getElementById('readingProgressFill');
    if (progressFill) {
      progressFill.style.width = '0%';
    }
    return;
  }

  // 更新书籍信息
  if (els.readingBookName) {
    els.readingBookName.textContent = `📚 ${escapeHtml(readingBook.name)}`;
  }

  // 更新页数信息
  if (els.readingBookPages) {
    els.readingBookPages.textContent = `已读 ${readingBook.currentPage || 0} / ${readingBook.totalPages} 页`;
  }

  // 更新进度条
  const progress = readingBook.totalPages > 0
    ? Math.round(((readingBook.currentPage || 0) / readingBook.totalPages) * 100)
    : 0;

  const progressFill = document.getElementById('readingProgressFill');
  if (progressFill) {
    progressFill.style.width = `${progress}%`;
  }
}

// 增加阅读页数
async function addReadingPages(pages = 1) {
  if (!currentChild || !currentChild.readingBook) return;
  
  const book = currentChild.readingBook;
  const oldPage = book.currentPage || 0;
  
  // 增加页数，不超过总页数
  book.currentPage = Math.min(oldPage + pages, book.totalPages);
  
  // 同步到服务器
  syncToServer();
  
  // 重新渲染
  renderReading();
  
  // 显示提示动画
  if (book.currentPage > oldPage) {
    playSound('check');
    showCelebrate('📖', '阅读进步！', `+${pages} 页`);
  }
  
  // 检查是否读完
  if (book.currentPage >= book.totalPages && oldPage < book.totalPages) {
    // 记录到历史
    recordReadingCompletion(book);

    // 清空当前书目
    currentChild.readingBook = null;
    syncToServer();
    renderReading();

    setTimeout(() => {
      showConfirm(`🎉 恭喜！《${book.name}》已经读完啦！\n\n请在设置中添加新书`, () => {
        // 关闭确认框
      });
    }, 800);
  }
}

// 记录阅读完成到历史
function recordReadingCompletion(book) {
  const t = today();
  
  // 初始化阅读历史数组
  if (!currentChild.readingHistory) {
    currentChild.readingHistory = [];
  }
  
  // 检查是否已存在相同书名的完成记录（防止重复添加）
  const alreadyExists = currentChild.readingHistory.some(
    h => h.bookName === book.name && h.completedDate === t
  );
  
  if (alreadyExists) {
    console.log(`《${book.name}》已在今日阅读历史中，跳过重复添加`);
    return;
  }
  
  // 添加完成记录
  currentChild.readingHistory.unshift({
    bookName: book.name,
    author: book.author || null,
    totalPages: book.totalPages,
    completedDate: t,
  });
  
  // 限制历史记录数量（最多 50 本）
  if (currentChild.readingHistory.length > 50) {
    currentChild.readingHistory.pop();
  }
  
  // 更新 lifetimeScore（阅读完成不计分，但记录次数）
  initChildScoreSystem(currentChild);
  
  // 播放完成音效
  playSound('complete');
}

// ============================================================
// 任务打卡逻辑
// ============================================================

async function handleTaskClick(taskId) {
  const t = today();
  ensureTodayChecks();

  const checks = currentChild.dailyChecks[t];
  const task   = currentChild.tasks.find(tk => tk.id === taskId);
  if (!task) return;

  const wasDone = !!checks[taskId];

  // 检查取消前是否全部完成
  const total = currentChild.tasks.length;
  const doneBefore = currentChild.tasks.filter(tk => checks[tk.id]).length;
  const wasAllDone = doneBefore === total && total > 0;

  // 初始化积分系统（兼容旧数据）
  initChildScoreSystem(currentChild);

  if (wasDone) {
    // 取消打卡
    checks[taskId] = false;
    
    // 扣减总积分
    currentChild.lifetimeScore = Math.max(0, (currentChild.lifetimeScore || 0) - task.points);
    currentChild.totalScore = currentChild.lifetimeScore; // 保持兼容
    
    // 如果之前全部完成，需要扣回额外奖励
    if (wasAllDone) {
      const bonus = parseInt(currentChild.bonusPoints) || 0;
      currentChild.lifetimeScore = Math.max(0, currentChild.lifetimeScore - bonus);
      currentChild.totalScore = currentChild.lifetimeScore;
      allDoneShownToday = false;
      
      // 从历史记录中移除今天的记录
      const historyIndex = currentChild.scoreHistory.findIndex(h => h.date === t);
      if (historyIndex > -1) {
        currentChild.scoreHistory.splice(historyIndex, 1);
      }
      
      // 重置连续打卡（如果今天是最后完成日期）
      if (currentChild.lastCompleteDate === t) {
        currentChild.lastCompleteDate = null;
        currentChild.streak = Math.max(0, currentChild.streak - 1);
      }
    }
    
    playSound('uncheck');
  } else {
    // 完成打卡
    checks[taskId] = true;
    
    // 增加总积分
    currentChild.lifetimeScore = (currentChild.lifetimeScore || 0) + task.points;
    currentChild.totalScore = currentChild.lifetimeScore; // 保持兼容

    // 播放打卡音效
    playSound('check');

    // 显示庆祝动画
    showCelebrate(task.emoji, randomItem(PRAISE_WORDS), `+${task.points} 积分`);
    launchConfetti();
  }

  // 同步到服务器
  syncToServer();
  renderAll();

  // 检查是否全部完成
  const done  = currentChild.tasks.filter(tk => checks[tk.id]).length;

  if (done === total && total > 0 && !wasDone && !allDoneShownToday) {
    allDoneShownToday = true;
    setTimeout(() => showAllDone(), 900);
  }
}

function showAllDone() {
  // 播放全部完成音效
  playSound('complete');

  // 发放全部完成奖励
  const bonus = parseInt(currentChild.bonusPoints) || 0;
  
  // 初始化积分系统（兼容旧数据）
  initChildScoreSystem(currentChild);
  
  // 增加总积分
  currentChild.lifetimeScore = (currentChild.lifetimeScore || 0) + bonus;
  currentChild.totalScore = currentChild.lifetimeScore; // 保持兼容

  // 更新连续打卡
  updateStreak();

  // 记录历史
  const t = today();
  const checks = currentChild.dailyChecks[t] || {};
  const earned = currentChild.tasks.reduce((sum, tk) => sum + (checks[tk.id] ? tk.points : 0), 0) + bonus;
  const existing = currentChild.scoreHistory.find(h => h.date === t);
  if (!existing) {
    currentChild.scoreHistory.unshift({
      date: t,
      earned,
      tasks: currentChild.tasks.filter(tk => checks[tk.id]).length,
      total: currentChild.tasks.length,
      bonus,
    });
    if (currentChild.scoreHistory.length > 60) currentChild.scoreHistory.pop();
  }

  syncToServer();
  renderAll();

  els.bonusPoints.textContent = bonus;
  els.allDoneOverlay.style.display = 'flex';
}

function updateStreak() {
  const t = today();
  if (currentChild.lastCompleteDate === null) {
    currentChild.streak = 1;
  } else {
    const last = new Date(currentChild.lastCompleteDate + 'T00:00:00');
    const now  = new Date(t + 'T00:00:00');
    const diff = Math.round((now - last) / 86400000);
    if (diff === 1) {
      currentChild.streak += 1;
    } else if (diff > 1) {
      currentChild.streak = 1;
    }
  }
  currentChild.lastCompleteDate = t;
}

// ============================================================
// 庆祝动画
// ============================================================

let celebrateTimer = null;

function showCelebrate(emoji, text, sub) {
  els.celebrateEmoji.textContent = emoji || '🎉';
  els.celebrateText.textContent  = text;
  els.celebrateSub.textContent   = sub;

  els.celebrateOverlay.classList.add('show');

  if (celebrateTimer) clearTimeout(celebrateTimer);
  celebrateTimer = setTimeout(() => {
    els.celebrateOverlay.classList.remove('show');
  }, 1200);
}

function launchConfetti() {
  const container = document.createElement('div');
  container.className = 'confetti-container';
  document.body.appendChild(container);

  const colors = ['#FF6B6B','#4ECDC4','#FFE66D','#A29BFE','#55EFC4','#FD79A8','#74B9FF'];
  const count  = 40;

  for (let i = 0; i < count; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.cssText = `
      left: ${Math.random() * 100}vw;
      background: ${randomItem(colors)};
      width: ${6 + Math.random() * 10}px;
      height: ${6 + Math.random() * 10}px;
      border-radius: ${Math.random() > 0.5 ? '50%' : '2px'};
      animation-duration: ${0.8 + Math.random() * 1.2}s;
      animation-delay: ${Math.random() * 0.4}s;
    `;
    container.appendChild(piece);
  }

  setTimeout(() => container.remove(), 2500);
}

// ============================================================
// 孩子切换面板
// ============================================================

function openChildSwitch() {
  renderChildList();
  els.childSwitchModal.style.display = 'flex';
}

// 渲染设置面板中的头像预览
function renderAvatarPreview(child) {
  if (!child || !els.avatarPreview) return;
  
  const avatarUrl = child.avatar;
  const initial = getChildInitial(child.name);
  
  if (avatarUrl) {
    els.avatarImage.src = avatarUrl;
    els.avatarImage.style.display = 'block';
    els.avatarPlaceholder.style.display = 'none';
    if (els.removeAvatarBtn) els.removeAvatarBtn.style.display = 'block';
  } else {
    els.avatarImage.style.display = 'none';
    els.avatarPlaceholder.style.display = 'flex';
    els.avatarPlaceholder.textContent = initial;
    if (els.removeAvatarBtn) els.removeAvatarBtn.style.display = 'none';
  }
}

// 处理头像上传
async function handleAvatarUpload(file) {
  if (!file || !currentChild) return;
  
  // 检查文件类型
  const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (!validTypes.includes(file.type)) {
    alert('请选择图片文件（支持 JPG、PNG、GIF、WebP 格式）');
    return;
  }
  
  // 检查文件大小（限制 2MB）
  if (file.size > 2 * 1024 * 1024) {
    alert('图片大小不能超过 2MB');
    return;
  }
  
  // 读取文件并转换为 Base64
  const reader = new FileReader();
  reader.onload = async (e) => {
    const base64Data = e.target.result;
    
    // 更新当前孩子的头像
    currentChild.avatar = base64Data;
    
    // 同步到服务器
    syncToServer();
    
    // 更新预览
    renderAvatarPreview(currentChild);
    renderChildAvatar();
    renderChildList();
    
    playSound('add');
  };
  reader.readAsDataURL(file);
}

// 删除头像
function handleAvatarRemove() {
  if (!currentChild) return;
  
  showConfirm('确定要删除头像吗？\n将恢复为默认的首字母显示', () => {
    currentChild.avatar = null;
    syncToServer();
    
    renderAvatarPreview(currentChild);
    renderChildAvatar();
    renderChildList();
    
    playSound('delete');
  });
}

function renderChildList() {
  if (!appData) return;

  els.childList.innerHTML = appData.children.map(child => {
    const isActive = child.id === appData.currentChildId;
    const initial = getChildInitial(child.name);
    // 初始化积分系统（兼容旧数据）
    initChildScoreSystem(child);
    // 显示总积分
    const lifetimeScore = child.lifetimeScore !== undefined ? child.lifetimeScore : (child.totalScore || 0);
    
    // 判断是否有头像
    const hasAvatar = child.avatar && child.avatar.trim() !== '';
    const avatarHtml = hasAvatar 
      ? `<img src="${escapeHtml(child.avatar)}" alt="${escapeHtml(child.name)}" />`
      : `<span>${initial}</span>`;
    
    return `
      <div class="child-item ${isActive ? 'active' : ''}" data-id="${child.id}">
        <div class="child-item-info">
          <div class="child-avatar">${avatarHtml}</div>
          <div>
            <div class="child-name-text">${escapeHtml(child.name)}</div>
            <div class="child-score">⭐ ${lifetimeScore} 总积分</div>
            ${child.readingHistory && child.readingHistory.length > 0 ? `<div class="child-reading-stats">📚 已读 ${getTotalBooksRead(child)} 本书</div>` : ''}
          </div>
        </div>
        <div class="child-item-check">✅</div>
      </div>
    `;
  }).join('');

  // 绑定点击事件
  els.childList.querySelectorAll('.child-item').forEach(item => {
    item.addEventListener('click', () => {
      const childId = item.dataset.id;
      if (childId !== appData.currentChildId) {
        switchChild(childId);
      }
      els.childSwitchModal.style.display = 'none';
    });

    // 长按删除
    let pressTimer;
    item.addEventListener('mousedown', () => {
      pressTimer = setTimeout(() => {
        if (appData.children.length > 1) {
          const childId = item.dataset.id;
          const child = appData.children.find(c => c.id === childId);
          showConfirm(`确定要删除 "${child.name}" 吗？\n所有数据将被清空！`, async () => {
            if (await removeChild(childId)) {
              currentChild = getCurrentChild();
              renderAll();
              renderChildList();
            }
          });
        }
      }, 800);
    });
    item.addEventListener('mouseup', () => clearTimeout(pressTimer));
    item.addEventListener('mouseleave', () => clearTimeout(pressTimer));

    // 触摸设备支持
    item.addEventListener('touchstart', (e) => {
      pressTimer = setTimeout(() => {
        if (appData.children.length > 1) {
          const childId = item.dataset.id;
          const child = appData.children.find(c => c.id === childId);
          showConfirm(`确定要删除 "${child.name}" 吗？\n所有数据将被清空！`, async () => {
            if (await removeChild(childId)) {
              currentChild = getCurrentChild();
              renderAll();
              renderChildList();
            }
          });
        }
      }, 800);
    });
    item.addEventListener('touchend', () => clearTimeout(pressTimer));
  });
}

async function handleAddChild() {
  const name = prompt('请输入新孩子的名字：', '');
  if (name && name.trim()) {
    const newChild = await addChild(name.trim());
    if (newChild) {
      switchChild(newChild.id);
      renderChildList();
    }
  }
}

// ============================================================
// 设置面板
// ============================================================

let editingTasks = [];
let activeEmojiTarget = null;

function openSettings() {
  // 填充孩子选择下拉菜单
  renderChildSelect();
  // 加载当前孩子的数据
  loadChildDataToSettings(currentChild);
  // 更新顺序按钮状态
  updateOrderButtonsState();
  els.settingsModal.style.display = 'flex';
}

// 渲染孩子选择下拉菜单
function renderChildSelect() {
  if (!appData || !els.selectChild) return;
  
  els.selectChild.innerHTML = '<option value="">-- 选择孩子 --</option>' +
    appData.children.map(child => 
      `<option value="${child.id}" ${child.id === currentChild.id ? 'selected' : ''}>${escapeHtml(child.name)}</option>`
    ).join('');
}

// 加载指定孩子的数据到设置面板
function loadChildDataToSettings(child) {
  if (!child) return;
  editingTasks = child.tasks.map(t => ({ ...t }));
  els.inputChildName.value = child.name;
  els.inputBonus.value = child.bonusPoints;
  renderTaskEditor();
  // 渲染头像预览
  renderAvatarPreview(child);
  // 加载阅读书目
  loadReadingBookToSettings();
}

// 更新顺序按钮状态
function updateOrderButtonsState() {
  if (!els.selectChild || !els.moveChildUp || !els.moveChildDown) return;
  
  const selectedChildId = els.selectChild.value;
  if (!selectedChildId) {
    els.moveChildUp.disabled = true;
    els.moveChildDown.disabled = true;
    if (els.childOrderNumber) {
      els.childOrderNumber.textContent = '-';
    }
    return;
  }
  
  const index = appData.children.findIndex(c => c.id === selectedChildId);
  const order = index + 1; // 从1开始计数
  
  // 更新序号显示
  if (els.childOrderNumber) {
    els.childOrderNumber.textContent = `${order} / ${appData.children.length}`;
  }
  
  // 更新按钮状态
  els.moveChildUp.disabled = index <= 0;
  els.moveChildDown.disabled = index >= appData.children.length - 1 || index === -1;
}

// 移动孩子顺序
function moveChildOrder(direction) {
  if (!els.selectChild) return;
  
  const selectedChildId = els.selectChild.value;
  if (!selectedChildId) return;
  
  const index = appData.children.findIndex(c => c.id === selectedChildId);
  if (index === -1) return;
  
  const newIndex = index + direction;
  if (newIndex < 0 || newIndex >= appData.children.length) return;
  
  // 交换位置
  const temp = appData.children[index];
  appData.children[index] = appData.children[newIndex];
  appData.children[newIndex] = temp;
  
  // 同步到服务器
  syncToServer();
  
  // 重新渲染下拉菜单
  renderChildSelect();
  
  // 保持选中状态
  els.selectChild.value = selectedChildId;
  
  // 更新按钮状态
  updateOrderButtonsState();
  
  // 如果孩子切换面板打开，也刷新它
  if (els.childSwitchModal.style.display === 'flex') {
    renderChildList();
  }
}

// 加载阅读书目到设置面板
function loadReadingBookToSettings() {
  if (!currentChild || !els.readingBookNameInput) return;
  
  const readingBook = currentChild.readingBook;
  
  if (readingBook && readingBook.name) {
    els.readingBookNameInput.value = readingBook.name;
    els.readingBookAuthorInput.value = readingBook.author || '';
    els.readingBookTotalPagesInput.value = readingBook.totalPages || '';
    els.readingBookCurrentPagesInput.value = readingBook.currentPage || '';
    if (els.clearReadingBookBtn) els.clearReadingBookBtn.style.display = 'block';
  } else {
    els.readingBookNameInput.value = '';
    els.readingBookAuthorInput.value = '';
    els.readingBookTotalPagesInput.value = '';
    els.readingBookCurrentPagesInput.value = '';
    if (els.clearReadingBookBtn) els.clearReadingBookBtn.style.display = 'none';
  }
}

function renderTaskEditor() {
  els.taskEditorList.innerHTML = editingTasks.map((task, idx) => `
    <div class="task-editor-item" data-idx="${idx}">
      <span class="task-editor-emoji" data-idx="${idx}" title="点击更换图标">${task.emoji || '⭐'}</span>
      <input class="task-editor-name"
             type="text"
             value="${escapeHtml(task.name)}"
             placeholder="任务名称"
             maxlength="20"
             data-idx="${idx}" />
      <input class="task-editor-points"
             type="number"
             value="${task.points}"
             min="1" max="99"
             data-idx="${idx}" />
      <span class="task-editor-points-label">分</span>
      <button class="task-editor-delete" data-idx="${idx}" title="删除">🗑️</button>
    </div>
  `).join('');

  els.taskEditorList.querySelectorAll('.task-editor-emoji').forEach(el => {
    el.addEventListener('click', e => {
      e.stopPropagation();
      showEmojiPicker(parseInt(el.dataset.idx), el);
    });
  });

  els.taskEditorList.querySelectorAll('.task-editor-name').forEach(el => {
    el.addEventListener('input', () => {
      editingTasks[parseInt(el.dataset.idx)].name = el.value;
    });
  });

  els.taskEditorList.querySelectorAll('.task-editor-points').forEach(el => {
    el.addEventListener('input', () => {
      editingTasks[parseInt(el.dataset.idx)].points = Math.max(1, parseInt(el.value) || 1);
    });
  });

  els.taskEditorList.querySelectorAll('.task-editor-delete').forEach(el => {
    el.addEventListener('click', () => {
      editingTasks.splice(parseInt(el.dataset.idx), 1);
      renderTaskEditor();
    });
  });
}

function addNewTask() {
  const colorIdx = editingTasks.length % TASK_COLORS.length;
  editingTasks.push({
    id:     uid(),
    name:   '',
    emoji:  randomItem(EMOJI_LIST),
    points: 2,
    color:  TASK_COLORS[colorIdx],
  });
  renderTaskEditor();
  setTimeout(() => {
    const items = els.taskEditorList.querySelectorAll('.task-editor-item');
    if (items.length > 0) {
      items[items.length - 1].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      const input = items[items.length - 1].querySelector('.task-editor-name');
      if (input) input.focus();
    }
  }, 50);
}

function saveSettings() {
  const name = els.inputChildName.value.trim();
  if (!name) {
    els.inputChildName.focus();
    els.inputChildName.style.borderColor = 'var(--primary)';
    return;
  }

  const validTasks = editingTasks.filter(t => t.name.trim() !== '');
  validTasks.forEach((t, idx) => {
    if (!t.color) t.color = TASK_COLORS[idx % TASK_COLORS.length];
    t.name = t.name.trim();
    t.points = Math.max(1, parseInt(t.points) || 1);
  });

  // 找到当前孩子在 appData.children 中的索引
  const currentChildIndex = appData.children.findIndex(c => c.id === currentChild.id);
  if (currentChildIndex === -1) return;

  // 保存任务前，先记录已打卡的任务 ID
  const t = today();
  const oldChecks = currentChild.dailyChecks[t] || {};
  const completedTaskIds = Object.keys(oldChecks).filter(id => oldChecks[id]);
  
  // 更新当前孩子的数据
  currentChild.name        = name;
  currentChild.bonusPoints = Math.max(0, parseInt(els.inputBonus.value) || 0);
  
  // 更新任务列表
  currentChild.tasks = validTasks;
  
  // 初始化积分系统（兼容旧数据）
  initChildScoreSystem(currentChild);
  
  // 保留今日已打卡状态，只更新任务列表
  // 创建新的打卡记录，保留原有已打卡状态
  const newChecks = {};
  currentChild.tasks.forEach(task => {
    // 如果任务ID在之前的已打卡列表中，保持已打卡状态
    newChecks[task.id] = completedTaskIds.includes(task.id);
  });
  currentChild.dailyChecks[t] = newChecks;
  
  // 检查是否有任务被删除但已打卡，需要扣回积分
  let scoreToDeduct = 0;
  completedTaskIds.forEach(taskId => {
    const taskStillExists = validTasks.find(t => t.id === taskId);
    if (!taskStillExists) {
      // 任务被删除了，需要扣回该任务的积分
      const deletedTask = currentChild.tasks.find(t => t.id === taskId);
      if (deletedTask) {
        scoreToDeduct += deletedTask.points;
      }
    }
  });
  
  // 如果之前全部完成，且现在有任务被删除或新增，可能需要调整
  const oldTotalTasks = Object.keys(oldChecks).length;
  const oldCompletedCount = completedTaskIds.length;
  const newTotalTasks = validTasks.length;
  const newCompletedCount = Object.values(newChecks).filter(v => v).length;
  
  // 扣回被删除任务的积分
  if (scoreToDeduct > 0) {
    currentChild.lifetimeScore = Math.max(0, currentChild.lifetimeScore - scoreToDeduct);
    currentChild.totalScore = currentChild.lifetimeScore;
  }
  
  // 如果之前全部完成，现在不是全部完成，扣回奖励分
  if (oldCompletedCount === oldTotalTasks && oldTotalTasks > 0) {
    if (newCompletedCount < newTotalTasks) {
      const bonusToDeduct = parseInt(currentChild.bonusPoints) || 0;
      currentChild.lifetimeScore = Math.max(0, currentChild.lifetimeScore - bonusToDeduct);
      currentChild.totalScore = currentChild.lifetimeScore;
    }
  }
  
  // 如果现在是全部完成，显示庆祝
  if (newCompletedCount === newTotalTasks && newTotalTasks > 0 && !allDoneShownToday) {
    showAllDone(currentChild.bonusPoints);
  }

  // 同步到服务器
  syncToServer();
  renderAll();
  // 如果在并列视图模式中，也刷新并列视图
  if (selectedSplitChildren.length > 0) {
    renderSplitView();
  }
  els.settingsModal.style.display = 'none';
}

// ============================================================
// Emoji 选择器
// ============================================================

let emojiPickerEl = null;

function showEmojiPicker(taskIdx, anchorEl) {
  closeEmojiPicker();
  activeEmojiTarget = taskIdx;

  emojiPickerEl = document.createElement('div');
  emojiPickerEl.className = 'emoji-picker';
  emojiPickerEl.innerHTML = EMOJI_LIST.map(e =>
    `<div class="emoji-picker-item" data-emoji="${e}">${e}</div>`
  ).join('');

  document.body.appendChild(emojiPickerEl);

  const rect = anchorEl.getBoundingClientRect();
  let top  = rect.bottom + 8;
  let left = rect.left;

  const pickerW = 320;
  const pickerH = 200;
  if (left + pickerW > window.innerWidth - 10) left = window.innerWidth - pickerW - 10;
  if (top + pickerH > window.innerHeight - 10) top = rect.top - pickerH - 8;

  emojiPickerEl.style.top  = top  + 'px';
  emojiPickerEl.style.left = left + 'px';

  emojiPickerEl.querySelectorAll('.emoji-picker-item').forEach(item => {
    item.addEventListener('click', e => {
      e.stopPropagation();
      editingTasks[activeEmojiTarget].emoji = item.dataset.emoji;
      renderTaskEditor();
      closeEmojiPicker();
    });
  });

  setTimeout(() => {
    document.addEventListener('click', closeEmojiPicker, { once: true });
  }, 0);
}

function closeEmojiPicker() {
  if (emojiPickerEl) {
    emojiPickerEl.remove();
    emojiPickerEl = null;
  }
}

// ============================================================
// 并列视图
// ============================================================

let isSplitView = false;
let selectedSplitChildren = [];

function toggleSplitView() {
  if (!appData || appData.children.length < 2) {
    showConfirm('需要至少两个孩子才能使用并列显示功能\n是否现在添加第二个孩子？', () => {
      handleAddChild();
    });
    return;
  }

  if (isSplitView) {
    closeSplitView();
    return;
  }

  if (appData.children.length >= 3) {
    openSplitSelectPanel();
  } else {
    selectedSplitChildren = [appData.children[0].id, appData.children[1].id];
    showSplitView();
  }
}

function openSplitSelectPanel() {
  selectedSplitChildren = [];
  renderSplitSelectList();
  els.splitSelectModal.style.display = 'flex';
}

function renderSplitSelectList() {
  const hintEl = document.querySelector('.split-select-hint');
  if (hintEl) {
    hintEl.textContent = `💡 已选择 ${selectedSplitChildren.length} 个孩子，点击确认显示`;
  }

  els.splitSelectList.innerHTML = appData.children.map(child => {
    const isSelected = selectedSplitChildren.includes(child.id);
    const initial = getChildInitial(child.name);
    // 初始化积分系统（兼容旧数据）
    initChildScoreSystem(child);
    // 显示总积分
    const lifetimeScore = child.lifetimeScore !== undefined ? child.lifetimeScore : (child.totalScore || 0);
    
    // 判断是否有头像
    const hasAvatar = child.avatar && child.avatar.trim() !== '';
    const avatarHtml = hasAvatar 
      ? `<img src="${escapeHtml(child.avatar)}" alt="${escapeHtml(child.name)}" />`
      : `<span>${initial}</span>`;
    
    return `
      <div class="split-select-item ${isSelected ? 'selected' : ''}" data-id="${child.id}">
        <div class="split-select-checkbox">${isSelected ? '✅' : ''}</div>
        <div class="split-select-avatar">${avatarHtml}</div>
        <div class="split-select-info">
          <div class="split-select-name">${escapeHtml(child.name)}</div>
          <div class="split-select-score">⭐ ${lifetimeScore}</div>
          ${child.readingHistory && child.readingHistory.length > 0 ? `<div class="split-select-reading">📚 已读 ${getTotalBooksRead(child)} 本</div>` : ''}
        </div>
      </div>
    `;
  }).join('');

  els.splitSelectList.querySelectorAll('.split-select-item').forEach(item => {
    item.addEventListener('click', () => {
      const childId = item.dataset.id;
      const idx = selectedSplitChildren.indexOf(childId);

      if (idx > -1) {
        selectedSplitChildren.splice(idx, 1);
      } else {
        selectedSplitChildren.push(childId);
      }

      renderSplitSelectList();
    });
  });
}

function confirmSplitSelection() {
  if (selectedSplitChildren.length < 2) {
    alert('请至少选择 2 个孩子进行并列显示');
    return;
  }
  els.splitSelectModal.style.display = 'none';
  showSplitView();
}

function showSplitView() {
  isSplitView = true;
  renderSplitView();
  els.splitViewContainer.style.display = 'flex';
  els.app.style.display = 'none';
  els.splitViewBtn.classList.add('active');
}

function renderSplitView() {
  els.splitViewContainer.setAttribute('data-count', selectedSplitChildren.length);
  els.splitViewContainer.innerHTML = '';

  selectedSplitChildren.forEach(childId => {
    const child = appData.children.find(c => c.id === childId);
    if (child) {
      const panel = document.createElement('div');
      panel.className = 'split-view-child-panel';
      panel.innerHTML = renderChildPanel(child);
      els.splitViewContainer.appendChild(panel);
      bindSplitViewTasks(child, panel);
    }
  });

  const closeBtn = document.createElement('button');
  closeBtn.className = 'split-view-close';
  closeBtn.textContent = '👤';
  closeBtn.onclick = closeSplitView;
  els.splitViewContainer.appendChild(closeBtn);
}

function renderChildPanel(child) {
  const t = today();
  const checks = child.dailyChecks[t] || {};
  const total = child.tasks.length;
  const done = child.tasks.filter(task => checks[task.id]).length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  // 初始化积分系统（兼容旧数据）
  initChildScoreSystem(child);

  // 获取今日积分和总积分
  const dailyScore = getDailyScore(child);
  const lifetimeScore = child.lifetimeScore || 0;

  // 处理头像显示
  const initial = getChildInitial(child.name);
  const hasAvatar = child.avatar && child.avatar.trim() !== '';
  const avatarHtml = hasAvatar
    ? `<img src="${escapeHtml(child.avatar)}" alt="${escapeHtml(child.name)}" />`
    : `<span>${initial}</span>`;

  const tasksHtml = child.tasks.map((task, idx) => {
    const isDone = !!checks[task.id];
    const color = task.color || TASK_COLORS[idx % TASK_COLORS.length];
    return `
      <div class="task-card ${isDone ? 'done' : ''}"
           style="--task-color: ${color}"
           data-task-id="${task.id}"
           data-child-id="${child.id}"
           role="button">
        <div class="task-emoji">${task.emoji || '⭐'}</div>
        <div class="task-info">
          <div class="task-name">${escapeHtml(task.name)}</div>
          <div class="task-points">奖励 <span>${task.points}</span> 积分</div>
        </div>
        <div class="task-check">${isDone ? '✅' : ''}</div>
      </div>
    `;
  }).join('');

  // 阅读区域数据
  const readingBook = child.readingBook;
  const readingHistory = child.readingHistory || [];
  const totalBooksRead = readingHistory.length;
  const readingProgress = readingBook && readingBook.totalPages > 0
    ? Math.round(((readingBook.currentPage || 0) / readingBook.totalPages) * 100)
    : 0;

  // 累计阅读统计卡片（仅在已读书籍 > 0 时显示）
  let statsHtml = '';
  if (totalBooksRead > 0) {
    statsHtml = `
      <div class="split-view-reading-stats" onclick="showChildReadingHistory('${child.id}')">

        <div class="split-view-reading-stats-content">
          <div class="split-view-reading-stats-label">累计阅读</div>
          <div class="split-view-reading-stats-value">📚 ${totalBooksRead}</div>
        </div>
      </div>
    `;
  }

  // 底部阅读卡片
  let readingHtml = '';
  if (readingBook && readingBook.name) {
    readingHtml = `
      <div class="split-view-reading-card" data-child-id="${child.id}">
        <div class="split-view-reading-header">
          <div class="split-view-reading-book-name">${escapeHtml(readingBook.name)}</div>
          <div class="split-view-reading-pages">${readingBook.currentPage || 0} / ${readingBook.totalPages} 页</div>
        </div>
        <div class="split-view-reading-bar">
          <div class="split-view-reading-fill" style="width: ${readingProgress}%"></div>
        </div>
      </div>
    `;
  } else {
    readingHtml = `
      <div class="split-view-reading-card" data-child-id="${child.id}">
        <div class="split-view-reading-header">
          <div class="split-view-reading-book-name">点击添加一本书</div>

        </div>
        <div class="split-view-reading-bar">
          <div class="split-view-reading-fill" style="width: 0%"></div>
        </div>
      </div>
    `;
  }

  return `
    <div class="split-view-child">
      <div class="split-view-header">
        <div class="split-view-avatar-name">
          <div class="split-view-avatar-display">${avatarHtml}</div>
          <div class="split-view-name">${escapeHtml(child.name)}</div>
        </div>
        <div class="split-view-scores">
          <div class="split-view-score-badge daily">
            <span>📅</span>
            <span>${dailyScore}</span>
          </div>
          <div class="split-view-score-badge lifetime">
            <span>⭐</span>
            <span>${lifetimeScore}</span>
          </div>
        </div>
      </div>
      <div class="split-view-progress">
        <div class="split-view-progress-bar">
          <div class="split-view-progress-fill" style="width: ${pct}%"></div>
        </div>
        <div class="split-view-progress-text">今日完成 ${done} / ${total} 项任务 · 今日 ${dailyScore} 分</div>
      </div>
      <div class="split-view-tasks">
        ${tasksHtml}
      </div>
      <div class="split-view-reading-section">
        ${statsHtml}
        ${readingHtml}
      </div>
    </div>
  `;
}

function bindSplitViewTasks(child, panel) {
  const cards = panel.querySelectorAll('.task-card');

  cards.forEach(card => {
    card.addEventListener('click', () => {
      const taskId = card.dataset.taskId;
      handleSplitViewTaskClick(child, taskId);
    });
  });

  // 绑定阅读卡片点击事件
  const readingCard = panel.querySelector('.split-view-reading-card');
  if (readingCard) {
    readingCard.addEventListener('click', () => {
      // 重新获取最新的child数据
      const latestChild = appData.children.find(c => c.id === child.id);
      if (!latestChild) return;
      child = latestChild;

      // 检查是否有在读书籍
      if (!child.readingBook || !child.readingBook.name) {
        // 没有在读书籍，切换到该孩子的单视图模式并打开设置
        switchChild(child.id);
        setTimeout(() => openSettings(), 100);
        return;
      }
      // 检查是否已读完
      if (child.readingBook.currentPage >= child.readingBook.totalPages) {
        // 已读完，打开设置
        switchChild(child.id);
        setTimeout(() => openSettings(), 100);
        return;
      }
      // 有在读书籍且未读完，增加1页
      playSound('click');
      const oldPage = child.readingBook.currentPage || 0;
      const bookName = child.readingBook.name;
      const totalPages = child.readingBook.totalPages;
      child.readingBook.currentPage = Math.min(oldPage + 1, totalPages);
      syncToServer();
      // 重新渲染并列视图
      renderSplitView();
      // 播放提示
      if (child.readingBook && child.readingBook.currentPage > oldPage) {
        showCelebrate('📖', '阅读进步！', '+1 页');
      }
      // 检查是否读完
      if (child.readingBook && child.readingBook.currentPage >= totalPages && oldPage < totalPages) {
        // 记录到历史
        if (!child.readingHistory) child.readingHistory = [];
        child.readingHistory.unshift({
          bookName: bookName,
          author: child.readingBook.author || null,
          totalPages: totalPages,
          completedDate: today(),
        });
        child.readingBook = null;
        syncToServer();
        // 重新渲染并列视图，更新阅读卡片显示
        renderSplitView();
        setTimeout(() => {
          showConfirm(`🎉 恭喜！《${bookName}》已经读完啦！\n\n请在设置中添加新书`, () => {});
        }, 800);
      }
    });
  }
}

// 查看孩子的阅读历史
function showChildReadingHistory(childId) {
  const child = appData.children.find(c => c.id === childId);
  if (!child) return;

  const readingHistory = child.readingHistory || [];

  if (readingHistory.length === 0) {
    showConfirm('还没有已读的书籍哦', () => {});
    return;
  }

  // 构建阅读历史列表
  const historyContent = readingHistory.map(item => `
    <div class="reading-history-item">
      <div class="reading-history-book">
        <div class="reading-history-book-name">📚 ${escapeHtml(item.bookName)}</div>
        ${item.author ? `<div class="reading-history-book-author">✍️ ${escapeHtml(item.author)}</div>` : ''}
        <div class="reading-history-pages">${item.totalPages} 页</div>
      </div>
      <div class="reading-history-date">${formatDateShort(item.completedDate)}</div>
      <div class="reading-history-complete">✅</div>
    </div>
  `).join('');

  // 显示对话框
  els.historyTotalScore.innerHTML = `<span>已读书籍 ${readingHistory.length} 本</span>`;
  els.historyList.innerHTML = '';
  const readingHistorySection = document.getElementById('readingHistorySection');
  const readingHistoryList = document.getElementById('readingHistoryList');
  if (readingHistorySection) readingHistorySection.style.display = 'block';
  if (readingHistoryList) readingHistoryList.innerHTML = historyContent;

  els.historyModal.style.display = 'flex';
}

// 显示指定孩子的积分历史
function showChildHistory(child) {
  // 初始化积分系统（兼容旧数据）
  initChildScoreSystem(child);
  
  // 获取总积分
  const lifetimeScore = child.lifetimeScore || 0;
    
  // 显示积分信息
  els.historyTotalScore.innerHTML = `
    <div class="score-breakdown">
      <span class="score-daily">今日：${dailyScore}</span>
      <span class="score-lifetime">总积分：${lifetimeScore}</span>
    </div>
  `;

  // 显示阅读历史
  const readingHistorySection = document.getElementById('readingHistorySection');
  const readingHistoryList = document.getElementById('readingHistoryList');
  
  if (readingHistorySection && readingHistoryList) {
    const readingHistory = child.readingHistory || [];
    
    if (readingHistory.length > 0) {
      readingHistorySection.style.display = 'block';
      readingHistoryList.innerHTML = readingHistory.map(item => `
        <div class="reading-history-item">
          <div class="reading-history-book">
            <div class="reading-history-book-name">📚 ${escapeHtml(item.bookName)}</div>
            <div class="reading-history-pages">${item.totalPages} 页</div>
          </div>
          <div class="reading-history-date">${formatDateShort(item.completedDate)}</div>
          <div class="reading-history-complete">✅</div>
        </div>
      `).join('');
    } else {
      readingHistorySection.style.display = 'none';
    }
  }

  if (child.scoreHistory.length === 0) {
    els.historyList.innerHTML = '<div class="history-empty">还没有积分记录哦，快去完成任务吧！🌟</div>';
  } else {
    els.historyList.innerHTML = child.scoreHistory.map(item => `
      <div class="history-item">
        <div>
          <div class="history-item-date">${formatDate(item.date)}</div>
          <div class="history-item-detail">完成 ${item.tasks}/${item.total} 项任务${item.bonus > 0 ? `，全完成奖励 +${item.bonus}` : ''}</div>
        </div>
        <div class="history-item-score">+${item.earned} ⭐</div>
      </div>
    `).join('');
  }

  els.historyModal.style.display = 'flex';
}

async function handleSplitViewTaskClick(child, taskId) {
  const t = today();

  if (!child.dailyChecks[t]) {
    child.dailyChecks[t] = {};
    child.tasks.forEach(task => {
      child.dailyChecks[t][task.id] = false;
    });
  }

  const checks = child.dailyChecks[t];
  const task = child.tasks.find(tk => tk.id === taskId);
  if (!task) return;

  const wasChecked = checks[taskId];
  
  // 检查取消前是否全部完成
  const total = child.tasks.length;
  const doneBefore = child.tasks.filter(tk => checks[tk.id]).length;
  const wasAllDone = doneBefore === total && total > 0;

  // 初始化积分系统（兼容旧数据）
  initChildScoreSystem(child);

  checks[taskId] = !wasChecked;

  if (!wasChecked) {
    // 增加总积分
    child.lifetimeScore = (child.lifetimeScore || 0) + task.points;
    child.totalScore = child.lifetimeScore; // 保持兼容
    
    playSound('check');
    showCelebrate(task.emoji, randomItem(PRAISE_WORDS), `+${task.points} 积分`);
    launchConfetti();
  } else {
    // 扣减总积分
    child.lifetimeScore = Math.max(0, (child.lifetimeScore || 0) - task.points);
    child.totalScore = child.lifetimeScore; // 保持兼容
    
    // 如果之前全部完成，需要扣回额外奖励
    if (wasAllDone) {
      const bonus = parseInt(child.bonusPoints) || 0;
      child.lifetimeScore = Math.max(0, child.lifetimeScore - bonus);
      child.totalScore = child.lifetimeScore;
      
      // 从历史记录中移除今天的记录
      const historyIndex = child.scoreHistory.findIndex(h => h.date === t);
      if (historyIndex > -1) {
        child.scoreHistory.splice(historyIndex, 1);
      }
      
      // 重置连续打卡（如果今天是最后完成日期）
      if (child.lastCompleteDate === t) {
        child.lastCompleteDate = null;
        child.streak = Math.max(0, child.streak - 1);
      }
    }
    
    playSound('uncheck');
  }

  // 检查是否全部完成
  const done = child.tasks.filter(tk => checks[tk.id]).length;

  if (done === total && total > 0 && !wasChecked) {
    const bonus = parseInt(child.bonusPoints) || 0;
    
    // 增加总积分
    child.lifetimeScore = (child.lifetimeScore || 0) + bonus;
    child.totalScore = child.lifetimeScore; // 保持兼容

    if (child.lastCompleteDate === null) {
      child.streak = 1;
    } else {
      const last = new Date(child.lastCompleteDate + 'T00:00:00');
      const now = new Date(t + 'T00:00:00');
      const diff = Math.round((now - last) / 86400000);
      if (diff === 1) {
        child.streak += 1;
      } else if (diff > 1) {
        child.streak = 1;
      }
    }
    child.lastCompleteDate = t;

    const earned = child.tasks.reduce((sum, tk) => sum + (checks[tk.id] ? tk.points : 0), 0) + bonus;
    const existing = child.scoreHistory.find(h => h.date === t);
    if (!existing) {
      child.scoreHistory.unshift({
        date: t,
        earned,
        tasks: child.tasks.filter(tk => checks[tk.id]).length,
        total: child.tasks.length,
        bonus,
      });
      if (child.scoreHistory.length > 60) child.scoreHistory.pop();
    }

    setTimeout(() => {
      els.bonusPoints.textContent = bonus;
      els.allDoneOverlay.style.display = 'flex';
    }, 500);
  }

  syncToServer();
  renderSplitView();
}

function closeSplitView() {
  isSplitView = false;
  els.splitViewContainer.style.display = 'none';
  els.app.style.display = 'flex';
  els.splitViewBtn.classList.remove('active');

  const closeBtn = els.splitViewContainer.querySelector('.split-view-close');
  if (closeBtn) closeBtn.remove();

  currentChild = getCurrentChild();
  renderAll();
}

// ============================================================
// 积分历史
// ============================================================

function openHistory() {
  // 初始化积分系统（兼容旧数据）
  initChildScoreSystem(currentChild);
  
  // 获取今日积分和总积分
  const dailyScore = getDailyScore(currentChild);
  const lifetimeScore = currentChild.lifetimeScore || 0;
    
  // 显示积分信息
  els.historyTotalScore.innerHTML = `
    <div class="score-breakdown">
      <span class="score-daily">今日：${dailyScore}</span>
      <span class="score-lifetime">总积分：${lifetimeScore}</span>
    </div>
  `;

  // 显示阅读历史
  const readingHistorySection = document.getElementById('readingHistorySection');
  const readingHistoryList = document.getElementById('readingHistoryList');
  
  if (readingHistorySection && readingHistoryList) {
    const readingHistory = currentChild.readingHistory || [];
    
    if (readingHistory.length > 0) {
      readingHistorySection.style.display = 'block';
      readingHistoryList.innerHTML = readingHistory.map(item => `
        <div class="reading-history-item">
          <div class="reading-history-book">
            <div class="reading-history-book-name">📚 ${escapeHtml(item.bookName)}</div>
            <div class="reading-history-pages">${item.totalPages} 页</div>
          </div>
          <div class="reading-history-date">${formatDateShort(item.completedDate)}</div>
          <div class="reading-history-complete">✅</div>
        </div>
      `).join('');
    } else {
      readingHistorySection.style.display = 'none';
    }
  }

  if (currentChild.scoreHistory.length === 0) {
    els.historyList.innerHTML = '<div class="history-empty">还没有积分记录哦，快去完成任务吧！🌟</div>';
  } else {
    els.historyList.innerHTML = currentChild.scoreHistory.map(item => `
      <div class="history-item">
        <div>
          <div class="history-item-date">${formatDate(item.date)}</div>
          <div class="history-item-detail">完成 ${item.tasks}/${item.total} 项任务${item.bonus > 0 ? `，全完成奖励 +${item.bonus}` : ''}</div>
        </div>
        <div class="history-item-score">+${item.earned} ⭐</div>
      </div>
    `).join('');
  }

  els.historyModal.style.display = 'flex';
}

// ============================================================
// 查看阅读历史
// ============================================================

function showReadingHistory() {
  if (!currentChild) return;

  const readingHistory = currentChild.readingHistory || [];

  if (readingHistory.length === 0) {
    showConfirm('还没有已读的书籍哦', () => {});
    return;
  }

  // 构建阅读历史列表
  const historyContent = readingHistory.map(item => `
    <div class="reading-history-item">
      <div class="reading-history-book">
        <div class="reading-history-book-name">📚 ${escapeHtml(item.bookName)}</div>
        ${item.author ? `<div class="reading-history-book-author">✍️ ${escapeHtml(item.author)}</div>` : ''}
        <div class="reading-history-pages">${item.totalPages} 页</div>
      </div>
      <div class="reading-history-date">${formatDateShort(item.completedDate)}</div>
      <div class="reading-history-complete">✅</div>
    </div>
  `).join('');

  // 显示对话框
  els.historyTotalScore.innerHTML = `<span>已读书籍 ${readingHistory.length} 本</span>`;
  els.historyList.innerHTML = '';
  const readingHistorySection = document.getElementById('readingHistorySection');
  const readingHistoryList = document.getElementById('readingHistoryList');
  if (readingHistorySection) readingHistorySection.style.display = 'block';
  if (readingHistoryList) readingHistoryList.innerHTML = historyContent;

  els.historyModal.style.display = 'flex';
}

// ============================================================
// 重置总积分
// ============================================================

function resetLifetimeScore() {
  showConfirm('确定要重置总积分吗？\n\n这将清空所有累计的总积分和连续打卡记录！\n此操作不可恢复！', () => {
    // 初始化积分系统
    initChildScoreSystem(currentChild);
    
    // 清空所有积分
    currentChild.lifetimeScore = 0;
    currentChild.totalScore = 0;
    currentChild.scoreHistory = [];
    currentChild.streak = 0;
    currentChild.lastCompleteDate = null;
    
    syncToServer();
    renderAll();
    els.settingsModal.style.display = 'none';
    
    // 显示成功提示
    showCelebrate('🔄', '总积分已重置！', '所有积分已清零');
  });
}

// ============================================================
// 确认对话框
// ============================================================

let confirmCallback = null;

function showConfirm(text, onYes) {
  els.confirmText.textContent = text;
  confirmCallback = onYes;
  els.confirmModal.style.display = 'flex';
}

// ============================================================
// 保存阅读书目
// ============================================================

function saveReadingBook() {
  if (!currentChild) return;
  
  const bookName = els.readingBookNameInput.value.trim();
  const bookAuthor = els.readingBookAuthorInput.value.trim();
  const totalPages = parseInt(els.readingBookTotalPagesInput.value) || 0;
  const currentPage = parseInt(els.readingBookCurrentPagesInput.value) || 0;
  
  if (!bookName) {
    alert('请输入书名');
    els.readingBookNameInput.focus();
    return;
  }
  
  if (totalPages <= 0) {
    alert('请输入正确的总页数');
    els.readingBookTotalPagesInput.focus();
    return;
  }
  
  if (currentPage < 0 || currentPage > totalPages) {
    alert('已读页数必须在 0 到总页数之间');
    els.readingBookCurrentPagesInput.focus();
    return;
  }
  
  // 保存阅读书目
  currentChild.readingBook = {
    name: bookName,
    author: bookAuthor || null,
    totalPages: totalPages,
    currentPage: currentPage,
  };
  
  // 同步到服务器
  syncToServer();
  
  // 更新显示
  renderReading();
  els.settingsModal.style.display = 'none';
  
  // 显示成功提示
  playSound('add');
  showCelebrate('📚', '书目已保存！', bookName);
}

// ============================================================
// 自动日期切换检测
// ============================================================

let lastCheckedDate = today();

function checkDateChange() {
  const current = today();
  if (current !== lastCheckedDate) {
    lastCheckedDate = current;
    ensureTodayChecks();
    allDoneShownToday = false;
    renderAll();
  }
}

setInterval(checkDateChange, 60000);

// ============================================================
// 事件绑定
// ============================================================

function bindEvents() {
  // 并列视图
  els.splitViewBtn.addEventListener('click', () => {
    playSound('click');
    toggleSplitView();
  });
  els.closeSplitSelect.addEventListener('click', () => {
    playSound('click');
    els.splitSelectModal.style.display = 'none';
  });
  els.confirmSplitSelect.addEventListener('click', () => {
    playSound('click');
    confirmSplitSelection();
  });
  els.splitSelectModal.addEventListener('click', e => {
    if (e.target === els.splitSelectModal) els.splitSelectModal.style.display = 'none';
  });

  // 孩子切换
  els.switchChild.addEventListener('click', () => {
    playSound('click');
    openChildSwitch();
  });
  els.closeChildSwitch.addEventListener('click', () => {
    playSound('click');
    els.childSwitchModal.style.display = 'none';
  });
  els.childSwitchModal.addEventListener('click', e => {
    if (e.target === els.childSwitchModal) els.childSwitchModal.style.display = 'none';
  });
  els.addChildBtn.addEventListener('click', () => {
    playSound('add');
    handleAddChild();
  });

  // 设置
  els.openSettings.addEventListener('click', () => {
    playSound('click');
    openSettings();
  });
  els.closeSettings.addEventListener('click', () => {
    playSound('click');
    els.settingsModal.style.display = 'none';
    closeEmojiPicker();
  });
  els.saveSettings.addEventListener('click', () => {
    playSound('click');
    saveSettings();
  });
  els.addTaskBtn.addEventListener('click', () => {
    playSound('add');
    addNewTask();
  });
  // 重置总积分按钮
  const resetLifetimeScoreBtn = document.getElementById('resetLifetimeScore');
  if (resetLifetimeScoreBtn) {
    resetLifetimeScoreBtn.addEventListener('click', () => {
      playSound('delete');
      resetLifetimeScore();
    });
  }

  // 孩子选择下拉菜单
  if (els.selectChild) {
    els.selectChild.addEventListener('change', () => {
      playSound('switch');
      const selectedChildId = els.selectChild.value;
      if (selectedChildId) {
        const selectedChild = appData.children.find(c => c.id === selectedChildId);
        if (selectedChild) {
          // 更新当前孩子引用和全局状态
          currentChild = selectedChild;
          appData.currentChildId = selectedChildId;
          // 同步到服务器
          syncToServer();
          // 加载孩子的数据到设置面板（重新加载编辑中的任务）
          loadChildDataToSettings(selectedChild);
          // 更新顺序按钮状态
          updateOrderButtonsState();
        }
      }
    });
  }

  // 孩子顺序调整按钮
  if (els.moveChildUp) {
    els.moveChildUp.addEventListener('click', () => {
      playSound('click');
      moveChildOrder(-1);
    });
  }
  if (els.moveChildDown) {
    els.moveChildDown.addEventListener('click', () => {
      playSound('click');
      moveChildOrder(1);
    });
  }

  // 头像上传按钮
  if (els.uploadAvatarBtn) {
    els.uploadAvatarBtn.addEventListener('click', () => {
      playSound('click');
      els.avatarFileInput.click();
    });
  }

  // 头像文件选择
  if (els.avatarFileInput) {
    els.avatarFileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        handleAvatarUpload(file);
        // 清空 input 以允许重复选择同一文件
        els.avatarFileInput.value = '';
      }
    });
  }

  // 删除头像按钮
  if (els.removeAvatarBtn) {
    els.removeAvatarBtn.addEventListener('click', () => {
      playSound('delete');
      handleAvatarRemove();
    });
  }

  els.settingsModal.addEventListener('click', e => {
    if (e.target === els.settingsModal) {
      els.settingsModal.style.display = 'none';
      closeEmojiPicker();
    }
  });

  // 阅读书目保存按钮
  if (els.saveReadingBookBtn) {
    els.saveReadingBookBtn.addEventListener('click', () => {
      playSound('click');
      saveReadingBook();
    });
  }

  // 阅读书目清除按钮
  if (els.clearReadingBookBtn) {
    els.clearReadingBookBtn.addEventListener('click', () => {
      playSound('delete');
      showConfirm('确定要清除在读书目吗？\n阅读进度将被清空！', () => {
        currentChild.readingBook = null;
        syncToServer();
        renderReading();
        loadReadingBookToSettings();
        renderAll();
      });
    });
  }

  // 历史
  els.openHistory.addEventListener('click', () => {
    playSound('click');
    openHistory();
  });
  els.closeHistory.addEventListener('click', () => {
    playSound('click');
    els.historyModal.style.display = 'none';
  });
  els.historyModal.addEventListener('click', e => {
    if (e.target === els.historyModal) els.historyModal.style.display = 'none';
  });

  // 全部完成关闭
  els.allDoneClose.addEventListener('click', () => {
    playSound('click');
    els.allDoneOverlay.style.display = 'none';
  });

  // 确认框
  els.confirmYes.addEventListener('click', () => {
    playSound('click');
    els.confirmModal.style.display = 'none';
    if (confirmCallback) {
      confirmCallback();
      confirmCallback = null;
    }
  });
  els.confirmNo.addEventListener('click', () => {
    playSound('click');
    els.confirmModal.style.display = 'none';
    confirmCallback = null;
  });
  els.confirmModal.addEventListener('click', e => {
    if (e.target === els.confirmModal) {
      els.confirmModal.style.display = 'none';
      confirmCallback = null;
    }
  });

  // 左右切换按钮
  if (els.navPrev) {
    els.navPrev.addEventListener('click', () => {
      switchToPrevChild();
    });
  }
  if (els.navNext) {
    els.navNext.addEventListener('click', () => {
      switchToNextChild();
    });
  }

  // 防止 iOS Safari 双击缩放，但允许输入框正常聚焦
  document.addEventListener('touchend', e => {
    const tagName = e.target.tagName.toLowerCase();
    const isInputElement = tagName === 'input' || tagName === 'textarea' || tagName === 'select';
    if (!isInputElement) {
      e.preventDefault();
      e.target.click && e.target.click();
    }
  }, { passive: false });

  // 阅读卡片点击增加页数
  if (els.readingCardBtn) {
    els.readingCardBtn.addEventListener('click', () => {
      if (!currentChild || !currentChild.readingBook) {
        // 没有在读书籍，打开设置面板
        openSettings();
        return;
      }
      // 检查是否已读完
      if (currentChild.readingBook.currentPage >= currentChild.readingBook.totalPages) {
        openSettings();
        return;
      }
      playSound('click');
      addReadingPages(1);
    });
  }
}

// ============================================================
// 时钟更新
// ============================================================

function startClock() {
  function tick() {
    renderHeader();
  }
  tick();
  setInterval(tick, 60000);
}

// ============================================================
// 初始化
// ============================================================

function init() {
  // 初始化 Socket.IO 连接
  initSocket();

  // 等待数据加载
  const checkDataLoaded = setInterval(() => {
    if (appData) {
      clearInterval(checkDataLoaded);
      currentChild = getCurrentChild();
      ensureTodayChecks();
      bindEvents();
      renderAll();
      startClock();

      // 检查今天是否已经全部完成
      const t = today();
      const checks = currentChild.dailyChecks[t] || {};
      const total  = currentChild.tasks.length;
      const done   = currentChild.tasks.filter(tk => checks[tk.id]).length;
      if (done === total && total > 0) {
        allDoneShownToday = true;
      }

      console.log('🌟 儿童任务打卡助手已启动！支持多端实时同步！');
    }
  }, 100);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
