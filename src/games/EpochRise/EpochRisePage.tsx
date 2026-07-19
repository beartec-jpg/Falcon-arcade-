import { GamePageShell } from '../../components/GamePageShell'
import { getGameDefinition } from '../../utils/games'
import { EpochRiseGame } from './EpochRiseGame'

const epochRise = getGameDefinition('epoch-rise')

export function EpochRisePage() {
  return (
    <GamePageShell
      title={epochRise.name}
      tagline={epochRise.tagline}
      description={epochRise.longDescription}
      scoreLabel={epochRise.scoreLabel}
      gameCanvas={<EpochRiseGame />}
    />
  )
}
