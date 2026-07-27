# Frontend Flows Code Review

Goal: read-only final review of frontend flows in `C:\Users\User\Desktop\aivle_big_project`, focused on login/signup account-derived UI, admin vs manager navigation, exam detail/monitoring flow, and obvious runtime regressions.

Input completeness: the prompt did not include explicit success criteria, changed-file list, full diff, prior evidence paths, or a notepad path. I treated the current dirty worktree and local verification as the review source of truth.

Skill-perspective check: ran. Consulted `omo:remove-ai-slops`, `omo:programming` plus TypeScript reference, and `omo:frontend` with design/perfection/React perf references. The diff violates the remove-ai-slops/programming perspectives via a false-confidence monitoring test that locks the current disconnected behavior, and via production/debug UI that fakes QR completion instead of exercising the real boundary.

## CRITICAL

None.

## HIGH

1. Newly invited/submitted candidates never enter live monitoring or exam-status data.

- Files: `backend/src/app.mjs:211`, `backend/src/app.mjs:219`, `backend/src/app.mjs:489`, `backend/src/app.mjs:512`, `backend/src/app.mjs:558`, `backend/src/app.mjs:569`, `backend/src/app.mjs:579`, `frontend/src/supervisor/LiveMonitoringTab.jsx:25`, `frontend/src/supervisor/LiveMonitoringTab.jsx:72`, `frontend/src/supervisor/ExamStatusTab.jsx:16`.
- The manager exam detail flow creates candidates, assignments, invitations, and applicant sessions, but no path writes or updates `store.examinees`. Submission only updates the assignment at `backend/src/app.mjs:219-220`. The monitoring endpoints count/read `store.examinees` only, so candidates created through the new exam-detail/invitation flow remain invisible to live monitoring and exam status.
- Isolated API exercise confirmed it: after creating/assigning/inviting `Review Candidate`, `/api/supervisor/examinees?examId=exam-2026-second-half` returned only seeded names `["김응시","이수험"]`; the new candidate did not appear.
- Impact: the core manager detail -> candidate invite -> applicant exam -> monitoring flow is broken for real manager-created exams/candidates.

2. A test locks in the broken monitoring behavior instead of catching it.

- File: `backend/test/api.test.mjs:136`, `backend/test/api.test.mjs:138`, `backend/test/api.test.mjs:146`, `backend/test/api.test.mjs:155`, `backend/test/api.test.mjs:159`.
- The test walks assignment, invitation, applicant verification, and submission, then asserts the manager monitor endpoint has length `0`. That is an implementation-mirroring/false-confidence test for the flow under review: it proves the current data disconnect rather than the intended observable monitoring behavior.
- Impact: future fixes that make invited/submitted candidates visible in monitoring will fail this test, while the current broken frontend monitoring experience is reported as green.

3. Candidate exam pages render the staff/guest header instead of candidate-derived UI.

- Files: `frontend/src/App.jsx:30`, `frontend/src/App.jsx:36`, `frontend/src/App.jsx:59`, `frontend/src/App.jsx:60`, `frontend/src/pages/InvitePage.jsx:14`, `frontend/src/components/Header.jsx:14`, `frontend/src/components/Header.jsx:139`, `frontend/src/components/Header.jsx:153`.
- `/exam/check` and `/exam/session` are candidate-token routes, but `Layout` still renders `Header` there. `InvitePage` stores only `candidateAccessToken`/`candidateNumber`; `Header` derives identity only from staff `userRole`/`userEmail`. A valid candidate therefore sees guest navigation and a "login / signup" button. If a staff user opens an invite while logged in, the candidate exam can show staff/admin/manager navigation while the exam API uses the candidate token.
- Impact: account-derived UI is wrong in the high-stakes exam flow and can mix staff and candidate session state on the same screen.

4. The mobile side-camera QR flow cannot complete across an actual phone/desktop scan.

- Files: `frontend/src/pages/ExamCheckPage.jsx:58`, `frontend/src/pages/ExamCheckPage.jsx:399`, `frontend/src/pages/ExamCheckPage.jsx:411`, `frontend/src/pages/MobileProctoringPage.jsx:18`, `frontend/src/pages/MobileProctoringPage.jsx:19`.
- The desktop precheck listens on `BroadcastChannel('exam_qr_channel')`; the mobile page posts to that same channel. BroadcastChannel is scoped to same-origin browsing contexts on the same client, not across a separate phone scanning a QR code from the desktop. The only reliable way to advance on real devices is the in-page manual "test" toggle at `ExamCheckPage.jsx:411`.
- Impact: a real candidate scanning the QR from a phone will not set `qrConnected` on the desktop, so the exam start button remains disabled unless the debug bypass is used.

## MEDIUM

1. Frontend flow coverage is missing for the reviewed surfaces.

- Evidence: `frontend/package.json` has build/lint/preview only, no unit, integration, or route smoke test. Backend tests pass, but they do not render `StaffAuthPage`, role navigation, `InvitePage`, `ExamCheckPage`, `ExamSessionPage`, or monitoring tabs.
- Impact: the header/session-state and QR cross-device issues are not covered by current checks.

## LOW

1. Frontend lint has existing warnings that should not be treated as a clean quality gate.

- Evidence: `npm.cmd run lint` passed with warnings: unused vars in `MobileScanPage.jsx`, unused catch params in `ExamCheckPage.jsx` and mobile pages, missing React hook dependency in `ManagerExamDetailPage.jsx`, and unused imports in `ResultTab.jsx`.
- Impact: not a release blocker by itself, but the missing hook dependency and unused code are maintenance signals around the edited flow.

## Verification

- `npm.cmd run lint` from `frontend`: PASS with warnings listed above.
- `npm.cmd run build -- --outDir ..\.omo\evidence\frontend-review-dist --emptyOutDir` from `frontend`: PASS, production build emitted to `.omo/evidence/frontend-review-dist`.
- `npm.cmd test` from `backend`: PASS, 7/7 tests.
- Isolated API flow exercise using `createApp` with `.omo/evidence/review-monitoring-db.json`: reproduced the monitoring disconnect after creating, assigning, and inviting a candidate.
- Browser/Playwright route smoke was not run. The project does not include Playwright, and a Node REPL import probe hung/reset; I did not install new dependencies in this read-only review.

## Status

codeQualityStatus: BLOCK

recommendation: REQUEST_CHANGES

blockers:

- Connect the manager-created candidate/applicant-session lifecycle to the live monitoring and exam-status data model, and replace the zero-examinees test with an observable monitoring expectation.
- Hide or replace the staff `Header` on candidate exam routes, or derive a candidate-specific account state from `candidateAccessToken`/`candidateNumber` while preventing staff/candidate session mixing.
- Replace the BroadcastChannel-only QR handoff and manual debug toggle with a backend-mediated pairing/status check that works across desktop and phone.
