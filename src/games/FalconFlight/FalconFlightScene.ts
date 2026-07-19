import Phaser from 'phaser'
import { renderPlaceholderScene } from '../../utils/renderPlaceholderScene'

export class FalconFlightScene extends Phaser.Scene {
  constructor() {
    super('FalconFlightScene')
  }

  create() {
    renderPlaceholderScene(this, {
      title: 'Falcon Flight',
      subtitle: 'Arcade flight path placeholder',
      accentColor: 0xf4a62a,
    })
  }
}
