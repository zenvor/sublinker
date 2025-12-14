// 订阅管理接口
// 用于管理订阅和查看活跃 IP

import Router from '@koa/router';
import {
  createSubscription,
  listSubscriptions,
  getSubscription,
  updateSubscription,
  deleteSubscription
} from '../services/subscriptionService.js';
import { getActiveIps, clearTokenIps, removeTokenIp } from '../services/ipTracker.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';

const router = new Router({ prefix: '/admin' });

// 应用认证中间件：该路由下的所有请求都需要经过认证
router.use(authMiddleware());

/**
 * POST /admin/subscription
 * 创建新订阅
 */
router.post('/subscription', async (ctx) => {
  const { remark, maxIps = 1, expiredAt = null } = ctx.request.body || {};
  
  if (!remark) {
    ctx.fail(400, '备注不能为空');
    return;
  }
  
  if (maxIps < 0 || maxIps > 100) {
    ctx.fail(400, 'IP 绑定数量必须在 0-100 之间 (0表示无限制)');
    return;
  }
  
  const subscription = createSubscription({ remark, maxIps, expiredAt });
  
  ctx.success(subscription, '订阅创建成功', 201);
});

/**
 * GET /admin/subscription
 * 列出所有订阅
 */
router.get('/subscription', async (ctx) => {
  const { limit = 50, offset = 0 } = ctx.query;
  const subscriptions = listSubscriptions(parseInt(limit), parseInt(offset));
  
  // 为每个订阅添加活跃 IP 数量
  const result = subscriptions.map(sub => ({
    ...sub,
    activeIpCount: getActiveIps(sub.token).length
  }));
  
  ctx.success(result);
});

/**
 * GET /admin/subscription/:token
 * 获取单个订阅详情
 */
router.get('/subscription/:token', async (ctx) => {
  const { token } = ctx.params;
  const subscription = getSubscription(token);
  
  if (!subscription) {
    ctx.fail(404, '订阅不存在');
    return;
  }
  
  // 添加活跃 IP 数量
  subscription.activeIpCount = getActiveIps(token).length;
  
  ctx.success(subscription);
});

/**
 * PUT /admin/subscription/:token
 * 更新订阅
 */
router.put('/subscription/:token', async (ctx) => {
  const { token } = ctx.params;
  const { remark, maxIps, status, expiredAt } = ctx.request.body || {};
  
  // 验证状态值
  if (status !== undefined && !['active', 'banned'].includes(status)) {
    ctx.fail(400, '状态只能是 active 或 banned');
    return;
  }
  
  // 验证 maxIps
  if (maxIps !== undefined && (maxIps < 0 || maxIps > 100)) {
    ctx.fail(400, 'IP 绑定数量必须在 0-100 之间 (0表示无限制)');
    return;
  }
  
  const updated = updateSubscription(token, { remark, maxIps, status, expiredAt });
  
  if (!updated) {
    ctx.fail(404, '订阅不存在');
    return;
  }
  
  ctx.success(null, '订阅更新成功');
});

/**
 * DELETE /admin/subscription/:token
 * 删除订阅
 */
router.delete('/subscription/:token', async (ctx) => {
  const { token } = ctx.params;
  const deleted = deleteSubscription(token);
  
  if (!deleted) {
    ctx.fail(404, '订阅不存在');
    return;
  }
  
  // 同时清除该订阅的活跃 IP 记录
  clearTokenIps(token);
  
  ctx.status = 204;
  ctx.body = null;
});

/**
 * GET /admin/subscription/:token/active-ips
 * 查看订阅的已绑定 IP 列表
 */
router.get('/subscription/:token/active-ips', async (ctx) => {
  const { token } = ctx.params;
  
  // 检查订阅是否存在
  const subscription = getSubscription(token);
  if (!subscription) {
    ctx.fail(404, '订阅不存在');
    return;
  }
  
  const activeIps = getActiveIps(token);
  
  ctx.success({
    token: token.slice(0, 8) + '...',
    maxIps: subscription.max_ips,
    count: activeIps.length,
    ips: activeIps.map(item => ({
      ip: item.ip,
      boundAt: new Date(item.boundAt).toLocaleString('zh-CN')
    }))
  });
});

/**
 * DELETE /admin/subscription/:token/active-ips
 * 解绑订阅的所有 IP
 */
router.delete('/subscription/:token/active-ips', async (ctx) => {
  const { token } = ctx.params;
  const body = ctx.request.body || {};
  const hasIpField = Object.prototype.hasOwnProperty.call(body, 'ip');
  
  // 检查订阅是否存在
  const subscription = getSubscription(token);
  if (!subscription) {
    ctx.fail(404, '订阅不存在');
    return;
  }

  const operator = ctx.state?.user?.username || 'unknown';

  if (hasIpField) {
    const ip = typeof body.ip === 'string' ? body.ip.trim() : body.ip;

    if (!ip || typeof ip !== 'string') {
      ctx.fail(400, 'IP 不能为空');
      return;
    }

    const removed = removeTokenIp(token, ip);
    if (!removed) {
      console.log(`[Admin] 单个IP解绑失败: operator=${operator} token=${token.slice(0, 8)}... ip=${ip}`);
      ctx.fail(404, 'IP 不存在');
      return;
    }

    console.log(`[Admin] 单个IP解绑成功: operator=${operator} token=${token.slice(0, 8)}... ip=${ip}`);
    ctx.success(null, 'IP 解绑成功');
    return;
  }

  clearTokenIps(token);
  console.log(`[Admin] 全部IP解绑成功: operator=${operator} token=${token.slice(0, 8)}...`);
  ctx.success(null, 'IP 解绑成功');
});

export default router;
