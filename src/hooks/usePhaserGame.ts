import { useEffect, useRef } from 'react'
import Phaser from 'phaser'
import type { PhaserSceneClass } from '../types/game'

export type UsePhaserGameConfig = {
  width?: number
  height?: number
  backgroundColor?: string
  /** Enable arcade physics (needed for Falcon Flight collisions). */
  arcadePhysics?: boolean
  /**
   * Seed the game registry once after construction.
   * Prefer putting stable refs (bridge objects) here.
   */
  onGameCreated?: (game: Phaser.Game) => void
}

export function usePhaserGame(
  SceneClass: PhaserSceneClass,
  config: UsePhaserGameConfig = {},
) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const gameRef = useRef<Phaser.Game | null>(null)
  const configRef = useRef(config)
  configRef.current = config

  useEffect(() => {
    if (!containerRef.current) {
      return
    }

    const {
      width = 960,
      height = 540,
      backgroundColor = '#020617',
      arcadePhysics = false,
    } = configRef.current

    const game = new Phaser.Game({
      type: Phaser.AUTO,
      width,
      height,
      parent: containerRef.current,
      backgroundColor,
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
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
    })

    gameRef.current = game
    configRef.current.onGameCreated?.(game)

    return () => {
      game.destroy(true)
      gameRef.current = null
    }
  }, [SceneClass])

  return containerRef
}
