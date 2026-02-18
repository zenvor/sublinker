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
const defaultDbPath = path.join(__dirname, '../../data/cloakgate.db')
const dbPath = process.env.DB_PATH ? path.resolve(process.env.DB_PATH) : defaultDbPath

fs.mkdirSync(path.dirname(dbPath), { recursive: true })

// 创建数据库连接
const db = new Database(dbPath)

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
    last_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(token, ip)
  );
  
  CREATE INDEX IF NOT EXISTS idx_ip_bindings_token ON ip_bindings(token);

  CREATE TABLE IF NOT EXISTS ip_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token TEXT NOT NULL,
    ip TEXT NOT NULL,
    first_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    access_count INTEGER DEFAULT 1,
    UNIQUE(token, ip)
  );

  CREATE INDEX IF NOT EXISTS idx_ip_history_token ON ip_history(token);

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
    UNIQUE(token, raw_link)
  );

  CREATE INDEX IF NOT EXISTS idx_subscription_nodes_token ON subscription_nodes(token);
  CREATE INDEX IF NOT EXISTS idx_subscription_nodes_token_sort ON subscription_nodes(token, sort_order);
`)

// 数据库迁移：确保 subscriptions 表包含 max_ips 列
// 这个迁移是为了兼容旧版本的数据库，旧版本没有 max_ips 列
// SQLite 的 CREATE TABLE IF NOT EXISTS 不会添加缺失的列
try {
  // 检查 max_ips 列是否存在
  const tableInfo = db.prepare('PRAGMA table_info(subscriptions)').all()
  const hasMaxIpsColumn = tableInfo.some((col) => col.name === 'max_ips')

  if (!hasMaxIpsColumn) {
    console.log('检测到旧版数据库结构，正在添加 max_ips 列...')
    db.exec('ALTER TABLE subscriptions ADD COLUMN max_ips INTEGER DEFAULT 1')
    console.log('max_ips 列添加成功')
  }
} catch (error) {
  console.error('数据库迁移失败:', error.message)
}

// 数据库迁移：确保 ip_bindings 表包含 last_seen_at 列
try {
  const ipBindingsInfo = db.prepare('PRAGMA table_info(ip_bindings)').all()
  const hasLastSeenColumn = ipBindingsInfo.some((col) => col.name === 'last_seen_at')

  if (!hasLastSeenColumn) {
    console.log('检测到旧版数据库结构，正在添加 last_seen_at 列...')
    db.exec('ALTER TABLE ip_bindings ADD COLUMN last_seen_at DATETIME')
    db.exec('UPDATE ip_bindings SET last_seen_at = bound_at')
    console.log('last_seen_at 列添加成功')
  }
} catch (error) {
  console.error('ip_bindings 表迁移失败:', error.message)
}

// 创建 last_seen_at 索引（在迁移完成后）
try {
  db.exec('CREATE INDEX IF NOT EXISTS idx_ip_bindings_last_seen ON ip_bindings(last_seen_at)')
} catch (error) {
  console.error('创建 last_seen_at 索引失败:', error.message)
}

// 数据库迁移：确保 subscription_nodes 表包含 host/path 列
try {
  const subscriptionNodesInfo = db.prepare('PRAGMA table_info(subscription_nodes)').all()
  const hasHostColumn = subscriptionNodesInfo.some((col) => col.name === 'host')
  const hasPathColumn = subscriptionNodesInfo.some((col) => col.name === 'path')

  if (!hasHostColumn) {
    db.exec('ALTER TABLE subscription_nodes ADD COLUMN host TEXT')
  }

  if (!hasPathColumn) {
    db.exec('ALTER TABLE subscription_nodes ADD COLUMN path TEXT')
  }
} catch (error) {
  console.error('subscription_nodes 表迁移失败:', error.message)
}

console.log('数据库初始化完成:', dbPath)

export default db
