#!/usr/bin/env node
/* ============================================================
   数据迁移脚本: JSON -> SQLite
   使用方法: node migrate.js
   ============================================================ */

const fs = require('fs');
const path = require('path');
const { initDatabase, saveAllData, saveAvatar, closeDatabase } = require('./db');

const DATA_FILE = path.join(__dirname, 'data.json');
const AVATAR_FILE = path.join(__dirname, 'avatars.json');

async function migrate() {
  console.log('🚀 开始数据迁移...\n');

  try {
    // 1. 检查源文件是否存在
    if (!fs.existsSync(DATA_FILE)) {
      console.error('❌ 错误: data.json 文件不存在');
      process.exit(1);
    }

    // 2. 读取 JSON 数据
    console.log('📂 读取 data.json...');
    const jsonData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    console.log(`   ✓ 找到 ${jsonData.children?.length || 0} 个孩子数据`);

    // 3. 读取头像数据
    let avatarData = { avatars: {} };
    if (fs.existsSync(AVATAR_FILE)) {
      console.log('📂 读取 avatars.json...');
      avatarData = JSON.parse(fs.readFileSync(AVATAR_FILE, 'utf8'));
      const avatarCount = Object.keys(avatarData.avatars || {}).length;
      console.log(`   ✓ 找到 ${avatarCount} 个头像数据`);
    }

    // 4. 初始化数据库
    console.log('\n📦 初始化 SQLite 数据库...');
    await initDatabase();

    // 5. 迁移主数据
    console.log('\n💾 迁移主数据到数据库...');
    await saveAllData(jsonData);
    console.log('   ✓ 孩子信息已迁移');
    console.log('   ✓ 任务数据已迁移');
    console.log('   ✓ 打卡记录已迁移');
    console.log('   ✓ 阅读书籍已迁移');
    console.log('   ✓ 阅读历史已迁移');

    // 6. 迁移头像数据
    console.log('\n🖼️  迁移头像数据...');
    const avatars = avatarData.avatars || {};
    for (const [childId, avatarBase64] of Object.entries(avatars)) {
      if (avatarBase64) {
        await saveAvatar(childId, avatarBase64);
      }
    }
    console.log(`   ✓ ${Object.keys(avatars).length} 个头像已迁移`);

    // 7. 验证数据
    console.log('\n🔍 验证数据完整性...');
    const { getAllData, getAllAvatars } = require('./db');
    const dbData = await getAllData();
    const dbAvatars = await getAllAvatars();
    
    console.log(`   ✓ 数据库中孩子数量: ${dbData.children.length}`);
    console.log(`   ✓ 数据库中头像数量: ${Object.keys(dbAvatars).length}`);
    
    // 统计任务数量
    const totalTasks = dbData.children.reduce((sum, c) => sum + (c.tasks?.length || 0), 0);
    console.log(`   ✓ 数据库中任务数量: ${totalTasks}`);

    // 8. 备份原文件
    console.log('\n📋 备份原数据文件...');
    const backupDir = path.join(__dirname, 'backup');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir);
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    fs.copyFileSync(DATA_FILE, path.join(backupDir, `data-${timestamp}.json`));
    if (fs.existsSync(AVATAR_FILE)) {
      fs.copyFileSync(AVATAR_FILE, path.join(backupDir, `avatars-${timestamp}.json`));
    }
    console.log(`   ✓ 备份已保存到 backup/ 目录`);

    console.log('\n✅ 数据迁移完成！');
    console.log('\n下一步:');
    console.log('  1. 测试应用功能是否正常');
    console.log('  2. 确认无误后可删除原 JSON 文件');
    console.log('  3. 启动服务器: npm start\n');

  } catch (error) {
    console.error('\n❌ 迁移失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await closeDatabase();
  }
}

// 运行迁移
migrate();
