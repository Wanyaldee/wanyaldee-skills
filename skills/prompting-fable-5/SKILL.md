---
name: prompting-fable-5
description: Prompting and scaffolding reference for Claude Fable 5 / Mythos 5 and Fable 5.1 / Mythos 5.1 — use when writing system prompts, agent harnesses, skills, or API integrations that target either generation, tuning effort levels (including 5.1's `max` and mid-conversation effort), handling refusals/fallback, designing subagent/memory/send-to-user scaffolding, or migrating prompts between Fable 5, 5.1, and Opus-era models. Not for ordinary coding tasks (that's fable-coding).
---

# Prompting Claude Fable 5 (framework reference)

Distilled from Anthropic's official guides: the Fable 5 guide
(`platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-fable-5`),
and — fetched 2026-09-05 — the Fable 5.1 guides
(`platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-fable-5-1`
and `platform.claude.com/docs/en/models/fable-5-1/whats-new-fable-5-1`).
Use the snippet blocks verbatim — they are Anthropic's tested wording.

## Model shape (what you're prompting)

- Fable 5 = Mythos-class tier above Opus; Mythos 5 is the same model without the extra safety measures (approved orgs only).
- Aim at the top of your difficulty range: hours-to-weeks, end-to-end work. Testing only simple workloads undersells it; routine tasks still fine.
- Improved vs Opus 4.8: long-horizon autonomy, first-shot correctness on well-specified problems, dense-image vision, enterprise docs/spreadsheets, code review & debugging recall, ambiguity navigation, parallel-subagent management.
- Safety classifiers target offensive cyber, biology/life sciences, reasoning-extraction; benign work can trip them. Handle `stop_reason: "refusal"` with fallback — permitted targets: Claude Opus 4.8 and Claude Opus 5.
- API: adaptive thinking only, summarized-only thinking output, no extended-thinking budgets.

## Effort — the primary knob

