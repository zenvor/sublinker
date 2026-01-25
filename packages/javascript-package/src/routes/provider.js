// /provider 路由
// 返回节点列表 YAML，同时执行 IP 并发控制

import Router from '@koa/router'
import { getSubscription, isSubscriptionValid } from '../services/subscriptionService.js'
import { updateAndCheck, getActiveIps, getActiveIpCount } from '../services/ipTracker.js'
import { generateProxiesYaml, generateEmptyProxiesYaml } from '../services/yamlService.js'
import { recordIpHistory } from '../services/ipHistoryService.js'

const router = new Router()

/**
 * GET /provider?token=xxx
 * 返回节点列表 YAML（proxy-providers 请求此接口）
 *
 * IP 绑定策略:
 * 1. 通过 UA 和订阅校验后，直接进行 IP 绑定
 * 2. 槽位未满时自动绑定新 IP
 * 3. 槽位已满时拒绝新 IP，需管理员手动清理
 */
router.get('/provider', async (ctx) => {
  const { token } = ctx.query

  // 检查 token 参数
  if (!token) {
    ctx.status = 400
    ctx.type = 'application/x-yaml; charset=utf-8'
    ctx.body = generateEmptyProxiesYaml()
    return
  }

  // 检查 User-Agent，允许 Clash 和 Shadowrocket 客户端访问
  const userAgent = ctx.headers['user-agent'] || ''
  const userAgentLower = userAgent.toLowerCase()
  if (!userAgentLower.includes('clash') && !userAgentLower.includes('shadowrocket')) {
    console.log(`[Provider] UA检测失败: token=${token.slice(0, 8)}... ua=${userAgent.slice(0, 30)}`)
    ctx.status = 403
    ctx.type = 'application/x-yaml; charset=utf-8'
    ctx.body = generateEmptyProxiesYaml()
    return
  }

  // 查询并校验订阅
  const subscription = getSubscription(token)
  const validation = isSubscriptionValid(subscription)

  if (!validation.valid) {
    console.log(`[Provider] 订阅校验失败: ${token} - ${validation.reason}`)
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
    console.error(`[Provider] IP绑定检查异常: token=${token.slice(0, 8)}... ip=${clientIp}`, err)
    ctx.status = 500
    ctx.type = 'application/x-yaml; charset=utf-8'
    ctx.body = generateEmptyProxiesYaml()
    return
  }

  // 记录 IP 历史（在绑定检查后，只要有绑定IP就记录）
  // 这样可以追踪用户所有使用过的IP，包括首次绑定和后续访问
  const currentBindings = getActiveIpCount(token)
  if (currentBindings > 0) {
    recordIpHistory(token, clientIp)
  }

  if (!allowed) {
    // 超限：返回 403 IP 绑定数量超限
    const activeIps = getActiveIps(token)
    console.log(
      `[Provider] IP超限: token=${token.slice(0, 8)}... ip=${clientIp} bound=${activeIps.length}/${subscription.max_ips}`,
    )
    ctx.status = 403
    ctx.type = 'application/x-yaml; charset=utf-8'
    ctx.body = generateEmptyProxiesYaml()
    return
  }

  // 通过：返回真实节点列表
  // 注意：此时IP已经成功绑定或更新活跃时间
  console.log(`[Provider] 允许访问: token=${token.slice(0, 8)}... ip=${clientIp}`)

  try {
    // 使用默认节点配置（已移除 node_profile 字段）
    const yaml = generateProxiesYaml('default')
    ctx.type = 'application/x-yaml; charset=utf-8'
    ctx.body = yaml
  } catch (err) {
    console.error('生成节点列表失败:', err)
    ctx.status = 500
    ctx.type = 'application/x-yaml; charset=utf-8'
    ctx.body = generateEmptyProxiesYaml()
  }
})

export default router
