import { useMockWallet } from '../hooks/useMockWallet'

function shortAddress(address: string) {
  if (address.length <= 12) return address
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

export function WalletConnectButton() {
  const { address, isConnected, isEmbedded, toggleConnection, requestWalletConnect } = useMockWallet()
  const compact = shortAddress(address)

  if (isEmbedded) {
    // Connected: informational. Not connected: ask the portal to open its wallet.
    return (
      <button
        type="button"
        className="wallet-button"
        disabled={isConnected}
        onClick={isConnected ? undefined : requestWalletConnect}
        title={isConnected ? undefined : 'Open your Falcon wallet on the portal'}
      >
        <span className="wallet-button__label">
          {isConnected ? 'Connected' : 'Connect'}
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
