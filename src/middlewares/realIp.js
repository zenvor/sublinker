// 真实 IP 解析中间件
// 从代理头获取客户端真实 IP（仅信任配置中的代理源）

import net from 'net'
import { TRUSTED_PROXIES } from '../config/appConfig.js'

/**
 * 规范化 IP 地址
 * 去除 IPv4-mapped IPv6 前缀 (::ffff:)
 * @param {string} ip - 原始 IP 地址
 * @returns {string} - 规范化后的 IP 地址
 */
function normalizeIp(ip) {
  if (!ip) {
    return ip
  }

  // 去除 IPv4-mapped IPv6 前缀
  // 例如: ::ffff:192.168.1.1 -> 192.168.1.1
  if (ip.startsWith('::ffff:')) {
    return ip.substring(7)
  }

  return ip
}

/**
 * 将 IPv4 地址字符串转为 32 位整数
 * @param {string} ip
 * @returns {number}
 */
function ipv4ToInt(ip) {
  const parts = ip.split('.')
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0
}

/**
 * 解析 TRUSTED_PROXIES 配置项为高效匹配结构（启动时预计算一次）
 * 非法条目会被跳过并输出警告
 */
function parseTrustedProxies(list) {
  const results = []
  for (const entry of list) {
    if (entry.includes('/')) {
      // CIDR 格式（仅支持 IPv4 CIDR）
      const [base, prefixStr] = entry.split('/')
      const bits = /^\d+$/.test(prefixStr) ? Number(prefixStr) : NaN
      if (!net.isIPv4(base) || isNaN(bits) || bits < 0 || bits > 32) {
        console.warn(`[realIp] TRUSTED_PROXIES 忽略非法 CIDR 条目: "${entry}"`)
        continue
      }
      const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0
      results.push({ type: 'cidr', network: ipv4ToInt(base) & mask, mask })
    } else {
      // 精确 IP
      const normalized = normalizeIp(entry)
      if (!net.isIPv4(normalized) && !net.isIPv6(normalized)) {
        console.warn(`[realIp] TRUSTED_PROXIES 忽略非法 IP 条目: "${entry}"`)
        continue
      }
      results.push({ type: 'exact', ip: normalized })
    }
  }
  return results
}

const parsedProxies = parseTrustedProxies(TRUSTED_PROXIES)

/**
 * 检查 IP 是否在可信代理列表中（支持精确匹配和 CIDR）
 * @param {string} ip - 规范化后的 IP
 * @returns {boolean}
 */
function isTrustedProxy(ip) {
  const normalized = normalizeIp(ip)
  return parsedProxies.some(rule => {
    if (rule.type === 'exact') {
      return rule.ip === normalized
    }
    // CIDR：仅对 IPv4 生效
    if (net.isIPv4(normalized)) {
      return (ipv4ToInt(normalized) & rule.mask) === rule.network
    }
    return false
  })
}

/**
 * 解析真实 IP 的中间件
 * 仅当直连 IP 在 TRUSTED_PROXIES 列表中时，才信任代理头
 */
export default async function realIp(ctx, next) {
  const directIp = normalizeIp(ctx.ip)

  // 仅信任可信代理转发的头部
  if (isTrustedProxy(directIp)) {
    const xff = ctx.headers['x-forwarded-for']
    const xRealIp = ctx.headers['x-real-ip']

    if (xff) {
      ctx.realIp = normalizeIp(xff.split(',')[0].trim())
    } else if (xRealIp) {
      ctx.realIp = normalizeIp(xRealIp.trim())
    } else {
      ctx.realIp = directIp
    }
  } else {
    // 非可信代理：忽略代理头，使用直连 IP
    ctx.realIp = directIp
  }

  await next()
}
