recommendation: REVISE

## originalIntent

Verify scope fidelity for the current role-access implementation. The shipped work must not expose applicant signup or applicant result pages, and it must preserve legacy manager/supervisor monitoring compatibility.

## desiredOutcome

- Routed login should be staff-only or invitation-only for candidates, with no applicant signup page in the active route surface.
- Candidate/applicant result pages should not be reachable as part of the current implementation.
- Existing monitoring surfaces and `/api/supervisor/*` compatibility should remain usable for the manager/supervisor role.

## userOutcomeReview

Applicant self-signup is blocked in the backend and the active `/login` route now points to `StaffAuthPage`, which exposes only ADMIN and MANAGER login. Legacy monitoring is still present in the frontend tab set and the backend supervisor endpoints still respond for the manager-compatible role.

The result-page exclusion is not satisfied. The header hides the visible "RESULT" nav item, but `HomePage.jsx` still imports and renders `ResultTab` whenever the query string is `?tab=RESULT`. A user can still navigate directly to `/home?tab=RESULT` and get the applicant result view.

## blockers

1. Applicant result page remains directly reachable.
   - `frontend/src/pages/HomePage.jsx:20` imports `ResultTab`.
   - `frontend/src/pages/HomePage.jsx:100` still maps the `RESULT` tab to a result-page title.
   - `frontend/src/pages/HomePage.jsx:117` renders `<ResultTab />` for `activeTab === 'RESULT'`.
   - `frontend/src/components/Header.jsx` removed the visible RESULT nav button, but that does not remove the route/query entry point.
   - This violates the documented guardrail in `.omo/plans/role-access-flow.md:33` and `.omo/plans/role-access-flow.md:106` that no candidate result page should be present.

## nonBlockerFindings

- Applicant signup route surface is not active: `frontend/src/App.jsx:5` imports `StaffAuthPage` as the `/login` page, and `frontend/src/pages/StaffAuthPage.jsx:6-12` exposes ADMIN/MANAGER login only. Backend `POST /api/auth/signup` returns 403 for applicant signup, confirmed by direct probe.
- The legacy signup-capable `frontend/src/pages/AuthPage.jsx` still exists in the repository, but I found no active route importing it from `App.jsx`. If the acceptance criterion is "delete all dead signup UI code", this needs a separate blocker; for "do not expose applicant signup page", it passes.
- Legacy monitoring compatibility is present by source and runtime probe: `frontend/src/components/Header.jsx:93`, `frontend/src/pages/HomePage.jsx:81`, and `backend/src/app.mjs:300-301` keep monitoring tabs/API routes available. Direct temp-db probe returned `signupStatus:403`, `managerLoginStatus:200`, `supervisorExamineesStatus:200`, `supervisorExamineeCount:4`.
- Manager/supervisor default landing changed from `LIVE_MONITORING` to `MANAGER_WORKSPACE` at `frontend/src/components/Header.jsx:23,51` and `frontend/src/pages/HomePage.jsx:41`. I did not count this as blocking because the plan asks to preserve monitoring compatibility, not preserve monitoring as the default landing page.

## checkedArtifactPaths

- `C:\Users\User\Desktop\aivle_big_project\.omo\plans\role-access-flow.md`
- `C:\Users\User\Desktop\aivle_big_project\.omo\drafts\role-access-flow.md`
- `C:\Users\User\Desktop\aivle_big_project\.omo\evidence\admin-governance-manager-invite-code-review.md`
- `C:\Users\User\Desktop\aivle_big_project\.omo\evidence\admin-platform-governance-security-code-review.md`
- `C:\Users\User\Desktop\aivle_big_project\.omo\evidence\governance-qa\http-governance-scenarios-filepayload.txt`
- `C:\Users\User\Desktop\aivle_big_project\.omo\evidence\admin-governance-qa\curl-supervisor-compatibility.txt`
- `C:\Users\User\Desktop\aivle_big_project\frontend\src\App.jsx`
- `C:\Users\User\Desktop\aivle_big_project\frontend\src\components\Header.jsx`
- `C:\Users\User\Desktop\aivle_big_project\frontend\src\pages\HomePage.jsx`
- `C:\Users\User\Desktop\aivle_big_project\frontend\src\pages\StaffAuthPage.jsx`
- `C:\Users\User\Desktop\aivle_big_project\frontend\src\pages\AuthPage.jsx`
- `C:\Users\User\Desktop\aivle_big_project\frontend\src\applicant\ResultTab.jsx`
- `C:\Users\User\Desktop\aivle_big_project\frontend\src\supervisor\LiveMonitoringTab.jsx`
- `C:\Users\User\Desktop\aivle_big_project\backend\src\app.mjs`
- `C:\Users\User\Desktop\aivle_big_project\backend\test\api.test.mjs`

## removeAiSlopsAndProgrammingPass

Loaded and applied `omo:remove-ai-slops` and `omo:programming` criteria before approval. Direct slop/overfit review found:

- The signup rejection test is a valid exclusion regression and not a tautological deletion-only test for this narrow gate, because it verifies observable HTTP 403 plus no persisted user.
- There is no frontend regression or QA assertion that `/home?tab=RESULT` is blocked or redirected. The implementation hides a nav button while leaving the underlying render branch active, creating false confidence.
- Prior code-review coverage exists in `admin-governance-manager-invite-code-review.md` and explicitly includes both skill perspectives plus the same `ResultTab` direct-access finding. The wider security/code review artifacts are still failing, so they cannot be used as approval evidence.

## verificationCommands

- `cd backend; npm test` exited 0.
- `cd frontend; npm run build` exited 0.
- `cd frontend; npm run lint` exited 0.
- Direct temp-db API probe:
  - applicant signup: HTTP 403
  - manager-compatible login: HTTP 200
  - `/api/supervisor/examinees`: HTTP 200, 4 examinees

## exactEvidenceGaps

- No dedicated scope-fidelity manual QA matrix was present before this review.
- No browser capture or DOM snapshot demonstrates `/home?tab=RESULT` is blocked; source shows it is still rendered.
- One prior supervisor-compatibility artifact under `admin-governance-qa` shows a stale/misconfigured 401, while a later governance transcript and my direct probe show 200. I treated the stale 401 as non-approving evidence and relied on direct source/runtime verification.

## final

REVISE. Applicant signup is not exposed and monitoring compatibility is preserved, but applicant result access remains reachable through `/home?tab=RESULT`.
