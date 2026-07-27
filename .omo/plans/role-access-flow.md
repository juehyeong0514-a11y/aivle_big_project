# role-access-flow - Work Plan

## TL;DR (For humans)
<!-- Fill this LAST, after the detailed plan below is written, so it summarizes the REAL plan. -->
<!-- Plain English for a non-engineer: NO file paths, NO todo numbers, NO wave/agent/tool names. -->

**What you'll get:** ADMIN can review organizations, create managers, assign approved organizations, and see platform-wide summaries. MANAGER can work within assigned organizations to register candidates, create exams, assign candidates, preview/send invitation mail, monitor participants, and manage results, while candidates enter only through a one-time invitation link and candidate number.

**Why this approach:** The persisted role becomes `MANAGER` to match the product language, with a narrow legacy `SUPERVISOR` compatibility path. Invitation records remain provider-neutral so the required mail payload and one-time token behavior are observable without inventing SMTP credentials.

**What it will NOT do:** It will not add candidate self-signup, role-selection login, or a candidate result page. It will not implement production SMTP, WebRTC, or AI analysis engines.

**Effort:** Large
**Risk:** Medium - several role-scoped flows share the JSON store and existing legacy screens
**Decisions I made for you:** Manager accounts are created by ADMIN, organization requests are explicit records, candidate numbers are generated server-side, and invitation sending records a mail preview with a one-time token.

Your next move: Review the delivered screens and replace the provider-neutral mail preview with the production mail adapter when credentials and provider policy are available. Full execution detail follows below.

---

> TL;DR (machine): Large / medium risk / add role-scoped organization governance, manager workspace, and invitation-only candidate entry across Express + React.

## Scope
### Must have
- API-backed organization lifecycle and manager assignment
- organization-scoped manager access enforcement
- manager candidate registration and invitation preview/send flow
- candidate invitation verification and preflight handoff without signup
- ADMIN, MANAGER, and candidate-facing labels and navigation matching the product spec
- backend regression tests plus production frontend build/lint
### Must NOT have (guardrails, anti-slop, scope boundaries)
- no applicant self-registration or role selection login
- no candidate result page
- no destructive database reset or provider credentials

## Verification strategy
> Zero human intervention - all verification is agent-executed.
- Test decision: tests-after + Node `node:test` API integration tests and browser-driven manual QA
- Evidence: .omo/evidence/task-<N>-role-access-flow.<ext>

## Execution strategy
### Parallel execution waves
> Target 5-8 todos per wave. Fewer than 3 (except the final) means you under-split.

### Dependency matrix
| Todo | Depends on | Blocks | Can parallelize with |
| --- | --- | --- | --- |
| 1 | discovery complete | 2, 3 | none |
| 2 | 1 | 4 | 3 |
| 3 | 1 | 4 | 2 |
| 4 | 2, 3 | 5 | none |
| 5 | 4 | F1-F4 | none |

## Todos
> Implementation + Test = ONE todo. Never separate.
<!-- APPEND TASK BATCHES BELOW THIS LINE WITH edit/apply_patch - never rewrite the headers above. -->
- [x] 1. Establish design contract and feature topology
  What to do / Must NOT do: Codify the existing light operational-console tokens, shared primitives, accessibility constraints, and the approved role/invitation boundaries in `DESIGN.md`; do not introduce a second visual system.
  Parallelization: Wave 1 | Blocked by: none | Blocks: 2, 3
  References (executor has NO interview context - be exhaustive): `frontend/src/styles/main.css`, `frontend/src/components/Header.jsx`, `frontend/src/pages/HomePage.jsx`, `frontend/src/admin/*`, `frontend/src/supervisor/*`
  Acceptance criteria (agent-executable): `DESIGN.md` exists with all 8 required sections and documents the new role workspace primitives.
  QA scenarios (name the exact tool + invocation): inspect `DESIGN.md` and compare tokens to existing CSS; Evidence `.omo/evidence/task-1-role-access-flow.md`
  Commit: N | docs(frontend): document role workspace design contract
