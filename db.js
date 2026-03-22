/* ============================================================
   SQLite 数据库模块 - 儿童任务打卡应用
   ============================================================ */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_FILE = path.join(__dirname, 'data.db');

// 数据库连接
let db = null;

// 初始化数据库
function initDatabase() {
  return new Promise((resolve, reject) => {
    db = new sqlite3.Database(DB_FILE, (err) => {
      if (err) {
        console.error('数据库连接失败:', err);
        reject(err);
      } else {
        console.log('📦 SQLite 数据库已连接');
        createTables().then(resolve).catch(reject);
      }
    });
  });
}

// 检查并添加 sort_order 列
function migrateAddSortOrder() {
  return new Promise((resolve, reject) => {
    db.all("PRAGMA table_info(children)", [], (err, columns) => {
      if (err) return reject(err);
      
      const hasSortOrder = columns.some(col => col.name === 'sort_order');
      if (!hasSortOrder) {
        console.log('🔄 迁移: 添加 sort_order 列...');
        db.run('ALTER TABLE children ADD COLUMN sort_order INTEGER DEFAULT 0', (err) => {
          if (err) reject(err);
          else {
            console.log('✅ sort_order 列已添加');
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  });
}

// 创建表结构
function createTables() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // 孩子表
      db.run(`CREATE TABLE IF NOT EXISTS children (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        bonus_points INTEGER DEFAULT 5,
        total_score INTEGER DEFAULT 0,
        lifetime_score INTEGER DEFAULT 0,
        streak INTEGER DEFAULT 0,
        last_complete_date TEXT,
        current_child_id TEXT,
        sort_order INTEGER DEFAULT 0,
        created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
      )`, async (err) => {
        if (err) return reject(err);
        // 迁移旧表结构
        try {
          await migrateAddSortOrder();
        } catch (e) {
          return reject(e);
        }
      });

      // 任务表
      db.run(`CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        child_id TEXT NOT NULL,
        name TEXT NOT NULL,
        emoji TEXT,
        points INTEGER DEFAULT 0,
        color TEXT,
        FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE CASCADE
      )`);

      // 每日打卡表
      db.run(`CREATE TABLE IF NOT EXISTS daily_checks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        child_id TEXT NOT NULL,
        task_id TEXT NOT NULL,
        date TEXT NOT NULL,
        checked INTEGER DEFAULT 0,
        FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE CASCADE,
        UNIQUE(child_id, task_id, date)
      )`);

      // 当前阅读书籍表
      db.run(`CREATE TABLE IF NOT EXISTS reading_books (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        child_id TEXT NOT NULL UNIQUE,
        name TEXT,
        author TEXT,
        total_pages INTEGER DEFAULT 0,
        current_page INTEGER DEFAULT 0,
        FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE CASCADE
      )`);

      // 阅读历史表
      db.run(`CREATE TABLE IF NOT EXISTS reading_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        child_id TEXT NOT NULL,
        book_name TEXT NOT NULL,
        author TEXT,
        total_pages INTEGER DEFAULT 0,
        completed_date TEXT NOT NULL,
        FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE CASCADE
      )`);

      // 头像表
      db.run(`CREATE TABLE IF NOT EXISTS avatars (
        child_id TEXT PRIMARY KEY,
        avatar_data TEXT,
        updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
        FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE CASCADE
      )`, (err) => {
        if (err) {
          reject(err);
        } else {
          console.log('✅ 数据库表结构已创建');
          resolve();
        }
      });
    });
  });
}

// 关闭数据库
function closeDatabase() {
  return new Promise((resolve, reject) => {
    if (db) {
      db.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    } else {
      resolve();
    }
  });
}

// ==================== 数据访问方法 ====================

// 获取所有数据（兼容原 JSON 格式）
async function getAllData() {
  return new Promise((resolve, reject) => {
    const result = {
      children: [],
      currentChildId: null,
      lastModified: Date.now()
    };

    // 获取所有孩子（按 sort_order 排序）
    db.all('SELECT * FROM children ORDER BY sort_order ASC, created_at ASC', [], (err, children) => {
      if (err) return reject(err);
      
      if (children.length === 0) {
        return resolve(result);
      }

      let processedCount = 0;
      
      children.forEach((child) => {
        const childData = {
          id: child.id,
          name: child.name,
          bonusPoints: child.bonus_points,
          totalScore: child.total_score,
          lifetimeScore: child.lifetime_score,
          streak: child.streak,
          lastCompleteDate: child.last_complete_date,
          tasks: [],
          dailyChecks: {},
          scoreHistory: [],
          readingBook: null,
          readingHistory: []
        };

        // 设置 currentChildId
        if (child.current_child_id) {
          result.currentChildId = child.current_child_id;
        }

        // 并行获取关联数据
        Promise.all([
          // 获取任务
          new Promise((res, rej) => {
            db.all('SELECT * FROM tasks WHERE child_id = ?', [child.id], (err, tasks) => {
              if (err) return rej(err);
              childData.tasks = tasks.map(t => ({
                id: t.id,
                name: t.name,
                emoji: t.emoji,
                points: t.points,
                color: t.color
              }));
              res();
            });
          }),
          // 获取每日打卡
          new Promise((res, rej) => {
            db.all('SELECT * FROM daily_checks WHERE child_id = ?', [child.id], (err, checks) => {
              if (err) return rej(err);
              checks.forEach(check => {
                if (!childData.dailyChecks[check.date]) {
                  childData.dailyChecks[check.date] = {};
                }
                childData.dailyChecks[check.date][check.task_id] = check.checked === 1;
              });
              res();
            });
          }),
          // 获取当前阅读书籍
          new Promise((res, rej) => {
            db.get('SELECT * FROM reading_books WHERE child_id = ?', [child.id], (err, book) => {
              if (err) return rej(err);
              if (book) {
                childData.readingBook = {
                  name: book.name,
                  author: book.author,
                  totalPages: book.total_pages,
                  currentPage: book.current_page
                };
              }
              res();
            });
          }),
          // 获取阅读历史
          new Promise((res, rej) => {
            db.all('SELECT * FROM reading_history WHERE child_id = ? ORDER BY completed_date DESC', [child.id], (err, history) => {
              if (err) return rej(err);
              childData.readingHistory = history.map(h => ({
                bookName: h.book_name,
                author: h.author,
                totalPages: h.total_pages,
                completedDate: h.completed_date
              }));
              res();
            });
          })
        ]).then(() => {
          result.children.push(childData);
          processedCount++;
          if (processedCount === children.length) {
            // 如果没有设置 currentChildId，使用第一个孩子
            if (!result.currentChildId && result.children.length > 0) {
              result.currentChildId = result.children[0].id;
            }
            resolve(result);
          }
        }).catch(reject);
      });
    });
  });
}

// 保存所有数据
async function saveAllData(data) {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');

      const { children, currentChildId } = data;

      children.forEach((child, index) => {
        // 保存孩子基本信息（包含顺序）
        db.run(
          `INSERT OR REPLACE INTO children 
           (id, name, bonus_points, total_score, lifetime_score, streak, last_complete_date, current_child_id, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [child.id, child.name, child.bonusPoints || 0, child.totalScore || 0, 
           child.lifetimeScore || 0, child.streak || 0, child.lastCompleteDate, currentChildId, index]
        );

        // 保存任务
        if (child.tasks) {
          child.tasks.forEach((task) => {
            db.run(
              `INSERT OR REPLACE INTO tasks (id, child_id, name, emoji, points, color)
               VALUES (?, ?, ?, ?, ?, ?)`,
              [task.id, child.id, task.name, task.emoji, task.points, task.color]
            );
          });
        }

        // 保存每日打卡
        if (child.dailyChecks) {
          Object.entries(child.dailyChecks).forEach(([date, checks]) => {
            Object.entries(checks).forEach(([taskId, checked]) => {
              db.run(
                `INSERT OR REPLACE INTO daily_checks (child_id, task_id, date, checked)
                 VALUES (?, ?, ?, ?)`,
                [child.id, taskId, date, checked ? 1 : 0]
              );
            });
          });
        }

        // 保存当前阅读书籍
        if (child.readingBook) {
          db.run(
            `INSERT OR REPLACE INTO reading_books (child_id, name, author, total_pages, current_page)
             VALUES (?, ?, ?, ?, ?)`,
            [child.id, child.readingBook.name, child.readingBook.author, 
             child.readingBook.totalPages, child.readingBook.currentPage]
          );
        }

        // 保存阅读历史
        if (child.readingHistory) {
          child.readingHistory.forEach((book) => {
            db.run(
              `INSERT OR REPLACE INTO reading_history (child_id, book_name, author, total_pages, completed_date)
               VALUES (?, ?, ?, ?, ?)`,
              [child.id, book.bookName, book.author, book.totalPages, book.completedDate]
            );
          });
        }
      });

      db.run('COMMIT', (err) => {
        if (err) {
          db.run('ROLLBACK');
          reject(err);
        } else {
          resolve();
        }
      });
    });
  });
}

// 获取所有头像
async function getAllAvatars() {
  return new Promise((resolve, reject) => {
    db.all('SELECT child_id, avatar_data FROM avatars', [], (err, rows) => {
      if (err) return reject(err);
      const avatars = {};
      rows.forEach(row => {
        avatars[row.child_id] = row.avatar_data;
      });
      resolve(avatars);
    });
  });
}

// 保存头像
async function saveAvatar(childId, avatarData) {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT OR REPLACE INTO avatars (child_id, avatar_data, updated_at)
       VALUES (?, ?, ?)`,
      [childId, avatarData, Date.now()],
      function(err) {
        if (err) reject(err);
        else resolve();
      }
    );
  });
}

// 删除头像
async function deleteAvatar(childId) {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM avatars WHERE child_id = ?', [childId], (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

// 添加孩子
async function addChild(child) {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO children (id, name, bonus_points, total_score, lifetime_score, streak, last_complete_date)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [child.id, child.name, child.bonusPoints || 5, child.totalScore || 0, 
       child.lifetimeScore || 0, child.streak || 0, child.lastCompleteDate],
      function(err) {
        if (err) reject(err);
        else resolve();
      }
    );
  });
}

