// 认证配置

// 管理员账号配置
export const adminConfig = {
  username: process.env.ADMIN_USERNAME || 'REDACTED_ADMIN_PLACEHOLDER',
  password: process.env.ADMIN_PASSWORD || 'REDACTED_ADMIN_PASSWORD'
};

// JWT 配置
export const jwtConfig = {
  secret: process.env.JWT_SECRET || 'REDACTED_JWT_PLACEHOLDER',
  expiresIn: 24 * 60 * 60 * 1000 // 24 小时（毫秒）
};
