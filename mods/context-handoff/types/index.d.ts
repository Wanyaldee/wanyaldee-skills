export type Handoff = {
  repoRoot: string
  branch: string
  commit: string
  reason: string
  summary: string
  createdAt: string
}

declare module 'claude-code' {
  interface PluginState {
    'context-handoff': {
      pending: Handoff | null
      hasSavedThisSession: boolean
    }
  }
}
