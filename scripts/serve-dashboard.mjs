import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, extname, resolve } from 'node:path'

const directory = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(directory, '..')
const siteDirectory = resolve(projectRoot, 'dist')
const port = Number(process.env.PORT ?? 8787)
const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
}

createServer(async (request, response) => {
  const requestPath = new URL(request.url, `http://${request.headers.host}`).pathname
  const relativePath = requestPath === '/' ? 'index.html' : requestPath.replace(/^\/+/, '')
  const filePath = resolve(siteDirectory, relativePath)
  if (!filePath.startsWith(`${siteDirectory}\\`) && filePath !== resolve(siteDirectory, 'index.html')) {
    response.writeHead(404).end('Not found')
    return
  }

  try {
    const content = await readFile(filePath)
    const isData = relativePath === 'api/home.json'
    response.writeHead(200, {
      'content-type': contentTypes[extname(filePath)] ?? 'application/octet-stream',
      'cache-control': isData ? 'no-store' : 'no-cache',
    })
    response.end(content)
  } catch {
    response.writeHead(404).end('Not found')
  }
}).listen(port, () => console.log(`个人行情看板运行于 http://localhost:${port}`))