- [ ] 2. Add organization, manager, candidate, exam assignment, and invitation storage/API
  What to do / Must NOT do: Extend `backend/src/store.mjs`, `backend/src/seed.mjs`, and `backend/src/app.mjs` with authenticated role-scoped endpoints and default-array migration; do not expose password hashes or allow manager access outside assigned organizations.
  Parallelization: Wave 2 | Blocked by: 1 | Blocks: 4
  References (executor has NO interview context - be exhaustive): `backend/src/app.mjs`, `backend/src/store.mjs`, `backend/src/seed.mjs`, `backend/test/api.test.mjs`
  Acceptance criteria (agent-executable): `cd backend; npm test` passes and tests cover approval, assignment, org isolation, candidate-number generation, and one-time invitation verification.
  QA scenarios (name the exact tool + invocation): Node `node:test` via `npm test`; direct `fetch` happy/failure scenarios; Evidence `.omo/evidence/task-2-role-access-flow.json`
  Commit: N | feat(backend): add organization and invitation governance APIs
- [ ] 3. Add ADMIN and MANAGER workspaces plus invitation entry page
  What to do / Must NOT do: Add role-specific React tabs, API client calls, navigation, and `/invite/:token` entry; remove applicant signup and result navigation; preserve existing monitoring screens through compatibility labels/routes.
  Parallelization: Wave 2 | Blocked by: 1 | Blocks: 4
  References (executor has NO interview context - be exhaustive): `frontend/src/App.jsx`, `frontend/src/pages/AuthPage.jsx`, `frontend/src/pages/HomePage.jsx`, `frontend/src/components/Header.jsx`, `frontend/src/styles/main.css`
  Acceptance criteria (agent-executable): `cd frontend; npm run build` and `npm run lint` pass; visible admin/manager/invite flows call the live API.
  QA scenarios (name the exact tool + invocation): Playwright/Chrome or in-app browser at 375/768/1280px; verify admin approval, manager workspace, and invite page; Evidence `.omo/evidence/task-3-role-access-flow/`
  Commit: N | feat(frontend): add role workspaces and invite entry
- [ ] 4. Integrate data contracts and legacy compatibility
  What to do / Must NOT do: Re-read all changed files, fix API response mismatches, ensure `SUPERVISOR` legacy sessions can still reach monitoring routes while new UI calls them MANAGER; do not broaden scope into AI or WebRTC implementation.
  Parallelization: Wave 3 | Blocked by: 2, 3 | Blocks: 5
  References (executor has NO interview context - be exhaustive): changed backend and frontend files, existing `frontend/src/supervisor/*`, `frontend/src/api/client.js`
  Acceptance criteria (agent-executable): backend tests, frontend build, and lint all exit 0; no changed file has LSP diagnostics.
  QA scenarios (name the exact tool + invocation): `npm test`, `npm run build`, `npm run lint`, LSP diagnostics; Evidence `.omo/evidence/task-4-role-access-flow.md`
  Commit: N | fix(integration): reconcile role-scoped data contracts
- [ ] 5. Run independent review and real browser QA
  What to do / Must NOT do: Run fresh browser evidence for every requested role surface, review-work/debugging audit, and two independent visual QA reviewers; fix blocking findings before completion.
  Parallelization: Wave 4 | Blocked by: 4 | Blocks: F1-F4
  References (executor has NO interview context - be exhaustive): `frontend/src/App.jsx`, `frontend/src/pages/AuthPage.jsx`, `frontend/src/pages/HomePage.jsx`, new role workspace components, new invitation page
  Acceptance criteria (agent-executable): independent reviewer PASS on fresh captures; backend/API and frontend gates remain green.
  QA scenarios (name the exact tool + invocation): Playwright/Chrome real browser at mobile/tablet/desktop widths, `review-work`, `debugging` runtime audit; Evidence `.omo/evidence/task-5-role-access-flow/`
  Commit: N | test(e2e): verify role and invitation workflows

## Final verification wave
> Runs in parallel after ALL todos. ALL must APPROVE. Surface results and wait for the user's explicit okay before declaring complete.
- [ ] F1. Plan compliance audit
- [ ] F2. Code quality review
- [ ] F3. Real manual QA
- [ ] F4. Scope fidelity

## Commit strategy

No commit unless explicitly requested by the user. Keep the working tree changes grouped by backend contract, frontend surface, and verification artifacts.

## Success criteria

Every requested role boundary is observable in the UI and enforced by the API, candidate access is invitation-only, no candidate result page is present, tests/build/lint pass, and fresh browser evidence demonstrates the three role surfaces.
