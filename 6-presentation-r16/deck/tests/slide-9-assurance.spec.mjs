import { expect, test } from '@playwright/test'
import {
  startIsolatedViteServer,
  stopIsolatedViteServer,
} from './helpers/slide-5-browser-assurance.mjs'
import { assertSlide9DevAtUrl } from './helpers/slide-9-browser-assurance.mjs'

test('Slide 9 removes the authority panel and uses the freed width after dev inline-edit activation', async () => {
  let server
  try {
    server = await startIsolatedViteServer({ timeoutMs: 45000 })
    const assurance = await assertSlide9DevAtUrl({
      url: `${server.baseUrl}/?slide=8`,
      timeoutMs: 45000,
      screenshotPath: process.env.AFF_SLIDE9_SCREENSHOT,
    })

    expect(assurance.errors, JSON.stringify(assurance.summaries, null, 2)).toEqual([])
    expect(assurance.summaries.default.wrapperCount).toBeGreaterThanOrEqual(31)
    expect(assurance.summaries.system.wrapperCount).toBeGreaterThanOrEqual(31)
    expect(assurance.summaries.reduced.wrapperCount).toBeGreaterThanOrEqual(31)
    expect(assurance.summaries.default.layerCount).toBe(5)
    expect(assurance.summaries.default.widthUse).toBeGreaterThanOrEqual(0.98)
    expect(assurance.summaries.default.removedAuthorityTextAbsent).toBe(true)
  } finally {
    await stopIsolatedViteServer(server?.process)
  }
})
