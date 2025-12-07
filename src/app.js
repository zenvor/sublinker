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

const app = new Koa();
const router = new Router();

// 注册中间件（顺序重要）
app.use(errorHandler);
app.use(cors());           // CORS 跨域支持
app.use(bodyParser());     // JSON 请求体解析
app.use(response);         // 统一响应格式
app.use(realIp);
app.use(logger);

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

// 启动服务
app.listen(PORT, () => {
  console.log(`CloakGate 服务已启动: http://localhost:${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/health`);
  console.log(`订阅接口: http://localhost:${PORT}/sub?token=YOUR_TOKEN`);
  console.log(`节点接口: http://localhost:${PORT}/provider?token=YOUR_TOKEN`);
  console.log(`管理接口: http://localhost:${PORT}/admin/subscription`);
});

export default app;
