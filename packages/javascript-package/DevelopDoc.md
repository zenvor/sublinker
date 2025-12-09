## 一、整体目标和架构确认

### 1. 核心目标（方案 A’）

- 提供两个 HTTP 接口：

  1. `GET /sub?token=xxx`
     返回 **一级订阅 YAML**：包含

     - 端口、模式、规则
     - `proxy-providers.main.url = https://api.starying.top/provider?token=xxx`

  2. `GET /provider?token=xxx`
     返回 **只包含 `proxies:` 的 YAML**：

     - 验证 token
     - 统计最近一段时间内该 token 的**活跃公网 IP 数量 ≤ 2**
     - 超限 → 返回 `proxies: []`
     - 未超限 → 返回真实节点列表

- 不依赖 3x-ui 日志（那是后续扩展 B 方案）。

- 只用 Node.js 自己维护一个「滑动窗口活跃 IP 表」。

---

## 二、技术栈 & 工程基础规划

### 1. 技术选型

- **语言**：Node.js（建议 Node 18+）
- **Web 框架**：Koa 或 Express（你之前用 Koa，可以继续用 Koa）
- **YAML 处理**：`js-yaml`
- **存储：第一版可以这样**

  - Token 信息：SQLite / JSON 文件 / MySQL 均可
    （推荐 SQLite 起步，简单好用）
  - 活跃 IP 统计：先用内存 Map 实现，将来需要多进程再换 Redis

- **部署**：

  - 仍然通过 1Panel + Docker 部署 Node 容器
  - 前面用 Caddy/Nginx 做反向代理 + HTTPS（starying.top 你已经在用）

### 2. 项目结构建议

```text
project-root/
  src/
    app.js / app.js           # Koa 启动入口
    routes/
      sub.js                  # /sub 相关路由
      provider.js             # /provider 相关路由
      admin.js                # 可选：token 管理
    services/
      tokenService.js         # token 增删改查
      ipTracker.js            # 活跃 IP 统计逻辑（滑动窗口）
      yamlService.js          # 生成 YAML 的逻辑
    middlewares/
      errorHandler.js         # 统一错误处理
      logger.js               # 日志中间件
      realIp.js               # 解析真实 IP（X-Forwarded-For）
    config/
      defaultSubTemplate.yaml # 一级订阅模板（带占位符）
      nodesTemplate.yaml      # 节点模板（可选：按用户/套餐区分）
      appConfig.js            # 全局配置，如窗口时间、max IP
    db/
      schema.sql              # SQLite 初始化
  package.json
  Dockerfile                  # 部署用
  README.md
```

---

## 三、数据模型设计

### 1. Token 表（必需）

字段建议：

- `id`：自增 ID
- `token`：字符串，唯一，随机生成（长度 32 或 64）
- `status`：`active` / `banned`
- `created_at`
- `expired_at`（可选：没有就存 NULL）
- `remark`：备注，比如“给谁用的”“3x-ui 对应邮箱”等
- `node_profile`：该 token 应该使用的节点配置标识（例如“planA”、“US-only”等）

示例（SQLite 表）：

```sql
CREATE TABLE tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  remark TEXT,
  node_profile TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expired_at DATETIME
);
```

### 2. 活跃 IP 统计（滑动窗口）【先用内存实现】

逻辑结构：

```ts
// Map<string, Map<string, number>>
token -> (ip -> lastSeenTimestamp)
```

- `WINDOW_MS`：滑动窗口长度，比如 `30 * 60 * 1000`（30 分钟）
- `MAX_IP`：最大允许活跃公网 IP 数，比如 2

将来如果要多进程 / 多机部署，再把这套 Map 换成 Redis。

---

## 四、接口设计（HTTP API）

### 1. `GET /sub?token=xxx`

**用途**：客户端导入订阅时使用（一级订阅）。

流程：

1. 从 `query.token` 拿 token
2. 校验 token：

   - 是否存在
   - 是否 `status = active`
   - 是否未过期

3. 读取 `defaultSubTemplate.yaml`
4. 用字符串替换 or 模板引擎，把里面的 `__TOKEN__` 替换成真实 token：

   - `https://api.starying.top/provider?token=__TOKEN__`

5. 设置响应头 `Content-Type: application/x-yaml; charset=utf-8`
6. 返回处理后的 YAML 文本

错误情况：

- token 不存在 / 被禁用 / 过期：

  - 可以返回 404 或 403（配合一个简单的 YAML 提示，或者干脆 JSON）

### 2. `GET /provider?token=xxx`

**用途**：被 Clash 的 proxy-providers 定期请求，用于拿真实节点列表。

流程：

1. 从 `query.token` 拿 token
2. 通过中间件获取真实 IP：

   - 先取 `X-Forwarded-For` 第一段
   - 退化为 `ctx.ip`

3. 读取 UA：`ctx.headers['user-agent']`（可以记录但先不强依赖）
4. 校验 token 状态同上
5. 调用 IP 统计逻辑：

#### IP 并发控制详细逻辑（核心）

