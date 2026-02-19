// 数据库初始化
// 使用 better-sqlite3 管理 SQLite 数据库

import Database from 'better-sqlite3'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 数据库文件路径（位于项目根目录 data 文件夹）
// src/db -> ../../data
const defaultDbPath = path.join(__dirname, '../../data/sublinker.db')
const dbPath = process.env.DB_PATH ? path.resolve(process.env.DB_PATH) : defaultDbPath

fs.mkdirSync(path.dirname(dbPath), { recursive: true })

// 创建数据库连接
const db = new Database(dbPath)

// 启用外键约束
db.pragma('foreign_keys = ON')

// 初始化表结构
db.exec(`
  CREATE TABLE IF NOT EXISTS subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token TEXT UNIQUE NOT NULL,
    remark TEXT NOT NULL,
    max_ips INTEGER DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
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
    last_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(token, ip),
    FOREIGN KEY(token) REFERENCES subscriptions(token) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_ip_bindings_token ON ip_bindings(token);

  CREATE TABLE IF NOT EXISTS subscription_nodes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token TEXT NOT NULL,
    raw_link TEXT NOT NULL,
    node_name TEXT NOT NULL,
    protocol TEXT NOT NULL,
    server TEXT NOT NULL,
    port INTEGER NOT NULL,
    uuid TEXT NOT NULL,
    transport_type TEXT,
    security TEXT,
    host TEXT,
    path TEXT,
    sni TEXT,
    fingerprint TEXT,
    public_key TEXT,
    short_id TEXT,
    spider_x TEXT,
    flow TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(token, raw_link),
    FOREIGN KEY(token) REFERENCES subscriptions(token) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_subscription_nodes_token ON subscription_nodes(token);
  CREATE INDEX IF NOT EXISTS idx_subscription_nodes_token_sort ON subscription_nodes(token, sort_order);

  -- updated_at 自动维护触发器
  CREATE TRIGGER IF NOT EXISTS trg_subscriptions_updated_at
  AFTER UPDATE ON subscriptions
  BEGIN UPDATE subscriptions SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id; END;

  CREATE TRIGGER IF NOT EXISTS trg_subscription_nodes_updated_at
  AFTER UPDATE ON subscription_nodes
  BEGIN UPDATE subscription_nodes SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id; END;

  CREATE TRIGGER IF NOT EXISTS trg_admins_updated_at
  AFTER UPDATE ON admins
  BEGIN UPDATE admins SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id; END;
`)

// 兼容旧数据库：subscriptions 表可能缺少 updated_at 列
try {
  db.exec('ALTER TABLE subscriptions ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP')
} catch {
  // 列已存在，忽略
}

export default db
