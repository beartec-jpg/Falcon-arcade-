import type { GameDefinition } from '../types/game'

export const gameDefinitions: GameDefinition[] = [
  {
    slug: 'falcon-flight',
    name: 'Falcon Flight',
    route: '/falcon-flight',
    tagline: 'Horizontal flight',
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
    route: '/ledger-runner',
    tagline: 'Auto-runner',
    description:
      'Jump quantum spikes, slide under bad ledgers, chain combos. Distance scoring with progressive speed — claim at 500 points on a single run.',
    longDescription:
      'Ledger Runner is a horizontal auto-runner. You sprint forward automatically and only jump (with a double-jump) or slide. Clear quantum spikes, duck bad-ledger barriers, and time floaters. Combos reward clean consecutive clears. Best single-run score of the day unlocks the claim; keep playing for the leaderboard.',
    scoreLabel: 'Runner score',
    rewardLabel: 'Claim at 500 pts',
  },
  {
    slug: 'epoch-rise',
    name: 'Epoch Rise',
    route: '/epoch-rise',
    tagline: 'Vertical energy run',
    description:
      'Rise forever while managing energy. Collect quantum orbs, dodge bad ledgers, grab shields and boosts — claim at 500 points on a single run.',
    longDescription:
      'Epoch Rise is a vertical energy scroller. Your falcon ascends continuously; steer left and right, dash through gaps, and keep the energy bar alive. Bad ledgers and quantum interference drain energy; orbs restore it and score. Riskier orb clusters, temporary shields, and boost zones reward bold play. Best single-run score of the day unlocks the claim; keep playing for the leaderboard.',
    scoreLabel: 'Rise score',
    rewardLabel: 'Claim at 500 pts',
  },
  {
    slug: 'amendment-apocalypse',
    name: 'Amendment Apocalypse',
    route: '/amendment-apocalypse',
    tagline: 'Ledger defense',
    description:
      'Free-roam arena shooter. Collect Amendments to escalate firepower, smash code bugs, and hold consensus — claim at 500 points on a single run.',
    longDescription:
      'Amendment Apocalypse is an Asteroids-style defense of the ledger. Your ship flies freely with momentum while weapons auto-fire through six Amendment tiers. Collect Amendments to upgrade and gain a Consensus Shield; take two hits without recovery and consensus breaks. Hunt Null, Race, Loop, and Corrupt bugs — rare Hard Forks clear the screen.',
    scoreLabel: 'Defense score',
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
