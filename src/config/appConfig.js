// 全局配置

// 服务端口
export const PORT = process.env.PORT || 9007;

// 滑动窗口配置
export const WINDOW_MS = 30 * 60 * 1000; // 30 分钟
export const MAX_IP_PER_TOKEN = 2; // 每个 token 最大活跃 IP 数

// API 域名（用于生成订阅中的 provider URL）
export const API_DOMAIN = process.env.API_DOMAIN || 'https://api.starying.top';
