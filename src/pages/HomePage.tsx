import { Link } from 'react-router-dom'
import { GameCard } from '../components/GameCard'
import { gameDefinitions } from '../utils/games'

export function HomePage() {
  return (
    <>
      <section className="hero">
        <div>
          <span className="section-label">Mini-games platform scaffold</span>
          <h2 className="hero__title">Falcon Games ships the arcade shell first.</h2>
          <p className="hero__copy">
            Explore a clean React + Phaser setup for Falcon Flight, Ledger Runner,
            and Epoch Rise before gameplay, wallet, and reward mechanics are wired
            in.
          </p>

          <div className="hero__actions">
            <Link className="button-primary" to="/falcon-flight">
              Enter Falcon Flight
            </Link>
            <Link className="button-secondary" to="/leaderboard">
              Open leaderboard stub
            </Link>
          </div>
        </div>

        <div className="hero__stats">
          <div className="hero-stat">
            <span className="game-meta__label">Games scaffolded</span>
            <strong>3 playable routes</strong>
          </div>
          <div className="hero-stat">
            <span className="game-meta__label">Wallet status</span>
            <strong>Mock connection ready</strong>
          </div>
          <div className="hero-stat">
            <span className="game-meta__label">Reward flow</span>
            <strong>Claim UI placeholder</strong>
          </div>
        </div>
      </section>

      <section className="page-panel" style={{ marginTop: '1.5rem' }}>
        <span className="section-label">Game lobby</span>
        <h2 className="page-title">Choose your next mission.</h2>
        <p className="page-copy">
          Each game route already includes a Phaser canvas mount, score placeholder,
          and disabled reward claim action so implementation can happen
          independently.
        </p>

        <div className="games-grid">
          {gameDefinitions.map((game) => (
            <GameCard key={game.slug} game={game} />
          ))}
        </div>
      </section>
    </>
  )
}
