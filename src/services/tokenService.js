// Token 服务
// 负责 Token 的增删改查和校验

import crypto from 'crypto';
import db from '../db/index.js';

/**
 * 生成随机 Token
 * @param {number} length - Token 长度（默认 32）
 * @returns {string}
 */
export function generateToken(length = 32) {
  return crypto.randomBytes(length).toString('hex').slice(0, length);
}

/**
 * 根据 token 字符串查询 Token 记录
 * @param {string} tokenStr - Token 字符串
 * @returns {object|null} Token 记录或 null
 */
export function getToken(tokenStr) {
  const stmt = db.prepare('SELECT * FROM tokens WHERE token = ?');
  return stmt.get(tokenStr) || null;
}

/**
 * 创建新 Token
 * @param {object} options - 创建选项
 * @param {string} options.remark - 备注
 * @param {string} options.nodeProfile - 节点配置标识
 * @param {Date|null} options.expiredAt - 过期时间
 * @returns {object} 创建的 Token 记录
 */
export function createToken(options = {}) {
  const { remark = '', nodeProfile = 'default', expiredAt = null } = options;
  const token = generateToken();
  
  const stmt = db.prepare(`
    INSERT INTO tokens (token, remark, node_profile, expired_at, status)
    VALUES (?, ?, ?, ?, 'active')
  `);
  
  const info = stmt.run(token, remark, nodeProfile, expiredAt);
  
  return {
    id: info.lastInsertRowid,
    token,
    status: 'active',
    remark,
    nodeProfile,
    expiredAt
  };
}

/**
 * 更新 Token 状态
 * @param {string} tokenStr - Token 字符串
 * @param {string} status - 新状态（active/banned）
 * @returns {boolean} 是否更新成功
 */
export function updateTokenStatus(tokenStr, status) {
  const stmt = db.prepare('UPDATE tokens SET status = ? WHERE token = ?');
  const info = stmt.run(status, tokenStr);
  return info.changes > 0;
}

/**
 * 列出所有 Token
 * @param {number} limit - 限制数量
 * @param {number} offset - 偏移量
 * @returns {array} Token 列表
 */
export function listTokens(limit = 50, offset = 0) {
  const stmt = db.prepare('SELECT * FROM tokens ORDER BY created_at DESC LIMIT ? OFFSET ?');
  return stmt.all(limit, offset);
}

/**
 * 删除 Token
 * @param {string} tokenStr - Token 字符串
 * @returns {boolean} 是否删除成功
 */
export function deleteToken(tokenStr) {
  const stmt = db.prepare('DELETE FROM tokens WHERE token = ?');
  const info = stmt.run(tokenStr);
  return info.changes > 0;
}

/**
 * 校验 Token 是否有效
 * @param {object} tokenRecord - Token 记录
 * @returns {object} { valid: boolean, reason?: string }
 */
export function isTokenValid(tokenRecord) {
  if (!tokenRecord) {
    return { valid: false, reason: 'Token 不存在' };
  }
  
  if (tokenRecord.status !== 'active') {
    return { valid: false, reason: 'Token 已被禁用' };
  }
  
  if (tokenRecord.expired_at) {
    const expiredAt = new Date(tokenRecord.expired_at);
    if (expiredAt < new Date()) {
      return { valid: false, reason: 'Token 已过期' };
    }
  }
  
  return { valid: true };
}
