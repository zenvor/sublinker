// IP 绑定服务
// 使用数据库持久化 token-IP 绑定，绑定后不会自动过期

import db from '../db/index.js';

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
  
  // 获取当前已绑定 IP 数量
  const countResult = db.prepare('SELECT COUNT(*) as count FROM ip_bindings WHERE token = ?').get(token);
  const boundCount = countResult?.count || 0;
  
  // 如果是新 IP 且已达到绑定上限，拒绝访问
  // maxIps 为 0 时表示无限制
  if (!alreadyBound && maxIps > 0 && boundCount >= maxIps) {
    return false;
  }
  
  // 记录新 IP 的绑定（使用 INSERT OR IGNORE 避免重复）
  if (!alreadyBound) {
    db.prepare('INSERT OR IGNORE INTO ip_bindings (token, ip) VALUES (?, ?)').run(token, ip);
  }
  
  return true;
}

/**
 * 获取指定 Token 的已绑定 IP 列表
 * @param {string} token - Token 字符串
 * @returns {Array<{ip: string, boundAt: number}>} 已绑定 IP 列表
 */
export function getActiveIps(token) {
  const rows = db.prepare('SELECT ip, bound_at FROM ip_bindings WHERE token = ?').all(token);
  
  return rows.map(row => ({
    ip: row.ip,
    boundAt: new Date(row.bound_at).getTime()
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

/**
 * 获取所有订阅的全部已绑定 IP（用于比对非法访问）
 * @returns {Set<string>} 所有已绑定 IP 的 Set
 */
export function getAllActiveIps() {
  const rows = db.prepare('SELECT DISTINCT ip FROM ip_bindings').all();
  return new Set(rows.map(row => row.ip));
}
