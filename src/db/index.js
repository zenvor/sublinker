// 数据库初始化
// 使用 better-sqlite3 管理 SQLite 数据库

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 数据库文件路径（位于项目根目录的 data 文件夹）
const dbPath = path.join(__dirname, '../../data/cloakgate.db');

// 创建数据库连接
const db = new Database(dbPath);

// 初始化表结构
db.exec(`
  CREATE TABLE IF NOT EXISTS subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token TEXT UNIQUE NOT NULL,
    remark TEXT NOT NULL,
    max_ips INTEGER DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expired_at DATETIME
  );
  
  CREATE INDEX IF NOT EXISTS idx_subscriptions_token ON subscriptions(token);
  CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

  CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS ip_bindings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token TEXT NOT NULL,
    ip TEXT NOT NULL,
    bound_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(token, ip)
  );
  
  CREATE INDEX IF NOT EXISTS idx_ip_bindings_token ON ip_bindings(token);
`);

// 数据库迁移：确保 subscriptions 表包含 max_ips 列
// 这个迁移是为了兼容旧版本的数据库，旧版本没有 max_ips 列
// SQLite 的 CREATE TABLE IF NOT EXISTS 不会添加缺失的列
try {
  // 检查 max_ips 列是否存在
  const tableInfo = db.prepare('PRAGMA table_info(subscriptions)').all();
  const hasMaxIpsColumn = tableInfo.some(col => col.name === 'max_ips');
  
  if (!hasMaxIpsColumn) {
    console.log('检测到旧版数据库结构，正在添加 max_ips 列...');
    db.exec('ALTER TABLE subscriptions ADD COLUMN max_ips INTEGER DEFAULT 1');
    console.log('max_ips 列添加成功');
  }
} catch (error) {
  console.error('数据库迁移失败:', error.message);
}

console.log('数据库初始化完成:', dbPath);

export default db;
