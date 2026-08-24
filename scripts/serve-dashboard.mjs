import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { buildDisplaySnapshot, readStore } from '../src/market-data-store.mjs'
import { buildHomeView } from '../src/home-view-model.mjs'

const directory = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(directory, '..')
const storePath = resolve(projectRoot, 'data/market-data.json')
const publicDirectory = resolve(projectRoot, 'public')
const port = Number(process.env.PORT ?? 8787)
const staticFiles = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/app.js': ['app.js', 'text/javascript; charset=utf-8'],
  '/styles.css': ['styles.css', 'text/css; charset=utf-8'],
  '/manifest.webmanifest': ['manifest.webmanifest', 'application/manifest+json; charset=utf-8'],
  '/icon.svg': ['icon.svg', 'image/svg+xml'],
  '/sw.js': ['sw.js', 'text/javascript; charset=utf-8'],
}

async function homeResponse() {
  const store = await readStore(storePath)
  const liveSnapshot = store.latestAttempt ?? { collectedAt: null, observations: [] }
  const displaySnapshot = buildDisplaySnapshot(liveSnapshot, store)
  return { collectedAt: displaySnapshot.collectedAt, ...buildHomeView(displaySnapshot) }
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  response.end(JSON.stringify(payload))
}

createServer(async (request, response) => {
  if (request.url === '/api/home') {
    try {
      sendJson(response, 200, await homeResponse())
    } catch (error) {
      sendJson(response, 500, { error: '无法读取本地展示数据', detail: error.message })
    }
    return
  }

  const staticFile = staticFiles[request.url]
  if (!staticFile) {
    response.writeHead(404).end('Not found')
    return
  }

  try {
    const [fileName, contentType] = staticFile
    const content = await readFile(resolve(publicDirectory, fileName))
    response.writeHead(200, { 'content-type': contentType, 'cache-control': 'no-cache' })
    response.end(content)
  } catch {
    response.writeHead(500).end('Unable to load application files')
  }
}).listen(port, () => console.log(`个人行情看板运行于 http://localhost:${port}`))
