import { useMockWallet } from '../hooks/useMockWallet'

export function WalletConnectButton() {
  const { address, isConnected, toggleConnection } = useMockWallet()

  return (
    <button type="button" className="wallet-button" onClick={toggleConnection}>
      <span>{isConnected ? 'Wallet Connected' : 'Connect Wallet'}</span>
      <span className="wallet-chip">{address}</span>
    </button>
  )
}
