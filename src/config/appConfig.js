// 全局配置

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// 获取当前文件路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 加载项目根目录 .env 文件
// src/config -> ../../.env
dotenv.config({ path: path.join(__dirname, '../../.env'), quiet: true });

// 服务端口
export const PORT = process.env.PORT || 3000;

// API 域名（用于生成订阅中的 provider URL）
export const API_DOMAIN = process.env.API_DOMAIN || 'https://api.starying.top';

// 日志级别（error|warn|info|debug）
const rawLogLevel = String(process.env.LOG_LEVEL || 'info').toLowerCase();
const validLogLevels = ['error', 'warn', 'info', 'debug'];
export const LOG_LEVEL = validLogLevels.includes(rawLogLevel) ? rawLogLevel : 'info';

