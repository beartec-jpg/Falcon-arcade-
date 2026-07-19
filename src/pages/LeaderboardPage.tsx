export function LeaderboardPage() {
  return (
    <section className="page-panel">
      <span className="section-label">Leaderboard</span>
      <h2 className="page-title">Cross-game rankings placeholder</h2>
      <p className="page-copy">
        This stub will evolve into a shared leaderboard once score persistence and
        wallet-linked player profiles are integrated.
      </p>

      <ol className="leaderboard-list">
        <li>
          <span>Falcon Flight top score</span>
          <strong>Coming soon</strong>
        </li>
        <li>
          <span>Ledger Runner top score</span>
          <strong>Coming soon</strong>
        </li>
        <li>
          <span>Epoch Rise top score</span>
          <strong>Coming soon</strong>
        </li>
      </ol>

      <p className="footer-note">
        Future portal integration can swap this page to fetch rankings from a shared
        backend or parent host application.
      </p>
    </section>
  )
}
