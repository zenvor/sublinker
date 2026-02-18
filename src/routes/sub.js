// /sub 路由
// 返回一级订阅 YAML

import Router from '@koa/router'
import { renderSubYaml } from '../services/yamlService.js'
import { getSubscription, isSubscriptionValid } from '../services/subscriptionService.js'
import { ensureSupportedClientUa } from '../utils/clientUa.js'
import { logInfo, logError } from '../utils/logUtil.js'

const router = new Router()

/**
 * GET /sub?t=xxx
 * 返回一级订阅 YAML
 * 注意: 此接口仅返回订阅配置，不进行 IP 绑定。IP 绑定在 /provider 接口中进行。
 */
router.get('/sub', async (ctx) => {
  const token = ctx.query.t

  // 检查 token 参数
  if (!token) {
    ctx.fail(400, '缺少 token 参数')
    return
  }

  // 检查 User-Agent，仅允许支持的客户端访问
  if (!ensureSupportedClientUa(ctx)) {
    return
  }

  const userAgent = ctx.headers['user-agent'] || ''

  // 查询并校验订阅
  const subscription = getSubscription(token)
  const validation = isSubscriptionValid(subscription)

  if (!validation.valid) {
    ctx.fail(403, validation.reason)
    return
  }

  logInfo(`[Sub] 返回订阅: token=${token.slice(0, 8)}... ua=${userAgent.slice(0, 30)}`)

  try {
    const apiDomain = resolveApiDomain(ctx)
    const yaml = renderSubYaml(token, apiDomain)
    ctx.set('Content-Disposition', 'attachment; filename=DMIT')
    ctx.type = 'application/x-yaml; charset=utf-8'
    ctx.body = yaml
  } catch (err) {
    logError('渲染订阅失败:', err)
    ctx.fail(500, '服务内部错误')
  }
})

/**
 * 根据当前请求解析 API 域名
 * 优先使用反向代理透传头，避免服务换 IP 后订阅中的 provider 地址失效
 * @param {import('koa').Context} ctx
 * @returns {string}
 */
function resolveApiDomain(ctx) {
  const forwardedProto = ctx.headers['x-forwarded-proto']
  const forwardedHost = ctx.headers['x-forwarded-host']
  const hostHeader = forwardedHost || ctx.headers.host || ''

  const protocol = String(forwardedProto || ctx.protocol || 'http')
    .split(',')[0]
    .trim()
  const host = String(hostHeader)
    .split(',')[0]
    .trim()

  if (!host) {
    return ''
  }

  return `${protocol}://${host}`
}

export default router
