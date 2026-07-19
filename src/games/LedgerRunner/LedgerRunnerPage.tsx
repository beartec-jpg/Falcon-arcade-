import { GamePageShell } from '../../components/GamePageShell'
import { getGameDefinition } from '../../utils/games'
import { LedgerRunnerGame } from './LedgerRunnerGame'

const ledgerRunner = getGameDefinition('ledger-runner')

export function LedgerRunnerPage() {
  return (
    <GamePageShell
      gameSlug={ledgerRunner.slug}
      title={ledgerRunner.name}
      tagline={ledgerRunner.tagline}
      description={ledgerRunner.longDescription}
      scoreLabel={ledgerRunner.scoreLabel}
      gameCanvas={<LedgerRunnerGame />}
    />
  )
}
