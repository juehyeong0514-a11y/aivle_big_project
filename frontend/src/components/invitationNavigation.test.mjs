import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getInvitationAwarePublicRoute,
  getInvitationContextToken,
  isInvitationSessionVerified,
} from './invitationNavigation.mjs';

test('keeps an invitation token while moving to a public information tab', () => {
  assert.equal(
    getInvitationAwarePublicRoute('NOTICE', 'invite-qa'),
    '/home?tab=NOTICE&inviteToken=invite-qa'
  );
});

test('returns to the invitation entry page when an invitation visitor selects home', () => {
  assert.equal(
    getInvitationAwarePublicRoute('HOME', 'invite-qa'),
    '/exam/enter?token=invite-qa'
  );
});

test('encodes invitation tokens before placing them in a URL', () => {
  assert.equal(
    getInvitationAwarePublicRoute('FAQ', 'a/b?c'),
    '/home?tab=FAQ&inviteToken=a%2Fb%3Fc'
  );
});

test('keeps the invitation context while a verified candidate is on environment check', () => {
  assert.equal(
    getInvitationContextToken('/exam/check', '', '', 'invite-qa', true),
    'invite-qa'
  );
});

test('restores the verified entry view only for the same invitation session', () => {
  assert.equal(isInvitationSessionVerified('invite-qa', 'invite-qa', 'candidate-token'), true);
  assert.equal(isInvitationSessionVerified('different-invite', 'invite-qa', 'candidate-token'), false);
});
