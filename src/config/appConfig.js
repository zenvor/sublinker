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

// GeoX 数据文件配置
// 项目根目录
const rootDir = path.join(__dirname, '../..')

// GeoX 数据文件存储目录
export const geoxDir = path.join(rootDir, 'data/geox')

// GeoX 同步间隔（毫秒），默认 24 小时
export const geoxSyncInterval = 24 * 60 * 60 * 1000

// GeoX 上游源地址
export const geoxSources = {
  geoip: 'https://cdn.jsdelivr.net/gh/Loyalsoldier/v2ray-rules-dat@release/geoip.dat',
  geosite: 'https://cdn.jsdelivr.net/gh/Loyalsoldier/v2ray-rules-dat@release/geosite.dat',
}
