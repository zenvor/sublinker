// 订阅节点服务
// 负责按 token 管理节点持久化数据

import db from '../db/index.js'

/**
 * 替换指定订阅的所有节点
 * @param {string} token - 订阅 token
 * @param {Array<object>} nodes - 解析后的节点列表
 */
export function replaceNodesByToken(token, nodes = []) {
  const runInTransaction = db.transaction((targetToken, targetNodes) => replaceNodesByTokenInSameTransaction(targetToken, targetNodes))

  runInTransaction(token, nodes)
}

/**
 * 在当前事务内替换节点（不自行开启事务）
 * @param {string} token - 订阅 token
 * @param {Array<object>} nodes - 解析后的节点列表
 */
export function replaceNodesByTokenInSameTransaction(token, nodes = []) {
  db.prepare('DELETE FROM subscription_nodes WHERE token = ?').run(token)

  if (!nodes.length) {
    return
  }

  const insertStmt = db.prepare(`
    INSERT INTO subscription_nodes (
      token,
      raw_link,
      node_name,
      protocol,
      server,
      port,
      uuid,
      transport_type,
      security,
      host,
      path,
      sni,
      fingerprint,
      public_key,
      short_id,
      spider_x,
      flow,
      sort_order
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  nodes.forEach((node, index) => {
    insertStmt.run(
      token,
      node.rawLink,
      node.nodeName,
      node.protocol,
      node.server,
      node.port,
      node.uuid,
      node.transportType || '',
      node.security || '',
      node.host || '',
      node.path || '',
      node.sni || '',
      node.fingerprint || '',
      node.publicKey || '',
      node.shortId || '',
      node.spiderX || '',
      node.flow || '',
      node.sortOrder ?? index,
    )
  })
}

/**
 * 查询订阅节点列表
 * @param {string} token - 订阅 token
 * @returns {Array<object>} 节点列表
 */
export function listNodesByToken(token) {
  const stmt = db.prepare(`
    SELECT
      raw_link,
      node_name,
      protocol,
      server,
      port,
      uuid,
      transport_type,
      security,
      host,
      path,
      sni,
      fingerprint,
      public_key,
      short_id,
      spider_x,
      flow,
      sort_order
    FROM subscription_nodes
    WHERE token = ?
    ORDER BY sort_order ASC, id ASC
  `)

  return stmt.all(token)
}

/**
 * 获取订阅节点文本（每行一个原始链接）
 * @param {string} token - 订阅 token
 * @returns {string} 多行节点文本
 */
export function getNodeLinksTextByToken(token) {
  const stmt = db.prepare(`
    SELECT raw_link
    FROM subscription_nodes
    WHERE token = ?
    ORDER BY sort_order ASC, id ASC
  `)

  const rows = stmt.all(token)
  return rows.map((row) => row.raw_link).join('\n')
}

/**
 * 删除订阅节点
 * @param {string} token - 订阅 token
 */
export function deleteNodesByToken(token) {
  db.prepare('DELETE FROM subscription_nodes WHERE token = ?').run(token)
}

/**
 * 批量获取订阅节点数量
 * @param {Array<string>} tokens - token 列表
 * @returns {Record<string, number>} 节点数量映射
 */
export function getNodeCountsByTokens(tokens = []) {
  if (!tokens.length) {
    return {}
  }

  const placeholders = tokens.map(() => '?').join(', ')
  const stmt = db.prepare(`
    SELECT token, COUNT(*) as count
    FROM subscription_nodes
    WHERE token IN (${placeholders})
    GROUP BY token
  `)

  const rows = stmt.all(...tokens)
  const countMap = {}

  rows.forEach((row) => {
    countMap[row.token] = row.count
  })

  return countMap
}
