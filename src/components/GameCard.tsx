import { Link } from 'react-router-dom'
import type { GameDefinition } from '../types/game'

type GameCardProps = {
  game: GameDefinition
}

export function GameCard({ game }: GameCardProps) {
  return (
    <article className="game-card">
      <span className="game-card__tag section-label">{game.tagline}</span>
      <h2 className="game-card__title">{game.name}</h2>
      <p className="game-card__description">{game.description}</p>
      <span className="game-card__badge">{game.rewardLabel}</span>

      <div className="game-card__footer">
        <span className="wallet-chip">{game.route}</span>
        <Link className="button-secondary" to={game.route}>
          Open scaffold
        </Link>
      </div>
    </article>
  )
}
