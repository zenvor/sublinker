// 客户端 UA 校验工具
// 仅允许 Clash / Shadowrocket 访问订阅相关接口

/**
 * 校验是否为支持的客户端 UA
 * @param {string} userAgent
 * @returns {boolean}
 */
export function isSupportedClientUa(userAgent = '') {
  const userAgentLower = String(userAgent).toLowerCase()
  return (
    userAgentLower.includes('clash') ||
    userAgentLower.includes('shadowrocket') ||
    userAgentLower.includes('mihomo')
  )
}

/**
 * 执行 UA 校验
 * @param {import('koa').Context} ctx
 * @param {{ onFail?: (ctx: import('koa').Context, userAgent: string) => void }} [options]
 * @returns {boolean}
 */
export function ensureSupportedClientUa(ctx, options = {}) {
  const userAgent = ctx.headers['user-agent'] || ''
  const { onFail } = options

  if (isSupportedClientUa(userAgent)) {
    return true
  }

  if (typeof onFail === 'function') {
    onFail(ctx, userAgent)
    return false
  }

  ctx.fail(403, '不支持的客户端')
  return false
}
