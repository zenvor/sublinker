// /sub 路由
// 返回一级订阅 YAML

import Router from '@koa/router';
import { renderSubYaml } from '../services/yamlService.js';
import { getToken, isTokenValid } from '../services/tokenService.js';

const router = new Router();

/**
 * GET /sub?token=xxx
 * 返回一级订阅 YAML
 */
router.get('/sub', async (ctx) => {
  const { token } = ctx.query;

  // 检查 token 参数
  if (!token) {
    ctx.status = 400;
    ctx.body = '缺少 token 参数';
    return;
  }

  // 查询并校验 token
  const tokenRecord = getToken(token);
  const validation = isTokenValid(tokenRecord);
  
  if (!validation.valid) {
    ctx.status = 403;
    ctx.body = validation.reason;
    return;
  }

  try {
    const yaml = renderSubYaml(token);
    ctx.type = 'application/x-yaml; charset=utf-8';
    ctx.body = yaml;
  } catch (err) {
    console.error('渲染订阅失败:', err);
    ctx.status = 500;
    ctx.body = '服务内部错误';
  }
});

export default router;

