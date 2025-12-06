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
  CREATE TABLE IF NOT EXISTS tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    remark TEXT,
    node_profile TEXT DEFAULT 'default',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expired_at DATETIME
  );
  
  CREATE INDEX IF NOT EXISTS idx_tokens_token ON tokens(token);
  CREATE INDEX IF NOT EXISTS idx_tokens_status ON tokens(status);
`);

console.log('数据库初始化完成:', dbPath);

export default db;
