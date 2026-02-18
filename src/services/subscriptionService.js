// 订阅服务
// 负责订阅的增删改查和校验

import crypto from 'crypto'
import db from '../db/index.js'
import { replaceNodesByTokenInSameTransaction, deleteNodesByToken } from './subscriptionNodeService.js'
import { clearTokenIps } from './ipTracker.js'
import { clearIpHistory } from './ipHistoryService.js'

/**
 * 生成随机 Token
 * @param {number} length - Token 长度（默认 32）
 * @returns {string}
 */
export function generateToken(length = 32) {
  return crypto.randomBytes(length).toString('hex').slice(0, length)
}

/**
 * 根据 token 字符串查询订阅记录
 * @param {string} tokenStr - Token 字符串
 * @returns {object|null} 订阅记录或 null
 */
export function getSubscription(tokenStr) {
  const stmt = db.prepare('SELECT * FROM subscriptions WHERE token = ?')
  return stmt.get(tokenStr) || null
}

/**
 * 创建新订阅
 * @param {object} options - 创建选项
 * @param {string} options.remark - 备注（必填）
 * @param {number} options.maxIps - 最大 IP 绑定数量（默认 1）
 * @param {string|null} options.expiredAt - 过期时间
 * @returns {object} 创建的订阅记录
 */
export function createSubscription(options = {}) {
  const { remark, maxIps = 1, expiredAt = null } = options
  const token = generateToken()
  
  const stmt = db.prepare(`
    INSERT INTO subscriptions (token, remark, max_ips, expired_at, status)
    VALUES (?, ?, ?, ?, 'active')
  `)
  
  const info = stmt.run(token, remark, maxIps, expiredAt)
  
  return {
    id: info.lastInsertRowid,
    token,
    status: 'active',
    remark,
    maxIps,
    expiredAt
  }
}

/**
 * 更新订阅
 * @param {string} tokenStr - Token 字符串
 * @param {object} updates - 更新内容
 * @param {string} [updates.remark] - 备注
 * @param {number} [updates.maxIps] - 最大 IP 绑定数量
 * @param {string} [updates.status] - 状态
 * @param {string|null} [updates.expiredAt] - 过期时间
 * @returns {boolean} 是否更新成功
 */
export function updateSubscription(tokenStr, updates = {}) {
  const fields = []
  const values = []
  
  if (updates.remark !== undefined) {
    fields.push('remark = ?')
    values.push(updates.remark)
  }
  if (updates.maxIps !== undefined) {
    fields.push('max_ips = ?')
    values.push(updates.maxIps)
  }
  if (updates.status !== undefined) {
    fields.push('status = ?')
    values.push(updates.status)
  }
  if (updates.expiredAt !== undefined) {
    fields.push('expired_at = ?')
    values.push(updates.expiredAt)
  }
  
  if (fields.length === 0) {
    return false
  }
  
  values.push(tokenStr)
  const stmt = db.prepare(`UPDATE subscriptions SET ${fields.join(', ')} WHERE token = ?`)
  const info = stmt.run(...values)
  return info.changes > 0
}

/**
 * 获取订阅总数
 * @returns {number} 订阅总数
 */
export function getSubscriptionCount() {
  const stmt = db.prepare('SELECT COUNT(*) as count FROM subscriptions')
  const result = stmt.get()
  return result.count
}

/**
 * 列出所有订阅
 * @param {number} limit - 限制数量
 * @param {number} offset - 偏移量
 * @returns {array} 订阅列表
 */
export function listSubscriptions(limit = 50, offset = 0) {
  const stmt = db.prepare('SELECT * FROM subscriptions ORDER BY created_at DESC LIMIT ? OFFSET ?')
  return stmt.all(limit, offset)
}

/**
 * 删除订阅
 * @param {string} tokenStr - Token 字符串
 * @returns {boolean} 是否删除成功
 */
export function deleteSubscription(tokenStr) {
  const stmt = db.prepare('DELETE FROM subscriptions WHERE token = ?')
  const info = stmt.run(tokenStr)
  return info.changes > 0
}

/**
 * 校验订阅是否有效
 * @param {object} subscription - 订阅记录
 * @returns {object} { valid: boolean, reason?: string }
 */
export function isSubscriptionValid(subscription) {
  if (!subscription) {
    return { valid: false, reason: '订阅不存在' }
  }
  
  if (subscription.status !== 'active') {
    return { valid: false, reason: '订阅已被禁用' }
  }
  
  if (subscription.expired_at) {
    const raw = String(subscription.expired_at)
    const expiredAt = raw.includes('T') ? new Date(raw) : new Date(raw.replace(' ', 'T') + 'Z')
    if (expiredAt < new Date()) {
      return { valid: false, reason: '订阅已过期' }
    }
  }
  
  return { valid: true }
}

/**
 * 创建订阅并保存节点（事务）
 */
export const createSubscriptionWithNodes = db.transaction((options, parsedNodes) => {
  const subscription = createSubscription(options)
  replaceNodesByTokenInSameTransaction(subscription.token, parsedNodes)
  return subscription
})

/**
 * 更新订阅并替换节点（事务）
 */
export const updateSubscriptionWithNodes = db.transaction((token, updates, parsedNodes, hasUpdates) => {
  if (hasUpdates) {
    updateSubscription(token, updates)
  }
  if (parsedNodes !== null) {
    replaceNodesByTokenInSameTransaction(token, parsedNodes)
  }
})

/**
 * 删除订阅及关联数据（事务）
 */
export const deleteSubscriptionWithRelated = db.transaction((token) => {
  const deleted = deleteSubscription(token)
  if (!deleted) {
    return false
  }
  clearTokenIps(token)
  deleteNodesByToken(token)
  clearIpHistory(token)
  return true
})