```ts
const WINDOW_MS = 30 * 60 * 1000 // 30 分钟
const MAX_IP = 2

function updateActiveIp(token: string, ip: string): boolean {
  const now = Date.now()
  let map = activeMap.get(token)
  if (!map) {
    map = new Map()
    activeMap.set(token, map)
  }

  // 1. 清理过期 IP
  for (const [ipKey, ts] of map.entries()) {
    if (now - ts > WINDOW_MS) {
      map.delete(ipKey)
    }
  }

  // 2. 判断当前 IP 是否已经在列表
  const already = map.has(ip)
  const activeCount = map.size

  // 3. 如果是新 IP 且已经达到上限 → 拒绝
  if (!already && activeCount >= MAX_IP) {
    return false
  }

  // 4. 记录 / 更新当前 IP
  map.set(ip, now)
  return true
}
```

在 `/provider` handler 里：

- `if (!updateActiveIp(token, ip))`：

  - 视为超限，返回：

    ```yaml
    proxies: []
    ```

- 否则：

  - 根据 `token.node_profile` 找到对应的节点配置
  - 拼好 `proxies:` 的 YAML 返回

同样设置 `Content-Type: application/x-yaml; charset=utf-8`

### 3. 可选：简单的管理接口

后期方便你管理 token，可以加一组后端管理接口（不对外，只自己用）：

- `POST /admin/token`：创建 token（入参：remark、node_profile、过期时间等）
- `GET /admin/token`：分页列出 token
- `PATCH /admin/token/:token`：禁用 / 启用
- `GET /admin/token/:token/active-ips`：查看最近窗口内的活跃 IP（从 activeMap 里读）

---

## 五、YAML 模板设计

### 1. 一级订阅模板 `defaultSubTemplate.yaml`

直接基于你现在的配置做改造，保留：

- 端口、mode、log-level、external-controller
- 所有 proxy-groups
- 所有 rules
- 只把原来的 `proxies:` 删掉，换成 `proxy-providers.main`

比如：

```yaml
port: 7890
socks-port: 7891
allow-lan: true
mode: Rule
log-level: info
external-controller: 127.0.0.1:9090

proxy-providers:
  main:
    type: http
    url: 'https://api.starying.top/provider?token=__TOKEN__'
    path: ./providers/main.yaml
    interval: 600
    health-check:
      enable: true
      url: http://www.gstatic.com/generate_204
      interval: 300

proxy-groups:
  # ……用我之前帮你改好的那一版（用 use/main，而不是列具体节点名）
rules:
  # ……沿用你现在的规则
```

Node.js 在 `/sub` 中只干两件事：

1. 把这个文件读出来
2. 把 `__TOKEN__` 替换为真实 token

### 2. 节点模板 / 数据

可以有两种做法：

1. **硬编码在代码里**：第一版你就直接把你这 5 个 VLESS 节点写在 `yamlService.js` 里，按 `token.node_profile` 分支即可；
2. **存在数据库 / 配置文件里**：以后要支持多个套餐 / 不同地区节点可以再结构化。

---

## 六、开发步骤拆解（实际动手顺序）

### 阶段 1：项目初始化

1. 初始化项目

```bash
mkdir clash-sub-server
cd clash-sub-server
npm init -y
npm install koa @koa/router js-yaml
npm install --save-dev typescript ts-node nodemon @types/node @types/koa @types/koa__router
```

2. 配好 TypeScript / tsconfig（如果用 TS）
3. 写一个最简 Koa server（只响应 `/health` 返回 OK），确认可以跑起来。

---

### 阶段 2：实现 `/sub` （不带 token 校验的最简版本）

1. 在 `config/defaultSubTemplate.yaml` 中放入模板（先写死一个 token 占位符）
2. 写 `yamlService.js`：

   - `loadSubTemplate()`：读文件并缓存
   - `renderSubYaml(token)`：字符串替换 `__TOKEN__`

3. 写 `routes/sub.js`：

   - 读取 `ctx.query.token`（暂时不校验）
   - 调用 `yamlService.renderSubYaml(token || 'TEST')`
   - 返回 YAML

4. 在 Clash 客户端手动填一个 token 测试，看能否正常解析一级订阅（如果 provider URL 暂时 404 也没关系）。

---

### 阶段 3：接入 Token 表和基本校验

1. 选定存储方案（建议 SQLite + `better-sqlite3` / `knex`）

2. 写简单的 tokenService：

   - `getToken(tokenStr)`：返回 token 记录（状态、过期时间、node_profile）

3. 修改 `/sub`：

   - 如果 token 不存在 / 被禁用 / 过期 → 返回 404/403 + 文本说明
   - 正常 → 返回渲染后的 YAML

4. 写一个临时脚本创建测试 token：

   - 比如 `node scripts/create-token.js` 打印出新 token，方便你在 Clash 里填。

---

### 阶段 4：实现活跃 IP 统计模块 ipTracker

1. 写 `services/ipTracker.js`：

   - 内部维护 `Map<string, Map<string, number>>`
   - 导出函数：

     - `updateAndCheck(token, ip): boolean` → 返回是否允许
     - `getActiveIps(token): { ip, lastSeen }[]`

