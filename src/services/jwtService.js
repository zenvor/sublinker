// JWT 工具服务
// 基于 jsonwebtoken 实现签发与验签

import jwt from 'jsonwebtoken'
import { jwtConfig } from '../config/authConfig.js'

/**
 * 生成 JWT Token
 * @param {Object} payload - Token 负载数据
 * @returns {string} JWT Token
 */
export function generateToken(payload) {
  return jwt.sign(payload, jwtConfig.secret, {
    algorithm: 'HS256',
    expiresIn: jwtConfig.expiresIn,
  })
}

/**
 * 验证 JWT Token
 * @param {string} token - JWT Token
 * @returns {{ valid: boolean, payload?: Object, error?: string }} 验证结果
 */
export function verifyToken(token) {
  try {
    if (!token || typeof token !== 'string') {
      return { valid: false, error: 'Token 格式无效' }
    }

    const payload = jwt.verify(token, jwtConfig.secret, {
      algorithms: ['HS256'],
    })
    return { valid: true, payload }
  } catch (error) {
    if (error?.name === 'TokenExpiredError') {
      return { valid: false, error: 'Token 已过期' }
    }
    if (error?.name === 'JsonWebTokenError') {
      return { valid: false, error: 'Token 无效' }
    }
    return { valid: false, error: `Token 解析失败: ${error.message}` }
  }
}
