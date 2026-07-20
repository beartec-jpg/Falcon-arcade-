import Phaser from 'phaser'

export type PhaserSceneClass = new () => Phaser.Scene

export type GameDefinition = {
  slug: string
  name: string
  /** Short category for nav / mode chips: Flight · Run · Rise · Shoot */
  mode: string
  route: string
  tagline: string
  description: string
  longDescription: string
  scoreLabel: string
  rewardLabel: string
}
