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
            All three mini-games are live. Scores feed epoch leaderboards and a
            secondary Game Faucet inside the Falcon Ledger portal — hit 100 in any
            game and claim when your wallet is connected.
          </p>
        </div>

        <div className="hero__stats">
          <div className="hero-stat">
            <span className="game-meta__label">Live now</span>
            <strong>All 3 games</strong>
          </div>
          <div className="hero-stat">
            <span className="game-meta__label">Claim threshold</span>
            <strong>100 pts each</strong>
          </div>
          <div className="hero-stat">
            <span className="game-meta__label">Modes</span>
            <strong>Flight · Run · Rise</strong>
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
