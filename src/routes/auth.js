// 认证路由
// 提供登录、登出、获取用户信息等接口

import Router from '@koa/router';
import { adminConfig } from '../config/authConfig.js';
import { generateToken } from '../services/jwtService.js';

import { authMiddleware } from '../middlewares/authMiddleware.js';

const router = new Router({
  prefix: '/admin/auth'
});

/**
 * POST /admin/auth/login
 * 管理员登录
 */
router.post('/login', async (ctx) => {
  const { username, password } = ctx.request.body;

  // 验证必填字段
  if (!username || !password) {
    ctx.fail(400, '用户名和密码不能为空');
    return;
  }

  // 验证账号密码
  if (username !== adminConfig.username || password !== adminConfig.password) {
    ctx.fail(401, '用户名或密码错误');
    return;
  }

  // 生成 token
  const token = generateToken({
    username,
    role: 'admin'
  });

  ctx.success({ token }, '登录成功');
});

/**
 * GET /admin/auth/info
 * 获取当前用户信息
 * 需要认证
 */
router.get('/info', authMiddleware(), async (ctx) => {
  // 此接口需要 authMiddleware 保护
  // ctx.state.user 由中间件设置
  const user = ctx.state.user;

  if (!user) {
    ctx.fail(401, '未登录');
    return;
  }

  ctx.success({
    username: user.username,
    roles: [user.role],
    name: '管理员',
    avatar: ''
  });
});

/**
 * POST /admin/auth/logout
 * 登出（客户端删除 token 即可，服务端仅返回成功）
 */
router.post('/logout', async (ctx) => {
  ctx.success(null, '登出成功');
});

export default router;
