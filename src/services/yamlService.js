// YAML 服务
// 负责加载模板和生成 YAML 响应

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

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
 * @returns {string} 渲染后的 YAML
 */
export function renderSubYaml(token) {
  const template = loadSubTemplate()
  return template.replace(/__TOKEN__/g, token)
}

/**
 * 生成节点列表 YAML
 * 目前返回固定的测试节点，后续根据 nodeProfile 返回不同节点集
 * @param {string} nodeProfile - 节点配置标识
 * @returns {string} 节点列表 YAML
 */
export function generateProxiesYaml(nodeProfile = 'default') {
  // 第一版：硬编码测试节点
  // 后续可以根据 nodeProfile 从数据库或配置文件加载不同节点集
  const proxies = [
    {
      name: 'United States | 01-miiokapvuser',
      server: 'lucky.starying.top',
      port: 36609,
      type: 'vless',
      tls: true,
      uuid: '5e4ed592-9a3f-41c9-9dde-b756f3e97d37',
      servername: 'amd.com',
      host: 'amd.com',
      path: '/',
      flow: 'xtls-rprx-vision',
      realityOpts: {
        publicKey: 'AqNagjlSjv7H6BCwczyK34HmJKKIE4oGugIB7DzJ7DQ',
        shortId: 'e0577732',
      },
      clientFingerprint: 'random',
    },
    {
      name: 'United States | 02-nx17aell',
      server: 'lucky.starying.top',
      port: 57340,
      type: 'vless',
      tls: true,
      uuid: '886060aa-ff99-4ff9-907f-22bbf8c16779',
      servername: 'amd.com',
      host: 'amd.com',
      path: '/',
      realityOpts: {
        publicKey: 'LjbQL4iXMdyPQj2Eiw8ReNoHyLpAS0t2ClTzhk-O-XE',
        shortId: 'ff',
      },
      clientFingerprint: 'random',
    },
    {
      name: 'United States | 03-db5nnigc',
      server: 'lucky.starying.top',
      port: 39075,
      type: 'vless',
      tls: true,
      uuid: 'a39c48cd-04a3-4c3a-a8f8-ac46aadafad2',
      servername: 'amd.com',
      host: 'amd.com',
      path: '/',
      realityOpts: {
        publicKey: 'deIpidvyTWJnlaBfZPQiC2CILf_2XAQAh5HU63T7_kc',
        shortId: 'd2bfb3b611bbaf',
      },
      clientFingerprint: 'random',
    },
    {
      name: 'United States | 04-a96iczrj',
      server: 'lucky.starying.top',
      port: 26284,
      type: 'vless',
      tls: true,
      uuid: '4b360382-98af-4b41-8b88-e35d4e98830d',
      servername: 'amd.com',
      host: 'amd.com',
      path: '/',
      realityOpts: {
        publicKey: 'Wb4RdU4rIW8OCXS705wSLhEVNes1PJ606N2yDEf3WWk',
        shortId: '23e047839decdb',
      },
      clientFingerprint: 'random',
    },
    {
      name: 'United States | 05-mnbv5sej',
      server: 'lucky.starying.top',
      port: 57020,
      type: 'vless',
      tls: true,
      uuid: '49600216-6a16-4685-bdc3-a1f3b3050b25',
      servername: 'amd.com',
      host: 'amd.com',
      path: '/',
      realityOpts: {
        publicKey: '_uvc-WXtfkrFiXnqA1YhUS6K7mWL9s55OddOQQClflM',
        shortId: '77',
      },
      clientFingerprint: 'random',
    },
  ]

  // 转换为 YAML 格式
  const yamlLines = ['proxies:']
  for (const proxy of proxies) {
    yamlLines.push(`  - name: "${proxy.name}"`)
    yamlLines.push(`    type: ${proxy.type}`)
    yamlLines.push(`    server: ${proxy.server}`)
    yamlLines.push(`    port: ${proxy.port}`)
    yamlLines.push(`    uuid: ${proxy.uuid}`)
    yamlLines.push(`    network: ${proxy.network}`)
    yamlLines.push(`    tls: ${proxy.tls}`)
    yamlLines.push(`    udp: ${proxy.udp}`)
    if (proxy['ws-opts']) {
      yamlLines.push('    ws-opts:')
      yamlLines.push(`      path: ${proxy['ws-opts'].path}`)
      yamlLines.push('      headers:')
      yamlLines.push(`        Host: ${proxy['ws-opts'].headers.Host}`)
    }
  }

  return yamlLines.join('\n')
}

/**
 * 生成空节点列表（用于超限情况）
 * @returns {string}
 */
export function generateEmptyProxiesYaml() {
  return 'proxies: []'
}
