// vless 链接解析服务
// 负责将多行 vless 订阅链接解析为结构化节点数据

/**
 * 解析多行节点链接文本
 * @param {string} nodeLinksText - 多行节点链接文本
 * @returns {Array<object>} 解析后的节点列表
 */
export function parseVlessNodeLinks(nodeLinksText) {
  if (typeof nodeLinksText !== 'string' || !nodeLinksText.trim()) {
    throw new Error('节点链接不能为空')
  }

  const lines = nodeLinksText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  if (lines.length === 0) {
    throw new Error('节点链接不能为空')
  }

  const duplicatedLine = findDuplicatedLine(lines)
  if (duplicatedLine) {
    throw new Error(`存在重复链接：${duplicatedLine}`)
  }

  return lines.map((line, index) => parseSingleVlessLine(line, index))
}

function findDuplicatedLine(lines) {
  const seen = new Set()

  for (const line of lines) {
    if (seen.has(line)) {
      return line
    }
    seen.add(line)
  }

  return ''
}

function parseSingleVlessLine(rawLink, index) {
  const lineNo = index + 1
  let parsedUrl

  try {
    parsedUrl = new URL(rawLink)
  } catch {
    throw new Error(`第 ${lineNo} 行链接无效：URL 格式错误`)
  }

  if (parsedUrl.protocol !== 'vless:') {
    throw new Error(`第 ${lineNo} 行链接无效：仅支持 vless:// 协议`)
  }

  const uuid = decodeSafely(parsedUrl.username).trim()
  if (!uuid) {
    throw new Error(`第 ${lineNo} 行链接无效：缺少 UUID`)
  }

  const server = parsedUrl.hostname?.trim()
  if (!server) {
    throw new Error(`第 ${lineNo} 行链接无效：缺少服务器地址`)
  }

  const port = Number.parseInt(parsedUrl.port, 10)
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`第 ${lineNo} 行链接无效：端口不合法`)
  }

  const searchParams = parsedUrl.searchParams
  const transportType = searchParams.get('type') || 'tcp'
  const security = searchParams.get('security') || ''
  const publicKey = searchParams.get('pbk') || ''
  const host = decodeSafely(searchParams.get('host') || '')
  const path = normalizePath(decodeSafely(searchParams.get('path') || ''))
  const nodeName = parseNodeName(parsedUrl.hash, lineNo, index)

  validateTransportType(transportType, lineNo)
  validateSecurity(security, publicKey, lineNo)

  return {
    rawLink,
    nodeName,
    protocol: 'vless',
    server,
    port,
    uuid,
    transportType,
    security,
    host,
    path,
    sni: searchParams.get('sni') || '',
    fingerprint: searchParams.get('fp') || '',
    publicKey,
    shortId: searchParams.get('sid') || '',
    spiderX: decodeSafely(searchParams.get('spx') || ''),
    flow: searchParams.get('flow') || '',
    sortOrder: index,
  }
}

function validateTransportType(transportType, lineNo) {
  const supportedTransportTypes = ['tcp', 'ws']
  if (!supportedTransportTypes.includes(transportType)) {
    throw new Error(`第 ${lineNo} 行链接无效：暂不支持 type=${transportType}`)
  }
}

function validateSecurity(security, publicKey, lineNo) {
  const supportedSecurityTypes = ['none', 'tls', 'reality']
  if (!supportedSecurityTypes.includes(security)) {
    throw new Error(`第 ${lineNo} 行链接无效：暂不支持 security=${security || '空值'}`)
  }

  if (security === 'reality' && !publicKey) {
    throw new Error(`第 ${lineNo} 行链接无效：security=reality 时必须包含 pbk`)
  }
}

function normalizePath(rawPath) {
  if (!rawPath) {
    return ''
  }

  return rawPath.startsWith('/') ? rawPath : `/${rawPath}`
}

function parseNodeName(hash, lineNo, index) {
  if (!hash || hash.length <= 1) {
    return `节点 ${index + 1}`
  }

  const rawName = hash.slice(1)
  const decodedName = decodeSafely(rawName).trim()

  if (!decodedName) {
    throw new Error(`第 ${lineNo} 行链接无效：节点名称为空`)
  }

  return decodedName
}

function decodeSafely(value) {
  if (!value) {
    return ''
  }

  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}
