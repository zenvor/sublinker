// /sub 路由
// 返回一级订阅 YAML

import Router from '@koa/router'
import { renderSubYaml } from '../services/yamlService.js'
import { getSubscription, isSubscriptionValid } from '../services/subscriptionService.js'
import { updateAndCheck, getActiveIps } from '../services/ipTracker.js'
import { ensureSupportedClientUa } from '../utils/clientUa.js'
import { logInfo, logError } from '../utils/logUtil.js'

const router = new Router()

/**
 * GET /sub?t=xxx
 * 返回一级订阅 YAML，同时完成 IP 绑定
 * 注意: IP 绑定在此接口完成，/provider 接口仅做 IP 校验，不新增绑定
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

  // 获取客户端真实 IP，在此阶段完成 IP 绑定
  const clientIp = ctx.realIp || ctx.ip

  let allowed = false
  try {
    allowed = updateAndCheck(token, clientIp, subscription.max_ips)
  } catch (err) {
    logError(`[Sub] IP绑定检查异常: token=${token.slice(0, 8)}... ip=${clientIp}`, err)
    ctx.fail(500, '服务内部错误')
    return
  }

  if (!allowed) {
    const activeIps = getActiveIps(token)
    logInfo(
      `[Sub] IP超限拒绝: token=${token.slice(0, 8)}... ip=${clientIp} bound=${activeIps.length}/${subscription.max_ips}`,
    )
    ctx.fail(403, 'IP 数量已达上限，订阅导入被拒绝')
    return
  }

  logInfo(`[Sub] 返回订阅: token=${token.slice(0, 8)}... ip=${clientIp} ua=${userAgent}`)

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
