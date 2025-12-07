// /sub 路由
// 返回一级订阅 YAML

import Router from '@koa/router';
import { renderSubYaml } from '../services/yamlService.js';
import { getSubscription, isSubscriptionValid } from '../services/subscriptionService.js';
import { updateAndCheck } from '../services/ipTracker.js';

const router = new Router();

/**
 * GET /sub?token=xxx
 * 返回一级订阅 YAML
 */
router.get('/sub', async (ctx) => {
  const { token } = ctx.query;

  // 检查 token 参数
  if (!token) {
    ctx.fail(400, '缺少 token 参数');
    return;
  }

  // 查询并校验订阅
  const subscription = getSubscription(token);
  const validation = isSubscriptionValid(subscription);
  
  if (!validation.valid) {
    ctx.fail(403, validation.reason);
    return;
  }

  // 检查 IP 数量限制
  const clientIp = ctx.ip || ctx.request.ip;
  const allowed = updateAndCheck(token, clientIp, subscription.max_ips);
  
  if (!allowed) {
    ctx.fail(403, `在线设备数量已达上限（${subscription.max_ips}）`);
    return;
  }

  try {
    const yaml = renderSubYaml(token);
    ctx.type = 'application/x-yaml; charset=utf-8';
    ctx.body = yaml;
  } catch (err) {
    console.error('渲染订阅失败:', err);
    ctx.fail(500, '服务内部错误');
  }
});

export default router;

