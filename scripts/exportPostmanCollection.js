import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, resolve } from 'node:path'

const routeDirPath = resolve(process.cwd(), 'src/routes')
const outputFilePath = resolve(process.cwd(), 'data/postmanCollection.json')

function getRouteFiles() {
  return readdirSync(routeDirPath).filter((fileName) => fileName.endsWith('.js'))
}

function getRouterPrefix(fileContent) {
  const prefixMatch = fileContent.match(/new Router\(\s*\{\s*prefix:\s*['"]([^'"]+)['"]\s*\}\s*\)/)
  return prefixMatch ? prefixMatch[1] : ''
}

function getRouteItems(fileName, fileContent) {
  const routerPrefix = getRouterPrefix(fileContent)
  const routeRegex = /router\.(get|post|put|delete|patch)\(\s*['"]([^'"]+)['"]/g
  const routeItems = []

  let matchItem = routeRegex.exec(fileContent)
  while (matchItem) {
    const httpMethod = matchItem[1].toUpperCase()
    const routePath = matchItem[2]
    const normalizedPath = `${routerPrefix}${routePath}`.replace(/\/+/g, '/')

    routeItems.push({
      fileName,
      httpMethod,
      path: normalizedPath,
    })

    matchItem = routeRegex.exec(fileContent)
  }

  return routeItems
}

function getManualRouteItems() {
  // /health 定义在 app.js，不在 src/routes 目录中，这里手动补齐
  return [
    {
      fileName: 'app',
      httpMethod: 'GET',
      path: '/health',
    },
  ]
}

function toPostmanPath(pathValue) {
  return pathValue
    .split('/')
    .filter(Boolean)
    .map((segment) => (segment.startsWith(':') ? `{{${segment.slice(1)}}}` : segment))
}

function toPostmanRawUrl(pathValue) {
  const replacedPath = pathValue.replace(/:([a-zA-Z0-9_]+)/g, '{{$1}}')
  return `{{baseUrl}}${replacedPath}`
}

function getQueryParams(pathValue) {
  if (pathValue === '/sub' || pathValue === '/provider') {
    return [{ key: 't', value: '{{subscriptionToken}}' }]
  }
  return []
}

function getRequestBody(httpMethod, pathValue) {
  if (httpMethod === 'POST' && pathValue === '/admin/auth/login') {
    return {
      mode: 'raw',
      raw: JSON.stringify({ username: 'admin', password: 'yourPassword' }, null, 2),
      options: { raw: { language: 'json' } },
    }
  }

  if (httpMethod === 'POST' && pathValue === '/admin/subscription') {
    return {
      mode: 'raw',
      raw: JSON.stringify(
        {
          remark: '示例订阅',
          maxIps: 1,
          expiredAt: null,
          nodeLinksText: 'vless://yourNodeLink',
        },
        null,
        2,
      ),
      options: { raw: { language: 'json' } },
    }
  }

  if (httpMethod === 'PUT' && pathValue === '/admin/subscription/:token') {
    return {
      mode: 'raw',
      raw: JSON.stringify(
        {
          remark: '更新后的备注',
          maxIps: 2,
          status: 'active',
          expiredAt: null,
          nodeLinksText: 'vless://yourNodeLink',
        },
        null,
        2,
      ),
      options: { raw: { language: 'json' } },
    }
  }

  if (httpMethod === 'DELETE' && pathValue === '/admin/subscription/:token/boundIps') {
    return {
      mode: 'raw',
      raw: JSON.stringify({ ip: '1.2.3.4' }, null, 2),
      options: { raw: { language: 'json' } },
    }
  }

  return undefined
}

function needsBearerAuth(pathValue, httpMethod) {
  if (pathValue.startsWith('/admin') && !(pathValue === '/admin/auth/login' && httpMethod === 'POST')) {
    return true
  }
  return false
}

function toPostmanItem(routeItem) {
  const query = getQueryParams(routeItem.path)
  const body = getRequestBody(routeItem.httpMethod, routeItem.path)

  const request = {
    method: routeItem.httpMethod,
    header: body
      ? [
          {
            key: 'Content-Type',
            value: 'application/json',
          },
        ]
      : [],
    url: {
      raw: toPostmanRawUrl(routeItem.path),
      host: ['{{baseUrl}}'],
      path: toPostmanPath(routeItem.path),
      query,
    },
    description: `${routeItem.httpMethod} ${routeItem.path}`,
  }

  if (body) {
    request.body = body
  }

  if (needsBearerAuth(routeItem.path, routeItem.httpMethod)) {
    request.auth = {
      type: 'bearer',
      bearer: [{ key: 'token', value: '{{adminToken}}', type: 'string' }],
    }
  }

  return {
    name: `${routeItem.httpMethod} ${routeItem.path}`,
    request,
    response: [],
  }
}

function groupItemsByFile(routeItems) {
  const fileItemMap = new Map()

  for (const routeItem of routeItems) {
    const fileKey = basename(routeItem.fileName, '.js')
    if (!fileItemMap.has(fileKey)) {
      fileItemMap.set(fileKey, [])
    }
    fileItemMap.get(fileKey).push(toPostmanItem(routeItem))
  }

  return Array.from(fileItemMap.entries()).map(([fileKey, items]) => ({
    name: fileKey,
    item: items,
  }))
}

function buildCollection(folderItems) {
  return {
    info: {
      _postman_id: 'cloakGate-auto-export',
      name: 'CloakGate API',
      description: '由脚本自动扫描 src/routes 生成',
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    },
    item: folderItems,
    variable: [
      { key: 'baseUrl', value: 'http://localhost:3000' },
      { key: 'adminToken', value: '' },
      { key: 'subscriptionToken', value: '' },
      { key: 'token', value: '' },
    ],
  }
}

function main() {
  const routeFiles = getRouteFiles()
  const routeItems = [...getManualRouteItems()]

  for (const fileName of routeFiles) {
    const filePath = resolve(routeDirPath, fileName)
    const fileContent = readFileSync(filePath, 'utf8')
    const fileRouteItems = getRouteItems(fileName, fileContent)
    routeItems.push(...fileRouteItems)
  }

  const sortedRouteItems = routeItems.sort((a, b) => a.path.localeCompare(b.path))
  const folderItems = groupItemsByFile(sortedRouteItems)
  const collection = buildCollection(folderItems)

  mkdirSync(resolve(process.cwd(), 'data'), { recursive: true })
  writeFileSync(outputFilePath, `${JSON.stringify(collection, null, 2)}\n`, 'utf8')

  console.log(`已导出 Postman Collection: ${outputFilePath}`)
  console.log(`共导出接口: ${sortedRouteItems.length}`)
}

main()
