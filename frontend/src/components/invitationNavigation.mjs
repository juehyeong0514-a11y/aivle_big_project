export const getInvitationAwarePublicRoute = (tabName, invitationToken) => {
  if (invitationToken && tabName === 'HOME') {
    return `/exam/enter?token=${encodeURIComponent(invitationToken)}`;
  }

  const searchParams = new URLSearchParams({ tab: tabName });
  if (invitationToken) searchParams.set('inviteToken', invitationToken);
  return `/home?${searchParams.toString()}`;
};

export const getInvitationContextToken = (pathname, entryToken, linkedToken, sessionToken, hasCandidateSession) => {
  if (pathname === '/exam/enter') return entryToken;
  return linkedToken || (hasCandidateSession ? sessionToken : '');
};

export const isInvitationSessionVerified = (invitationToken, sessionToken, candidateAccessToken) => (
  Boolean(invitationToken && candidateAccessToken && invitationToken === sessionToken)
);
