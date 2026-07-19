import Phaser from 'phaser'
import { renderPlaceholderScene } from '../../utils/renderPlaceholderScene'

export class EpochRiseScene extends Phaser.Scene {
  constructor() {
    super('EpochRiseScene')
  }

  create() {
    renderPlaceholderScene(this, {
      title: 'Epoch Rise',
      subtitle: 'Temporal strategy arena coming online',
      accentColor: 0xc58cff,
    })
  }
}
