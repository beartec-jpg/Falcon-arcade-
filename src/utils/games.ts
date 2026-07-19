import type { GameDefinition } from '../types/game'

export const gameDefinitions: GameDefinition[] = [
  {
    slug: 'falcon-flight',
    name: 'Falcon Flight',
    route: '/falcon-flight',
    tagline: 'Horizontal flight',
    description:
      'Auto-scroll dodge game. Steer up and down through ledger gaps, rack up distance, and unlock the Game Faucet at 100 points.',
    longDescription:
      'Falcon Flight is a horizontal auto-scroller. Your falcon flies forward at a constant pace — you only steer vertically to slip through ledger-block gaps and dodge quantum static. Score rises with distance and clean gap passes. Hit the reward threshold to claim once per epoch from the parent portal.',
    scoreLabel: 'Flight score',
    rewardLabel: 'Claim at 100 pts',
  },
  {
    slug: 'ledger-runner',
    name: 'Ledger Runner',
    route: '/ledger-runner',
    tagline: 'Coming soon',
    description:
      'Auto-runner + jump scaffold. Leap quantum attacks and bad ledgers — full gameplay arrives next.',
    longDescription:
      'Ledger Runner will be a momentum runner with jump controls over quantum attacks and bad ledgers. This route currently boots a placeholder Phaser scene while Falcon Flight ships first.',
    scoreLabel: 'Runner score',
    rewardLabel: 'Placeholder',
  },
  {
    slug: 'epoch-rise',
    name: 'Epoch Rise',
    route: '/epoch-rise',
    tagline: 'Coming soon',
    description:
      'Vertical scroller with an energy bar. Collect quantum orbs, avoid bad ledgers — deeper run systems planned.',
    longDescription:
      'Epoch Rise will be a vertical energy-management scroller: bad ledgers drain energy, quantum orbs restore it and score points. Placeholder scene only for now.',
    scoreLabel: 'Arena score',
    rewardLabel: 'Placeholder',
  },
]

export function getGameDefinition(slug: GameDefinition['slug']) {
  const game = gameDefinitions.find((entry) => entry.slug === slug)

  if (!game) {
    throw new Error(`Game config is missing for ${slug}`)
  }

  return game
}
