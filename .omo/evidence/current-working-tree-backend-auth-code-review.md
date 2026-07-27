# Code Quality Review: Current Working Tree Backend Auth

codeQualityStatus: BLOCK
recommendation: REQUEST_CHANGES
reportPath: .omo/evidence/current-working-tree-backend-auth-code-review.md

## Scope

Read-only review of the current working tree at `C:\Users\User\Desktop\aivle_big_project`, focused on backend auth, email verification, role/org scope, invitation security, and data persistence.

No goal/success-criteria/notepad input was supplied by the user. Existing `.omo` artifacts and logs were treated as untrusted context; findings below are based on direct source inspection and fresh runtime probes.

## Skill Perspective Check

Ran before judging tests and maintainability:

- `omo:remove-ai-slops`: consulted `C:/Users/User/.codex/plugins/cache/sisyphuslabs/omo/4.16.1/skills/remove-ai-slops/SKILL.md`.
- `omo:programming`: consulted `C:/Users/User/.codex/plugins/cache/sisyphuslabs/omo/4.16.1/skills/programming/SKILL.md`.

Violations found:

- `remove-ai-slops`: tests mirror insecure implementation details by reading `database.json` to obtain plaintext invitation tokens, and they miss adversarial cases for link-only redemption, failed mail persistence, and repeat submission.
- `programming`: `backend/src/app.mjs` measures 608 pure LOC and owns multiple security boundaries in one module, exceeding the 250 pure LOC ceiling.

## Tested Evidence

- `cd backend && npm test`: PASS, 7 tests passed, 0 failed, duration 8219.659 ms.
- Runtime invite/submission probe against a throwaway database:
  - `hasPlaintextToken: true`
  - `hasTokenHash: false`
  - `preflightStatus: 200`
  - `preflightCandidateNumberExposed: "AIVLE-1001"`
  - `verifyWithPreflightOnlyStatus: 200`
  - `firstSubmitStatus: 200`, `scoreAfterFirst: 100`
  - `secondSubmitStatus: 200`, `scoreAfterSecond: 0`
  - `restartReplayStatus: 410`
- Runtime failed-mail probe against a throwaway database and a local webhook returning HTTP 500:
  - `emailFirstStatus: 502`
  - `emailRetryStatus: 429`
  - `inviteSendStatus: 502`
  - `failedInvitePreflightStatus: 200`
  - `failedInviteVerifyStatus: 200`
- Pure LOC measurement:
  - `backend/src/app.mjs`: 608
  - `backend/src/store.mjs`: 224
  - `backend/test/api.test.mjs`: 219

## CRITICAL

1. `backend/src/app.mjs:533` through `backend/src/app.mjs:547` disclose and accept the same invitation verification secret.

   `GET /api/invitations/:token` returns `candidateNumber`, and `POST /api/invitations/:token/verify` treats that candidate number as the proof. A user with only the invite URL can fetch the candidate number and redeem the invitation without possessing the out-of-band candidate-number secret.

   Tested evidence: the probe got `preflightStatus: 200`, `preflightCandidateNumberExposed: "AIVLE-1001"`, then verified with only that disclosed value and got `verifyWithPreflightOnlyStatus: 200`.

2. `backend/src/app.mjs:211` through `backend/src/app.mjs:221` allow repeated exam submission with the same applicant session and overwrite persisted results.

   `authenticateApplicant` only checks that the applicant session exists; the submit handler does not reject already submitted invitations or assignments before recalculating and saving the score. The persisted assignment can be changed after a valid submission.

   Tested evidence: the probe submitted correct answers and persisted `scoreAfterFirst: 100`, then submitted `{}` with the same applicant access token and persisted `scoreAfterSecond: 0`; both submissions returned HTTP 200.

## HIGH

1. `backend/src/app.mjs:511` through `backend/src/app.mjs:514` persist live invitation tokens in plaintext; `backend/test/api.test.mjs:144` through `backend/test/api.test.mjs:146` depends on that plaintext token.

   Sessions and email verification tokens are hashed, but invitation tokens are stored as `token` and looked up directly. Anyone with read access to the JSON database or copied evidence can redeem unexpired invitations. The test reinforces the unsafe contract by reading `savedDatabase.invitations[0].token`.

   Tested evidence: the probe found `hasPlaintextToken: true` and `hasTokenHash: false`.

2. `backend/src/app.mjs:94` through `backend/src/app.mjs:99` and `backend/src/app.mjs:509` through `backend/src/app.mjs:520` persist active email verification and invitation state before webhook delivery succeeds.

   When the mail webhook returns 500, the API reports 502, but the store already contains an active email verification or invitation. The failed verification blocks immediate retry through the normal cooldown, and the failed invitation can still be opened and redeemed if the token is obtained from persistence.

   Tested evidence: with a webhook returning 500, the probe got `emailFirstStatus: 502`, immediate `emailRetryStatus: 429`, `inviteSendStatus: 502`, then the failed invite still returned `failedInvitePreflightStatus: 200` and `failedInviteVerifyStatus: 200`.

## MEDIUM

1. `backend/src/app.mjs` is a 608 pure LOC route module spanning public data, staff auth, email verification, admin governance, manager org scope, invitations, applicant sessions, submissions, and supervisor monitoring.

   This violates the loaded `programming` skill's 250 pure LOC ceiling and makes security review brittle: the critical invite and submission bugs both sit in distant parts of the same route module without narrow boundary tests.

## LOW

No low-severity findings.

## Blockers

- Do not approve until invitation preflight stops disclosing the candidate-number verifier and link-only redemption is covered by an adversarial test.
- Do not approve until repeat submissions are rejected or made idempotent without overwriting finalized persisted results.
- Do not approve until invitation tokens are hashed at rest and tests stop relying on plaintext DB tokens.
- Do not approve until failed mail delivery does not leave active redeemable invitations or active retry-blocking email verification records after a 502.
