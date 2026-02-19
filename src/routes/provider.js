// /provider 路由
// 返回节点列表 YAML，同时执行 IP 并发控制

import Router from '@koa/router'
import { getSubscription, isSubscriptionValid } from '../services/subscriptionService.js'
import { checkAndTouch, getActiveIps } from '../services/ipTracker.js'
import { generateProxiesYaml, generateEmptyProxiesYaml } from '../services/yamlService.js'
import { ensureSupportedClientUa } from '../utils/clientUa.js'
import { logInfo, logError } from '../utils/logUtil.js'

const router = new Router()

/**
 * GET /provider?t=xxx
 * 返回节点列表 YAML（proxy-providers 请求此接口）
 *
 * IP 校验策略:
 * IP 绑定统一在 /sub 阶段完成，此接口仅校验来访 IP 是否已绑定
 * 未经 /sub 绑定的 IP 一律返回 403 + 空节点列表
 */
router.get('/provider', async (ctx) => {
  const token = ctx.query.t

  // 检查 token 参数
  if (!token) {
    ctx.status = 400
    ctx.type = 'application/x-yaml; charset=utf-8'
    ctx.body = generateEmptyProxiesYaml()
    return
  }

  // 检查 User-Agent，仅允许支持的客户端访问
  if (
    !ensureSupportedClientUa(ctx, {
      onFail: (targetCtx, userAgent) => {
        logInfo(`[Provider] UA检测失败: token=${token.slice(0, 8)}... ua=${String(userAgent).slice(0, 30)}`)
        targetCtx.status = 403
        targetCtx.type = 'application/x-yaml; charset=utf-8'
        targetCtx.body = generateEmptyProxiesYaml()
      },
    })
  ) {
    return
  }

  // 查询并校验订阅
  const subscription = getSubscription(token)
  const validation = isSubscriptionValid(subscription)

  if (!validation.valid) {
    logInfo(`[Provider] 订阅校验失败: ${token} - ${validation.reason}`)
    ctx.status = 403
    ctx.type = 'application/x-yaml; charset=utf-8'
    ctx.body = generateEmptyProxiesYaml()
    return
  }

  // 获取客户端真实 IP
  const clientIp = ctx.realIp || ctx.ip

  // IP 校验：仅允许已在 /sub 阶段绑定的 IP 访问节点列表
  // 此处不新增绑定，IP 绑定入口统一收敛到 /sub
  let allowed = false
  try {
    allowed = checkAndTouch(token, clientIp)
  } catch (err) {
    logError(`[Provider] IP校验异常: token=${token.slice(0, 8)}... ip=${clientIp}`, err)
    ctx.status = 500
    ctx.type = 'application/x-yaml; charset=utf-8'
    ctx.body = generateEmptyProxiesYaml()
    return
  }

  if (!allowed) {
    // IP 未绑定：该 IP 未经 /sub 授权
    const activeIps = getActiveIps(token)
    logInfo(
      `[Provider] IP未绑定拒绝: token=${token.slice(0, 8)}... ip=${clientIp} bound=${activeIps.length}/${subscription.max_ips}`,
    )
    ctx.status = 403
    ctx.type = 'application/x-yaml; charset=utf-8'
    ctx.body = generateEmptyProxiesYaml()
    return
  }

  // 通过：返回真实节点列表
  // 注意：此时IP已经成功绑定或更新活跃时间
  logInfo(`[Provider] IP已绑定，允许访问: token=${token.slice(0, 8)}... ip=${clientIp}`)

  try {
    // 使用订阅绑定的动态节点配置
    const yaml = generateProxiesYaml(token)
    ctx.type = 'application/x-yaml; charset=utf-8'
    ctx.body = yaml
  } catch (err) {
    logError('生成节点列表失败:', err)
    ctx.status = 500
    ctx.type = 'application/x-yaml; charset=utf-8'
    ctx.body = generateEmptyProxiesYaml()
  }
})

export default router
