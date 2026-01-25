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

