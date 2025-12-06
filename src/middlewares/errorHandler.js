// 错误处理中间件
// 统一捕获错误并返回友好响应

export default async function errorHandler(ctx, next) {
  try {
    await next();
  } catch (err) {
    console.error('请求处理错误:', err);
    
    ctx.status = err.status || 500;
    ctx.body = {
      error: true,
      message: err.message || '服务内部错误'
    };
  }
}
