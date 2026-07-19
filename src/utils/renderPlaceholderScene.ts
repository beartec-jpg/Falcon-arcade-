import Phaser from 'phaser'

type PlaceholderSceneOptions = {
  title: string
  subtitle: string
  accentColor: number
}

export function renderPlaceholderScene(
  scene: Phaser.Scene,
  options: PlaceholderSceneOptions,
) {
  const { width, height } = scene.scale

  scene.cameras.main.setBackgroundColor('#0d1016')

  const panel = scene.add.rectangle(
    width / 2,
    height / 2,
    width - 120,
    height - 120,
    0x121722,
    0.95,
  )
  panel.setStrokeStyle(2, options.accentColor, 0.65)

  scene.add.circle(width / 2, height / 2 - 124, 28, options.accentColor, 0.9)

  scene.add
    .text(width / 2, height / 2 - 48, options.title, {
      fontFamily: 'Inter, sans-serif',
      fontSize: '34px',
      color: '#fff4dc',
      fontStyle: '700',
    })
    .setOrigin(0.5)

  scene.add
    .text(width / 2, height / 2 + 8, options.subtitle, {
      fontFamily: 'Inter, sans-serif',
      fontSize: '18px',
      color: '#a4abb8',
      align: 'center',
      wordWrap: { width: width - 200 },
    })
    .setOrigin(0.5)

  scene.add
    .text(width / 2, height / 2 + 98, 'Gameplay systems, scoring, and rewards plug in next.', {
      fontFamily: 'Inter, sans-serif',
      fontSize: '16px',
      color: '#f4a62a',
      align: 'center',
    })
    .setOrigin(0.5)
}
