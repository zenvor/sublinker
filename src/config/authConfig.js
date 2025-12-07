// 认证配置

// 管理员账号配置
export const adminConfig = {
  username: process.env.ADMIN_USERNAME || 'lffb4Rggn3',
  password: process.env.ADMIN_PASSWORD || 'm3wpzYBcT4'
};

// JWT 配置
export const jwtConfig = {
  secret: process.env.JWT_SECRET || 'cloakgate-jwt-secret-lffb4Rggn3',
  expiresIn: 24 * 60 * 60 * 1000 // 24 小时（毫秒）
};
