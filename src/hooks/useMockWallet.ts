import { useParentCommunication } from './useParentCommunication'

/**
 * Standalone-friendly wallet surface used by the scaffold UI.
 *
 * When embedded in the Falcon Ledger portal, address comes from the parent
 * via `WALLET_CONNECTED`. When running locally outside an iframe, the mock
 * connect toggle still works for development.
 *
 * Prefer `useParentCommunication` for score/claim messaging.
 */
export function useMockWallet() {
  const {
    address,
    isConnected,
    isEmbedded,
    toggleMockWallet,
    requestWalletConnect,
  } = useParentCommunication()

  return {
    address: address ?? (isEmbedded ? 'No wallet' : 'Mock wallet'),
    isConnected,
    isEmbedded,
    toggleConnection: toggleMockWallet,
    requestWalletConnect,
  }
}
