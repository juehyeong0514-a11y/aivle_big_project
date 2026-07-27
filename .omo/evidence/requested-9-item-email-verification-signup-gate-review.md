recommendation: REJECT

## originalIntent

Final gate review for `C:\Users\User\Desktop\aivle_big_project` after the requested 9-item fixes and email-verification signup work. Review must be read-only from the application-source perspective, verify the implementation from artifacts and current source/runtime behavior, and identify blockers only.

## desiredOutcome

The shipped workspace should satisfy the requested remediation set and email-verification signup flow: manager signup requires verified email and ADMIN approval, public/candidate access is invitation-only, one-time invitations remain one-time across restart, public exam and supervisor data leaks are closed, manager reads are organization/status scoped, CORS supports the current frontend origin, tests/build/lint/manual QA support the claims, and current code review evidence covers `remove-ai-slops` and `programming` criteria without unresolved overfit/slop.

## userOutcomeReview

The implementation is not complete. Direct runtime probing confirms several requested fixes now work: unverified signup is rejected, email verification plus manager signup creates a `PENDING` manager, pending login is blocked until ADMIN approval, `GET /api/exams` is blocked, CORS allows `http://localhost:5174`, invitation `usedAt` persists and replay after app restart returns 410, applicant APIs require the candidate access token, invitation previews no longer expose the one-time token, and unassigned/suspended manager scopes return no examinee/candidate data.

However, public invitation preflight still returns the candidate number. That means anyone with the invitation URL can fetch the secret required by `POST /api/invitations/:token/verify`, so the candidate-number check is not an independent proof. The latest evidence set also lacks a current approving code-review report with the required `remove-ai-slops`/`programming` coverage; existing review reports are stale and failing. Direct slop review also finds unresolved oversized changed files.

## blockers

1. Public invitation preflight discloses `candidateNumber`.
   - Source: `backend/src/app.mjs:533-537` returns `{ examName, schedule, candidateNumber: invitation.candidateNumber, expiresAt }` from unauthenticated `GET /api/invitations/:token`.
   - Runtime probe: `preflightKeys` were `["examName","schedule","candidateNumber","expiresAt"]` and `preflightCandidateNumber` was `AIVLE-1001`.
   - Impact: possession of the invite URL reveals the verification secret, so invitation verification is not truly invitation-plus-out-of-band-candidate-number.

2. Required current approval evidence is missing or stale.
   - Latest `qa-readonly` files contain only `exitCode=` with no command output, so they are not usable proof.
   - The available code-review reports are from the earlier failing state and still recommend changes: `.omo/evidence/admin-governance-manager-invite-code-review.md`, `.omo/evidence/admin-platform-governance-security-code-review.md`, `.omo/evidence/scope-fidelity-gate-review.md`, and `.omo/evidence/role-access-flow-gate-review.md`.
   - No current code-review report explicitly approves the latest 9-item/email-verification work with supported `remove-ai-slops` and `programming` overfit/slop coverage.

3. Direct `remove-ai-slops`/`programming` pass finds unresolved oversized changed files.
   - Measured pure LOC: `backend/src/app.mjs` 608, `frontend/src/styles/main.css` 1091, `frontend/src/pages/ExamCheckPage.jsx` 375.
   - These exceed the consulted 250 pure-LOC ceiling and remain multi-responsibility/maintenance-risk areas in changed production code.
   - Existing stale reports already flagged this class for `backend/src/app.mjs`; the latest implementation increased the issue rather than closing it.

4. Tests are too narrow for the remaining secret-disclosure class.
   - `backend/test/api.test.mjs` passes 7 tests, but no test asserts that public invitation preflight omits `candidateNumber`.
   - The suite can pass while blocker 1 remains present, so the tests do not support approval of the invitation-security outcome.

## checkedArtifactPaths

