import { useMockWallet } from '../hooks/useMockWallet'

export function WalletConnectButton() {
  const { address, isConnected, isEmbedded, toggleConnection } = useMockWallet()

  // Parent portal owns the wallet when the arcade is iframed.
  if (isEmbedded) {
    return (
      <button type="button" className="wallet-button" disabled>
        <span>{isConnected ? 'Wallet Connected' : 'Portal wallet'}</span>
        <span className="wallet-chip">{address}</span>
      </button>
    )
  }

  return (
    <button type="button" className="wallet-button" onClick={toggleConnection}>
      <span>{isConnected ? 'Wallet Connected' : 'Connect Wallet'}</span>
      <span className="wallet-chip">{address}</span>
    </button>
  )
}
