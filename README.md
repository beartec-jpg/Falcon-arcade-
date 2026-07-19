# Falcon Games (Falcon Arcade)

Falcon Arcade is a web-based mini-games platform built with **Vite**, **React 18**, **TypeScript**, **Phaser 3**, and **React Router**. It embeds into the **Falcon Ledger** portal (`Falcon-faucet-wallet`) as an iframe “Game Faucet” experience.

**Falcon Flight is fully playable.** Ledger Runner and Epoch Rise remain placeholder routes. The shell includes portal-aligned dark UI, wallet state (mock or parent-driven), and **parent ↔ iframe `postMessage` communication**.

## Getting started

### Install

```bash
npm install
```

### Run locally

```bash
npm run dev
```

### Build for production

```bash
npm run build
```

### Lint

```bash
npm run lint
```

### Parent origins (embed)

When embedded, inbound messages are origin-checked against `VITE_PARENT_ORIGINS` (comma-separated).

```bash
# .env.local example
VITE_PARENT_ORIGINS=https://your-falcon-ledger.example,http://localhost:3000
```

In development, if the env var is unset, common localhost ports (`3000`, `5173`, `5174`) are allowed automatically. Production builds with no env var trust **no** external origins until configured.

## Project structure

```text
src/
  components/               Shared layout, cards, wallet UI, game page shell
  games/
    FalconFlight/           Falcon Flight Phaser scene + page wrapper
    LedgerRunner/           Ledger Runner Phaser scene + page wrapper
    EpochRise/              Epoch Rise Phaser scene + page wrapper
  hooks/
    useParentCommunication  iframe detection + postMessage + wallet context
    useMockWallet           thin UI helper over parent communication
    usePhaserGame           Phaser boot helper
  pages/                    Home and leaderboard routes
  types/                    Shared models + parent message protocol
  utils/                    Game metadata, iframe/origin helpers, Phaser helpers
```

## Routes

- `/` — home page listing all three games
- `/falcon-flight` — Falcon Flight page with an empty Phaser scene
- `/ledger-runner` — Ledger Runner page with an empty Phaser scene
- `/epoch-rise` — Epoch Rise page with an empty Phaser scene
- `/leaderboard` — leaderboard stub page

## Games

1. **Falcon Flight** ✅ (horizontal) — auto-forward flight; steer up/down through ledger gaps and quantum static. Distance + gap-pass scoring, progressive difficulty, claim unlock at **100** points.
2. **Ledger Runner** (horizontal) — placeholder; auto-runner + jump planned next.
3. **Epoch Rise** (vertical) — placeholder; energy-bar vertical scroller planned later.

## Game → reward model (portal)

- Each game has an epoch leaderboard (resets every epoch).
- Each game has a **reward threshold**; reaching it makes the player eligible to claim the Game Faucet reward **once per game per epoch**.
- Score may keep climbing after the threshold for leaderboard ranking only.
- Daily/epoch claim limits protect the faucet balance (enforced by the parent portal / backend).

Gameplay and claim thresholds are **not** implemented in this scaffold yet.

## Parent portal integration (`postMessage`)

The arcade can run:

| Mode | Wallet | Messaging |
| --- | --- | --- |
| **Standalone** (`npm run dev`) | Mock connect toggle | Outbound messages are no-ops (logged in dev) |
| **Embedded iframe** | Parent sends `WALLET_CONNECTED` | Full protocol below |

### Inbound (parent → arcade)

```ts
{ type: "WALLET_CONNECTED", address: string }
```

### Outbound (arcade → parent)

```ts
{ type: "GAME_READY" }
{ type: "SCORE_UPDATE", game: string, score: number }
{ type: "CLAIM_REQUEST", game: string, score: number }
```

`game` values match route slugs: `falcon-flight`, `ledger-runner`, `epoch-rise`.

### Parent embed sketch

```html
<iframe id="falcon-arcade" src="https://arcade.example/" title="Falcon Arcade"></iframe>
<script>
  const iframe = document.getElementById('falcon-arcade')
  const ARCADE_ORIGIN = 'https://arcade.example'

  window.addEventListener('message', (event) => {
    if (event.origin !== ARCADE_ORIGIN) return
    const data = event.data
    if (!data || typeof data !== 'object') return

    if (data.type === 'GAME_READY') {
      iframe.contentWindow.postMessage(
        { type: 'WALLET_CONNECTED', address: currentWalletAddress },
        ARCADE_ORIGIN,
      )
    }

    if (data.type === 'SCORE_UPDATE') {
      // Update epoch leaderboard / threshold progress
    }

    if (data.type === 'CLAIM_REQUEST') {
      // Validate threshold + epoch limits, then process Game Faucet claim
    }
  })
</script>
```

### React API

```tsx
import { useParentCommunication } from './hooks/useParentCommunication'

const {
  isEmbedded,
  address,
  isConnected,
  sendScoreUpdate,
  sendClaimRequest,
  notifyGameReady,
} = useParentCommunication()
```

The provider wraps the app in `main.tsx` and automatically posts `GAME_READY` on mount. **Always** validate `event.origin` on both sides (arcade does this via `VITE_PARENT_ORIGINS` / dev defaults).

## Current scaffold features

- Dark, crypto-inspired UI with orange and gold accents
- Shared app shell and route navigation
- Per-game React wrapper pages + empty Phaser scenes
- Score display placeholders
- Disabled `Claim Reward` until claim eligibility is wired
- Mock wallet for standalone local development
- iframe detection + origin-validated `postMessage` layer

## Notes

This scaffold intentionally avoids full gameplay logic, scoring systems, physics, and on-chain claim execution so each game and the portal backend can be implemented iteratively on top of a clean foundation.
