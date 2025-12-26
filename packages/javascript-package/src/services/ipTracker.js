// IP 绑定服务
// 使用数据库持久化 token-IP 绑定，绑定后不会自动过期

import db from '../db/index.js';

// 清理频率限制缓存 (token -> 上次清理时间戳)
const cleanupCache = new Map();
// 清理间隔: 1小时 (小规模用户场景下足够)
const CLEANUP_INTERVAL = 60 * 60 * 1000;

/**
 * 检查 IP 绑定并更新记录
 * @param {string} token - Token 字符串
 * @param {string} ip - 客户端 IP
 * @param {number} maxIps - 该订阅允许的最大 IP 绑定数量
 * @returns {boolean} 是否允许访问（未超限返回 true）
 */
export function updateAndCheck(token, ip, maxIps) {
  // 检查当前 IP 是否已绑定
  const existing = db.prepare('SELECT id FROM ip_bindings WHERE token = ? AND ip = ?').get(token, ip);
  const alreadyBound = !!existing;
  
  // 如果是已绑定的IP，直接更新活跃时间
  if (alreadyBound) {
    db.prepare('UPDATE ip_bindings SET last_seen_at = CURRENT_TIMESTAMP WHERE token = ? AND ip = ?').run(token, ip);
    return true;
  }
  
  // 新IP：原子性检查槽位并尝试绑定
  // 获取当前已绑定 IP 数量
  const countResult = db.prepare('SELECT COUNT(*) as count FROM ip_bindings WHERE token = ?').get(token);
  const boundCount = countResult?.count || 0;
  
  // 如果已达到绑定上限，拒绝访问
  // maxIps 为 0 时表示无限制
  if (maxIps > 0 && boundCount >= maxIps) {
    console.log(`[ipTracker] 新IP绑定失败-槽位已满: token=${token.slice(0, 8)}... ip=${ip} slots=${boundCount}/${maxIps}`);
    return false;
  }
  
  // 记录新 IP 的绑定（使用 INSERT OR IGNORE 避免重复）
  const info = db.prepare('INSERT OR IGNORE INTO ip_bindings (token, ip, last_seen_at) VALUES (?, ?, CURRENT_TIMESTAMP)').run(token, ip);
  
  if (info.changes > 0) {
    console.log(`[ipTracker] 新IP绑定成功: token=${token.slice(0, 8)}... ip=${ip} slots=${boundCount + 1}/${maxIps || '∞'}`);
  }
  
  return true;
}

/**
 * 获取指定 Token 的已绑定 IP 列表
 * @param {string} token - Token 字符串
 * @returns {Array<{ip: string, boundAt: number, lastSeenAt: number}>} 已绑定 IP 列表
 */
export function getActiveIps(token) {
  const rows = db.prepare('SELECT ip, bound_at, last_seen_at FROM ip_bindings WHERE token = ?').all(token);
  
  return rows.map(row => ({
    ip: row.ip,
    boundAt: new Date(row.bound_at).getTime(),
    lastSeenAt: row.last_seen_at ? new Date(row.last_seen_at).getTime() : new Date(row.bound_at).getTime()
  }));
}

/**
 * 获取指定 Token 的已绑定 IP 数量
 * @param {string} token - Token 字符串
 * @returns {number} 已绑定 IP 数量
 */
export function getActiveIpCount(token) {
  const result = db.prepare('SELECT COUNT(*) as count FROM ip_bindings WHERE token = ?').get(token);
  return result?.count || 0;
}

/**
 * 清除指定 Token 的所有 IP 绑定（管理用，用于解绑设备）
 * @param {string} token - Token 字符串
 */
export function clearTokenIps(token) {
  db.prepare('DELETE FROM ip_bindings WHERE token = ?').run(token);
}
export function removeTokenIp(token, ip) {
  const info = db.prepare('DELETE FROM ip_bindings WHERE token = ? AND ip = ?').run(token, ip);
  return info.changes > 0;
}

/**
 * 获取所有订阅的全部已绑定 IP（用于比对非法访问）
 * @returns {Set<string>} 所有已绑定 IP 的 Set
 */
export function getAllActiveIps() {
  const rows = db.prepare('SELECT DISTINCT ip FROM ip_bindings').all();
  return new Set(rows.map(row => row.ip));
}

/**
 * 清理指定 Token 的不活跃 IP (带频率限制)
 * @param {string} token - Token 字符串
 * @param {number} inactiveDays - 不活跃天数阈值（默认7天）
 * @returns {number} 清理的 IP 数量
 */
export function cleanupInactiveIps(token, inactiveDays = 7) {
  // 检查是否需要清理（避免频繁执行）
  const lastCleanupTime = cleanupCache.get(token) || 0;
  const now = Date.now();
  
  if (now - lastCleanupTime < CLEANUP_INTERVAL) {
    return 0; // 跳过清理
  }
  
  // 更新清理时间戳
  cleanupCache.set(token, now);
 
  const cutoffModifier = `-${inactiveDays} days`;

  const toBeCleanedStmt = db.prepare(`
    SELECT ip, last_seen_at FROM ip_bindings 
    WHERE token = ? AND (last_seen_at IS NULL OR datetime(last_seen_at) < datetime('now', ?))
  `);
  const toBeCleanedIps = toBeCleanedStmt.all(token, cutoffModifier);
  
  const stmt = db.prepare(`
    DELETE FROM ip_bindings 
    WHERE token = ? AND (last_seen_at IS NULL OR datetime(last_seen_at) < datetime('now', ?))
  `);
  
  const info = stmt.run(token, cutoffModifier);
  
  if (info.changes > 0) {
    const ips = toBeCleanedIps.map(row => `${row.ip}(${row.last_seen_at || 'NULL'})`).join(', ');
    console.log(`[ipTracker] 清理了 ${info.changes} 个不活跃IP (token=${token.slice(0, 8)}..., 阈值=${inactiveDays}天, IPs: ${ips})`);
  }
  
  return info.changes;
}

/**
 * 清理所有订阅的不活跃 IP
 * @param {number} inactiveDays - 不活跃天数阈值（默认7天）
 * @returns {number} 清理的 IP 总数
 */
export function cleanupAllInactiveIps(inactiveDays = 7) {
  const cutoffModifier = `-${inactiveDays} days`;
  
  // 清理过期IP，同时处理NULL值
  const stmt = db.prepare(`
    DELETE FROM ip_bindings 
    WHERE last_seen_at IS NULL OR datetime(last_seen_at) < datetime('now', ?)
  `);
  
  const info = stmt.run(cutoffModifier);
  
  if (info.changes > 0) {
    console.log(`[ipTracker] 全局清理了 ${info.changes} 个不活跃IP (阈值=${inactiveDays}天)`);
  }
  
  return info.changes;
}
