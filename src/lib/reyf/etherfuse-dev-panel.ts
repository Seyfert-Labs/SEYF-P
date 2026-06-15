import { getEtherfuseConfig } from '@/lib/etherfuse/config'

export function isEtherfuseDevPanelEnabled(): boolean {
  if (process.env.REYF_ETHERFUSE_DEV_PANEL === 'true' || process.env.SEYF_ETHERFUSE_DEV_PANEL === 'true') return true
  return process.env.NODE_ENV === 'development'
}

export function isEtherfuseSandboxApiHost(): boolean {
  if (process.env.REYF_ALLOW_SANDBOX_FIAT_SIMULATION === 'true' || process.env.SEYF_ALLOW_SANDBOX_FIAT_SIMULATION === 'true') return true
  try {
    const { baseUrl } = getEtherfuseConfig()
    const host = new URL(baseUrl).hostname.toLowerCase()
    return host === 'api.sand.etherfuse.com' || host.endsWith('.sand.etherfuse.com')
  } catch {
    return false
  }
}

export function isSandboxFiatReceivedProxyEnabled(): boolean {
  return isEtherfuseDevPanelEnabled() || isEtherfuseSandboxApiHost()
}
