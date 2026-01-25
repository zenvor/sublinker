/**
 * PM2 Ecosystem 配置文件
 * 使用方式：pm2 start ecosystem.config.cjs
 */
module.exports = {
  apps: [
    {
      name: 'cloakgate',
      script: './packages/javascript-package/src/app.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 1000,
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      // 日志配置
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: './logs/cloakgate-error.log',
      out_file: './logs/cloakgate-out.log',
      merge_logs: true,
      // 内存限制，超过自动重启
      max_memory_restart: '500M',
      // 优雅关闭
      kill_timeout: 5000,
      wait_ready: false,
    },
  ],
};
