// GeoX 数据文件同步服务
// 定时从 GitHub 拉取 geoip.dat 和 geosite.dat，缓存到本地供客户端下载

import fs from 'fs'
import path from 'path'
import https from 'node:https'
import http from 'node:http'
import { geoxDir, geoxSyncInterval, geoxSources } from '../config/appConfig.js'
import { logInfo, logError } from '../utils/logUtil.js'

/**
 * 通过 HTTP/HTTPS 下载文件，自动跟随重定向
 * @param {string} url - 下载地址
 * @param {string} destPath - 目标文件路径
 * @param {number} [maxRedirects=5] - 最大重定向次数
 * @returns {Promise<void>}
 */
// 单次下载超时时间（毫秒）
const downloadTimeout = 60_000

function downloadFile(url, destPath, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    if (maxRedirects <= 0) {
      reject(new Error('重定向次数超限'))
      return
    }

    // 根据协议选择请求模块
    const client = url.startsWith('https') ? https : http

    const req = client.get(url, { timeout: downloadTimeout }, (res) => {
      // 处理重定向（兼容相对路径 Location）
      if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location) {
        res.resume() // 消费响应体，释放内存
        let redirectUrl
        try {
          redirectUrl = new URL(res.headers.location, url).toString()
        } catch {
          reject(new Error(`重定向地址无效: ${res.headers.location}`))
          return
        }
        downloadFile(redirectUrl, destPath, maxRedirects - 1)
          .then(resolve)
          .catch(reject)
        return
      }

      if (res.statusCode !== 200) {
        res.resume()
        reject(new Error(`下载失败，HTTP 状态码: ${res.statusCode}`))
        return
      }

      // 先写入临时文件，成功后再重命名，避免下载失败时损坏已有文件
      const tmpPath = `${destPath}.tmp`
      const fileStream = fs.createWriteStream(tmpPath)

      res.pipe(fileStream)

      fileStream.on('finish', () => {
        fileStream.close(() => {
          fs.rename(tmpPath, destPath, (err) => {
            if (err) {
              reject(err)
            } else {
              resolve()
            }
          })
        })
      })

      fileStream.on('error', (err) => {
        // 清理临时文件
        fs.unlink(tmpPath, () => {})
        reject(err)
      })
    })

    req.on('timeout', () => {
      req.destroy(new Error(`下载超时 (${downloadTimeout / 1000}s)`))
    })

    req.on('error', reject)
  })
}

// 并发锁，防止上一轮未完成时重入
let syncing = false

/**
 * 同步所有 GeoX 文件
 */
async function syncGeoxFiles() {
  if (syncing) {
    logInfo('[GeoX] 上一轮同步尚未完成，跳过本轮')
    return
  }

  syncing = true
  try {
    // 确保存储目录存在
    try {
      fs.mkdirSync(geoxDir, { recursive: true })
    } catch (err) {
      logError('[GeoX] 创建存储目录失败:', err)
      return
    }

    const tasks = [
      { name: 'geoip.dat', url: geoxSources.geoip },
      { name: 'geosite.dat', url: geoxSources.geosite },
    ]

    for (const task of tasks) {
      const destPath = path.join(geoxDir, task.name)
      try {
        logInfo(`[GeoX] 开始同步 ${task.name} ...`)
        await downloadFile(task.url, destPath)
        const stats = fs.statSync(destPath)
        const sizeMb = (stats.size / 1024 / 1024).toFixed(2)
        logInfo(`[GeoX] ${task.name} 同步完成 (${sizeMb} MB)`)
      } catch (err) {
        logError(`[GeoX] ${task.name} 同步失败:`, err)
      }
    }
  } finally {
    syncing = false
  }
}

/**
 * 启动 GeoX 定时同步调度器
 * 服务启动时立即执行一次同步，之后按配置间隔定期执行
 */
export function startGeoxScheduler() {
  logInfo(`[GeoX] 同步调度器已启动，间隔: ${geoxSyncInterval / 3600000}h`)

  // 启动时立即执行一次（捕获未处理拒绝）
  syncGeoxFiles().catch((err) => logError('[GeoX] 首次同步异常:', err))

  // 定期执行（捕获未处理拒绝）
  setInterval(() => {
    syncGeoxFiles().catch((err) => logError('[GeoX] 定时同步异常:', err))
  }, geoxSyncInterval)
}
