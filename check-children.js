const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_FILE = path.join(__dirname, 'data.db');

const db = new sqlite3.Database(DB_FILE);

console.log('\n=== 📊 当前所有孩子数据 ===\n');

db.all('SELECT * FROM children ORDER BY created_at ASC', [], (err, rows) => {
  if (err) {
    console.error('Error:', err);
    db.close();
    return;
  }
  
  console.log(`共找到 ${rows.length} 个孩子\n`);
  
  rows.forEach((row, index) => {
    console.log(`--- 孩子 #${index + 1} ---`);
    console.log(`ID:              ${row.id}`);
    console.log(`名字：            ${row.name}`);
    console.log(`创建时间戳：      ${row.created_at}`);
    console.log(`创建日期：        ${new Date(row.created_at).toLocaleString('zh-CN')}`);
    console.log(`积分：            ${row.lifetime_score}`);
    console.log(`奖励分：          ${row.bonus_points}`);
    console.log(`连续打卡：        ${row.streak} 天`);
    console.log(`最后完成日期：    ${row.last_complete_date || '无'}`);
    console.log(`当前孩子 ID:      ${row.current_child_id || '无'}`);
    console.log('');
  });
  
  console.log('=====================================\n');
  console.log('💡 提示：created_at 值越小，创建越早，在并列视图中显示在左边\n');
  
  db.close();
});
