# Admin Governance / Manager Invite Code Review

Date: 2026-07-23
Reviewer: Codex code quality reviewer, read-only
Status: FAIL
Recommendation: REQUEST_CHANGES

## Scope And Input Completeness

Reviewed goal: implement ADMIN platform governance, organization approval and manager assignment, manager organization-scoped candidate/exam/invitation management, and invitation-only candidate entry/preflight. Candidate self-signup, role-selection applicant login, and candidate result page are excluded. Existing supervisor monitoring routes must remain compatible.

Changed scope inspected:

- `backend/src/app.mjs`
- `backend/src/store.mjs`
- `backend/src/seed.mjs`
- `backend/test/api.test.mjs`
- `frontend/src/App.jsx`
- `frontend/src/components/Header.jsx`
- `frontend/src/pages/HomePage.jsx`
- `frontend/src/admin/AdminGovernanceTab.jsx`
- `frontend/src/manager/ManagerWorkspaceTab.jsx`
- `frontend/src/pages/InvitePage.jsx`
- `frontend/src/pages/StaffAuthPage.jsx`
- `frontend/src/styles/main.css`
- `DESIGN.md`
- Existing related files consulted: `frontend/src/pages/ExamCheckPage.jsx`, `frontend/src/applicant/CheckTab.jsx`, `frontend/src/applicant/ResultTab.jsx`, `frontend/src/admin/UserMgmtTab.jsx`, `frontend/vite.config.js`

Input gaps: no full diff artifact and no notepad path were provided. I reconstructed the diff from the worktree with `git diff` and inspected `.debug-journal.md` because it existed, but treated all prior evidence as untrusted.

## Skill Perspective Check

Required skill-perspective check ran.

- Loaded `omo:remove-ai-slops` from `C:/Users/User/.codex/plugins/cache/sisyphuslabs/omo/4.16.1/skills/remove-ai-slops/SKILL.md`.
- Loaded `omo:programming` from `C:/Users/User/.codex/plugins/cache/sisyphuslabs/omo/4.16.1/skills/programming/SKILL.md`.
- Also consulted `programming/references/typescript/README.md` and `programming/references/code-smells.md`.

Violations found from those perspectives:

- `remove-ai-slops`: current tests give false confidence for one-time invitations because they only test same-process memory reuse, not persisted reuse after restart.
- `remove-ai-slops` / `programming`: `backend/src/app.mjs` is 295 pure LOC after the change and now owns auth, admin governance, manager orgs, candidates, exams, invitations, and supervisor monitoring.
- `programming`: `frontend/src/styles/main.css` is 1012 pure LOC and was expanded in-place; this is a maintainability defect under the consulted code-smell criteria.

## Findings By Severity

### CRITICAL

1. One-time invitation tokens are reusable after backend restart.

- Code: `backend/src/app.mjs:280-287` mutates `invitation.usedAt` directly in memory but does not call `store.updateInvitation`.
- Persistence API exists: `backend/src/store.mjs:135-140` persists invitation patches, but the verify route does not use it.
- Test gap: `backend/test/api.test.mjs:81-84` only verifies reuse in the same process.
- Probe evidence: after verifying an invite, the database still had `usedAt: null`; restarting `createApp` against the same database allowed the same token to verify again with HTTP `200`.
- Blocking impact: the "one-time token" requirement is not met durably.

2. Candidate preflight is not invitation-only.

- Route: `frontend/src/App.jsx:39-40` exposes `/exam/check` directly.
- Preflight page: `frontend/src/pages/ExamCheckPage.jsx:15-42` initializes local device-check state and does not read or require `candidateAccessToken`.
- Invite handoff: `frontend/src/pages/InvitePage.jsx:14-15` stores `candidateAccessToken`, then navigates to `/exam/check`, but nothing enforces that token on the destination.
- Blocking impact: anyone can open the preflight route without an invitation, so "invitation-only candidate entry/preflight" is not satisfied.

### HIGH

1. Invitation send silently accepts invalid or out-of-scope candidate IDs.

- Code: `backend/src/app.mjs:263-276` filters candidate IDs by exam organization and returns `201` with whatever remains; unlike assignment, it does not compare `candidates.length` to `candidateIds.length`.
- Probe evidence: sending invitations for `candidateIds: ["candidate-1"]` against another organization's exam returned HTTP `201`, `count: 0`, and `mailPreviews: []`.
- Blocking impact: manager invitation management is not strictly organization-scoped at the API contract; bad requests can appear successful.

2. Backend feature code is oversized and multi-responsibility.

- Code: `backend/src/app.mjs` measured 295 pure LOC.
- The file now mixes auth, admin governance, organization lifecycle, manager candidate/exam/invitation operations, candidate invite entry, and supervisor monitoring.
- Impact: this violates the consulted `remove-ai-slops` and `programming` code-smell criteria and makes future lifecycle/security changes brittle.

### MEDIUM

1. Candidate result page remains directly renderable despite being excluded.

- Code: `frontend/src/pages/HomePage.jsx:20` imports `ResultTab`; `frontend/src/pages/HomePage.jsx:117` renders it when `?tab=RESULT`.
- The header removed the visible Result tab, but direct navigation still exposes the static candidate result view.
- Impact: the excluded result flow is mostly hidden, not actually excluded.

