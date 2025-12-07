// 统一响应格式中间件
// 为 ctx 添加 success() 和 fail() 方法，规范 API 响应格式

/**
 * 统一响应格式中间件
 * @param {import('koa').Context} ctx
 * @param {import('koa').Next} next
 */
export default async function response(ctx, next) {
  /**
   * 成功响应
   * @param {any} data - 响应数据
   * @param {string} message - 响应消息
   * @param {number} statusCode - HTTP 状态码
   */
  ctx.success = (data = null, message = 'success', statusCode = 200) => {
    ctx.status = statusCode;
    ctx.body = {
      code: statusCode,
      message,
      data
    };
  };

  /**
   * 失败响应
   * @param {number} code - 错误码
   * @param {string} message - 错误消息
   */
  ctx.fail = (code = 400, message = '请求失败') => {
    ctx.status = code;
    ctx.body = {
      code,
      message
    };
  };

  await next();
}
