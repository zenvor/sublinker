// /provider 路由
// 返回节点列表 YAML，同时执行 IP 并发控制

import Router from '@koa/router'
import { getSubscription, isSubscriptionValid } from '../services/subscriptionService.js'
import { updateAndCheck, getActiveIps } from '../services/ipTracker.js'
import { generateProxiesYaml, generateEmptyProxiesYaml } from '../services/yamlService.js'
import { recordIpHistory } from '../services/ipHistoryService.js'
import { ensureSupportedClientUa } from '../utils/clientUa.js'
import { logInfo, logError } from '../utils/logUtil.js'

const router = new Router()

/**
 * GET /provider?t=xxx
 * 返回节点列表 YAML（proxy-providers 请求此接口）
 *
 * IP 绑定策略:
 * 1. 通过 UA 和订阅校验后，直接进行 IP 绑定
 * 2. 槽位未满时自动绑定新 IP
 * 3. 槽位已满时拒绝新 IP，需管理员手动清理
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

  // IP 绑定检查（使用订阅的 max_ips 配置）
  // updateAndCheck 内部会原子性地检查槽位并绑定IP，避免竞态条件
  let allowed = false
  try {
    allowed = updateAndCheck(token, clientIp, subscription.max_ips)
  } catch (err) {
    logError(`[Provider] IP绑定检查异常: token=${token.slice(0, 8)}... ip=${clientIp}`, err)
    ctx.status = 500
    ctx.type = 'application/x-yaml; charset=utf-8'
    ctx.body = generateEmptyProxiesYaml()
    return
  }

  // 记录 IP 历史（绑定检查通过后无条件记录，包括首次绑定）
  if (allowed) {
    recordIpHistory(token, clientIp)
  }

  if (!allowed) {
    // 超限：返回 403 IP 绑定数量超限
    const activeIps = getActiveIps(token)
    logInfo(
      `[Provider] IP超限: token=${token.slice(0, 8)}... ip=${clientIp} bound=${activeIps.length}/${subscription.max_ips}`,
    )
    ctx.status = 403
    ctx.type = 'application/x-yaml; charset=utf-8'
    ctx.body = generateEmptyProxiesYaml()
    return
  }

  // 通过：返回真实节点列表
  // 注意：此时IP已经成功绑定或更新活跃时间
  logInfo(`[Provider] 允许访问: token=${token.slice(0, 8)}... ip=${clientIp}`)

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
