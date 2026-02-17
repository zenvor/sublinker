// CloakGate - Clash 订阅分发服务
// 应用入口

import Koa from 'koa';
import Router from '@koa/router';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

import cors from '@koa/cors';
import bodyParser from 'koa-bodyparser';
import serve from 'koa-static';
import { PORT } from './config/appConfig.js';
import { initAdmin } from './services/adminService.js';
import errorHandler from './middlewares/errorHandler.js';
import logger from './middlewares/logger.js';
import realIp from './middlewares/realIp.js';
import response from './middlewares/response.js';
import authRouter from './routes/auth.js';
import subRouter from './routes/sub.js';
import providerRouter from './routes/provider.js';
import subscriptionRouter from './routes/subscription.js';


const app = new Koa();
const router = new Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.resolve(__dirname, '../public');

// 获取本地 IP 地址
function getLocalIPs() {
  const interfaces = os.networkInterfaces();
  const ips = [];
  
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        ips.push(iface.address);
      }
    }
  }
  
  return ips;
}

// 注册中间件（顺序重要）
app.use(errorHandler);
app.use(cors());           // CORS 跨域支持
app.use(bodyParser());     // JSON 请求体解析
app.use(response);         // 统一响应格式
app.use(realIp);
app.use(logger);
app.use(serve(publicDir)); // 前端静态资源

// 健康检查端点
router.get('/health', (ctx) => {
  ctx.body = 'OK';
});

// 注册路由
app.use(subRouter.routes());
app.use(subRouter.allowedMethods());
app.use(providerRouter.routes());
app.use(providerRouter.allowedMethods());

// 认证路由（无需认证）
app.use(authRouter.routes());
app.use(authRouter.allowedMethods());

// 订阅管理路由（需要认证） - 中间件已在路由内部注册
app.use(subscriptionRouter.routes());
app.use(subscriptionRouter.allowedMethods());

app.use(router.routes());
app.use(router.allowedMethods());

// SPA 刷新回退：浏览器直接访问子路由时返回 index.html
app.use(async (ctx, next) => {
  await next();

  if (ctx.status !== 404 || ctx.method !== 'GET') {
    return;
  }

  const accept = ctx.get('accept');
  if (!accept.includes('text/html')) {
    return;
  }

  ctx.status = 200;
  ctx.type = 'text/html';
  ctx.path = '/index.html';
  await serve(publicDir)(ctx, async () => {});
});

// 启动服务
initAdmin().then(() => {
  app.listen(PORT, () => {
    const localIPs = getLocalIPs();
    const primaryIP = localIPs.length > 0 ? localIPs[0] : 'localhost';
    
    console.log(`CloakGate 服务已启动: http://${primaryIP}:${PORT}`);
    
    if (localIPs.length > 1) {
      localIPs.slice(1).forEach(ip => {
        console.log(`                    http://${ip}:${PORT}`);
      });
    }
    
    console.log(`健康检查: http://${primaryIP}:${PORT}/health`);
    console.log(`订阅接口: http://${primaryIP}:${PORT}/sub?token=YOUR_TOKEN`);
    console.log(`节点接口: http://${primaryIP}:${PORT}/provider?token=YOUR_TOKEN`);
    console.log(`管理接口: http://${primaryIP}:${PORT}/admin/subscription`);
  });
});

export default app;