// 删除孩子
async function deleteChild(childId) {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM children WHERE id = ?', [childId], (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

// 更新孩子信息
async function updateChild(childId, data) {
  return new Promise((resolve, reject) => {
    const fields = [];
    const values = [];
    
    if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name); }
    if (data.bonusPoints !== undefined) { fields.push('bonus_points = ?'); values.push(data.bonusPoints); }
    if (data.totalScore !== undefined) { fields.push('total_score = ?'); values.push(data.totalScore); }
    if (data.lifetimeScore !== undefined) { fields.push('lifetime_score = ?'); values.push(data.lifetimeScore); }
    if (data.streak !== undefined) { fields.push('streak = ?'); values.push(data.streak); }
    if (data.lastCompleteDate !== undefined) { fields.push('last_complete_date = ?'); values.push(data.lastCompleteDate); }
    
    values.push(childId);
    
    db.run(
      `UPDATE children SET ${fields.join(', ')} WHERE id = ?`,
      values,
      (err) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });
}

// 更新当前孩子ID
async function updateCurrentChildId(childId) {
  return new Promise((resolve, reject) => {
    db.run('UPDATE children SET current_child_id = ?', [childId], (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

// 任务打卡
async function checkinTask(childId, taskId, date, checked) {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT OR REPLACE INTO daily_checks (child_id, task_id, date, checked)
       VALUES (?, ?, ?, ?)`,
      [childId, taskId, date, checked ? 1 : 0],
      (err) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });
}

module.exports = {
  initDatabase,
  closeDatabase,
  getAllData,
  saveAllData,
  getAllAvatars,
  saveAvatar,
  deleteAvatar,
  addChild,
  deleteChild,
  updateChild,
  updateCurrentChildId,
  checkinTask
};
