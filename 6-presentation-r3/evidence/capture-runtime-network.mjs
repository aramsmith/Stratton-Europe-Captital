import { createServer } from 'node:http'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from '../deck/node_modules/puppeteer/lib/puppeteer/puppeteer.js'

const evidenceDir = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(evidenceDir, '..')
const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
}

const server = createServer(async (request, response) => {
  const requestPath = decodeURIComponent(new URL(request.url, 'http://localhost').pathname)
  const target = path.resolve(root, `.${requestPath}`)
  if (!target.startsWith(root)) {
    response.writeHead(403).end('Forbidden')
    return
  }
  try {
    const bytes = await readFile(target)
    response.writeHead(200, { 'Content-Type': contentTypes[path.extname(target)] || 'application/octet-stream' })
    response.end(bytes)
  } catch {
    response.writeHead(404).end('Not found')
  }
})
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const port = server.address().port
const nestedUrl = `http://127.0.0.1:${port}/deck/dist/index.html`

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage()
await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 })

const requests = []
const byRequest = new WeakMap()
const consoleErrors = []
page.on('request', (request) => {
  const url = request.url()
  if (!/^https?:\/\//i.test(url)) return
  const parsed = new URL(url)
  const entry = {
    sequence: requests.length + 1,
    method: request.method(),
    url,
    resourceType: request.resourceType(),
    scope: ['127.0.0.1', 'localhost'].includes(parsed.hostname) ? 'LOCAL' : 'EXTERNAL',
    responseStatus: null,
    failure: null,
  }
  requests.push(entry)
  byRequest.set(request, entry)
})
page.on('response', (response) => {
  const entry = byRequest.get(response.request())
  if (entry) entry.responseStatus = response.status()
})
page.on('requestfailed', (request) => {
  const entry = byRequest.get(request)
  if (entry) entry.failure = request.failure()?.errorText || 'unknown'
})
page.on('console', (message) => {
  if (message.type() === 'error') consoleErrors.push(message.text())
})

const response = await page.goto(nestedUrl, { waitUntil: 'networkidle0', timeout: 30000 })
await page.waitForSelector('.slide', { timeout: 15000 })
for (let i = 0; i < 12; i += 1) await page.keyboard.press('ArrowLeft')
for (let i = 0; i < 10; i += 1) {
  await new Promise((resolve) => setTimeout(resolve, 350))
  if (i < 9) await page.keyboard.press('ArrowRight')
}
await new Promise((resolve) => setTimeout(resolve, 1000))
const slideCount = await page.$$eval('.slide', (slides) => slides.length)
await browser.close()
await new Promise((resolve) => server.close(resolve))

const externalRequests = requests.filter((item) => item.scope === 'EXTERNAL')
const failedRequests = requests.filter((item) => item.failure || item.responseStatus === null || item.responseStatus >= 400)
const successfulRequests = requests.filter((item) => !item.failure && item.responseStatus !== null && item.responseStatus < 400)
const result = {
  schemaVersion: '1.0.0',
  recordType: 'AFF_PHASE_6_RUNTIME_NETWORK_RECEIPT',
  modelPlanRevision: '18',
  inspectedArtifact: 'deck/dist/index.html',
  nestedPath: '/deck/dist/index.html',
  initialHttpStatus: response.status(),
  slideCount,
  requestCount: requests.length,
  successfulRequestCount: successfulRequests.length,
  failedRequestCount: failedRequests.length,
  externalRequestCount: externalRequests.length,
  requests,
  successfulRequests,
  failedRequests,
  externalRequests,
  consoleErrors,
  interpretation:
    'This receipt records observed HTTP(S) calls while loading and traversing all ten slides. ' +
    'Static URL strings that were not requested are production-inert for this execution. No licensing conclusion is made.',
  overallStatus:
    response.status() === 200 &&
    slideCount === 10 &&
    failedRequests.length === 0 &&
    externalRequests.length === 0
      ? 'PASS'
      : 'FAIL',
}
await writeFile(
  path.join(evidenceDir, 'runtime-network-receipt.json'),
  `${JSON.stringify(result, null, 2)}\n`,
  'utf8',
)
console.log(JSON.stringify({
  requestCount: result.requestCount,
  successfulRequestCount: result.successfulRequestCount,
  failedRequestCount: result.failedRequestCount,
  externalRequestCount: result.externalRequestCount,
  slideCount: result.slideCount,
  overallStatus: result.overallStatus,
}, null, 2))
if (result.overallStatus !== 'PASS') process.exit(1)
