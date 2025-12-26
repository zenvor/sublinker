// 访问追踪服务
// 记录每个token的访问历史,用于实现二次访问验证机制

/**
 * 访问记录结构
 * @typedef {Object} AccessRecord
 * @property {boolean} sub - 是否访问过 /sub 接口
 * @property {boolean} provider - 是否访问过 /provider 接口
 * @property {number} firstAccessTime - 首次访问时间戳
 */

// 使用 Map 存储访问记录: token -> AccessRecord
const accessRecords = new Map();

// 记录过期时间(5分钟),超过此时间未完成二次访问则清除记录
const RECORD_EXPIRE_MS = 5 * 60 * 1000;

/**
 * 记录token的接口访问
 * @param {string} token - Token 字符串
 * @param {'sub' | 'provider'} endpoint - 访问的接口类型
 */
export function recordAccess(token, endpoint) {
  if (!accessRecords.has(token)) {
    accessRecords.set(token, {
      sub: false,
      provider: false,
      firstAccessTime: Date.now()
    });
  }
  
  const record = accessRecords.get(token);
  record[endpoint] = true;
}

/**
 * 检查token是否已访问过 /sub
 * @param {string} token - Token 字符串
 * @returns {boolean} 是否已访问过 /sub
 */
export function hasAccessedSub(token) {
  const record = accessRecords.get(token);
  if (!record) {
    return false;
  }
  
  return record.sub;
}

/**
 * 清除token的访问记录
 * @param {string} token - Token 字符串
 */
export function clearAccessRecord(token) {
  accessRecords.delete(token);
}

/**
 * 清理过期的访问记录
 * 定期调用此函数以释放内存
 */
export function cleanupExpiredRecords() {
  const now = Date.now();
  const expiredTokens = [];
  
  for (const [token, record] of accessRecords.entries()) {
    if (now - record.firstAccessTime > RECORD_EXPIRE_MS) {
      expiredTokens.push(token);
    }
  }
  
  expiredTokens.forEach(token => accessRecords.delete(token));
  
  if (expiredTokens.length > 0) {
    console.log(`[AccessTracker] 清理了 ${expiredTokens.length} 条过期访问记录`);
  }
}

// 每分钟清理一次过期记录
setInterval(cleanupExpiredRecords, 60 * 1000);
