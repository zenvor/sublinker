// IP 阻断服务
// 定时检查 Xray 日志，阻断非法 IP

import { exec } from 'child_process';
import { promisify } from 'util';
import { ipBlockerConfig } from '../config/appConfig.js';
import { login, getXrayLogs, extractIpsFromLogs, isLoggedIn } from './xrayLogService.js';
import { getAllActiveIps } from './ipTracker.js';

const execAsync = promisify(exec);

// 定时器 ID
let pollTimer = null;

// 已阻断的 IP 缓存（避免重复执行）
const blockedIps = new Set();

/**
 * 执行 Fail2Ban 阻断命令
 * @param {string} ip - 要阻断的 IP
 * @returns {Promise<boolean>} 是否执行成功
 */
async function banIp(ip) {
  const command = `fail2ban-client set ${ipBlockerConfig.jailName} banip ${ip}`;
  
  if (ipBlockerConfig.dryRun) {
    console.log(`[ipBlocker] [DRY-RUN] 将执行: ${command}`);
    return true;
  }
  
  try {
    await execAsync(command);
    console.log(`[ipBlocker] 已阻断 IP: ${ip}`);
    return true;
  } catch (error) {
    console.error(`[ipBlocker] 阻断 IP ${ip} 失败:`, error.message);
    return false;
  }
}

/**
 * 执行一次检查与阻断
 * @returns {Promise<{checked: number, blocked: number}>} 检查和阻断的统计
 */
export async function checkAndBlock() {
  const stats = { checked: 0, blocked: 0 };
  
  // 确保已登录
  if (!isLoggedIn()) {
    const loginSuccess = await login();
    if (!loginSuccess) {
      console.error('[ipBlocker] 无法登录 X-UI，跳过本次检查');
      return stats;
    }
  }
  
  // 获取 Xray 日志
  const logs = await getXrayLogs(ipBlockerConfig.logCount);
  if (!logs) {
    console.error('[ipBlocker] 获取日志失败，跳过本次检查');
    return stats;
  }
  
  // 提取日志中的 IP
  const logIps = extractIpsFromLogs(logs);
  stats.checked = logIps.size;
  
  if (logIps.size === 0) {
    return stats;
  }
  
  // 获取所有合法的活跃 IP
  const legalIps = getAllActiveIps();
  
  console.log(`[ipBlocker] 检查 ${logIps.size} 个 IP，合法 IP 池: ${legalIps.size} 个`);
  
  // 比对并阻断非法 IP
  for (const ip of logIps) {
    // 跳过已阻断的 IP
    if (blockedIps.has(ip)) {
      continue;
    }
    
    // 跳过合法 IP
    if (legalIps.has(ip)) {
      continue;
    }
    
    // 跳过本地/内网 IP
    if (isLocalIp(ip)) {
      continue;
    }
    
    // 阻断非法 IP
    const success = await banIp(ip);
    if (success) {
      blockedIps.add(ip);
      stats.blocked++;
    }
  }
  
  if (stats.blocked > 0) {
    console.log(`[ipBlocker] 本次检查阻断了 ${stats.blocked} 个非法 IP`);
  }
  
  return stats;
}

/**
 * 判断是否为本地/内网 IP
 * @param {string} ip - IP 地址
 * @returns {boolean}
 */
function isLocalIp(ip) {
  return (
    ip === '127.0.0.1' ||
    ip === 'localhost' ||
    ip.startsWith('10.') ||
    ip.startsWith('192.168.') ||
    ip.startsWith('172.16.') ||
    ip.startsWith('172.17.') ||
    ip.startsWith('172.18.') ||
    ip.startsWith('172.19.') ||
    ip.startsWith('172.20.') ||
    ip.startsWith('172.21.') ||
    ip.startsWith('172.22.') ||
    ip.startsWith('172.23.') ||
    ip.startsWith('172.24.') ||
    ip.startsWith('172.25.') ||
    ip.startsWith('172.26.') ||
    ip.startsWith('172.27.') ||
    ip.startsWith('172.28.') ||
    ip.startsWith('172.29.') ||
    ip.startsWith('172.30.') ||
    ip.startsWith('172.31.')
  );
}

/**
 * 启动 IP 阻断服务
 */
export function start() {
  if (pollTimer) {
    console.log('[ipBlocker] 服务已在运行中');
    return;
  }
  
  console.log(`[ipBlocker] 启动 IP 阻断服务，轮询间隔: ${ipBlockerConfig.pollInterval}ms`);
  
  if (ipBlockerConfig.dryRun) {
    console.log('[ipBlocker] 当前为 DRY-RUN 模式，不会实际执行阻断命令');
  }
  
  // 立即执行一次
  checkAndBlock();
  
  // 定时轮询
  pollTimer = setInterval(checkAndBlock, ipBlockerConfig.pollInterval);
}

/**
 * 停止 IP 阻断服务
 */
export function stop() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
    console.log('[ipBlocker] IP 阻断服务已停止');
  }
}

/**
 * 获取已阻断的 IP 列表（调试用）
 * @returns {Array<string>}
 */
export function getBlockedIps() {
  return Array.from(blockedIps);
}

/**
 * 清除已阻断 IP 缓存（管理用）
 */
export function clearBlockedCache() {
  blockedIps.clear();
  console.log('[ipBlocker] 已清除阻断 IP 缓存');
}
