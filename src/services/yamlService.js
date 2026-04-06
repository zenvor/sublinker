// YAML 服务
// 负责加载模板和生成 YAML 响应

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import yaml from 'js-yaml'
import { listNodesByToken } from './subscriptionNodeService.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 模板缓存
let subTemplateCache = null

/**
 * 加载一级订阅模板
 * @returns {string} 模板内容
 */
export function loadSubTemplate() {
  if (subTemplateCache) {
    return subTemplateCache
  }

  const templatePath = path.join(__dirname, '../config/defaultSubTemplate.yaml')
  subTemplateCache = fs.readFileSync(templatePath, 'utf-8')
  return subTemplateCache
}

/**
 * 渲染一级订阅 YAML
 * 替换 __TOKEN__ 占位符为真实 token
 * @param {string} token - 用户 token
 * @param {string} apiDomain - 请求中解析出的 API 域名
 * @returns {string} 渲染后的 YAML
 */
export function renderSubYaml(token, apiDomain) {
  const finalApiDomain = String(apiDomain || '').trim()
  if (!finalApiDomain) {
    throw new Error('缺少 API 域名，无法渲染订阅')
  }

  const template = loadSubTemplate()
  return template.replace(/__TOKEN__/g, token).replace(/__API_DOMAIN__/g, finalApiDomain)
}

/**
 * 生成节点列表 YAML
 * @param {string} token - 订阅 token
 * @returns {string} 节点列表 YAML
 */
export function generateProxiesYaml(token) {
  const rows = listNodesByToken(token)

  if (!rows.length) {
    return generateEmptyProxiesYaml()
  }

  const clashProxies = rows.map((row, index) => buildClashProxy(row, index))

  return yaml.dump(
    { proxies: clashProxies },
    {
      indent: 2,
      lineWidth: -1,
      quotingType: '"',
      forceQuotes: false,
    },
  )
}

function buildClashProxy(node, index) {
  const security = (node.security || '').trim()
  const network = (node.transport_type || 'tcp').trim()
  const tls = resolveTlsBySecurity(security, node, index)

  const proxy = {
    name: node.node_name || `节点 ${index + 1}`,
    type: 'vless',
    server: node.server,
    port: node.port,
    uuid: node.uuid,
    tls,
    servername: node.sni || node.server,
    'client-fingerprint': node.fingerprint || 'chrome',
  }

  if (network && network !== 'tcp') {
    proxy.network = network
  }

  if (network === 'ws') {
    proxy['ws-opts'] = {
      path: node.path || '/',
    }

    if (node.host) {
      proxy['ws-opts'].headers = { Host: node.host }
    }
  } else if (network !== 'tcp') {
    throw new Error(`第 ${index + 1} 个节点暂不支持 network=${network}`)
  }

  if (node.flow) {
    proxy.flow = node.flow
  }

  if (security === 'reality') {
    proxy['reality-opts'] = {}

    if (node.public_key) {
      proxy['reality-opts']['public-key'] = node.public_key
    }

    if (node.short_id) {
      proxy['reality-opts']['short-id'] = node.short_id
    }
  }

  return proxy
}

function resolveTlsBySecurity(security, node, index) {
  if (security === 'none') {
    return false
  }

  if (security === 'tls' || security === 'reality') {
    if (security === 'reality' && !node.public_key) {
      throw new Error(`第 ${index + 1} 个节点缺少 reality public-key`)
    }
    return true
  }

  throw new Error(`第 ${index + 1} 个节点暂不支持 security=${security || '空值'}`)
}

/**
 * 生成空节点列表（用于超限情况）
 * @returns {string}
 */
export function generateEmptyProxiesYaml() {
  return 'proxies: []'
}
