import { GameCard } from '../components/GameCard'
import { gameDefinitions } from '../utils/games'

export function HomePage() {
  return (
    <>
      <section className="hero">
        <div>
          <span className="section-label">Falcon Arcade · Game Faucet</span>
          <h2 className="hero__title">Play. Score. Claim Falcon.</h2>
          <p className="hero__copy">
            Four mini-games are live. Scores feed daily leaderboards and a
            secondary Game Faucet inside the Falcon Ledger portal — hit{' '}
            <strong>500</strong> on a single run to unlock a claim (portal caps
            payouts; keep playing for high scores anytime).
          </p>
        </div>

        <div className="hero__stats">
          <div className="hero-stat">
            <span className="game-meta__label">Live now</span>
            <strong>All 4 games</strong>
          </div>
          <div className="hero-stat">
            <span className="game-meta__label">Claim threshold</span>
            <strong>500 pts / run</strong>
          </div>
          <div className="hero-stat">
            <span className="game-meta__label">Modes</span>
            <strong>Flight · Run · Rise · Shoot</strong>
          </div>
        </div>
      </section>

      <section className="page-panel" style={{ marginTop: '1.5rem' }}>
        <span className="section-label">Game lobby</span>
        <h2 className="page-title">Choose your mission.</h2>
        <p className="page-copy">
          Each run starts from zero — only your best single run of the day
          counts for claims and the leaderboard. Expect a few attempts before
          you clear 500; after you claim, keep grinding high scores.
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
