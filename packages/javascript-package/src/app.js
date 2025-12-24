// CloakGate - Clash 订阅分发服务
// 应用入口

import Koa from 'koa';
import path from 'path';
import { fileURLToPath } from 'url';
import Router from '@koa/router';
import os from 'os';

// 获取当前文件路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import cors from '@koa/cors';
import bodyParser from 'koa-bodyparser';
import { PORT, ipBlockerConfig } from './config/appConfig.js';
import { start as startIpBlocker } from './services/ipBlocker.js';
import { initAdmin } from './services/adminService.js';
import errorHandler from './middlewares/errorHandler.js';
import logger from './middlewares/logger.js';
import realIp from './middlewares/realIp.js';
import response from './middlewares/response.js';
import authRouter from './routes/auth.js';
import subRouter from './routes/sub.js';
import providerRouter from './routes/provider.js';
import subscriptionRouter from './routes/subscription.js';
import serve from 'koa-static';
import fs from 'fs';


const app = new Koa();
const router = new Router();

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

// 认证路由（无需认证）
app.use(authRouter.routes());
app.use(authRouter.allowedMethods());

// 订阅管理路由（需要认证） - 中间件已在路由内部注册
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
    
    // 启动 IP 阻断服务（如果启用）
    if (ipBlockerConfig.enabled) {
      startIpBlocker();
    }
  });
});

export default app;
