// 活跃 IP 统计服务
// 使用滑动窗口机制统计每个 Token 的活跃公网 IP 数量

import { WINDOW_MS, MAX_IP_PER_TOKEN } from '../config/appConfig.js';

/**
 * 活跃 IP 统计 Map
 * 结构: Map<tokenStr, Map<ip, lastSeenTimestamp>>
 */
const activeMap = new Map();

/**
 * 清理过期的 IP 记录
 * @param {Map} ipMap - IP -> timestamp 的 Map
 * @param {number} now - 当前时间戳
 */
function cleanExpiredIps(ipMap, now) {
  for (const [ip, timestamp] of ipMap.entries()) {
    if (now - timestamp > WINDOW_MS) {
      ipMap.delete(ip);
    }
  }
}

/**
 * 更新 IP 记录并检查是否允许访问
 * @param {string} token - Token 字符串
 * @param {string} ip - 客户端 IP
 * @returns {boolean} 是否允许访问（未超限返回 true）
 */
export function updateAndCheck(token, ip) {
  const now = Date.now();
  
  // 获取或创建该 token 的 IP Map
  let ipMap = activeMap.get(token);
  if (!ipMap) {
    ipMap = new Map();
    activeMap.set(token, ipMap);
  }
  
  // 1. 清理过期 IP
  cleanExpiredIps(ipMap, now);
  
  // 2. 检查当前 IP 是否已在列表中
  const alreadyExists = ipMap.has(ip);
  const activeCount = ipMap.size;
  
  // 3. 如果是新 IP 且已达到上限，拒绝访问
  if (!alreadyExists && activeCount >= MAX_IP_PER_TOKEN) {
    return false;
  }
  
  // 4. 记录/更新当前 IP 的时间戳
  ipMap.set(ip, now);
  return true;
}

/**
 * 获取指定 Token 的活跃 IP 列表
 * @param {string} token - Token 字符串
 * @returns {Array<{ip: string, lastSeen: number}>} 活跃 IP 列表
 */
export function getActiveIps(token) {
  const now = Date.now();
  const ipMap = activeMap.get(token);
  
  if (!ipMap) {
    return [];
  }
  
  // 先清理过期 IP
  cleanExpiredIps(ipMap, now);
  
  // 返回有效的 IP 列表
  const result = [];
  for (const [ip, timestamp] of ipMap.entries()) {
    result.push({
      ip,
      lastSeen: timestamp,
      // 计算还剩多少时间过期（毫秒）
      expiresIn: WINDOW_MS - (now - timestamp)
    });
  }
  
  return result;
}

/**
 * 获取指定 Token 的活跃 IP 数量（调试用）
 * @param {string} token - Token 字符串
 * @returns {number} 活跃 IP 数量
 */
export function getActiveIpCount(token) {
  return getActiveIps(token).length;
}

/**
 * 清除指定 Token 的所有 IP 记录（管理用）
 * @param {string} token - Token 字符串
 */
export function clearTokenIps(token) {
  activeMap.delete(token);
}