`high` default, `xhigh` for capability-sensitive work, `medium`/`low` for routine (low effort on Fable 5 often still beats prior models' xhigh). 5.1 adds `max`, above `xhigh`. Effort names don't correspond to the same amount of thinking across models — re-run any sweep on 5.1, don't reuse a Fable-5 one. Turns run minutes-to-hours: raise client timeouts, stream, show progress, prefer async check-ins over blocking.

Anti-overplanning snippet (for ambiguous tasks):

```text
When you have enough information to act, act. Do not re-derive facts already established in the conversation, re-litigate a decision the user has already made, or narrate options you will not pursue in user-facing messages. If you are weighing a choice, give a recommendation, not an exhaustive survey. This does not apply to thinking blocks.
```

Anti-overbuilding snippet (higher effort tends to tidy/refactor unasked):

```text
Don't add features, refactor, or introduce abstractions beyond what the task requires. A bug fix doesn't need surrounding cleanup and a one-shot operation usually doesn't need a helper. Don't design for hypothetical future requirements: do the simplest thing that works well. Avoid premature abstraction and half-finished implementations. Don't add error handling, fallbacks, or validation for scenarios that cannot happen. Trust internal code and framework guarantees. Only validate at system boundaries (user input, external APIs). Don't use feature flags or backwards-compatibility shims when you can just change the code.
```

## Instruction following — brief beats enumerated

One short instruction beats a list of cases. Brevity/readability:

```text
Lead with the outcome. Your first sentence after finishing should answer "what happened" or "what did you find": the thing the user would ask for if they said "just give me the TLDR." Supporting detail and reasoning come after. Being readable and being concise are different things, and readability matters more.

The way to keep output short is to be selective about what you include (drop details that don't change what the reader would do next), not to compress the writing into fragments, abbreviations, arrow chains like A → B → fails, or jargon.
```

Checkpoints in long workflows:

```text
Pause for the user only when the work genuinely requires them: a destructive or irreversible action, a real scope change, or input that only they can provide. If you hit one of these, ask and end the turn, rather than ending on a promise.
```

## Ground progress claims (long runs)

Nearly eliminates fabricated status reports:

```text
Before reporting progress, audit each claim against a tool result from this session. Only report work you can point to evidence for; if something is not yet verified, say so explicitly. Report outcomes faithfully: if tests fail, say so with the output; if a step was skipped, say that; when something is done and verified, state it plainly without hedging.
```

## State the boundaries (unrequested actions)

```text
When the user is describing a problem, asking a question, or thinking out loud rather than requesting a change, the deliverable is your assessment. Report your findings and stop. Don't apply a fix until they ask for one. Before running a command that changes system state (restarts, deletes, config edits), check that the evidence actually supports that specific action. A signal that pattern-matches to a known failure may have a different cause.
```

## Parallel subagents

Delegates readily; prefer async orchestrator↔subagent comms over blocking — long-lived subagents keep cache-warm context.

```text
Delegate independent subtasks to subagents and keep working while they run. Intervene if a subagent goes off track or is missing relevant context.
```

## Memory system

Give it a place to write lessons (a Markdown dir suffices):

```text
Store one lesson per file with a one-line summary at the top. Record corrections and confirmed approaches alike, including why they mattered. Don't save what the repo or chat history already records; update an existing note rather than creating a duplicate; delete notes that turn out to be wrong.
```

Bootstrap from history: `Reflect on the previous sessions we've had together. Use subagents to identify core themes and lessons, and store them in [X]. Make sure you know to reference [X] for future use.`

## Failure modes & their patches

- **Early stopping** (turn ends on "I'll now run X" with no tool call, or asks needless permission). Fable 5 wording — superseded on 5.1 by the two-block version in [Fable 5.1 — what changed](#fable-51--what-changed):

```text
You are operating autonomously. The user is not watching in real time and cannot answer questions mid-task, so asking "Want me to…?" or "Shall I…?" will block the work. For reversible actions that follow from the original request, proceed without asking. Offering follow-ups after the task is done is fine; asking permission before doing the work is not. Before ending your turn, check your last paragraph. If it is a plan, an analysis, a question, a list of next steps, or a promise about work you have not done ("I'll…", "let me know when…"), do that work now with tool calls. End your turn only when the task is complete or you are blocked on input only the user can provide.
```

- **Context-budget anxiety** (suggests new session / trims work when shown a token countdown). Hide remaining-token counts if possible; else:

```text
You have ample context remaining. Do not stop, summarize, or suggest a new session on account of context limits. Continue the work.
```

## Give the reason, not only the request

Performs better knowing intent: `I'm working on [the larger task] for [who it's for]. They need [what the output enables]. With that in mind: [request].`

## Readability addendum (agentic sessions)

```text
Terse shorthand is fine between tool calls (that's you thinking out loud, and brevity there is good). Your final summary is different: it's for a reader who didn't see any of that.

If you've been working for a while without the user watching (overnight, across many tool calls, since they last spoke), your final message is their first look at any of it. Write it as a re-grounding, not a continuation of your working thread: the outcome first, then the one or two things you need from them, each explained as if new. The vocabulary you built up while working is yours, not theirs; leave it behind unless you re-introduce it.

When you write the summary at the end, drop the working shorthand. Write complete sentences. Spell out terms. Don't use arrow chains, hyphen-stacked compounds, or labels you made up earlier. When you mention files, commits, flags, or other identifiers, give each one its own plain-language clause. Open with the outcome: one sentence on what happened or what you found. Then the supporting detail. If you have to choose between short and clear, choose clear.
```

## send_to_user tool (async agents)

For content the user must see verbatim mid-turn. Client-side tool, input rendered directly in the UI:

```json
{
  "name": "send_to_user",
  "description": "Display a message directly to the user. Use this for progress updates, partial results, or content the user must see exactly as written before the task finishes.",
  "input_schema": {
    "type": "object",
    "properties": {
      "message": { "type": "string", "description": "The content to display to the user." }
    },
    "required": ["message"]
  }
}
```

Defining it is not enough — pair with elicitation: `Between tool calls, when you have content the user must read verbatim (a partial deliverable, a direct answer to their question), call the send_to_user tool with that content. Use send_to_user only for user-facing content, not for narration or reasoning.` Never route narration through it.

## Migration checklist (Opus-era → Fable 5)

- Re-evaluate every instruction/guardrail: prior-model skills are often too prescriptive and degrade Fable 5 output — try removing before rewriting.
- Never instruct it to echo/transcribe/explain its internal reasoning — triggers `reasoning_extraction` refusals. Read `thinking` blocks instead; audit skills for "show your thinking" language.
- Make self-verification explicit; fresh-context verifier subagents beat self-critique: `Establish a method for checking your own work at an interval of [X] as you build. Run this every [X interval], verifying your work with subagents against the specification.`
- Configure refusal fallback to Claude Opus 4.8 or Claude Opus 5 (server- or client-side).
- Raise timeouts, add progress UX, restructure harnesses to check runs asynchronously.

## Fable 5.1 — what changed

Sources above, fetched 2026-09-05. IDs: `claude-fable-5-1`, `claude-mythos-5-1` (Glasswing only). Cache reads = 1/4 the Fable 5 rate — compacting early to save cost may no longer be the right tradeoff.

### Breaking / API

- **Forced tool use 400s** (thinking is always on; a forced call would skip it):

```text wrap
tool_choice: type "tool" and "any" are not supported for this model.
```

  Use strict tool use (`auto` + `strict: true`) or structured outputs.

- **History must be append-only.** Accounts created on/after 2026-08-31: editing anything before a thinking block (system, tools, earlier message) 400s the next request — "the block is bound to a different conversation." Escape hatch: `thinking.block_binding.prefix_mismatch_behavior: "drop_block"` (beta header `thinking-binding-controls-2026-08-01`). Fix instead: turn-scoped system messages, not injected-then-deleted reminders; mid-conversation system messages, not rewriting `system`/`tools`; server-side compaction/context editing for trimming.
- **Thinking blocks don't travel backward** — 5.1 reads earlier models' blocks, no earlier model reads 5.1's; a mid-conversation fallback/router silently drops what the target can't read.

### Behavior differences from Fable 5 (each with its fix)

- **Fewer progress updates during long tool runs.** Remove any "hold findings for final response" line first. Then: `thinking.display: "updates"` (beta `thinking-display-updates-2026-08-18`) surfaces each progress-update `thinking` block as a status line.

```text wrap
Before you start, say in a line what you're about to do; brief updates while you work help the user follow along. Close with a short recap that stands on its own — what you found, what you did, and what's next — so a reader who only sees the last message has the full picture.
```

- **One tool call per turn** in agent loops where next reads are only implied (coding agents, bash-and-editor harnesses, computer use). Nudge, as a turn-scoped system message (`clear_at: "next_user_message"`, beta `mid-conversation-system-clear-at-2026-08-21`) appended fresh each turn:

```text wrap
First privately list what you need next; then request every item that doesn't depend on another's result in this one response.
```

- **Denser prose:**

```text wrap
Mannered prose substitutes metaphor and flourish for direct statement. Instead of "a parameter worth varying," the mannered writer produces "a dial worth turning." Instead of "this point still matters," they write "this point earns its keep." The phrases exist to display the writer, not to convey the idea, and readers can tell. That is why mannered prose irritates: it makes the reader work harder so the writer can perform. It is also imprecise. Metaphors drag in connotations the writer did not choose and cannot control. The fix is to say what you mean. When a literal phrase is available, use it.
```

  Short version also works: "Please remove all mannered prose."

- **Less formatting in chat, not more — reverses prior guidance.** Remove earlier models' anti-formatting rules; they now suppress needed structure. Replace with:

```text wrap
Use lists and bullet points when asked to, or when the content is multifaceted enough that they help with clarity. If the person explicitly requests minimal formatting, always format your responses without bullet points, headers, lists, or bold emphasis, as requested. In conversational, personal, or emotional exchanges, keep to plain prose.
```

- **Unmarked quotations summarizing sources.** Fix: one complete worked example in the system prompt:

```text wrap
<example>
<user>look up how the Riverton Ledger and the Coast Dispatch each covered the Harbor Bridge closure and compare their reporting</user>
<response>
[web_search: Harbor Bridge closure Riverton Ledger]
[web_search: Harbor Bridge closure Coast Dispatch]
Both outlets agree on the basics: the bridge closed on March 3 after inspectors found cracked welds, and the state expects repairs to take about eight months. Where they differ is emphasis. The Ledger treats it as a local-economy story. The Dispatch frames it as a funding failure; its editorial calls the closure "entirely foreseeable." Read together, the Ledger explains who is affected now and the Dispatch explains how it came to this — neither account alone gives the whole picture.
</response>
<rationale>CORRECT: The response is organized around where the two outlets agree and differ, not as a walk through either article. Each outlet's reporting is conveyed in one or two sentences of the assistant's own indirect speech. One short marked phrase from one source; every other claim is reworded. The response is still specific and complete.</rationale>
</example>
```

- **Whole-file rewrites for small changes:**

```text wrap
The number of tokens used to edit files is best minimized, all else being equal. Therefore, when it will not affect the end result, try to surgically edit a file rather than rewrite the entire thing.
```

- **Answers from memory instead of searching, at `low` effort:**

```text wrap
When a query centers on a name you do not confidently recognize, or recognize from a fast-moving area like AI models and developer tools where the landscape shifts within months, the name itself is the thing to verify: search before answering, and include the name as the user wrote it in at least one query alongside any reformulations. This holds even when you have some background on it — partial background is exactly what makes an out-of-date answer sound authoritative, so familiarity is not a reason to skip the search.
```

- **Turn ends before the work is done** (supersedes the Fable 5 "early stopping" snippet above). Apply both blocks; first alone if prompt length is tight:

```text wrap
You are operating autonomously. The user is not watching in real time and cannot answer questions mid-task, so asking 'Want me to…?' or 'Shall I…?' will block the work. For reversible actions that follow from the original request, proceed without asking. Stop only for destructive actions or genuine scope changes the user must decide. Offering follow-ups after the task is done is fine; asking permission before doing the work is not.

Exception: when the user is describing a problem, asking a question, or thinking out loud rather than requesting a change, the deliverable is your assessment. Report your findings and stop. Don't apply a fix until they ask for one.

Before ending your turn, check your last paragraph. If it is a plan, an analysis, a question, a list of next steps, or a promise about work you have not done ('I'll…', 'let me know when…'), do that work now with tool calls. That includes retrying after errors and gathering missing information yourself. Do not stop because the context or session is long. End your turn only when the task is complete or you are blocked on input only the user can provide.

Before running a command that changes system state (such as restarts, deletes, or config edits), check that the evidence actually supports that specific action. A signal that pattern-matches to a known failure may have a different cause.
```

```text wrap
# Delivering work
The user's request — or the plan they approved — sets the scope, and the scope is the deliverable: don't quietly narrow, widen, or swap it. Read ambiguity the way a careful colleague would: make routine judgment calls yourself, and check in only when different readings would lead to materially different work. If you see a real problem with the task as specified, say so in a sentence or two and keep building under stated assumptions; if the user hears the concern and reaffirms, that is their decision, so deliver the full request.

If a question comes up partway, first do everything that doesn't depend on the answer; then state the assumption you made, or — when going ahead on a wrong guess would be unsafe or would make the work useless — put the question at the end of a turn that also delivers that progress. If one part turns out to be blocked, complete every other part in full and say exactly what you left out and why — the whole task is the deliverable, and scaling it down is the user's call, not yours. A step you have decided on is something to run, not to announce: describing the next step and ending the turn leaves it undone until the user replies.

Keep changes to what the request needs. Something else you notice worth doing — cleanup or documentation the task didn't call for, a change to a file the task didn't require — is a suggestion to make at the end, not a change to make; actions clearly beyond what the ask implies, and risky or destructive ones, still need the user's go-ahead.
```

- **Unrequested fixes and extra committed test files:**

```text wrap
If, while working or testing, you find a pre-existing bug, a performance concern, or behavior the task doesn't mention, don't fix, optimize or extend it in this change unless the requested behavior cannot work without it; report it as a follow-up in your summary. Where the task is ambiguous, implement the reading its wording and the surrounding code most directly support, state that assumption in your summary, and don't build for the other readings as well. Verify your work however you like; scratch scripts and quick checks need not be kept. Commit tests only where the task asks for them or this repository already keeps tests for this kind of change, sized like the neighboring test files — roughly one focused test per stated behavior — and don't turn scratch checks into additional permanent test files. This is about extras only: implement every behavior the task asks for, completely.
```

- **At `xhigh`/`max`, long deliverables get drafted in thinking, then written again.** Prefer `high` unless measured otherwise; else leave `max_tokens` room for thinking + reply and append (replace `[max_tokens]` with the actual value):

```text wrap
Everything produced in one reply, including any reasoning or drafting done before the reply, counts toward a single limit of about [max_tokens] tokens. If that limit is reached before the reply is finished, the person receives a cut-off response and has to start over. Composing an entire output or deliverable in full as reasoning and then again as a reply would double the length of the turn without improving the result, so don't do that.

Instead, when the person has asked for a long or effort-intensive deliverable such as a multi-section document, a large table or dataset, or a complete code file, spend extra effort on understanding the request, checking the inputs the answer depends on, settling the structure and other difficult decisions, and otherwise using the reasoning space to reason and the output space to write an output. Usually it is not needed to draft an output multiple times.
```

- **Safety classifiers: fewer false positives than at 5 launch**; finding vulnerabilities in source is now permitted. Three triggers remain: compile-check phrasing (ask "are there bugs," not "does this compile"), lesser-known languages (give the model docs/context), base64 in tool output (remove where you can).
- **Client-side compaction:**

```text wrap
Summarize the transcript inside <summary></summary> tags. Include relevant information in the summary such that this conversation will be continued by a new context window without needing to redo work or be reprovided with relevant constraints or context. Be sure to preserve: (1) any difficulties or problems that came up, and how they were handled or resolved; (2) any possibilities, options, or approaches that were raised, tried, or set aside, and why; (3) anything that was asked for, decided, agreed, ruled out, or established as a preference, constraint, or boundary — stated exactly; (4) exactly where things stand now — what has been covered, settled, or completed so far; (5) anything still open, unresolved, promised, or expected to happen next; (6) specific details that would be hard to reconstruct — names, numbers, dates, exact wording, links or references — kept exactly. Be complete on these even at the cost of length; keep everything else concise. Weight the two voices differently: keep what the user said, asked for, shared, or established carefully and close to their own words; your own explanations and reasoning can be condensed much further, to what they concluded or produced — as long as nothing in the six items above is dropped.
```

- **Subagents:** lead should keep working, not block on each subagent — launch tool returns immediately, result arrives in a later `user` message, lead gets a separate tool to wait when it wants to.
- **Vision:** crop-and-zoom tooling gets the most out of dense charts/filings; a plain cropping tool alone delivers most of the uplift if a full container isn't feasible.

## Default persona notes (Fable 5 claude.ai consumer app — community transcript, unverified)

Caveat: from a community-transcribed leaked system prompt, never verified against an Anthropic source; describes the Fable 5 claude.ai consumer app specifically, not Fable 5.1 and not Claude Code.

Useful when emulating Fable 5 or predicting its defaults: warm/constructive tone; minimal formatting — prose for simple questions, bullets only when essential; owns mistakes without over-apologizing; factual information over confident recommendations in legal/financial domains; searches for time-sensitive facts, answers timeless ones from knowledge; declines offensive-cyber and harmful-bio work by design.
