import { useCallback, useEffect, useRef, useState } from 'react'
import Phaser from 'phaser'
import type { PhaserSceneClass } from '../types/game'
import {
  resolveLogicalSize,
  type AspectBucket,
} from '../utils/gameSize'
import {
  computeRenderScale,
  patchTextResolution,
  setRenderScale,
} from '../utils/hiDpi'
import {
  PHASE_EVENT,
  currentPhase,
  requestGameStart,
  type GamePhase,
} from '../utils/startControl'

export type UsePhaserGameConfig = {
  width?: number
  height?: number
  /**
   * Match logical resolution to the host aspect (default true).
   * Fills mobile portrait without stretching art.
   */
  matchParentAspect?: boolean
  backgroundColor?: string
  arcadePhysics?: boolean
  onGameCreated?: (game: Phaser.Game) => void
}

export function usePhaserGame(
  SceneClass: PhaserSceneClass,
  config: UsePhaserGameConfig = {},
) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const gameRef = useRef<Phaser.Game | null>(null)
  const configRef = useRef(config)
  const bucketRef = useRef<AspectBucket | null>(null)
  const renderScaleRef = useRef(1)
  configRef.current = config
  const [phase, setPhase] = useState<GamePhase | null>(null)

  useEffect(() => {
    if (!containerRef.current) {
      return
    }

    const {
      width = 960,
      height = 540,
      matchParentAspect = true,
      backgroundColor = '#0b1224',
      arcadePhysics = false,
    } = configRef.current

    const parent = containerRef.current

    // Give the host a real height before measuring (flex may still be 0 on first paint)
    if (parent.clientHeight < 80) {
      parent.style.minHeight = 'min(78dvh, 900px)'
    }

    const initial = matchParentAspect
      ? resolveLogicalSize(parent)
      : {
          size: { width, height },
          bucket: 'landscape' as AspectBucket,
        }
    bucketRef.current = initial.bucket
    // DPR-correct backing store (cap 2): canvas = logical × r, scenes zoom by r
    const renderScale = computeRenderScale()
    renderScaleRef.current = renderScale
    patchTextResolution()

    const game = new Phaser.Game({
      type: Phaser.AUTO,
      width: Math.round(initial.size.width * renderScale),
      height: Math.round(initial.size.height * renderScale),
      parent,
      backgroundColor,
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        expandParent: false,
      },
      physics: arcadePhysics
        ? {
            default: 'arcade',
            arcade: {
              gravity: { x: 0, y: 0 },
              debug: false,
            },
          }
        : undefined,
      scene: SceneClass,
      callbacks: {
        preBoot: (g) => setRenderScale(g, renderScale),
      },
    })

    gameRef.current = game
    configRef.current.onGameCreated?.(game)

    const onPhase = (next: GamePhase) => setPhase(next)
    game.events.on(PHASE_EVENT, onPhase)
    setPhase(currentPhase(game))

    const refreshScale = () => {
      const g = gameRef.current
      if (!g || !containerRef.current) return
      try {
        if (configRef.current.matchParentAspect !== false) {
          const next = resolveLogicalSize(containerRef.current)
          if (next.bucket !== bucketRef.current) {
            bucketRef.current = next.bucket
            const r = renderScaleRef.current
            g.scale.setGameSize(
              Math.round(next.size.width * r),
              Math.round(next.size.height * r),
            )
          }
        }
        g.scale.refresh()
      } catch {
        // mid-destroy
      }
    }

    const ro =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => {
            refreshScale()
          })
        : null
    ro?.observe(parent)

    window.addEventListener('resize', refreshScale)
    window.addEventListener('orientationchange', refreshScale)
    requestAnimationFrame(() => {
      requestAnimationFrame(refreshScale)
    })

    return () => {
      game.events.off(PHASE_EVENT, onPhase)
      ro?.disconnect()
      window.removeEventListener('resize', refreshScale)
      window.removeEventListener('orientationchange', refreshScale)
      game.destroy(true)
      gameRef.current = null
      bucketRef.current = null
    }
  }, [SceneClass])

  const requestStart = useCallback(() => {
    requestGameStart(gameRef.current)
  }, [])

  return { containerRef, phase, requestStart }
}
