---
name: prompting-fable-5
description: Prompting and scaffolding reference for Claude Fable 5 / Mythos 5 — use when writing system prompts, agent harnesses, skills, or API integrations that target Fable 5, tuning effort levels, handling refusals/fallback, designing subagent/memory/send-to-user scaffolding, or migrating prompts from Opus-era models. Not for ordinary coding tasks (that's fable-coding).
---

# Prompting Claude Fable 5 (framework reference)

Distilled from Anthropic's official guide
(`platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-fable-5`).
Use the snippet blocks verbatim — they are Anthropic's tested wording.

## Model shape (what you're prompting)

- Fable 5 = Mythos-class tier above Opus; Mythos 5 is the same model without the extra safety measures (approved orgs only).
- Aim it at the top of your difficulty range: hours-to-weeks, end-to-end work. Testing only simple workloads undersells it; it still handles routine tasks fine.
- Improved vs Opus 4.8: long-horizon autonomy, first-shot correctness on well-specified problems, dense-image vision, enterprise docs/spreadsheets, code review & debugging recall, ambiguity navigation, parallel-subagent management.
- Safety classifiers target offensive cyber, biology/life sciences, and reasoning-extraction; benign work can trip them. Handle `stop_reason: "refusal"` with automatic fallback to Opus 4.8.
- API differences: adaptive thinking only, summarized-only thinking output, no extended-thinking budgets.

## Effort — the primary knob

`high` default, `xhigh` for capability-sensitive work, `medium`/`low` for routine (low effort on Fable 5 often still beats prior models' xhigh). Turns run minutes-to-hours: raise client timeouts, stream, show progress, prefer async check-ins over blocking.

Anti-overplanning snippet (for ambiguous tasks):

```text
When you have enough information to act, act. Do not re-derive facts already established in the conversation, re-litigate a decision the user has already made, or narrate options you will not pursue in user-facing messages. If you are weighing a choice, give a recommendation, not an exhaustive survey. This does not apply to thinking blocks.
```

Anti-overbuilding snippet (higher effort tends to tidy/refactor unasked):

```text
Don't add features, refactor, or introduce abstractions beyond what the task requires. A bug fix doesn't need surrounding cleanup and a one-shot operation usually doesn't need a helper. Don't design for hypothetical future requirements: do the simplest thing that works well. Avoid premature abstraction and half-finished implementations. Don't add error handling, fallbacks, or validation for scenarios that cannot happen. Trust internal code and framework guarantees. Only validate at system boundaries (user input, external APIs). Don't use feature flags or backwards-compatibility shims when you can just change the code.
```

## Instruction following — brief beats enumerated

Fable 5 steers off one short instruction; don't list every case. Brevity/readability:

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

Fable 5 delegates readily and manages long-running subagents well. Prefer async orchestrator↔subagent communication over blocking; long-lived subagents keep cache-warm context.

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

- **Early stopping** (turn ends on "I'll now run X" with no tool call, or asks permission it doesn't need). For autonomous pipelines:

```text
You are operating autonomously. The user is not watching in real time and cannot answer questions mid-task, so asking "Want me to…?" or "Shall I…?" will block the work. For reversible actions that follow from the original request, proceed without asking. Offering follow-ups after the task is done is fine; asking permission before doing the work is not. Before ending your turn, check your last paragraph. If it is a plan, an analysis, a question, a list of next steps, or a promise about work you have not done ("I'll…", "let me know when…"), do that work now with tool calls. End your turn only when the task is complete or you are blocked on input only the user can provide.
```

- **Context-budget anxiety** (suggests new session / trims work when shown a token countdown). Hide remaining-token counts if possible; else:

```text
You have ample context remaining. Do not stop, summarize, or suggest a new session on account of context limits. Continue the work.
```

## Give the reason, not only the request

Fable 5 performs better knowing intent: `I'm working on [the larger task] for [who it's for]. They need [what the output enables]. With that in mind: [request].`

## Readability addendum (agentic sessions)

```text
Terse shorthand is fine between tool calls (that's you thinking out loud, and brevity there is good). Your final summary is different: it's for a reader who didn't see any of that.

If you've been working for a while without the user watching (overnight, across many tool calls, since they last spoke), your final message is their first look at any of it. Write it as a re-grounding, not a continuation of your working thread: the outcome first, then the one or two things you need from them, each explained as if new. The vocabulary you built up while working is yours, not theirs; leave it behind unless you re-introduce it.

When you write the summary at the end, drop the working shorthand. Write complete sentences. Spell out terms. Don't use arrow chains, hyphen-stacked compounds, or labels you made up earlier. When you mention files, commits, flags, or other identifiers, give each one its own plain-language clause. Open with the outcome: one sentence on what happened or what you found. Then the supporting detail. If you have to choose between short and clear, choose clear.
```

## send_to_user tool (async agents)

For content the user must see verbatim mid-turn (deliverables, numeric progress, direct answers). Define a client-side tool whose input is rendered directly in the UI:

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

- Re-evaluate every instruction/guardrail: skills written for prior models are often too prescriptive and degrade Fable 5 output — try removing before rewriting.
- Never instruct it to echo/transcribe/explain its internal reasoning in responses — triggers `reasoning_extraction` refusals. Read adaptive-thinking `thinking` blocks instead; audit existing skills for "show your thinking" language.
- Make self-verification explicit on long runs; fresh-context verifier subagents beat self-critique: `Establish a method for checking your own work at an interval of [X] as you build. Run this every [X interval], verifying your work with subagents against the specification.`
- Configure refusal fallback to Opus 4.8 (server- or client-side).
- Raise timeouts, add progress UX, restructure harnesses to check runs asynchronously.

## Default persona notes (from Fable 5's production system prompt)

Useful when emulating Fable 5 or predicting its defaults: warm/constructive tone; minimal formatting — prose for simple questions, bullets only when essential; owns mistakes without over-apologizing; factual information over confident recommendations in legal/financial domains; searches for time-sensitive facts, answers timeless ones from knowledge; declines offensive-cyber and harmful-bio work by design.
