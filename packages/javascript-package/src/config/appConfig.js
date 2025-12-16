// 全局配置

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// 获取当前文件路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 加载根目录的 .env 文件 (monorepo架构)
// packages/javascript-package/src/config -> ../../../../.env
dotenv.config({ path: path.join(__dirname, '../../../../.env') });

// 服务端口
export const PORT = process.env.PORT || 3000;

// API 域名（用于生成订阅中的 provider URL）
export const API_DOMAIN = process.env.API_DOMAIN || 'https://api.starying.top';

// X-UI 面板配置
export const xuiConfig = {
  // 使用内网地址调用 API，跳过 HTTPS 证书验证
  host: process.env.XUI_HOST || '127.0.0.1',
  port: process.env.XUI_PORT || '54321',
  webBasePath: process.env.XUI_WEB_BASE_PATH || '',
  username: process.env.XUI_USERNAME || '',
  password: process.env.XUI_PASSWORD || ''
};

// IP 阻断配置
export const ipBlockerConfig = {
  enabled: process.env.IP_BLOCKER_ENABLED === 'true',
  pollInterval: parseInt(process.env.IP_BLOCKER_POLL_INTERVAL) || 30000, // 轮询间隔（毫秒）
  logCount: parseInt(process.env.IP_BLOCKER_LOG_COUNT) || 50, // 每次获取的日志数量
  jailName: process.env.IP_BLOCKER_JAIL_NAME || '3x-ipl', // Fail2Ban jail 名称
  dryRun: process.env.IP_BLOCKER_DRY_RUN === 'true' // 调试模式，仅输出不执行
};

