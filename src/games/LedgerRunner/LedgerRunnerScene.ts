import Phaser from 'phaser'
import { renderPlaceholderScene } from '../../utils/renderPlaceholderScene'

export class LedgerRunnerScene extends Phaser.Scene {
  constructor() {
    super('LedgerRunnerScene')
  }

  create() {
    renderPlaceholderScene(this, {
      title: 'Ledger Runner',
      subtitle: 'On-chain obstacle course placeholder',
      accentColor: 0x56f0c6,
    })
  }
}
