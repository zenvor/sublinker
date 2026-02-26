// sublinker - Clash 订阅分发服务
// 应用入口

import Koa from 'koa'
import Router from '@koa/router'

import cors from '@koa/cors'
import bodyParser from 'koa-bodyparser'
import { PORT, CORS_ORIGIN } from './config/appConfig.js'
import { initAdmin } from './services/adminService.js'
import errorHandler from './middlewares/errorHandler.js'
import logger from './middlewares/logger.js'
import realIp from './middlewares/realIp.js'
import response from './middlewares/response.js'
import authRouter from './routes/auth.js'
import subRouter from './routes/sub.js'
import providerRouter from './routes/provider.js'
import subscriptionRouter from './routes/subscription.js'
import geoxRouter from './routes/geox.js'
import { startGeoxScheduler } from './services/geoxSyncService.js'
import { logError, logInfo } from './utils/logUtil.js'
import db from './db/index.js'


const app = new Koa()
const router = new Router()

// 注册中间件（顺序重要）
app.use(errorHandler)
app.use(cors({ origin: CORS_ORIGIN })) // CORS 跨域支持
app.use(bodyParser())     // JSON 请求体解析
app.use(response)         // 统一响应格式
app.use(realIp)
app.use(logger)

// 健康检查端点（含 DB 探测）
router.get('/health', (ctx) => {
  try {
    db.prepare('SELECT 1').get()
    ctx.body = 'OK'
  } catch (error) {
    logError('健康检查失败:', error)
    ctx.status = 503
    ctx.body = 'DB unavailable'
  }
})

// 注册路由
app.use(subRouter.routes())
app.use(subRouter.allowedMethods())
app.use(providerRouter.routes())
app.use(providerRouter.allowedMethods())

// 认证路由（无需认证）
app.use(authRouter.routes())
app.use(authRouter.allowedMethods())

// 订阅管理路由（需要认证） - 中间件已在路由内部注册
app.use(subscriptionRouter.routes())
app.use(subscriptionRouter.allowedMethods())

// GeoX 数据文件下载路由
app.use(geoxRouter.routes())
app.use(geoxRouter.allowedMethods())

app.use(router.routes())
app.use(router.allowedMethods())

// 启动服务
initAdmin()
  .then(() => {
    // 启动 GeoX 数据文件定时同步
    startGeoxScheduler()

    app.listen(PORT, () => {
      logInfo(`服务启动完成，端口: ${PORT}`)
    })
  })
  .catch((error) => {
    logError('服务启动失败:', error)
    process.exit(1)
  })

export default app
