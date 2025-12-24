// /provider 路由
// 返回节点列表 YAML，同时执行 IP 并发控制

import Router from '@koa/router';
import { getSubscription, isSubscriptionValid } from '../services/subscriptionService.js';
import { updateAndCheck, getActiveIps, cleanupInactiveIps } from '../services/ipTracker.js';
import { generateProxiesYaml, generateEmptyProxiesYaml } from '../services/yamlService.js';
import { recordAccess, hasBothAccessed } from '../services/accessTracker.js';
import { ipCleanupConfig } from '../config/appConfig.js';

const router = new Router();

/**
 * GET /provider?token=xxx
 * 返回节点列表 YAML（proxy-providers 请求此接口）
 * 注意: 只有当 /sub 和 /provider 都被访问后,才会绑定IP
 */
router.get('/provider', async (ctx) => {
  const { token } = ctx.query;

  // 检查 token 参数
  if (!token) {
    ctx.status = 400;
    ctx.type = 'application/x-yaml; charset=utf-8';
    ctx.body = generateEmptyProxiesYaml();
    return;
  }

  // 检查 User-Agent,允许 Clash 和 Shadowrocket 客户端访问
  const userAgent = ctx.headers['user-agent'] || '';
  const userAgentLower = userAgent.toLowerCase();
  if (!userAgentLower.includes('clash') && !userAgentLower.includes('shadowrocket')) {
    console.log(`[Provider] UA检测失败: token=${token.slice(0, 8)}... ua=${userAgent.slice(0, 30)}`);
    ctx.status = 403;
    ctx.type = 'application/x-yaml; charset=utf-8';
    ctx.body = generateEmptyProxiesYaml();
    return;
  }

  // 查询并校验订阅
  const subscription = getSubscription(token);
  const validation = isSubscriptionValid(subscription);
  
  if (!validation.valid) {
    console.log(`[Provider] 订阅校验失败: ${token} - ${validation.reason}`);
    ctx.status = 403;
    ctx.type = 'application/x-yaml; charset=utf-8';
    ctx.body = generateEmptyProxiesYaml();
    return;
  }

  // 记录访问
  recordAccess(token, 'provider');

  // 检查是否完成二次访问(sub + provider)
  if (!hasBothAccessed(token)) {
    console.log(`[Provider] 未完成二次访问: token=${token.slice(0, 8)}... 等待访问 /sub`);
    ctx.status = 403;
    ctx.type = 'application/x-yaml; charset=utf-8';
    ctx.body = generateEmptyProxiesYaml();
    return;
  }

  // 获取客户端真实 IP
  const clientIp = ctx.realIp || ctx.ip;

  // 清理不活跃的 IP
  cleanupInactiveIps(token, ipCleanupConfig.inactiveDays);

  // IP 绑定检查（使用订阅的 max_ips 配置）
  // 只有完成二次访问后才会执行IP绑定
  const allowed = updateAndCheck(token, clientIp, subscription.max_ips);
  
  if (!allowed) {
    // 超限：返回 403 IP 绑定数量超限
    const activeIps = getActiveIps(token);
    console.log(`[Provider] IP 超限: token=${token.slice(0, 8)}... ip=${clientIp} bound=${activeIps.length}/${subscription.max_ips}`);
    ctx.status = 403;
    ctx.type = 'application/x-yaml; charset=utf-8';
    ctx.body = generateEmptyProxiesYaml();
    return;
  }

  // 通过：返回真实节点列表
  console.log(`[Provider] 允许访问: token=${token.slice(0, 8)}... ip=${clientIp} ua=${userAgent.slice(0, 30)}`);
  
  try {
    // 使用默认节点配置（已移除 node_profile 字段）
    const yaml = generateProxiesYaml('default');
    ctx.type = 'application/x-yaml; charset=utf-8';
    ctx.body = yaml;
  } catch (err) {
    console.error('生成节点列表失败:', err);
    ctx.status = 500;
    ctx.type = 'application/x-yaml; charset=utf-8';
    ctx.body = generateEmptyProxiesYaml();
  }
});

export default router;

