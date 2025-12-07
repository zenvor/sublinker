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
    max_ips INTEGER DEFAULT 2,
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
`);

console.log('数据库初始化完成:', dbPath);

export default db;
