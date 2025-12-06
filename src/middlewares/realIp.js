// 真实 IP 解析中间件
// 从 X-Forwarded-For 头获取客户端真实 IP

/**
 * 解析真实 IP 的中间件
 * 优先从 X-Forwarded-For 获取，fallback 到 ctx.ip
 */
export default async function realIp(ctx, next) {
  const xff = ctx.headers['x-forwarded-for'];
  
  if (xff) {
    // X-Forwarded-For 格式: client, proxy1, proxy2, ...
    // 取第一个 IP（真实客户端 IP）
    const firstIp = xff.split(',')[0].trim();
    ctx.realIp = firstIp;
  } else {
    // Fallback 到 Koa 的 ctx.ip
    ctx.realIp = ctx.ip;
  }
  
  await next();
}
