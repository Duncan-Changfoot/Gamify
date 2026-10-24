# Gamify

Offline games for a 4-year-old on long trips. A web app (PWA) with no build step: `index.html` loads
`src/main.js`, which loads every game in `src/games/`. See `README.md` to run it and `DECISIONS.md`
for why it is built this way.

- `npm run serve` serves it on the LAN (port 8080).
- `npm test` plays every game in Chromium and WebKit (Playwright) and checks offline mode.
- When you add or rename a file the page loads, add it to `FILES` in `sw.js`. The test fails until you do.

## How to work

- Before you write any logic, name the core data shape first: the types, the structures, and what
  concurrent parts share.
- Make the smallest change that solves the problem. Lean towards deleting code, and don't add layers or
  abstractions you don't need.
- Remove dead or redundant code first, then build on the simpler base.
- When a new requirement arrives, redesign as if it had been there from day one instead of bolting it on.
- For any non-trivial job, build a tool that does or proves the work (a script, codemod or generator)
  rather than doing it by hand.
- If a question can be answered by running something (behaviour, timing, layout, output), build a quick
  throwaway prototype and let the result decide. Only ask the human about real product or preference
  choices.
- For a novel design decision with no precedent, build two or three competing prototypes and compare them.
- Choose what's best for the user over what's easiest to build.

## Architecture

- Put the domain into a structure such as a state machine, typed model, lookup table or reducer, instead
  of scattered if-statements.
- Validate and handle errors at system boundaries, trust internal types, and keep business logic pure.
- Design types so illegal states can't be represented, and parse outside data at the boundary.
- Make commands and loops idempotent, so running them again after a crash or retry ends in the same state.
- When you replace an internal API, migrate every caller and delete the old one in the same change.
- If several workers might write the same file, branch or key, remove the sharing before you add locking.

## Verification

- Nothing is done until it's proven against the real thing, such as the running app in a real browser.
  "It compiles" doesn't count.
- When debugging, reproduce the bug first, then fix the root cause where things first went wrong, not
  just the symptom.
- Break multi-step work into small units that each end in a check, and verify each one before starting
  the next.
- Tests should check what users can observe, not internal details.
- Before trusting or reporting a measured number, explain what limits it and rule out that it measured
  the wrong thing.
- If two fixes based on the same assumption fail, stop and test that assumption directly.

## Before committing and reviewing

- Do a cleanup pass to strip AI-generated clutter and messy code style.
- Keep a comment only when it explains a non-obvious why that the code can't show.
- For contested designs, get an adversarial review from a second model before shipping.

## Autonomy

- Just do reversible work without asking, then show the result and let the human correct it.
- Always stop and ask before anything irreversible, such as force-pushing to shared branches, deploying,
  deleting data or messaging customers.
- Give honest judgement, and push back when something doesn't earn its place.

## Reporting back

- Use short, plain sentences.
- Say who the change is for and what changes for them before going into implementation details.
- Label every claim as measured, inferred or a guess, and never invent links or citations.
- For long or unattended runs, keep a decision log so you can review it later (`DECISIONS.md`).

## Splitting work with colleagues

Split specs into independent sections that each end in their own check, so several people can each build
one in parallel on separate Claude accounts without stepping on each other.
