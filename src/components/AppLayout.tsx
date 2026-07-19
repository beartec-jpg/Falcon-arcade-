import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { WalletConnectButton } from './WalletConnectButton'

const navigationItems = [
  { label: 'Home', to: '/' },
  { label: 'Board', to: '/leaderboard' },
  { label: 'Flight', to: '/falcon-flight' },
  { label: 'Runner', to: '/ledger-runner' },
  { label: 'Rise', to: '/epoch-rise' },
]

export function AppLayout() {
  const [navOpen, setNavOpen] = useState(false)
  const location = useLocation()

  // Close the mobile drawer on navigation
  useEffect(() => {
    setNavOpen(false)
  }, [location.pathname])

  // Lock body scroll while the drawer is open
  useEffect(() => {
    if (!navOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [navOpen])

  return (
    <div className={`app-shell${navOpen ? ' app-shell--nav-open' : ''}`}>
      <header className="app-header">
        <div className="app-header__inner">
          <div className="app-header__row">
            <div className="brand">
              <span className="brand__eyebrow">Falcon Arcade</span>
              <h1 className="brand__title">Game Faucet</h1>
              <span className="brand__subtitle">
                Play · score · claim qXRP
              </span>
            </div>

            <div className="app-header__actions">
              <div className="wallet-slot">
                <WalletConnectButton />
              </div>
              <button
                type="button"
                className="nav-toggle"
                aria-expanded={navOpen}
                aria-controls="primary-nav"
                onClick={() => setNavOpen((open) => !open)}
              >
                <span className="nav-toggle__bars" aria-hidden />
                <span className="sr-only">{navOpen ? 'Close menu' : 'Open menu'}</span>
              </button>
            </div>
          </div>

          <nav
            id="primary-nav"
            className={`app-nav${navOpen ? ' app-nav--open' : ''}`}
            aria-label="Primary"
          >
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
        </div>
      </header>

      {navOpen ? (
        <button
          type="button"
          className="nav-backdrop"
          aria-label="Close menu"
          onClick={() => setNavOpen(false)}
        />
      ) : null}

      <main className="app-main">
        <Outlet />
      </main>
    </div>
  )
}
