import type { GameDefinition } from '../types/game'

export const gameDefinitions: GameDefinition[] = [
  {
    slug: 'falcon-flight',
    name: 'Falcon Flight',
    mode: 'Flight',
    route: '/falcon-flight',
    tagline: 'Flight · horizontal',
    description:
      'Auto-scroll dodge game. Steer up and down through ledger gaps, rack up distance, and unlock the Game Faucet at 500 points on a single run.',
    longDescription:
      'Falcon Flight is a horizontal auto-scroller. Your falcon flies forward at a constant pace — you only steer vertically to slip through ledger-block gaps and dodge quantum static. Score rises with distance and clean gap passes. Best single-run score of the day unlocks the claim; keep playing for the leaderboard.',
    scoreLabel: 'Flight score',
    rewardLabel: 'Claim at 500 pts',
  },
  {
    slug: 'ledger-runner',
    name: 'Ledger Runner',
    mode: 'Run',
    route: '/ledger-runner',
    tagline: 'Run · auto-runner',
    description:
      'Jump quantum spikes, slide under bad ledgers, chain combos. Distance scoring with progressive speed — claim at 500 points on a single run.',
    longDescription:
      'Ledger Runner is a horizontal auto-runner. You sprint forward automatically and only jump (with a double-jump) or slide. Clear quantum spikes, duck bad-ledger barriers, and time floaters. Combos reward clean consecutive clears. Best single-run score of the day unlocks the claim; keep playing for the leaderboard.',
    scoreLabel: 'Run score',
    rewardLabel: 'Claim at 500 pts',
  },
  {
    slug: 'epoch-rise',
    name: 'Epoch Rise',
    mode: 'Rise',
    route: '/epoch-rise',
    tagline: 'Rise · vertical energy',
    description:
      'Start at the bottom and fly freely in 2D. Climb for fast orbs, drop back for distant ones — manage energy, claim at 500 on a single run.',
    longDescription:
      'Epoch Rise is a vertical energy run. Your falcon starts near the bottom while the world rises past you. Move freely up, down, left, and right (WASD or drag) to snag quantum orbs, dodge ledgers, and grab shields or boosts. Dash in your travel direction with Space. Best single-run score of the day unlocks the claim.',
    scoreLabel: 'Rise score',
    rewardLabel: 'Claim at 500 pts',
  },
  {
    slug: 'amendment-apocalypse',
    name: 'Amendment Apocalypse',
    mode: 'Shoot',
    route: '/amendment-apocalypse',
    tagline: 'Shoot · ledger defense',
    description:
      'Free-roam arena shooter. Grab upgrade scrolls to escalate firepower, smash code bugs, and hold consensus — claim at 500 points on a single run.',
    longDescription:
      'Amendment Apocalypse (Shoot mode) is an Asteroids-style defense of the ledger. Your ship flies freely with momentum while weapons auto-fire through six weapon tiers. Collect green+ upgrade scrolls and gold Hard Forks; take two hits without recovery and consensus breaks. Hunt Null, Race, Loop, and Corrupt bugs.',
    scoreLabel: 'Shoot score',
    rewardLabel: 'Claim at 500 pts',
  },
]

export function getGameDefinition(slug: GameDefinition['slug']) {
  const game = gameDefinitions.find((entry) => entry.slug === slug)

  if (!game) {
    throw new Error(`Game config is missing for ${slug}`)
  }

  return game
}
