# Falcon Games

Falcon Games is a web-based mini-games platform scaffold built with **Vite**, **React 18**, **TypeScript**, **Phaser 3**, and **React Router**. This repository currently focuses on the shell only: navigation, dark-themed UI, wallet placeholder state, and game-specific pages ready for future implementation.

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

## Project structure

```text
src/
  components/               Shared layout, cards, and wallet UI
  games/
    FalconFlight/           Falcon Flight Phaser scene + page wrapper
    LedgerRunner/           Ledger Runner Phaser scene + page wrapper
    EpochRise/              Epoch Rise Phaser scene + page wrapper
  hooks/                    Mock wallet and Phaser boot hooks
  pages/                    Home and leaderboard routes
  types/                    Shared TypeScript models
  utils/                    Shared game metadata and Phaser helpers
```

## Routes included in the scaffold

- `/` — home page listing all three games
- `/falcon-flight` — Falcon Flight page with an empty Phaser scene
- `/ledger-runner` — Ledger Runner page with an empty Phaser scene
- `/epoch-rise` — Epoch Rise page with an empty Phaser scene
- `/leaderboard` — leaderboard stub page

## High-level game plans

### Falcon Flight

Planned as an arcade flight experience focused on fast movement, obstacle avoidance, and collectible-driven score runs.

### Ledger Runner

Planned as a momentum-based runner with lane or platform traversal, chained scoring, and milestone rewards.

### Epoch Rise

Planned as a strategic arena game with timing-based encounters, progression layers, and session-based ranking hooks.

## Current scaffold features

- Dark, crypto-inspired UI with orange and gold accents
- Shared app shell and route navigation
- Per-game React wrapper pages
- Per-game Phaser canvas components using empty placeholder scenes
- Score display placeholders
- Disabled `Claim Reward` buttons for future reward claims
- Mock wallet connection button with placeholder address state

## Future parent portal integration notes

- Replace the mock wallet hook with the real wallet connector used by the parent portal
- Feed leaderboard and score data from a shared backend or host-provided SDK
- Pass authenticated player context and reward eligibility into each game page
- Evolve the disabled claim actions into portal-driven reward claim workflows

## Notes

This scaffold intentionally avoids full gameplay logic, scoring systems, physics, and blockchain integration so each game can be implemented iteratively on top of a clean foundation.
