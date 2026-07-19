import { NavLink, Outlet } from 'react-router-dom'
import { WalletConnectButton } from './WalletConnectButton'

const navigationItems = [
  { label: 'Home', to: '/' },
  { label: 'Leaderboard', to: '/leaderboard' },
  { label: 'Falcon Flight', to: '/falcon-flight' },
  { label: 'Ledger Runner', to: '/ledger-runner' },
  { label: 'Epoch Rise', to: '/epoch-rise' },
]

export function AppLayout() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header__inner">
          <div className="brand">
            <span className="brand__eyebrow">Falcon Arcade</span>
            <h1 className="brand__title">Game Faucet</h1>
            <span className="brand__subtitle">
              Play mini-games · earn qXRP · climb epoch boards
            </span>
          </div>

          <nav className="app-nav" aria-label="Primary">
            {navigationItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `nav-link${isActive ? ' nav-link--active' : ''}`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <WalletConnectButton />
        </div>
      </header>

      <main className="app-main">
        <Outlet />
      </main>
    </div>
  )
}
