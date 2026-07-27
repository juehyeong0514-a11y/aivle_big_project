---
slug: role-access-flow
status: executing
intent: unclear
pending-action: implement the approved feature scope in the shared workspace
approach: Extend the JSON store and Express API with organizations, manager assignments, candidate invitations, and scoped exam operations. Add role-specific workspace tabs and a public invitation entry route while preserving existing monitoring routes as compatibility adapters.
---

# Draft: role-access-flow

## Components (topology ledger)
<!-- Lock the SHAPE before depth. One row per top-level component that can succeed or fail independently. -->
<!-- id | outcome (one line) | status: active|deferred | evidence path -->
- auth-boundary | ADMIN and MANAGER login only; candidates use invite token + candidate number | active | .omo/evidence/auth-boundary.json
- organization-governance | organization requests move through PENDING/APPROVED/REJECTED/SUSPENDED and ADMIN assigns managers | active | .omo/evidence/organization-governance.json
- manager-workspace | manager sees and mutates only assigned organizations | active | .omo/evidence/manager-workspace.json
- invitation-flow | manager registers candidates, creates exam assignments, sends one-time invitation tokens | active | .omo/evidence/invitation-flow.json
- applicant-entry | invitation page verifies candidate number and enters preflight flow without signup/result page | active | .omo/evidence/applicant-entry.json

## Open assumptions (announced defaults)
<!-- Intent is UNCLEAR: research resolves ambiguity, defaults are adopted (not asked), and each is surfaced in the plan's human TL;DR for veto. -->
<!-- assumption | adopted default | rationale | reversible? -->
- role naming | use `MANAGER` as the persisted role and accept legacy `SUPERVISOR` only on old monitoring routes | matches the product roles while avoiding a breaking migration for existing seeded data | yes
- invitation delivery | persist a sent invitation record and expose a mail-preview payload instead of integrating a provider | real provider credentials are not in scope; UI can verify all required mail fields | yes
- candidate identity | keep candidate records separate from login users and issue generated candidate numbers | candidates must not self-register or choose a role | yes
- result visibility | retain manager/admin result management stubs but do not add a candidate result route | explicitly excluded by the request | yes

## Findings (cited - path:lines)
- `backend/src/app.mjs:1-120` currently only protects three legacy roles and has no organization or invitation endpoints.
- `backend/src/store.mjs:1-75` stores only users, exams, notices, examinees, and warnings; existing JSON files need default-array hydration.
- `frontend/src/pages/AuthPage.jsx:1-220` exposes applicant signup and role selection, which conflicts with invitation-only candidate access.
- `frontend/src/pages/HomePage.jsx:1-122` routes ADMIN and SUPERVISOR to existing tabs but has no organization or manager workspace.
- `frontend/src/components/Header.jsx:1-135` labels SUPERVISOR as 감독관 and exposes candidate result navigation.

## Decisions (with rationale)

## Scope IN
- role and access boundary changes described in the user request
- organization request review, approval, rejection, suspension display, and manager assignment
- manager organization request, organization-scoped candidate management, exam creation, assignment, invitation preview/sending
- candidate invitation URL, candidate-number verification, one-time token state, and preflight handoff
- API tests for happy paths and role/org isolation failures
- fresh browser QA of admin, manager, and invitation surfaces

## Scope OUT (Must NOT have)
- payment, production SMTP/provider integration, WebRTC/AI implementation, or database replacement
- candidate normal signup, role-selection login, or candidate result page
- destructive deletion of unrelated existing features or user data

## Open questions
- none; reversible implementation defaults above are adopted for this execution

## Approval gate
status: drafting
<!-- When exploration is exhausted and unknowns are answered, set status: awaiting-approval. -->
<!-- That durable record is the loop guard: on a later turn read it and resume at the gate instead of re-running exploration. -->
