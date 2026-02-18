// 认证配置

/**
 * 读取必填环境变量
 * @param {string} key
 * @returns {string}
 */
function getRequiredEnv(key) {
  const value = String(process.env[key] || '').trim()
  if (!value) {
    throw new Error(`[authConfig] 缺少必填环境变量: ${key}`)
  }
  return value
}

// 管理员账号配置
// 这里的配置仅在首次启动初始化数据库时使用
// 后续验证将使用数据库中的加密凭据
export const adminConfig = {
  username: getRequiredEnv('ADMIN_USERNAME'),
  password: getRequiredEnv('ADMIN_PASSWORD'),
};

// JWT 配置
export const jwtConfig = {
  secret: getRequiredEnv('JWT_SECRET'),
  expiresIn: process.env.JWT_EXPIRES_IN || '24h',
};
