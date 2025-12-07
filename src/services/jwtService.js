// JWT 工具服务
// 使用简单的 HMAC-SHA256 签名实现 JWT

import crypto from 'crypto';
import { jwtConfig } from '../config/authConfig.js';

/**
 * Base64URL 编码
 * @param {string} str - 原始字符串
 * @returns {string} Base64URL 编码后的字符串
 */
function base64UrlEncode(str) {
  return Buffer.from(str)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Base64URL 解码
 * @param {string} str - Base64URL 编码的字符串
 * @returns {string} 解码后的字符串
 */
function base64UrlDecode(str) {
  // 补齐 padding
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString('utf8');
}

/**
 * 生成 HMAC-SHA256 签名
 * @param {string} data - 待签名数据
 * @param {string} secret - 密钥
 * @returns {string} Base64URL 编码的签名
 */
function sign(data, secret) {
  const signature = crypto
    .createHmac('sha256', secret)
    .update(data)
    .digest('base64');
  return signature.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * 生成 JWT Token
 * @param {Object} payload - Token 负载数据
 * @returns {string} JWT Token
 */
export function generateToken(payload) {
  const header = { alg: 'HS256', typ: 'JWT' };
  
  // 添加过期时间
  const tokenPayload = {
    ...payload,
    iat: Date.now(),
    exp: Date.now() + jwtConfig.expiresIn
  };

  const headerEncoded = base64UrlEncode(JSON.stringify(header));
  const payloadEncoded = base64UrlEncode(JSON.stringify(tokenPayload));
  const signature = sign(`${headerEncoded}.${payloadEncoded}`, jwtConfig.secret);

  return `${headerEncoded}.${payloadEncoded}.${signature}`;
}

/**
 * 验证 JWT Token
 * @param {string} token - JWT Token
 * @returns {{ valid: boolean, payload?: Object, error?: string }} 验证结果
 */
export function verifyToken(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return { valid: false, error: 'Token 格式无效' };
    }

    const [headerEncoded, payloadEncoded, signature] = parts;

    // 验证签名
    const expectedSignature = sign(`${headerEncoded}.${payloadEncoded}`, jwtConfig.secret);
    if (signature !== expectedSignature) {
      return { valid: false, error: 'Token 签名无效' };
    }

    // 解析 payload
    const payload = JSON.parse(base64UrlDecode(payloadEncoded));

    // 检查过期时间
    if (payload.exp && Date.now() > payload.exp) {
      return { valid: false, error: 'Token 已过期' };
    }

    return { valid: true, payload };
  } catch (error) {
    return { valid: false, error: `Token 解析失败: ${error.message}` };
  }
}
