// 真实 IP 解析中间件
// 从代理头获取客户端真实 IP

/**
 * 规范化 IP 地址
 * 去除 IPv4-mapped IPv6 前缀 (::ffff:)
 * @param {string} ip - 原始 IP 地址
 * @returns {string} - 规范化后的 IP 地址
 */
function normalizeIp(ip) {
  if (!ip) {
    return ip;
  }
  
  // 去除 IPv4-mapped IPv6 前缀
  // 例如: ::ffff:192.168.1.1 -> 192.168.1.1
  if (ip.startsWith('::ffff:')) {
    return ip.substring(7);
  }
  
  return ip;
}

/**
 * 解析真实 IP 的中间件
 * 优先级: X-Forwarded-For > X-Real-IP > ctx.ip
 */
export default async function realIp(ctx, next) {
  let clientIp;
  
  const xff = ctx.headers['x-forwarded-for'];
  const xRealIp = ctx.headers['x-real-ip'];
  
  if (xff) {
    // X-Forwarded-For 格式: client, proxy1, proxy2, ...
    // 取第一个 IP（真实客户端 IP）
    clientIp = xff.split(',')[0].trim();
  } else if (xRealIp) {
    // 从 X-Real-IP 头获取
    clientIp = xRealIp.trim();
  } else {
    // Fallback 到 Koa 的 ctx.ip
    clientIp = ctx.ip;
  }
  
  // 规范化 IP 地址
  ctx.realIp = normalizeIp(clientIp);
  
  await next();
}
