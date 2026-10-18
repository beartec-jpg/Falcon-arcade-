import Phaser from 'phaser'
import { cssFont, cssPerLogical } from './hiDpi'

/**
 * Logical Y just below the DOM start/restart button (`.game-start-button`:
 * top = clamp(56px, 9%, 96px) of the game wrap, 48px tall). Status panels sit
 * under it so button + panel read as ONE game-over / ready card.
 */
export function belowStartButtonY(scene: Phaser.Scene): number {
  const ratio = cssPerLogical(scene)
  const canvas = scene.game.canvas
  const wrap = canvas?.closest('.phaser-game-wrap') as HTMLElement | null
  if (!canvas || !wrap) return scene.scale.height * 0.22
  const wrapRect = wrap.getBoundingClientRect()
  const canvasRect = canvas.getBoundingClientRect()
  const btnTop = Math.min(96, Math.max(56, wrapRect.height * 0.09))
  const btnBottomCss = wrapRect.top + btnTop + 48 + 14
  const y = (btnBottomCss - canvasRect.top) / ratio
  return Phaser.Math.Clamp(y, 40, scene.scale.height * 0.5)
}

/**
 * Re-layout a scene's status overlay (title / body / cta stored as data on
 * the container, first child = panel rectangle): readable fonts (≥ 12 CSS px
 * body), wrapped to the panel, auto height, anchored under the DOM button.
 * The CTA becomes a quiet keyboard hint — the DOM button is the real action.
 */
export function layoutStatusPanel(
  scene: Phaser.Scene,
  overlay: Phaser.GameObjects.Container,
) {
  const title = overlay.getData('title') as Phaser.GameObjects.Text | undefined
  const body = overlay.getData('body') as Phaser.GameObjects.Text | undefined
  const cta = overlay.getData('cta') as Phaser.GameObjects.Text | undefined
  const panel = overlay.list.find(
    (o) => o instanceof Phaser.GameObjects.Rectangle,
  ) as Phaser.GameObjects.Rectangle | undefined
  if (!title || !body || !panel) return
  const { width } = scene.scale
  const panelW = Math.min(width - 24, Math.max(440, width * 0.62))
  const pad = 22

  title.setFontSize(cssFont(scene, 20, 26))
  body.setFontSize(cssFont(scene, 13, 15))
  body.setWordWrapWidth(panelW - pad * 2)
  body.setAlign('center')
  if (cta) {
    cta.setText('or press SPACE')
    cta.setFontSize(cssFont(scene, 12, 14))
    cta.setColor('#94a3b8')
    cta.setFontStyle('600')
    cta.setAlpha(1)
  }

  const gap = 12
  const ctaH = cta ? cta.height : 0
  const panelH = pad + title.height + gap + body.height + (cta ? gap + ctaH : 0) + pad
  panel.setSize(panelW, panelH)
  panel.setDisplaySize(panelW, panelH)
  if (panel.isStroked) panel.setStrokeStyle(panel.lineWidth, panel.strokeColor, panel.strokeAlpha)

  let y = -panelH / 2 + pad
  title.setOrigin(0.5, 0).setPosition(0, y)
  y += title.height + gap
  body.setOrigin(0.5, 0).setPosition(0, y)
  y += body.height + gap
  cta?.setOrigin(0.5, 0).setPosition(0, y)

  overlay.setSize(panelW, panelH)
  overlay.setPosition(width / 2, belowStartButtonY(scene) + panelH / 2)
}
