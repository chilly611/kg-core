# Showing kg-core — the walkthrough kit

*For presenting the built system to John, Rich, or anyone who was in the 06-30 architecture conversation. Two assets:*

1. **Shareable overview page** — <https://kgcore-walkthrough.vercel.app> (also committed as `docs/walkthrough.html`). Send it before or after the meeting; it maps the whiteboard model to the built system with receipts, including the real role-lens screenshots.
2. **This runbook** — the 15-minute live demo, beat by beat, with the talk track.

The live demo runs **locally against the seeded fixture** — full loop, no credentials, no cloud dependency, nothing can break. The hosted URL appears only in the closing beat, where its locked door is the point.

---

## Prep — one command, from any directory

```sh
bash ~/Developer/kg-core/scripts/demo.sh --reset
```

Then open **http://localhost:3000/workspace**. That's it — the script stops any stale dev server, brings up the seeded local Postgres, resets to the pristine fixture, and starts the app signed in as the fixture admin of **Harborline Property Management** (fake, Ryan-shaped: 8 projects, 12 contacts, 2 groups, a lapsed lease, a dream project with no street).

Only prerequisite: the `~/Developer/kg-core` checkout is on `main` and current (`git -C ~/Developer/kg-core checkout main && git -C ~/Developer/kg-core pull`).

Keep a second browser tab on <https://kgcore-eight.vercel.app> for the close, and this file open for the beats. If anything looks off mid-demo, rerun the same command — pristine fixture in seconds, and that safety is itself demo-worthy.

---

## The script — ten beats, ~90 seconds each

Tags: **[F]**rictionless · **[S]**calable · **[U]**ser-friendly · **[R]**isk-free

**1. The trust surface — reconciliation chips. [U][R]**
Open `/workspace`, Projects tab. Point at the chip: **"8 of 8 expected."**
*Say: "Expected-versus-actual is on every grid. If an import misses a row, that chip goes amber — a visible flag, never a silent gap. This is how a property manager trusts the record without auditing it."*

**2. Grid-first, no drill-downs. [U]**
Flip through Projects · Contacts · Groups · Users. Filter by status; show inactive hidden by default, one click to reveal. Inline-edit a project name.
*Say: "Recurring actions never hide behind navigation — that was the four-locks lesson from the design call. Everything is reachable from the grid."*

**3. Bulk vendor reassign — the exact scenario from the call. [U][F]**
Select the vendor's rows across projects (fixture: Bayline spans 3 projects), end-date them, create replacement links to another contact in one action.
*Say: "Contractor leaves, new one takes over everywhere — one transaction, history retained, nothing deleted."*

**4. The detail rail — the model made visible. [S]**
Open a project rail: address card (raw input + normalized parts), active contacts with lease dates, the lapsed lessee collapsed under inactive history, documents with one lock-marked agreement, and the Journey + Budget slots.
*Say: "Notice there's no 'tenant' anywhere — a tenant is a contact in a time-bound lessee relationship. Turnover is a date. That's the category-agnostic core: property management today, any vertical as data rows tomorrow."*

**5. Spreadsheet import — the onboarding motion. [F]**
Go to `/workspace/import`. Drop `tests/fixtures/harborline-import.xlsx`. Walk the preview grid (creates / updates / conflicts color-coded), commit, and point at the **leverage stat** ("N records in M s of your time").
*Say: "This is the pilot's day one: the client sends a spreadsheet, we import, they verify. Zero required data entry on their side."*
Then **drop the same file again** → updates, not duplicates.
*Say: "Idempotent — the spreadsheet is a safety net, not a hazard."*

**6. Contact card + typed sentence. [F]**
Drop `tests/fixtures/kai-rivera.vcf` → preview → commit. Then the quick-capture box: *"New project at 59 Bay Vista, tenant Jane Doe jane@x.com 415-555-0100, lease starts Aug 1"* → preview → commit.
*Say: "Four ways in, one review pattern. Nothing auto-commits — a human always sees the preview."* (Without an Anthropic key the parser is a labeled heuristic for simple sentences; with a key it's Claude. Say whichever is true on your machine.)

**7. Financial truth — double-entry, enforced by the database. [R]**
In a project rail's Budget slot: post an expense, approve a pending change order (watch budget move), then undo — and point out the undo is a **reversal entry**, not a deletion.
*Say: "Money is double-entry; the database itself rejects an unbalanced write. Corrections are reversals, so the audit trail is never rewritten. The view reconciles to the penny or it raises before rendering a wrong number."*

**8. The journey — time machine on real data. [S]**
Scrub the Journey slot: moments from the events stream, spans from relationship windows.
*Say: "The timeline is generated from data — events and dated relationships — not from hardcoded stages. Same engine, any category."*

**9. The role lens — the risk story's money shot. [R]**
Flip to the read-only-without-budgets user (one command, keeps the data):

```sh
bash ~/Developer/kg-core/scripts/demo.sh --as readonly
```

Reload the same project: the Budget slot, the money moments in the journey, and the gated agreement are gone. (`--as admin` flips back.)
*Say: "Same project, different grant. And this isn't the UI hiding things — the rows never leave Postgres. Row-level security is on every table and proven by the SQL test suite. When we ran the lens pass, it caught a real leak — money surfacing in the journey for budget-less grants — and the gate was fixed before merge. The tests are how we know, not how we hope."*

**10. The hosted close — the locked front door. [R]**
Switch to <https://kgcore-eight.vercel.app>.
*Say: "Same code, deployed. An unauthenticated visitor gets nothing — every API refuses before touching data. Sign-in is the next unlock (Auth0), and until it exists the door stays shut. Fail-closed is the default posture."*
Optionally show the hosted proof from a terminal: `scripts/db-test.sh` locally, and note the same suite runs green against the hosted dev database.

---

## The honest status slide (say it before they ask)

- **Done:** model locked (G0) · schema live + tested on hosted dev (G1) · all four surface lanes merged (grids, intake, ledger/journey/documents) · deployed, fail-closed.
- **The unlock:** Ryan's spreadsheet + expected counts → G2 (his real tree at 100% reconciliation). The import path is built and waiting.
- **Next founder actions:** Auth0 tenant (hosted sign-in demo becomes possible) · Ryan's data · triage + address-API picks from the Cowork memos.

## Q&A ammo

- **"Why is there no tenant table?"** — A tenant is a contact in a time-bound `lessee` relationship. Turnover is a date change; history is retained; reactivation is one edit. Nothing category-specific lives in the schema (the Rubicon rule).
- **"Where does construction go when BKG needs it?"** — As rows: `contact_types` / `list_values` with a category column, registered `attrs` keys via `attribute_defs`. Never new columns, never new schema.
- **"How do we know RLS actually holds?"** — SQL tests assert a second client's user sees zero Harborline rows, module gates hold, and the ledger rejects unbalanced writes — 14/14 green locally **and** against the hosted dev project.
- **"What does it cost to serve?"** — Every user/operator/machine action writes an event with actor and duration. The margin lives in the machine doing the labor, and we can watch it from day one.
- **"Can this touch our production data?"** — No. The connection layer hard-refuses the shared production project ref at boot, and the deploy script refuses env that resolves to it.
