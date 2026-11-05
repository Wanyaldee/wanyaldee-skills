// Entry of the function-hooks mods bundled in this plugin. A plugin's hooks.json
// names one module, and a plugin may hook session.start without a matcher only
// once, so this module owns session.start and calls each mod's start, then lets
// each mod register the rest of its hooks. Each mod's code stays under mods/.
import type { Register } from 'claude-code'

import { register as contextHandoff, start as startContextHandoff } from '../mods/context-handoff/hooks/register'
import { register as stickyNotes, start as startStickyNotes } from '../mods/sticky-notes/hooks/register'

export const register: Register = (on, options) => {
  on('session.start', async ($, e, next) => {
    await startContextHandoff($, e)
    await startStickyNotes($)
    return next(e)
  })
  contextHandoff(on, options)
  stickyNotes(on, options)
}
