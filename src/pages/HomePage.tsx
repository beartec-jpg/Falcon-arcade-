import { Link } from 'react-router-dom'
import { GameCard } from '../components/GameCard'
import { gameDefinitions } from '../utils/games'

export function HomePage() {
  return (
    <>
      <section className="hero">
        <div>
          <span className="section-label">Falcon Arcade · Game Faucet</span>
          <h2 className="hero__title">Play. Score. Claim free qXRP.</h2>
          <p className="hero__copy">
            Three mini-games feed epoch leaderboards and a secondary Game Faucet
            inside the Falcon Ledger portal. Falcon Flight is live — steer the
            bronze falcon, clear ledger gaps, and unlock your claim at 100 points.
          </p>

          <div className="hero__actions">
            <Link className="button-primary" to="/falcon-flight">
              Play Falcon Flight
            </Link>
            <Link className="button-secondary" to="/leaderboard">
              Epoch leaderboard
            </Link>
          </div>
        </div>

        <div className="hero__stats">
          <div className="hero-stat">
            <span className="game-meta__label">Live now</span>
            <strong>Falcon Flight</strong>
          </div>
          <div className="hero-stat">
            <span className="game-meta__label">Claim threshold</span>
            <strong>100 flight pts</strong>
          </div>
          <div className="hero-stat">
            <span className="game-meta__label">Coming next</span>
            <strong>Runner · Epoch Rise</strong>
          </div>
        </div>
      </section>

      <section className="page-panel" style={{ marginTop: '1.5rem' }}>
        <span className="section-label">Game lobby</span>
        <h2 className="page-title">Choose your mission.</h2>
        <p className="page-copy">
          Scores stream to the parent portal via secure postMessage. Reach each
          game&apos;s reward threshold to become eligible for the Game Faucet
          claim (once per game per epoch).
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
