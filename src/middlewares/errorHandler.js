// 错误处理中间件
// 统一捕获错误并返回友好响应

import { logError } from '../utils/logUtil.js'

export default async function errorHandler(ctx, next) {
  try {
    await next()
  } catch (err) {
    logError('请求处理错误:', err)

    const statusCode = err.status || 500
    const message = err.message || '服务内部错误'

    if (typeof ctx.fail === 'function') {
      ctx.fail(statusCode, message)
      return
    }

    // 兜底分支：避免 response 中间件未挂载时响应结构不一致
    ctx.status = statusCode
    ctx.body = {
      code: statusCode,
      message,
    }
  }
}
