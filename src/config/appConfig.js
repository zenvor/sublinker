// 全局配置

// 服务端口
export const PORT = process.env.PORT || 3000;

// 滑动窗口配置
export const WINDOW_MS = 30 * 60 * 1000; // 30 分钟

// API 域名（用于生成订阅中的 provider URL）
export const API_DOMAIN = process.env.API_DOMAIN || 'https://api.starying.top';
