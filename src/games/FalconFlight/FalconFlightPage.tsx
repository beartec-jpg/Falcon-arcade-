import { GamePageShell } from '../../components/GamePageShell'
import { getGameDefinition } from '../../utils/games'
import { FalconFlightGame } from './FalconFlightGame'

const falconFlight = getGameDefinition('falcon-flight')

export function FalconFlightPage() {
  return (
    <GamePageShell
      gameSlug={falconFlight.slug}
      title={falconFlight.name}
      tagline={falconFlight.tagline}
      description={falconFlight.longDescription}
      scoreLabel={falconFlight.scoreLabel}
      gameCanvas={<FalconFlightGame />}
    />
  )
}
