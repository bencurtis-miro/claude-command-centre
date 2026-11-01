export type VaultNote = { name: string; mtimeMs: number }
export type Vault = {
  notes: VaultNote[]
  hubs: string[]
  directives: { text: string; note: string }[]
  scheduled: string[]
  source: 'live'
  loadedAt: number
}
export type Activity = {
  state: 'idle' | 'working' | 'error'
  tool: string | null
  turns: number
  toolsThisTurn: number
  lastTurnSeconds: number | null
}

declare module 'claude-code' {
  interface PluginState {
    'command-centre': {
      vault: Shaped<Vault | null>
      activity: Activity
      clock: number
      chimeOn: boolean
      bandHidden: boolean
    }
  }
}
