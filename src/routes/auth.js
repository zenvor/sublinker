// 认证路由
// 提供登录、登出、获取用户信息等接口

import Router from '@koa/router'
import { generateToken } from '../services/jwtService.js'
import { authMiddleware } from '../middlewares/authMiddleware.js'
import { verifyCredentials } from '../services/adminService.js'

const router = new Router({
  prefix: '/admin/auth'
})

// 登录限速：同一 IP 5 分钟内最多 5 次尝试
const LOGIN_WINDOW_MS = 5 * 60 * 1000
const LOGIN_MAX_ATTEMPTS = 5
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000
const loginAttempts = new Map()

// 定时清理过期记录，防止一次性 IP 累积导致内存增长
setInterval(() => {
  const now = Date.now()
  for (const [ip, record] of loginAttempts) {
    if (now > record.resetAt) {
      loginAttempts.delete(ip)
    }
  }
}, CLEANUP_INTERVAL_MS).unref()

function checkLoginRate(ip) {
  const now = Date.now()
  const record = loginAttempts.get(ip)

  if (!record || now > record.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + LOGIN_WINDOW_MS })
    return true
  }

  record.count++
  return record.count <= LOGIN_MAX_ATTEMPTS
}

/**
 * POST /admin/auth/login
 * 管理员登录
 */
router.post('/login', async (ctx) => {
  // 限速检查
  const clientIp = ctx.realIp || ctx.ip
  if (!checkLoginRate(clientIp)) {
    ctx.fail(429, '登录尝试过于频繁，请 5 分钟后再试')
    return
  }

  const { username, password } = ctx.request.body

  // 验证必填字段
  if (!username || !password) {
    ctx.fail(400, '用户名和密码不能为空')
    return
  }

  // 验证账号密码
  const isValid = await verifyCredentials(username, password)
  if (!isValid) {
    ctx.fail(401, '用户名或密码错误')
    return
  }

  // 生成 token
  const token = generateToken({
    username,
    role: 'admin'
  })

  ctx.success({ token }, '登录成功')
})

/**
 * GET /admin/auth/info
 * 获取当前用户信息
 * 需要认证
 */
router.get('/info', authMiddleware(), async (ctx) => {
  // 此接口需要 authMiddleware 保护
  // ctx.state.user 由中间件设置
  const user = ctx.state.user

  if (!user) {
    ctx.fail(401, '未登录')
    return
  }

  ctx.success({
    username: user.username,
    roles: [user.role],
    name: '管理员',
    avatar: ''
  })
})

export default router
