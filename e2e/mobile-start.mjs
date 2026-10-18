// Mobile start/restart smoke test (Playwright, touch emulation).
// Usage: npm run build && npx vite preview --port 4173 &  then  node e2e/mobile-start.mjs
// Env: DEVS='Pixel 7,iPhone 13' MODES=standalone,iframe VIA=button,canvas GAMES=... (needs: npm i -D playwright)
// iframe mode loads https://falcon-fpl.com/arcade and routes the arcade origin to LOCAL.
import { chromium, webkit, devices } from 'playwright'
const LOCAL = process.env.LOCAL || 'http://localhost:4173'
const TAG = process.env.TAG || 'after'
const MODES = (process.env.MODES || 'standalone,iframe').split(',')
const DEVS = (process.env.DEVS || 'Pixel 7,iPhone 13,iPhone SE').split(',')
const GAMES = (process.env.GAMES || 'falcon-flight,ledger-runner,epoch-rise,amendment-apocalypse').split(',')
const OUT = process.env.OUT || 'e2e-shots'; (await import('fs')).mkdirSync(OUT, { recursive: true })
const PROD = 'https://falcon-arcade-lake.vercel.app'
const TEXT = { playing: /In flight|Running|Ascending|Defending/, gameover: /Run ended|Energy depleted|Consensus broken/, ready: /Ready for launch|Ready on the line|Ready to rise|Ready to deploy/ }
const results = []
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

async function phaseOf(f) {
  const dp = await f.locator('.phaser-game-wrap').first().getAttribute('data-phase', { timeout: 500 }).catch(() => null)
  if (dp) return dp
  const t = await f.locator('.status-pill').first().innerText({ timeout: 500 }).catch(() => '')
  const l = t.trim().toLowerCase(); if (['ready','playing','gameover'].includes(l)) return l
  for (const [k, re] of Object.entries(TEXT)) if (re.test(t)) return k
  return 'unknown:' + t
}
async function waitPhase(f, want, ms) {
  const end = Date.now() + ms; let p
  while (Date.now() < end) { p = await phaseOf(f); if (want.includes(p)) return p; await sleep(250) }
  return p
}
// tap the canvas at a point that is actually on-screen (and inside the iframe viewport)
async function tapCanvas(page, f, frameEl) {
  const c = await f.locator('canvas').first().boundingBox()
  const vp = page.viewportSize()
  let top = Math.max(c.y, 0), bottom = Math.min(c.y + c.height, vp.height)
  if (frameEl) { const fb = await frameEl.boundingBox(); top = Math.max(top, fb.y); bottom = Math.min(bottom, fb.y + fb.height) }
  if (bottom - top < 20) return { ok: false, why: 'canvas not on screen' }
  // avoid the pause corner; middle of visible band
  const x = c.x + c.width * 0.5, y = top + (bottom - top) * 0.6
  await page.touchscreen.tap(x, y)
  return { ok: true, x, y }
}
async function tapButton(page, f) {
  const b = f.locator('[data-testid=game-start-button]')
  if (!(await b.count())) return { ok: false, why: 'no button' }
  await b.tap({ timeout: 10000 }) // Playwright tap: scrolls into view + real touch
  return { ok: true }
}

for (const dn of DEVS) {
  const bt = dn.startsWith('iPhone') ? webkit : chromium
  const browser = await bt.launch()
  for (const mode of MODES) for (const g of GAMES) for (const via of (process.env.VIA || 'button,canvas').split(',')) {
    const ctx = await browser.newContext({ ...devices[dn], hasTouch: true })
    await ctx.route(PROD + '/**', async (route) => {
      const u = new URL(route.request().url())
      const r = await fetch(LOCAL + u.pathname + u.search)
      const body = Buffer.from(await r.arrayBuffer())
      await route.fulfill({ status: r.status, headers: Object.fromEntries(r.headers), body })
    })
    const page = await ctx.newPage()
    const errs = []; page.on('pageerror', e => errs.push(String(e)))
    let f = page, frameEl = null
    const rec = { dev: dn, mode, game: g, via, tag: TAG }
    try {
      if (mode === 'standalone') { await page.goto(`${LOCAL}/${g}`) }
      else {
        await page.goto('https://falcon-fpl.com/arcade', { waitUntil: 'domcontentloaded' })
        frameEl = page.locator('iframe[title="Falcon Arcade"]')
        await frameEl.waitFor({ timeout: 30000 })
        const fr = await (await frameEl.elementHandle()).contentFrame()
        await fr.goto(`${PROD}/${g}`)
        f = fr
      }
      await f.locator('canvas').first().waitFor({ timeout: 30000 }); await sleep(1500)
      const shot = (n) => page.screenshot({ path: `${OUT}/${TAG}-${mode}-${dn.replace(/ /g, '')}-${g}-${via}-${n}.png` })
      rec.initial = await phaseOf(f); await shot('1-initial')
      const tap = () => via === 'button' ? tapButton(page, f) : tapCanvas(page, f, frameEl)
      rec.startTap = await tap()
      rec.afterStart = await waitPhase(f, ['playing'], 3000); await shot('2-started')
      rec.startOk = rec.afterStart === 'playing'
      if (rec.startOk) {
        rec.died = await waitPhase(f, ['gameover'], 120000); await sleep(600); await shot('3-gameover')
        if (rec.died === 'gameover') {
          rec.restartTap = await tap()
          rec.afterRestart = await waitPhase(f, ['playing'], 3000); await shot('4-restarted')
          rec.restartOk = rec.afterRestart === 'playing'
        }
      }
    } catch (e) { rec.error = String(e).split('\n')[0] }
    rec.pageErrors = errs.slice(0, 2)
    console.log(JSON.stringify(rec)); results.push(rec)
    await ctx.close()
  }
  await browser.close()
}
const fs = await import('fs'); fs.writeFileSync(`${OUT}/${TAG}-results.json`, JSON.stringify(results, null, 2))
const bad = results.filter(r => !r.startOk || !r.restartOk)
console.log(`SUMMARY ${TAG}: ${results.length - bad.length}/${results.length} passed start+restart`)
