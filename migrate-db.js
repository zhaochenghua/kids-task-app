/* ============================================================
   数据库迁移脚本 - 移除 total_score 字段
   ============================================================ */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_FILE = path.join(__dirname, 'data.db');

async function migrateDatabase() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_FILE, (err) => {
      if (err) {
        console.error('❌ 数据库连接失败:', err);
        reject(err);
        return;
      }
      console.log('📦 连接到数据库...');
      
      // SQLite 不支持直接删除列，需要重建表
      // 使用临时表迁移数据
      db.serialize(() => {
        // 1. 创建新表结构（不含 total_score）
        db.run(`CREATE TABLE IF NOT EXISTS children_new (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          bonus_points INTEGER DEFAULT 5,
          lifetime_score INTEGER DEFAULT 0,
          streak INTEGER DEFAULT 0,
          last_complete_date TEXT,
          current_child_id TEXT,
          created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
        )`, (err) => {
          if (err) {
            console.error('❌ 创建新表失败:', err);
            reject(err);
            return;
          }
          console.log('✅ 创建新表结构');
          
          // 2. 复制旧数据到新表（只复制 lifetime_score，忽略 total_score）
          db.run(`INSERT INTO children_new 
                  SELECT id, name, bonus_points, lifetime_score, streak, 
                         last_complete_date, current_child_id, created_at
                  FROM children`, (err) => {
            if (err) {
              console.error('❌ 数据迁移失败:', err);
              reject(err);
              return;
            }
            console.log('✅ 数据迁移完成');
            
            // 3. 删除旧表
            db.run('DROP TABLE children', (err) => {
              if (err) {
                console.error('❌ 删除旧表失败:', err);
                reject(err);
                return;
              }
              console.log('✅ 删除旧表');
              
              // 4. 重命名新表
              db.run('ALTER TABLE children_new RENAME TO children', (err) => {
                if (err) {
                  console.error('❌ 重命名表失败:', err);
                  reject(err);
                  return;
                }
                console.log('✅ 表重命名完成');
                
                // 5. 验证结果
                db.get('PRAGMA table_info(children)', [], (err, row) => {
                  if (err) {
                    reject(err);
                    return;
                  }
                  console.log('\n📋 新的表结构:');
                  console.log(row);
                  
                  db.close((err) => {
                    if (err) reject(err);
                    else {
                      console.log('\n✅ 数据库迁移成功完成！');
                      resolve();
                    }
                  });
                });
              });
            });
          });
        });
      });
    });
  });
}

// 执行迁移
migrateDatabase()
  .then(() => {
    console.log('🎉 迁移完成！');
    process.exit(0);
  })
  .catch((err) => {
    console.error('💥 迁移失败:', err);
    process.exit(1);
  });
