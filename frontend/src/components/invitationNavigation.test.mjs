import test from 'node:test';
import assert from 'node:assert/strict';
import { getInvitationAwarePublicRoute } from './invitationNavigation.mjs';

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
