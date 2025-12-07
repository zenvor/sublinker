// JWT 认证中间件
// 验证请求头中的 Bearer Token

import { verifyToken } from '../services/jwtService.js';

/**
 * 创建认证中间件
 * 验证 Authorization 头中的 Bearer Token
 */
export function authMiddleware() {
  return async (ctx, next) => {
    const authHeader = ctx.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      ctx.fail(401, '未提供认证令牌');
      return;
    }

    const token = authHeader.slice(7); // 移除 'Bearer ' 前缀
    const result = verifyToken(token);

    if (!result.valid) {
      ctx.fail(401, result.error);
      return;
    }

    // 将用户信息存入 ctx.state
    ctx.state.user = result.payload;

    await next();
  };
}

export default authMiddleware;
