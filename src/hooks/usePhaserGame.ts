import { useEffect, useRef } from 'react'
import Phaser from 'phaser'
import type { PhaserSceneClass } from '../types/game'

export function usePhaserGame(SceneClass: PhaserSceneClass) {
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!containerRef.current) {
      return
    }

    const game = new Phaser.Game({
      type: Phaser.AUTO,
      width: 960,
      height: 540,
      parent: containerRef.current,
      backgroundColor: '#0d1016',
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
      scene: SceneClass,
    })

    return () => {
      game.destroy(true)
    }
  }, [SceneClass])

  return containerRef
}
