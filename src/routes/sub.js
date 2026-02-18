// /sub 路由
// 返回一级订阅 YAML

import Router from '@koa/router'
import { renderSubYaml } from '../services/yamlService.js'
import { getSubscription, isSubscriptionValid } from '../services/subscriptionService.js'
import { getActiveIpCount } from '../services/ipTracker.js'
import { recordIpHistory } from '../services/ipHistoryService.js'

const router = new Router()

/**
 * GET /sub?token=xxx
 * 返回一级订阅 YAML
 * 注意: 此接口仅返回订阅配置，不进行 IP 绑定。IP 绑定在 /provider 接口中进行。
 */
router.get('/sub', async (ctx) => {
  const { token } = ctx.query

  // 检查 token 参数
  if (!token) {
    ctx.fail(400, '缺少 token 参数')
    return
  }

  // 检查 User-Agent，允许 Clash 和 Shadowrocket 客户端访问
  const userAgent = ctx.headers['user-agent'] || ''
  const userAgentLower = userAgent.toLowerCase()
  if (!userAgentLower.includes('clash') && !userAgentLower.includes('shadowrocket')) {
    ctx.fail(403, '不支持的客户端')
    return
  }

  // 查询并校验订阅
  const subscription = getSubscription(token)
  const validation = isSubscriptionValid(subscription)

  if (!validation.valid) {
    ctx.fail(403, validation.reason)
    return
  }

  // 获取客户端真实 IP 并记录历史（仅当已有绑定时）
  const clientIp = ctx.realIp || ctx.ip
  const currentBindings = getActiveIpCount(token)
  if (currentBindings > 0) {
    recordIpHistory(token, clientIp)
  }

  console.log(`[Sub] 返回订阅: token=${token.slice(0, 8)}... ua=${userAgent.slice(0, 30)}`)

  try {
    const apiDomain = resolveApiDomain(ctx)
    const yaml = renderSubYaml(token, apiDomain)
    ctx.set('Content-Disposition', 'attachment; filename=DMIT')
    ctx.type = 'application/x-yaml; charset=utf-8'
    ctx.body = yaml
  } catch (err) {
    console.error('渲染订阅失败:', err)
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
