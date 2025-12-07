// IP 绑定服务
// 简单的 token-IP 绑定逻辑，绑定后不会自动过期

/**
 * IP 绑定 Map
 * 结构: Map<tokenStr, Map<ip, bindTimestamp>>
 */
const bindingMap = new Map();

/**
 * 检查 IP 绑定并更新记录
 * @param {string} token - Token 字符串
 * @param {string} ip - 客户端 IP
 * @param {number} maxIps - 该订阅允许的最大 IP 绑定数量
 * @returns {boolean} 是否允许访问（未超限返回 true）
 */
export function updateAndCheck(token, ip, maxIps) {
  // 获取或创建该 token 的 IP Map
  let ipMap = bindingMap.get(token);
  if (!ipMap) {
    ipMap = new Map();
    bindingMap.set(token, ipMap);
  }
  
  // 检查当前 IP 是否已绑定
  const alreadyBound = ipMap.has(ip);
  const boundCount = ipMap.size;
  
  // 如果是新 IP 且已达到绑定上限，拒绝访问
  if (!alreadyBound && boundCount >= maxIps) {
    return false;
  }
  
  // 记录/更新当前 IP 的绑定时间
  if (!alreadyBound) {
    ipMap.set(ip, Date.now());
  }
  
  return true;
}

/**
 * 获取指定 Token 的已绑定 IP 列表
 * @param {string} token - Token 字符串
 * @returns {Array<{ip: string, boundAt: number}>} 已绑定 IP 列表
 */
export function getActiveIps(token) {
  const ipMap = bindingMap.get(token);
  
  if (!ipMap) {
    return [];
  }
  
  const result = [];
  for (const [ip, timestamp] of ipMap.entries()) {
    result.push({
      ip,
      boundAt: timestamp
    });
  }
  
  return result;
}

/**
 * 获取指定 Token 的已绑定 IP 数量
 * @param {string} token - Token 字符串
 * @returns {number} 已绑定 IP 数量
 */
export function getActiveIpCount(token) {
  return getActiveIps(token).length;
}

/**
 * 清除指定 Token 的所有 IP 绑定（管理用，用于解绑设备）
 * @param {string} token - Token 字符串
 */
export function clearTokenIps(token) {
  bindingMap.delete(token);
}

/**
 * 获取所有订阅的全部已绑定 IP（用于比对非法访问）
 * @returns {Set<string>} 所有已绑定 IP 的 Set
 */
export function getAllActiveIps() {
  const allIps = new Set();
  
  for (const [, ipMap] of bindingMap.entries()) {
    for (const ip of ipMap.keys()) {
      allIps.add(ip);
    }
  }
  
  return allIps;
}
