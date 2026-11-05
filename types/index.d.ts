// State contract and shared types of the function-hooks mods bundled in this
// plugin (hooks/mods.tsx). The engine requires the contract to be one
// self-contained file, so each mod imports its types from here.
// $.state values are owned by the plugin that writes them, so both mods write
// under 'wanyaldee-skills'; their keys must not collide.

// context-handoff
export type Handoff = {
  repoRoot: string
  branch: string
  commit: string
  reason: string
  summary: string
  createdAt: string
}

// sticky-notes
export type Verdict = 'pending' | 'ok' | 'mismatch' | 'unclear'
export type Review = { verdict: Verdict; comment: string }
export type Sticky = { id: string; text: string; at: number; review?: Review }
export type Summary = { text: string; at: number }

declare module 'claude-code' {
  interface PluginState {
    'wanyaldee-skills': {
      // context-handoff
      pending: Handoff | null
      hasSavedThisSession: boolean
      // sticky-notes
      commands: Shaped<Sticky[]>
      notes: Shaped<Sticky[]>
      summary: Shaped<Summary | null>
      isSummarizing: boolean
    }
  }
}