- `C:\Users\User\Desktop\aivle_big_project\.debug-journal.md`
- `C:\Users\User\Desktop\aivle_big_project\.omo\plans\role-access-flow.md`
- `C:\Users\User\Desktop\aivle_big_project\.omo\evidence\admin-governance-manager-invite-code-review.md`
- `C:\Users\User\Desktop\aivle_big_project\.omo\evidence\admin-platform-governance-security-code-review.md`
- `C:\Users\User\Desktop\aivle_big_project\.omo\evidence\scope-fidelity-gate-review.md`
- `C:\Users\User\Desktop\aivle_big_project\.omo\evidence\role-access-flow-gate-review.md`
- `C:\Users\User\Desktop\aivle_big_project\.omo\evidence\qa-readonly\session.txt`
- `C:\Users\User\Desktop\aivle_big_project\.omo\evidence\qa-readonly\backend-npm-test.txt`
- `C:\Users\User\Desktop\aivle_big_project\.omo\evidence\qa-readonly\frontend-npm-lint.txt`
- `C:\Users\User\Desktop\aivle_big_project\.omo\evidence\qa-readonly\frontend-npm-build.txt`
- `C:\Users\User\Desktop\aivle_big_project\.omo\evidence\current-app-qa\*`
- `C:\Users\User\Desktop\aivle_big_project\backend\src\app.mjs`
- `C:\Users\User\Desktop\aivle_big_project\backend\src\store.mjs`
- `C:\Users\User\Desktop\aivle_big_project\backend\src\seed.mjs`
- `C:\Users\User\Desktop\aivle_big_project\backend\test\api.test.mjs`
- `C:\Users\User\Desktop\aivle_big_project\frontend\src\App.jsx`
- `C:\Users\User\Desktop\aivle_big_project\frontend\src\pages\HomePage.jsx`
- `C:\Users\User\Desktop\aivle_big_project\frontend\src\pages\InvitePage.jsx`
- `C:\Users\User\Desktop\aivle_big_project\frontend\src\pages\ExamCheckPage.jsx`
- `C:\Users\User\Desktop\aivle_big_project\frontend\src\pages\ExamSessionPage.jsx`
- `C:\Users\User\Desktop\aivle_big_project\frontend\src\pages\StaffAuthPage.jsx`
- `C:\Users\User\Desktop\aivle_big_project\frontend\src\api\client.js`
- `C:\Users\User\Desktop\aivle_big_project\frontend\src\styles\main.css`

## verificationPerformed

- Loaded and applied `omo:remove-ai-slops` and `omo:programming` criteria directly.
- `cd backend; node --test`: PASS, 7 tests, 0 failed.
- `cd frontend; node node_modules\vite\bin\vite.js build`: PASS.
- `cd frontend; node node_modules\oxlint\bin\oxlint .`: PASS exit code with warnings.
- Fresh temp-database adversarial probe:
  - public exams: 403
  - CORS 5174 preflight: 204, `Access-Control-Allow-Origin: http://localhost:5174`, methods `GET,POST,PATCH,OPTIONS`
  - unverified signup: 400
  - email verification send/confirm/signup: 201/200/201
  - pending manager login before approval: 403
  - admin approval then manager login: 200/200
  - unassigned manager `/api/supervisor/examinees`: 200 with 0 rows
  - invitation preview exposed no `oneTimeToken`
  - public invitation preflight exposed `candidateNumber`
  - wrong candidate number verify: 401
  - correct verify: 200
  - applicant session/exam with token: 200/200, question answers not leaked
  - applicant session without token: 401
  - replay after app restart: 410
  - suspended org manager candidate/examinee reads: 200 with 0 rows

## exactEvidenceGaps

- The original 9-item checklist was not present as a standalone artifact in the workspace; I reconstructed it from `.debug-journal.md`, the plan, stale review reports, source, and QA evidence.
- No current manual QA matrix specifically covers the latest 9-item/email-verification pass.
- No current approving code-review report covers the latest source state with required `remove-ai-slops`/`programming` overfit/slop criteria.
- No automated regression proves unauthenticated invitation preflight omits `candidateNumber`.
- No automated regression proves invitation replay remains rejected after recreating the app from the same database file, although the fresh manual probe did verify that behavior.
