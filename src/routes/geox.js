// GeoX 数据文件下载路由
// 提供 geoip.dat 和 geosite.dat 的静态文件下载
// 文件不存在时回退到上游地址

import Router from '@koa/router'
import fs from 'fs/promises'
import { createReadStream } from 'fs'
import path from 'path'
import { geoxDir, geoxSources } from '../config/appConfig.js'
import { logError } from '../utils/logUtil.js'

const router = new Router({ prefix: '/geox' })

// 上游回退地址映射
const upstreamMap = {
  'geoip.dat': geoxSources.geoip,
  'geosite.dat': geoxSources.geosite,
}

/**
 * 通用文件下载处理
 * 本地文件存在则直接返回，否则 302 回退到上游地址
 * @param {import('koa').Context} ctx
 * @param {string} filename - 文件名
 */
async function serveGeoxFile(ctx, filename) {
  const filePath = path.join(geoxDir, filename)

  let stats
  try {
    stats = await fs.stat(filePath)
  } catch (err) {
    if (err.code === 'ENOENT') {
      // 文件不存在（首次启动或同步失败），回退到上游地址
      ctx.redirect(upstreamMap[filename])
    } else {
      // 权限/IO 等非预期错误，详细信息写日志，对外返回通用错误
      logError(`[GeoX] 读取 ${filename} 失败:`, err)
      ctx.status = 500
      ctx.body = '读取文件失败，请联系管理员'
    }
    return
  }

  ctx.set('Content-Type', 'application/octet-stream')
  ctx.set('Content-Disposition', `attachment; filename=${filename}`)
  ctx.set('Content-Length', String(stats.size))
  ctx.set('Cache-Control', 'public, max-age=3600') // 缓存 1 小时
  ctx.set('Last-Modified', stats.mtime.toUTCString())

  ctx.body = createReadStream(filePath)
}

/**
 * GET /geox/geoip.dat
 */
router.get('/geoip.dat', async (ctx) => {
  await serveGeoxFile(ctx, 'geoip.dat')
})

/**
 * GET /geox/geosite.dat
 */
router.get('/geosite.dat', async (ctx) => {
  await serveGeoxFile(ctx, 'geosite.dat')
})

export default router
