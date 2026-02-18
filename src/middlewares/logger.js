// 日志中间件
// 记录请求信息：时间、路径、Token、IP、UA、状态码

import { logInfo, shouldLog } from '../utils/logUtil.js'

/**
 * 格式化时间为本地格式
 * @param {Date} date 
 * @returns {string}
 */
function formatTime(date) {
  return date.toLocaleString('zh-CN', { 
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  })
}

/**
 * 日志中间件
 */
export default async function logger(ctx, next) {
  const startTime = Date.now()

  await next()

  if (!shouldLog('info')) {
    return
  }

  const duration = Date.now() - startTime
  const { method, path, query } = ctx
  const status = ctx.status
  const ip = ctx.realIp || ctx.ip
  const ua = ctx.headers['user-agent'] || '-'
  const token = query.token ? `${query.token.slice(0, 8)}...` : '-'

  // 构建日志信息
  const logParts = [
    `[${formatTime(new Date())}]`,
    `${method} ${path}`,
    `status=${status}`,
    `token=${token}`,
    `ip=${ip}`,
    `${duration}ms`,
    `ua=${ua.slice(0, 50)}`,
  ]

  logInfo(logParts.join(' | '))
}
