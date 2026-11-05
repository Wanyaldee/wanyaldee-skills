export type Verdict = 'pending' | 'ok' | 'mismatch' | 'unclear'
export type Review = { verdict: Verdict; comment: string }
export type Sticky = { id: string; text: string; at: number; review?: Review }
export type Summary = { text: string; at: number }

declare module 'claude-code' {
  interface PluginState {
    'sticky-notes': {
      commands: Shaped<Sticky[]>
      notes: Shaped<Sticky[]>
      summary: Shaped<Summary | null>
      isSummarizing: boolean
    }
  }
}
