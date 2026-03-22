const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_FILE = path.join(__dirname, 'data.db');

const db = new sqlite3.Database(DB_FILE);

db.get('PRAGMA table_info(children)', [], (err, row) => {
  if (err) {
    console.error('Error:', err);
  } else {
    console.log('\n=== children 表结构 ===\n');
    console.log('字段名\t\t类型\t\t默认值');
    console.log('----------------------------------------');
  }
  
  // 获取所有列信息
  db.all('PRAGMA table_info(children)', [], (err, rows) => {
    if (err) {
      console.error('Error:', err);
      db.close();
      return;
    }
    
    rows.forEach(row => {
      console.log(`${row.name}\t\t${row.type}\t\t${row.dflt_value || 'NULL'}`);
    });
    
    console.log('\n=====================================\n');
    
    // 查询一条示例数据
    db.get('SELECT * FROM children LIMIT 1', [], (err, row) => {
      if (err) {
        console.error('Error:', err);
      } else if (row) {
        console.log('示例数据:');
        console.log(JSON.stringify(row, null, 2));
      }
      
      db.close();
    });
  });
});