2. Tests are relevant but incomplete around the riskiest contracts.

- Good coverage exists for signup rejection, basic admin/manager lifecycle, same-process invitation reuse, and manager candidate out-of-scope create rejection.
- Missing coverage: invitation `usedAt` persistence, restart reuse, direct preflight access without invite token, invalid/out-of-scope candidate IDs on invitation send, expired token behavior, wrong candidate number behavior, and supervisor route compatibility.

### LOW

1. Guest header still says "로그인 / 회원가입" while signup is intentionally blocked.

- Code: `frontend/src/components/Header.jsx` retains the guest navigation label.
- Impact: minor UX contradiction with the excluded self-signup flow.

2. Backend CORS is hard-coded to `http://localhost:5173`.

- Code: `backend/src/app.mjs:43`.
- Vite dev proxy means the requested `5174` smoke still works through `/api`, but direct browser calls from `5174` to backend `3000` would fail CORS.

## Requirement Matrix

| Requirement | Result | Evidence |
|---|---|---|
| ADMIN platform governance | PASS for core governance | Admin overview/org/managers APIs at `backend/src/app.mjs:83-139`; UI loads overview/orgs/managers at `frontend/src/admin/AdminGovernanceTab.jsx:15-24`. |
| Organization approval lifecycle | PASS | Manager creates `PENDING` org at `backend/src/app.mjs:175-181`; admin status/approve/reject routes at `backend/src/app.mjs:119-121`; manager assignment requires approved status at `backend/src/app.mjs:122-135`. |
| ADMIN manager assignment | PASS | Backend assignment updates org `managerIds` and user `organizationIds` at `backend/src/app.mjs:130-133`; UI invokes assign at `frontend/src/admin/AdminGovernanceTab.jsx:36-42`. |
| Manager organization-scoped candidate management | PASS for create/list | Scope helper at `backend/src/app.mjs:186`; candidate list/create enforce assigned org at `backend/src/app.mjs:187-203`; test rejects out-of-scope create at `backend/test/api.test.mjs:68-69`. |
| Manager organization-scoped exam management | PASS for create/list/assign | Exam list/create scoped at `backend/src/app.mjs:223-234`; assignment rejects cross-org candidates at `backend/src/app.mjs:243-258`. |
| Manager invitation management | FAIL | Mail preview fields exist at `backend/src/app.mjs:272-274`, but invalid/out-of-scope candidate IDs return successful zero-send responses at `backend/src/app.mjs:263-276`. |
| Invitation mail fields | PASS for preview fields | Preview includes `to`, `examName`, `schedule`, `entryLink`, `candidateNumber`, `notice`, `expiresAt`, and `oneTimeToken` at `backend/src/app.mjs:274`; UI displays preview at `frontend/src/manager/ManagerWorkspaceTab.jsx:45`. |
| One-time token | FAIL | Same-process reuse is blocked by mutation, but persisted `usedAt` remains null and token verifies after restart. See CRITICAL finding 1. |
| Invitation-only candidate entry/preflight | FAIL | Invite page stores token at `frontend/src/pages/InvitePage.jsx:14`, but `/exam/check` is a public route at `frontend/src/App.jsx:40` and `ExamCheckPage` does not check the invite token. |
| Candidate self-signup excluded | PASS | Signup returns `403` for valid signup payloads at `backend/src/app.mjs:53-59`; test confirms no new applicant user at `backend/test/api.test.mjs:29-38`. |
| Role-selection applicant login excluded | PASS | Login rejects role `APPLICANT` at `backend/src/app.mjs:65-71`; `StaffAuthPage` exposes only ADMIN/MANAGER role buttons at `frontend/src/pages/StaffAuthPage.jsx:8-12`. |
| Candidate result page excluded | WATCH/FAIL for direct access | Header hides result tab, but direct `?tab=RESULT` still renders `ResultTab` at `frontend/src/pages/HomePage.jsx:117`. |
| Existing supervisor monitoring compatibility | PASS by code inspection | `isManagerRole` accepts `MANAGER` and `SUPERVISOR` at `backend/src/app.mjs:9`; supervisor routes now use `requireManager` at `backend/src/app.mjs:289-294`; frontend keeps legacy monitoring tabs under manager/supervisor role at `frontend/src/pages/HomePage.jsx:76-84`. |

## Verification Commands

- `cd backend && node --test`: PASS, 4 tests, 0 failed.
- `cd frontend && node node_modules/vite/bin/vite.js build`: PASS, built production bundle.
- `cd frontend && node_modules/oxlint/bin/oxlint .`: first run timed out at 120s with no diagnostics; retry completed successfully with exit code 0.
- Runtime smoke: backend `3000` and frontend `5174` both started and responded. Evidence directory: `.omo/evidence/admin-governance-runtime/`.

## Blocking Gaps

- Persist invitation `usedAt` during verification and add a regression that proves verified tokens cannot be reused after backend restart.
- Require invite-derived candidate authorization for `/exam/check` or otherwise remove direct unauthenticated candidate preflight entry.
- Make invitation send reject any invalid, missing, or cross-organization candidate IDs instead of returning `201` with zero previews.

## Final Status

FAIL. The implementation has useful ADMIN/MANAGER scaffolding and green baseline commands, but it does not satisfy the durable one-time-token or invitation-only preflight requirements.
