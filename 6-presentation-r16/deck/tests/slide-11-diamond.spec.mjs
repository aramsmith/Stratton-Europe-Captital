import { expect, test } from '@playwright/test'
import {
  startIsolatedViteServer,
  stopIsolatedViteServer,
} from './helpers/slide-5-browser-assurance.mjs'

test('Slide 11 presents the requested prompt, loop and diamond technique diagrams', async ({ page }) => {
  let server
  try {
    server = await startIsolatedViteServer({ timeoutMs: 45000 })
    await page.goto(`${server.baseUrl}/?slide=10`)

    await expect(page.getByText('AI Techniques used', { exact: true })).toBeVisible()
    await expect(page.getByText('Prompt Engineering', { exact: true })).toBeVisible()
    await expect(page.locator('[data-prompt-graph]')).toBeVisible()
    await expect(page.getByText('Loop Engineering', { exact: true })).toBeVisible()
    await expect(page.locator('[data-loop-graph]')).toBeVisible()
    await expect(page.getByText('Graph Engineering - Diamond', { exact: true })).toBeVisible()
    await expect(page.locator('[data-diamond-graph]')).toBeVisible()
    await expect(page.getByText('Graph Engineering - Chain', { exact: true })).toHaveCount(0)
    await expect(page.getByText('Promotion guardrails', { exact: true })).toHaveCount(0)
  } finally {
    await stopIsolatedViteServer(server?.process)
  }
})