2. 配置：

   - 在 `config/appConfig.js` 定义：

     - `WINDOW_MS = 30 * 60 * 1000`
     - `MAX_IP_PER_TOKEN = 2`

---

### 阶段 5：实现 `/provider`

1. 写 `middlewares/realIp.js`：

   - 从 `X-Forwarded-For` 取首个 IP
   - 无则 fallback 到 `ctx.ip`

2. 在 `app.js` 中 use 这个 middleware

3. 写 `routes/provider.js`：

   流程：

   - 拿 `token`（query）
   - token 校验（调用 tokenService）
   - 拿 `ip` & `user-agent`
   - 调用 `ipTracker.updateAndCheck(token, ip)`：

     - false → `ctx.body = 'proxies: []\n'`
     - true → `ctx.body = generateProxiesYaml(token)`

4. `yamlService` 里写 `generateProxiesYaml(token)`：

   - 第一版直接返回你现在这 5 个 VLESS 节点组成的 YAML（写死）
   - 将来按 `token.node_profile` 分套餐返回不同节点集

5. 在 Clash 里导入你 `/sub` 生成的订阅：

   - 看看节点能否正常列出来
   - 如果你手动复制 token 给第三台设备、多网 IP 使用，观察是否有某台开始显示“无节点”。

---

### 阶段 6：增加日志 & 简单监控

1. 写 `logger` 中间件：

   - 打印：时间、路径、token、IP、UA、status code

2. 对 `/provider` 特别记录：

   - 是“放行”还是“超限返回空”

3. 考虑加一个 `GET /admin/token/:token/active-ips`：

   - 调用 `ipTracker.getActiveIps(token)` 返回当前窗口内的活跃 IP 列表，方便你检查风控是否生效。

---

### 阶段 7：部署上线（结合你现有环境）

1. 写 `Dockerfile`，把 Node 服务打进镜像
2. 使用 1Panel 创建 Node 服务容器：

   - 暴露一个内网端口：如 3000

3. 在 Caddy/Nginx 中加反向代理：

   - `https://api.starying.top` → `http://127.0.0.1:3000`

4. 确认：

   - `curl https://api.starying.top/sub?token=xxx` 能拿到 YAML
   - Clash 导入订阅可用
   - 日志正确记录 IP 和 token

---

## 七、未来扩展方向（可以先记着，不用一开始做）

- 把活跃 IP 统计从内存 Map 换成 Redis，支持多实例部署。
- 接入 3x-ui 日志系统，做更精细的“真实在线 IP 判断”。
- 增加：

  - 每 token 最大设备数 / 最大请求频率（Rate Limit）
  - 每 token 的到期时间、流量用量等（接近计费系统）

- 写一个简单 Web 管理界面（Vue + Ant Design），对接 admin API 管理 token。

核心思路再重申一遍（修订版 A’）

我们不要求“实时在线连接数”，而是近似为：

在最近一段时间窗口内（比如 2×interval），同一个 token 出现了多少个不同公网 IP 去访问 /provider。

因为：

只要一个 Clash 实例在持续使用订阅，它就会按 interval 间隔不断访问 /provider；

如果有多个人共享这个 token，他们各自的 Clash 也会不断访问 /provider；

你只要在比如 最近 30 分钟 内统计到 3 个不同 IP，就可以认定这个 token 已经被多人同时用。

怎么跟手机卡“IP 一直变”这件事兼容？

方案是这样：

缩短 interval

在你下发的一级订阅里，把 provider 的 interval 写得合理短一点，比如 600 秒（10 分钟）而不是 3600。

这样每个在线设备至少每 10 分钟访问一次 /provider。

滑动时间窗口设置为 2–3 倍 interval

比如 interval = 600 → WINDOW = 1800 秒（30 分钟）。

逻辑变成：

“最近半小时内，如果有超过 2 个不同公网 IP 用这个 token 拉配置，就视作滥用。”

手机流量 IP 漂移的影响

同一台手机，如果 IP 频繁变化，但它实际上还是一个人使用：

这些 IP 会在窗口内进进出出，但一般不会同时有多个 IP 在不断访问（旧 IP 很快就不再访问 /provider 了）。

真正多人共用的情况：

不同人的设备在不同网络、不同 IP 下，都会按 interval 不断访问 provider → 会在窗口内持续看到 3 个以上 IP。

换句话说：

我们不是严格意义上的“实时在线连接数”，

但可以做到**“最近 N 分钟内的并发 IP 数量”**，足以判定是否“多人在同时用”。

3. 如果 interval 设置很大（比如 1 小时）怎么处理？

那确实会削弱这个方法的判断精度：

用户 A 一小时访问一次；用户 B 也一小时访问一次；

时间差刚好比较大时，窗口内看起来「好像只有一个 IP」。

所以，如果你要依赖 provider 日志做风控，interval 不能太夸张，建议：

你自己控制生成的订阅模板，强制：

interval: 600 # 10 分钟

或者：

interval: 900 # 15 分钟

这样：

精度足够；

访问频率对你服务器压力也不会太夸张。
