// 日志工具
// 通过 LOG_LEVEL 控制日志输出级别，减少生产环境噪音

import { LOG_LEVEL } from '../config/appConfig.js'

const levelPriorityMap = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
}

const currentLevelPriority = levelPriorityMap[LOG_LEVEL] ?? levelPriorityMap.info

/**
 * 判断目标日志级别是否应输出
 * @param {'error'|'warn'|'info'|'debug'} targetLevel
 * @returns {boolean}
 */
export function shouldLog(targetLevel) {
  const targetPriority = levelPriorityMap[targetLevel]
  if (targetPriority === undefined) {
    return false
  }
  return targetPriority <= currentLevelPriority
}

/**
 * 输出 error 日志
 * @param {...any} args
 */
export function logError(...args) {
  if (shouldLog('error')) {
    console.error(...args)
  }
}

/**
 * 输出 warn 日志
 * @param {...any} args
 */
export function logWarn(...args) {
  if (shouldLog('warn')) {
    console.warn(...args)
  }
}

/**
 * 输出 info 日志
 * @param {...any} args
 */
export function logInfo(...args) {
  if (shouldLog('info')) {
    console.log(...args)
  }
}

/**
 * 输出 debug 日志
 * @param {...any} args
 */
export function logDebug(...args) {
  if (shouldLog('debug')) {
    console.debug(...args)
  }
}
