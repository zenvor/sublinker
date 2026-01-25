// IP 历史记录服务
// 记录用户所有访问过的 IP，用于后续封禁

import db from '../db/index.js'

/**
 * 记录 IP 访问历史
 * 使用 upsert 逻辑：存在则更新 last_seen_at 和 access_count，不存在则插入
 * @param {string} token - Token 字符串
 * @param {string} ip - 客户端 IP
 */
export function recordIpHistory(token, ip) {
  try {
    // 使用 INSERT OR REPLACE 来实现 upsert
    // 但为了保留 first_seen_at，我们使用 INSERT ... ON CONFLICT
    const stmt = db.prepare(`
      INSERT INTO ip_history (token, ip, first_seen_at, last_seen_at, access_count)
      VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 1)
      ON CONFLICT(token, ip) DO UPDATE SET
        last_seen_at = CURRENT_TIMESTAMP,
        access_count = access_count + 1
    `)
    stmt.run(token, ip)
  } catch (error) {
    console.error(`[ipHistory] 记录IP历史失败: token=${token.slice(0, 8)}... ip=${ip}`, error)
  }
}

/**
 * 获取指定 Token 的所有历史 IP
 * @param {string} token - Token 字符串
 * @returns {Array<{ip: string, firstSeenAt: string, lastSeenAt: string, accessCount: number}>}
 */
export function getIpHistory(token) {
  const rows = db
    .prepare(
      `
    SELECT ip, first_seen_at, last_seen_at, access_count 
    FROM ip_history 
    WHERE token = ?
    ORDER BY last_seen_at DESC
  `,
    )
    .all(token)

  return rows.map((row) => ({
    ip: row.ip,
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
    accessCount: row.access_count,
  }))
}

/**
 * 获取指定 Token 用于封禁的所有 IP（合并 ip_bindings 和 ip_history）
 * @param {string} token - Token 字符串
 * @returns {Array<string>} 去重后的 IP 列表
 */
export function getAllIpsForBlocking(token) {
  // 从 ip_bindings 获取当前绑定的 IP
  const boundRows = db.prepare('SELECT ip FROM ip_bindings WHERE token = ?').all(token)
  const boundIps = boundRows.map((row) => row.ip)

  // 从 ip_history 获取历史 IP
  const historyRows = db.prepare('SELECT ip FROM ip_history WHERE token = ?').all(token)
  const historyIps = historyRows.map((row) => row.ip)

  // 合并并去重
  return [...new Set([...boundIps, ...historyIps])]
}

/**
 * 清除指定 Token 的所有 IP 历史（管理用）
 * @param {string} token - Token 字符串
 */
export function clearIpHistory(token) {
  db.prepare('DELETE FROM ip_history WHERE token = ?').run(token)
}
