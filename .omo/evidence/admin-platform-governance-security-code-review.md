# Security Code Review - Admin Governance / Invitation Flow

Result: FAIL  
Recommendation: REQUEST_CHANGES  
Code quality status: BLOCK  
Date: 2026-07-23

## Scope Reviewed

Changed and referenced files inspected: `backend/src/app.mjs`, `backend/src/store.mjs`, `backend/src/seed.mjs`, `backend/test/api.test.mjs`, `frontend/src/App.jsx`, `frontend/src/components/Header.jsx`, `frontend/src/pages/HomePage.jsx`, `frontend/src/admin/AdminGovernanceTab.jsx`, `frontend/src/manager/ManagerWorkspaceTab.jsx`, `frontend/src/pages/InvitePage.jsx`, `frontend/src/pages/StaffAuthPage.jsx`, `frontend/src/styles/main.css`, `DESIGN.md`.

No explicit notepad path was supplied. Existing `.debug-journal.md` and `.omo/evidence/admin-governance-qa/*` were inspected as untrusted context, then the verification below was rerun directly.

## Required Skill-Perspective Check

- `omo:remove-ai-slops`: ran as a review perspective. The diff does not contain deletion-only tests, but the new API test is a broad happy-path mega-test that gives false confidence for invitation security because it only checks same-process replay and omits restart replay, candidate-number disclosure, public exam leakage, suspended-org reads, and no-scope manager monitoring access.
- `omo:programming`: ran as a review perspective. The diff violates the perspective through an oversized route module (`backend/src/app.mjs`, 306 pure LOC), weak boundary parsing/validation, and route-level authorization branches concentrated in one file.
- `codex-security:security-diff-scan`: loaded and applied as the audit frame. App-only scan tooling was not invoked in this review context.

## Verification Performed

- `cd backend && node --test`: PASS, 4 tests passed.
- `cd frontend && node node_modules/vite/bin/vite.js build`: PASS.
- `cd frontend && node_modules/oxlint/bin/oxlint .`: PASS, no findings.
- Live app smoke on existing ports: `http://127.0.0.1:3000/api/health` PASS, `http://127.0.0.1:5174/` PASS, `http://127.0.0.1:5174/api/health` PASS through Vite proxy.
- Isolated adversarial API probe using the actual Express app and a temp JSON database:
  - No-org manager created by admin could GET `/api/supervisor/examinees`: 200 with 4 records.
  - Manager-created org exam appeared in public GET `/api/exams`, including `questions` and `organizationId`.
  - Public invitation preflight returned `candidateNumber`.
  - POST verify using only the candidate number returned by preflight succeeded.
  - Invitation `usedAt` remained `null` in the persisted database after verify.
  - Restarting the app with the same DB allowed the same invitation token to verify again.
- Direct backend CORS preflight from `Origin: http://localhost:5174` returned `Access-Control-Allow-Origin: http://localhost:5173` and no `Access-Control-Allow-Methods`.

## CRITICAL

None.

## HIGH

### H1 - Invitation one-time use is not durable across restart

Location: `backend/src/app.mjs:291`, `backend/src/app.mjs:296`, `backend/src/store.mjs:135`

`POST /api/invitations/:token/verify` mutates `invitation.usedAt` in memory but never calls `store.updateInvitation()` or otherwise saves the database. Same-process replay is blocked, so `backend/test/api.test.mjs:81` through `backend/test/api.test.mjs:84` passes, but restart replay succeeds because persisted `usedAt` stays `null`.

Impact: an already redeemed invitation token can be reused after process restart, breaking the invitation-only one-time-entry requirement.

Remediation: make verification an async store operation that atomically checks token, expiry, candidate number, and `usedAt`, persists `usedAt` before issuing access, and rejects stale/replayed tokens after restart. Add an integration test that verifies, recreates the app from the same database file, and confirms replay returns 410.

### H2 - Public exam listing leaks organization-scoped manager exams

Location: `backend/src/app.mjs:50`, `backend/src/app.mjs:227`, `backend/src/app.mjs:232`

Manager-created org exams are stored in `store.exams`, and the existing public `GET /api/exams` returns the entire collection. The adversarial probe created an org-scoped exam with private `questions` content and then retrieved it unauthenticated through `/api/exams`.

Impact: exam metadata and potentially question content for organization-specific exams are exposed outside the invitation-only candidate flow.

Remediation: remove org-scoped exams from the public `/api/exams` response, require appropriate auth, or split public catalog data from manager/admin exam records. Never return `questions` on unauthenticated/public routes. Add a regression test that manager-created org exams are absent from public `/api/exams`.

### H3 - Plain managers inherit global supervisor monitoring access

