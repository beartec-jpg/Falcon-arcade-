import { useMemo, useState } from 'react'

const connectedWalletAddress = '0xFALC0N...B3TA'

export function useMockWallet() {
  const [isConnected, setIsConnected] = useState(false)

  const address = useMemo(
    () => (isConnected ? connectedWalletAddress : 'Mock wallet'),
    [isConnected],
  )

  const toggleConnection = () => {
    setIsConnected((value) => !value)
  }

  return {
    address,
    isConnected,
    toggleConnection,
  }
}
