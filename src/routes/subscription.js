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
import { getActiveIps, clearTokenIps } from '../services/ipTracker.js';

const router = new Router({ prefix: '/admin' });

/**
 * POST /admin/subscription
 * 创建新订阅
 */
router.post('/subscription', async (ctx) => {
  const { remark, maxIps = 2, expiredAt = null } = ctx.request.body || {};
  
  if (!remark) {
    ctx.fail(400, '备注不能为空');
    return;
  }
  
  if (maxIps < 1 || maxIps > 100) {
    ctx.fail(400, '在线 IP 限制必须在 1-100 之间');
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
  if (maxIps !== undefined && (maxIps < 1 || maxIps > 100)) {
    ctx.fail(400, '在线 IP 限制必须在 1-100 之间');
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
 * 查看订阅的活跃 IP 列表
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
      lastSeen: new Date(item.lastSeen).toLocaleString('zh-CN'),
      expiresInMinutes: Math.round(item.expiresIn / 60000)
    }))
  });
});

export default router;
