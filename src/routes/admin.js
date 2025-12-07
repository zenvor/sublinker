// Admin 管理接口
// 用于管理 Token 和查看活跃 IP

import Router from '@koa/router';
import { createToken, listTokens, getToken, updateTokenStatus, deleteToken } from '../services/tokenService.js';
import { getActiveIps, clearTokenIps } from '../services/ipTracker.js';

const router = new Router({ prefix: '/admin' });

/**
 * POST /admin/token
 * 创建新 Token
 */
router.post('/token', async (ctx) => {
  const { remark = '', nodeProfile = 'default', expiredAt = null } = ctx.request.body || {};
  
  const token = createToken({ remark, nodeProfile, expiredAt });
  
  ctx.success(token, 'Token 创建成功', 201);
});

/**
 * GET /admin/token
 * 列出所有 Token
 */
router.get('/token', async (ctx) => {
  const { limit = 50, offset = 0 } = ctx.query;
  const tokens = listTokens(parseInt(limit), parseInt(offset));
  
  ctx.success(tokens);
});

/**
 * GET /admin/token/:token
 * 获取单个 Token 详情
 */
router.get('/token/:token', async (ctx) => {
  const { token } = ctx.params;
  const tokenRecord = getToken(token);
  
  if (!tokenRecord) {
    ctx.fail(404, 'Token 不存在');
    return;
  }
  
  ctx.success(tokenRecord);
});

/**
 * PATCH /admin/token/:token
 * 更新 Token 状态（启用/禁用）
 */
router.patch('/token/:token', async (ctx) => {
  const { token } = ctx.params;
  const { status } = ctx.request.body || {};
  
  if (!['active', 'banned'].includes(status)) {
    ctx.fail(400, '状态只能是 active 或 banned');
    return;
  }
  
  const updated = updateTokenStatus(token, status);
  
  if (!updated) {
    ctx.fail(404, 'Token 不存在');
    return;
  }
  
  ctx.success(null, `Token 状态已更新为 ${status}`);
});

/**
 * DELETE /admin/token/:token
 * 删除 Token
 */
router.delete('/token/:token', async (ctx) => {
  const { token } = ctx.params;
  const deleted = deleteToken(token);
  
  if (!deleted) {
    ctx.fail(404, 'Token 不存在');
    return;
  }
  
  // 同时清除该 Token 的活跃 IP 记录
  clearTokenIps(token);
  
  ctx.status = 204;
  ctx.body = null;
});

/**
 * GET /admin/token/:token/active-ips
 * 查看 Token 的活跃 IP 列表
 */
router.get('/token/:token/active-ips', async (ctx) => {
  const { token } = ctx.params;
  
  // 检查 token 是否存在
  const tokenRecord = getToken(token);
  if (!tokenRecord) {
    ctx.fail(404, 'Token 不存在');
    return;
  }
  
  const activeIps = getActiveIps(token);
  
  ctx.success({
    token: token.slice(0, 8) + '...',
    count: activeIps.length,
    ips: activeIps.map(item => ({
      ip: item.ip,
      lastSeen: new Date(item.lastSeen).toLocaleString('zh-CN'),
      expiresInMinutes: Math.round(item.expiresIn / 60000)
    }))
  });
});

export default router;

