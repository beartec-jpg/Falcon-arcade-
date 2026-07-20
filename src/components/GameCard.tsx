import { Link } from 'react-router-dom'
import type { GameDefinition } from '../types/game'

type GameCardProps = {
  game: GameDefinition
}

const LIVE_SLUGS = new Set([
  'falcon-flight',
  'ledger-runner',
  'epoch-rise',
  'amendment-apocalypse',
])

export function GameCard({ game }: GameCardProps) {
  const isLive = LIVE_SLUGS.has(game.slug)

  return (
    <article className={`game-card${isLive ? ' game-card--live' : ''}`}>
      <span className="game-card__tag section-label">{game.tagline}</span>
      <h2 className="game-card__title">{game.name}</h2>
      <p className="game-card__description">{game.description}</p>
      <span className="game-card__badge">{game.rewardLabel}</span>

      <div className="game-card__footer">
        <span className="wallet-chip">{isLive ? 'Playable' : 'Scaffold'}</span>
        <Link className={isLive ? 'button-primary' : 'button-secondary'} to={game.route}>
          {isLive ? 'Play now' : 'Open scaffold'}
        </Link>
      </div>
    </article>
  )
}
