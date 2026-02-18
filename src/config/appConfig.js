// 全局配置

import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

// 获取当前文件路径
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 加载项目根目录 .env 文件
// src/config -> ../../.env
dotenv.config({ path: path.join(__dirname, '../../.env'), quiet: true })

// 服务端口
export const PORT = process.env.PORT || 3000

// API 域名（用于生成订阅中的 provider URL）
export const API_DOMAIN = process.env.API_DOMAIN || 'https://api.starying.top'

// 可信代理列表（逗号分隔的 IP/CIDR，仅这些直连 IP 才信任 X-Forwarded-For）
export const TRUSTED_PROXIES = (process.env.TRUSTED_PROXIES || '127.0.0.1,::1')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean)

// CORS 允许的来源（默认 * 适用于开发环境，生产环境应配置为实际前端域名）
export const CORS_ORIGIN = process.env.CORS_ORIGIN || '*'

// 日志级别（error|warn|info|debug）
const rawLogLevel = String(process.env.LOG_LEVEL || 'info').toLowerCase()
const validLogLevels = ['error', 'warn', 'info', 'debug']
export const LOG_LEVEL = validLogLevels.includes(rawLogLevel) ? rawLogLevel : 'info'

