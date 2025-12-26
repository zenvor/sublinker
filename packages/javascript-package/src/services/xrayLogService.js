// X-UI API 客户端服务
// 负责登录认证和获取 Xray 日志

import axios from 'axios';
import qs from 'qs';
import https from 'https';
import { xuiConfig } from '../config/appConfig.js';

// 创建 HTTPS Agent，跳过证书验证（内网调用）
const httpsAgent = new https.Agent({
  rejectUnauthorized: false
});

// 创建 axios 实例
const client = axios.create({
  baseURL: `https://${xuiConfig.host}:${xuiConfig.port}${xuiConfig.webBasePath}`,
  httpsAgent,
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    'X-Requested-With': 'XMLHttpRequest'
  },
  timeout: 10000
});

// 手动管理 session cookie
let sessionCookie = '';

// 请求拦截器 - 自动添加 cookie 和序列化数据
client.interceptors.request.use(config => {
  if (sessionCookie) {
    config.headers.Cookie = sessionCookie;
  }
  // 使用 qs 库序列化数据
  if (config.data && !(config.data instanceof FormData)) {
    config.data = qs.stringify(config.data, { arrayFormat: 'repeat' });
  }
  return config;
});

// 响应拦截器 - 自动保存 cookie
client.interceptors.response.use(
  response => {
    const setCookieHeader = response.headers['set-cookie'];
    if (setCookieHeader) {
      sessionCookie = setCookieHeader[0].split(';')[0];
    }
    return response;
  },
  error => {
    // 处理 401 错误，需要重新登录
    if (error.response && error.response.status === 401) {
      console.log('[xrayLogService] Session 已过期，需要重新登录');
      sessionCookie = '';
    }
    return Promise.reject(error);
  }
);

/**
 * 登录 X-UI 面板
 * @returns {Promise<boolean>} 是否登录成功
 */
export async function login() {
  try {
    const response = await client.post('/login', {
      username: xuiConfig.username,
      password: xuiConfig.password
    });
    
    if (response.data.success) {
      console.log('[xrayLogService] 登录 X-UI 成功');
      return true;
    }
    
    console.error('[xrayLogService] 登录失败:', response.data.msg);
    return false;
  } catch (error) {
    console.error('[xrayLogService] 登录请求失败:', error.message);
    return false;
  }
}

/**
 * 获取 Xray 日志
 * @param {number} count - 获取的日志数量
 * @param {number} retryLeft - 401 场景下的剩余重试次数
 * @returns {Promise<Array|null>} 日志数组或 null
 */
export async function getXrayLogs(count = 50, retryLeft = 1) {
  try {
    const response = await client.post(`/panel/api/server/xraylogs/${count}`, {
      filter: '',
      showDirect: 'true',
      showBlocked: 'true',
      showProxy: 'true'
    });
    
    if (response.data.success) {
      return response.data.obj || [];
    }
    
    console.error('[xrayLogService] 获取日志失败:', response.data.msg);
    return null;
  } catch (error) {
    // 如果是 401，尝试重新登录
    if (error.response?.status === 401 && retryLeft > 0) {
      console.log('[xrayLogService] 尝试重新登录...');
      const loginSuccess = await login();
      if (loginSuccess) {
        // 重试获取日志
        return getXrayLogs(count, retryLeft - 1);
      }
    }
    console.error('[xrayLogService] 获取日志请求失败:', error.message);
    return null;
  }
}

/**
 * 从日志中提取唯一 IP 列表
 * @param {Array} logs - Xray 日志数组
 * @returns {Set<string>} 唯一 IP 的 Set
 */
export function extractIpsFromLogs(logs) {
  const ips = new Set();
  
  if (!Array.isArray(logs)) {
    return ips;
  }
  
  for (const log of logs) {
    if (log.FromAddress) {
      // FromAddress 格式: "IP:PORT"，提取 IP 部分
      const ip = log.FromAddress.split(':')[0];
      if (ip) {
        ips.add(ip);
      }
    }
  }
  
  return ips;
}

/**
 * 检查是否已登录
 * @returns {boolean}
 */
export function isLoggedIn() {
  return !!sessionCookie;
}
