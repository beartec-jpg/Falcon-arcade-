import Phaser from 'phaser'

export type PhaserSceneClass = new () => Phaser.Scene

export type GameDefinition = {
  slug: string
  name: string
  route: string
  tagline: string
  description: string
  longDescription: string
  scoreLabel: string
  rewardLabel: string
}
