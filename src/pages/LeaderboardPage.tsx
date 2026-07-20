import { useCallback, useEffect, useState } from 'react'
import { gameDefinitions } from '../utils/games'

interface Entry {
  rank: number
  address: string
  game: string
  score: number
}

const PORTAL =
  (import.meta.env.VITE_PORTAL_API_URL as string | undefined)?.replace(
    /\/$/,
    '',
  ) ?? ''

export function LeaderboardPage() {
  const [game, setGame] = useState(gameDefinitions[0]?.slug ?? 'falcon-flight')
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dayUtc, setDayUtc] = useState('')

  const load = useCallback(async () => {
    if (!PORTAL) {
      setError(
        'Set VITE_PORTAL_API_URL to your Falcon Ledger origin to load live boards (e.g. http://localhost:3000).',
      )
      setEntries([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      const q = new URLSearchParams({
        game,
        limit: '25',
      })
      const r = await fetch(`${PORTAL}/api/arcade/leaderboard?${q}`)
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const data = await r.json()
      setEntries(data.entries ?? [])
      setDayUtc(data.dayUtc ?? '')
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Could not load leaderboard from portal',
      )
      setEntries([])
    } finally {
      setLoading(false)
    }
  }, [game])

  useEffect(() => {
    void load()
    const id = window.setInterval(load, 30_000)
    return () => window.clearInterval(id)
  }, [load])

  return (
    <section className="page-panel">
      <span className="section-label">Leaderboard</span>
      <h2 className="page-title">Today&apos;s top scores</h2>
      <p className="page-copy">
        Best score per wallet for the current UTC day
        {dayUtc ? ` (${dayUtc})` : ''}. Scores sync when you play inside the
        Falcon Ledger Arcade page.
      </p>

      <div className="page-actions" style={{ marginTop: '1rem' }}>
        {gameDefinitions.map((g) => (
          <button
            key={g.slug}
            type="button"
            className={
              game === g.slug ? 'button-primary' : 'button-secondary'
            }
            onClick={() => setGame(g.slug)}
          >
            {g.mode}
          </button>
        ))}
      </div>

      {loading && <p className="page-copy">Loading…</p>}
      {error && (
        <p className="page-copy" style={{ color: '#f87171' }}>
          {error}
        </p>
      )}

      {!loading && !error && entries.length === 0 && (
        <p className="page-copy">
          No scores yet. Play a run and cross the claim threshold to appear
          here.
        </p>
      )}

      {entries.length > 0 && (
        <ol className="leaderboard-list">
          {entries.map((e) => (
            <li key={`${e.rank}-${e.address}`}>
              <span>
                #{e.rank}{' '}
                <span className="wallet-chip">
                  {e.address.slice(0, 8)}…{e.address.slice(-4)}
                </span>
              </span>
              <strong>{Math.floor(e.score).toLocaleString()}</strong>
            </li>
          ))}
        </ol>
      )}

      <p className="footer-note">
        Full boards also live on the portal at{' '}
        <code>/arcade/leaderboard</code>. Game claims use the same FALCON faucet
        with separate daily game rate limits.
      </p>
    </section>
  )
}