Location: `backend/src/app.mjs:31`, `backend/src/app.mjs:300`, `frontend/src/components/Header.jsx:85`

`requireManager` accepts both `MANAGER` and `SUPERVISOR`, and the supervisor monitoring routes now use it. A newly admin-created manager with no organization assignment successfully fetched all supervisor examinees in the probe.

Impact: an unscoped manager can read global examinee monitoring data, which is PII and operational monitoring state outside the manager's organization-scoped candidate/exam/invitation responsibilities.

Remediation: keep legacy supervisor compatibility with a distinct `SUPERVISOR` authorization path, or bind examinees to organizations and scope reads/warnings to the manager's approved organizations. Do not expose supervisor monitoring tabs/routes to unassigned managers.

### H4 - Invitation preflight discloses the verification secret

Location: `backend/src/app.mjs:285`, `backend/src/app.mjs:289`, `backend/src/app.mjs:294`, `frontend/src/pages/InvitePage.jsx:13`

Public `GET /api/invitations/:token` returns `candidateNumber`, and the verify endpoint accepts that same value as proof. The probe used only the token and the disclosed preflight response to redeem the invitation.

Impact: the candidate-number check is not an independent preflight proof. Anyone with the invite URL can retrieve the answer and verify.

Remediation: preflight should return only non-secret display data, such as exam name, schedule, and expiry. Require the candidate number from the invitation email or another out-of-band secret, rate-limit failed attempts, and do not echo the candidate number before verification.

### H5 - Suspended organizations still expose manager-readable candidate data

Location: `backend/src/app.mjs:186`, `backend/src/app.mjs:187`, `backend/src/app.mjs:281`

Writes use `scopedOrganization()` and require `APPROVED`, but manager read routes use raw `managerOrganizationIds()` without status filtering. After suspending `org-aivle-cs`, the probe confirmed the manager still received candidates for that organization while writes were denied.

Impact: suspension/revocation does not stop PII reads for assigned managers.

Remediation: define one approved-scope helper and use it consistently for manager reads and writes, or explicitly document/read-allow suspended state if that is a business requirement. Add tests for PENDING, REJECTED, and SUSPENDED org reads.

## MEDIUM

### M1 - CORS is hard-coded and incomplete for the stated deployment ports

Location: `backend/src/app.mjs:42`

The backend always sends `Access-Control-Allow-Origin: http://localhost:5173`, while the requested real frontend is on 5174. It also omits `Access-Control-Allow-Methods`, which breaks direct browser preflights for methods such as PATCH outside the Vite proxy path.

Remediation: use an environment-driven allowlist that includes the active frontend origin(s), emit `Vary: Origin`, and include explicit allowed methods and headers.

### M2 - Boundary validation is too weak for security-sensitive routes

Location: `backend/src/app.mjs:7`, `backend/src/app.mjs:108`, `backend/src/app.mjs:177`, `backend/src/app.mjs:229`, `backend/src/app.mjs:268`

Most inputs are checked only for non-empty strings. Server-side email syntax, password policy, organization code uniqueness/format, candidate ID array limits, and invitation expiry bounds are not enforced. `expiresInHours` is coerced with `Number(...) || default`, allowing invalid or extreme values to reach date arithmetic.

Remediation: parse request bodies at the API boundary into explicit schemas with length, email, enum, ID-array, and expiry-range constraints. Reject malformed input with 400 before domain logic.

### M3 - Test coverage is too happy-path for the security claims

Location: `backend/test/api.test.mjs:48`

The main governance test covers the intended flow but not the adversarial cases in this review. Its same-process replay assertion missed durable replay because it never reloads the store from disk.

Remediation: add focused negative integration tests for public exam leakage, invitation restart replay, candidate-number preflight disclosure, no-scope manager supervisor access, suspended-org reads, CORS preflight behavior, and malformed/hostile input.

## LOW

### L1 - Backend app route file is oversized and mixes unrelated security boundaries

Location: `backend/src/app.mjs:36`

`backend/src/app.mjs` is 306 pure LOC and owns public data, auth, admin governance, manager operations, invitations, and supervisor monitoring. This violates the programming skill's 250 LOC ceiling and makes auth boundary review brittle.

Remediation: after the blocking security fixes are covered by tests, split route groups by boundary: public/auth, admin governance, manager organization scope, invitation verification, and supervisor monitoring.

## Blockers

- Persist and atomically enforce invitation one-time use across restarts.
- Stop public `/api/exams` from returning organization-scoped manager exams and `questions`.
- Prevent unassigned/plain managers from reading global supervisor examinee data.
- Remove `candidateNumber` from public invitation preflight responses.
- Apply organization status checks consistently to manager read routes.

Final status: FAIL / BLOCK.
