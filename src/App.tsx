import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/AppLayout'
import { AmendmentApocalypsePage } from './games/AmendmentApocalypse/AmendmentApocalypsePage'
import { EpochRisePage } from './games/EpochRise/EpochRisePage'
import { FalconFlightPage } from './games/FalconFlight/FalconFlightPage'
import { LedgerRunnerPage } from './games/LedgerRunner/LedgerRunnerPage'
import { HomePage } from './pages/HomePage'
import { LeaderboardPage } from './pages/LeaderboardPage'

function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<HomePage />} />
        <Route path="/falcon-flight" element={<FalconFlightPage />} />
        <Route path="/ledger-runner" element={<LedgerRunnerPage />} />
        <Route path="/epoch-rise" element={<EpochRisePage />} />
        <Route
          path="/amendment-apocalypse"
          element={<AmendmentApocalypsePage />}
        />
        <Route path="/leaderboard" element={<LeaderboardPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export default App
