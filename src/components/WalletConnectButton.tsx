import { useMockWallet } from '../hooks/useMockWallet'

function shortAddress(address: string) {
  if (address.length <= 12) return address
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

export function WalletConnectButton() {
  const { address, isConnected, isEmbedded, toggleConnection } = useMockWallet()
  const compact = shortAddress(address)

  if (isEmbedded) {
    return (
      <button type="button" className="wallet-button" disabled>
        <span className="wallet-button__label">
          {isConnected ? 'Connected' : 'Portal'}
        </span>
        <span className="wallet-chip">{compact}</span>
      </button>
    )
  }

  return (
    <button type="button" className="wallet-button" onClick={toggleConnection}>
      <span className="wallet-button__label">
        {isConnected ? 'Connected' : 'Connect'}
      </span>
      <span className="wallet-chip">{compact}</span>
    </button>
  )
}
