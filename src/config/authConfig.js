// 认证配置

// 管理员账号配置
// 这里的配置仅在首次启动初始化数据库时使用
// 后续验证将使用数据库中的加密凭据
export const adminConfig = {
  username: process.env.ADMIN_USERNAME || 'REDACTED_ADMIN_PLACEHOLDER',
  password: process.env.ADMIN_PASSWORD || 'REDACTED_ADMIN_PASSWORD'
};

// JWT 配置
export const jwtConfig = {
  secret: process.env.JWT_SECRET || 'REDACTED_JWT_PLACEHOLDER',
  expiresIn: 24 * 60 * 60 * 1000 // 24 小时（毫秒）
};
