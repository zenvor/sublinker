// CloakGate - Clash 订阅分发服务
// 应用入口

import Koa from 'koa';
import Router from '@koa/router';
import cors from '@koa/cors';
import bodyParser from 'koa-bodyparser';
import { PORT } from './config/appConfig.js';
import errorHandler from './middlewares/errorHandler.js';
import logger from './middlewares/logger.js';
import realIp from './middlewares/realIp.js';
import response from './middlewares/response.js';
import subRouter from './routes/sub.js';
import providerRouter from './routes/provider.js';
import subscriptionRouter from './routes/subscription.js';
import serve from 'koa-static';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const app = new Koa();
const router = new Router();

// 注册中间件（顺序重要）
app.use(errorHandler);
app.use(cors());           // CORS 跨域支持
app.use(bodyParser());     // JSON 请求体解析
app.use(response);         // 统一响应格式
app.use(realIp);
app.use(logger);

// 静态文件服务
app.use(serve(path.join(__dirname, '../public')));

// 健康检查端点
router.get('/health', (ctx) => {
  ctx.body = 'OK';
});

// 注册路由
app.use(subRouter.routes());
app.use(subRouter.allowedMethods());
app.use(providerRouter.routes());
app.use(providerRouter.allowedMethods());
app.use(subscriptionRouter.routes());
app.use(subscriptionRouter.allowedMethods());
app.use(router.routes());
app.use(router.allowedMethods());

// History Mode Fallback
app.use(async (ctx, next) => {
  await next();
  
  if (ctx.status === 404 && ctx.method === 'GET' && ctx.accepts('html')) {
    // 排除 API 路径 (假设所有 API 都以 /api, /sub, /provider, /admin 开头，或者是特定的功能路径)
    // 但更简单的是：如果到了这里还是 404，且是 HTML 请求，就返回 index.html
    try {
      ctx.type = 'html';
      ctx.body = fs.createReadStream(path.join(__dirname, '../public/index.html'));
    } catch (e) {
      if (e.code !== 'ENOENT') {
        throw e;
      }
    }
  }
});

// 启动服务
app.listen(PORT, () => {
  console.log(`CloakGate 服务已启动: http://localhost:${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/health`);
  console.log(`订阅接口: http://localhost:${PORT}/sub?token=YOUR_TOKEN`);
  console.log(`节点接口: http://localhost:${PORT}/provider?token=YOUR_TOKEN`);
  console.log(`管理接口: http://localhost:${PORT}/admin/subscription`);
});

export default app;
