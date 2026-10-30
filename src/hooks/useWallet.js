import { useState, useCallback, useRef } from 'react'
import { BrowserProvider } from 'ethers'
import { EthereumProvider } from '@walletconnect/ethereum-provider'
import { CHAIN_ID, CELO_SEPOLIA, RPC_URL, WC_PROJECT_ID } from '../lib/config'

const empty = { status: 'disconnected', kind: null, address: null, chainId: null, signer: null, error: null }

export function useWallet() {
  const [wallet, setWallet] = useState(empty)
  const raw = useRef(null)

  const attach = useCallback(async (provider, kind) => {
    raw.current = provider
    const bp = new BrowserProvider(provider)
    const signer = await bp.getSigner()
    const net = await bp.getNetwork()
    setWallet({ status: 'connected', kind, address: await signer.getAddress(), chainId: Number(net.chainId), signer, error: null })
  }, [])

  const bindEvents = useCallback((provider, kind) => {
    const refresh = () => attach(provider, kind).catch(() => setWallet(empty))
    provider.on?.('accountsChanged', (a) => (a.length ? refresh() : setWallet(empty)))
    provider.on?.('chainChanged', refresh)
    provider.on?.('disconnect', () => setWallet(empty))
  }, [attach])

  const connect = useCallback(async (kind) => {
    setWallet((w) => ({ ...w, status: 'connecting', error: null }))
    try {
      let provider
      if (kind === 'injected') {
        if (!window.ethereum) throw new Error('No browser wallet found. Use WalletConnect or install MetaMask.')
        await window.ethereum.request({ method: 'eth_requestAccounts' })
        provider = window.ethereum
      } else {
        if (!WC_PROJECT_ID) throw new Error('WalletConnect needs VITE_WALLETCONNECT_PROJECT_ID in your .env file.')
        provider = await EthereumProvider.init({
          projectId: WC_PROJECT_ID, optionalChains: [CHAIN_ID], rpcMap: { [CHAIN_ID]: RPC_URL }, showQrModal: true,
        })
        await provider.connect()
      }
      await attach(provider, kind)
      bindEvents(provider, kind)
    } catch (e) {
      setWallet({ ...empty, error: e?.code === 4001 ? 'Connection request rejected.' : e.message })
    }
  }, [attach, bindEvents])

  const switchNetwork = useCallback(async () => {
    const p = raw.current
    if (!p) return
    try {
      await p.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: CELO_SEPOLIA.chainId }] })
    } catch (e) {
      if (e?.code === 4902 || /unrecognized|not added/i.test(e?.message || '')) {
        await p.request({ method: 'wallet_addEthereumChain', params: [CELO_SEPOLIA] })
      } else {
        setWallet((w) => ({ ...w, error: e.message }))
      }
    }
  }, [])

  const disconnect = useCallback(async () => {
    try { await raw.current?.disconnect?.() } catch { /* injected wallets cannot disconnect programmatically */ }
    raw.current = null
    setWallet(empty)
  }, [])

  return { ...wallet, wrongNetwork: wallet.status === 'connected' && wallet.chainId !== CHAIN_ID, connect, switchNetwork, disconnect }
}
