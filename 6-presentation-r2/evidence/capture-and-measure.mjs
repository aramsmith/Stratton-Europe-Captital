import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from '../deck/node_modules/puppeteer/lib/puppeteer/puppeteer.js'

const evidenceDir = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(evidenceDir, '..')
const deckDir = path.resolve(evidenceDir, '..', 'deck')
const eyesDir = path.join(deckDir, '.github', 'eyes')
await mkdir(eyesDir, { recursive: true })

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
}
const server = createServer(async (request, response) => {
  const requestPath = decodeURIComponent(new URL(request.url, 'http://localhost').pathname)
  const target = path.resolve(rootDir, `.${requestPath}`)
  if (!target.startsWith(rootDir)) {
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

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage()
await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 })
await page.goto(`http://127.0.0.1:${port}/deck/dist/index.html`, {
  waitUntil: 'networkidle0',
  timeout: 30000,
})
await page.waitForSelector('.slide', { timeout: 15000 })

for (let i = 0; i < 12; i += 1) await page.keyboard.press('ArrowLeft')

const results = []
const images = []
for (let i = 0; i < 10; i += 1) {
  await new Promise((resolve) => setTimeout(resolve, 500))
  const measurement = await page.evaluate(() => {
    const slide = [...document.querySelectorAll('.slide')].find((node) => {
      const style = getComputedStyle(node)
      const rect = node.getBoundingClientRect()
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0
    })
    if (!slide) return { found: false, overflow: true, offenders: ['active slide not found'] }
    const bounds = slide.getBoundingClientRect()
    const offenders = [...slide.querySelectorAll('*')]
      .filter((node) => {
        const rect = node.getBoundingClientRect()
        if (!rect.width || !rect.height) return false
        return rect.left < bounds.left - 2 || rect.right > bounds.right + 2 ||
          rect.top < bounds.top - 2 || rect.bottom > bounds.bottom + 2
      })
      .slice(0, 12)
      .map((node) => ({
        tag: node.tagName,
        className: String(node.className || ''),
        text: String(node.textContent || '').trim().slice(0, 100),
      }))
    return {
      found: true,
      viewport: { width: bounds.width, height: bounds.height },
      scroll: { width: slide.scrollWidth, height: slide.scrollHeight },
      overflow: slide.scrollWidth > slide.clientWidth + 2 ||
        slide.scrollHeight > slide.clientHeight + 2 ||
        offenders.length > 0,
      offenders,
    }
  })
  const fileName = `slide-${String(i + 1).padStart(2, '0')}.png`
  const filePath = path.join(eyesDir, fileName)
  await page.screenshot({ path: filePath, type: 'png' })
  results.push({ slide: i + 1, ...measurement })
  images.push({ fileName, data: (await readFile(filePath)).toString('base64') })
  if (i < 9) await page.keyboard.press('ArrowRight')
}

const sheet = await browser.newPage()
await sheet.setViewport({ width: 1600, height: 920, deviceScaleFactor: 1 })
const cards = images.map(({ data }, index) =>
  `<figure><img src="data:image/png;base64,${data}" alt="Slide ${index + 1}"><figcaption>S${String(index + 1).padStart(2, '0')}</figcaption></figure>`
).join('')
await sheet.setContent(`<!doctype html><html><head><style>
*{box-sizing:border-box}body{margin:0;padding:12px;background:#0b1220;color:#e5e7eb;font:14px Segoe UI}
main{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}figure{margin:0;background:#111827;padding:5px;border-radius:5px}
img{display:block;width:100%;height:auto}figcaption{text-align:center;padding:2px}
</style></head><body><main>${cards}</main></body></html>`, { waitUntil: 'load' })
await sheet.screenshot({ path: path.join(eyesDir, 'contact-sheet.png'), fullPage: true })

await writeFile(
  path.join(evidenceDir, 'visual-measurements.json'),
  `${JSON.stringify({
    schemaVersion: '1.0.0',
    projectId: 'architecture-decision-executive-brief',
    inspectedArtifact: 'deck/dist/index.html',
    viewport: '1280x720',
    slideCount: 10,
    generatedBy: 'Puppeteer final static-build DOM bounds and screenshot capture',
    results,
  }, null, 2)}\n`,
  'utf8',
)

await browser.close()
await new Promise((resolve) => server.close(resolve))
