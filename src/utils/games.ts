import type { GameDefinition } from '../types/game'

export const gameDefinitions: GameDefinition[] = [
  {
    slug: 'falcon-flight',
    name: 'Falcon Flight',
    route: '/falcon-flight',
    tagline: 'Arcade action',
    description:
      'A high-speed sky run scaffold with a Phaser scene mount and future reward hooks.',
    longDescription:
      'Falcon Flight will become a reflex-driven flight challenge with collectible boosts, evasive movement, and tokenized progression hooks.',
    scoreLabel: 'Flight score',
    rewardLabel: 'Reward claims disabled',
  },
  {
    slug: 'ledger-runner',
    name: 'Ledger Runner',
    route: '/ledger-runner',
    tagline: 'On-chain runner',
    description:
      'A sprint-style platform scaffold for obstacle courses, streak scoring, and wallet-aware rewards.',
    longDescription:
      'Ledger Runner is positioned for endless-run pacing, milestone streaks, and portal-based reward redemption once persistence is connected.',
    scoreLabel: 'Runner score',
    rewardLabel: 'Wallet rewards pending',
  },
  {
    slug: 'epoch-rise',
    name: 'Epoch Rise',
    route: '/epoch-rise',
    tagline: 'Strategy arena',
    description:
      'A tactical arena scaffold prepared for future time-loop mechanics and cross-session progression.',
    longDescription:
      'Epoch Rise will layer strategy combat, timing windows, and progression systems onto this prepared Phaser and React route shell.',
    scoreLabel: 'Arena score',
    rewardLabel: 'Portal sync pending',
  },
]

export function getGameDefinition(slug: GameDefinition['slug']) {
  const game = gameDefinitions.find((entry) => entry.slug === slug)

  if (!game) {
    throw new Error(`Game config is missing for ${slug}`)
  }

  return game
}
