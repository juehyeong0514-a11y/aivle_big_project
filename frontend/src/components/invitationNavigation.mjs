export const getInvitationAwarePublicRoute = (tabName, invitationToken) => {
  if (invitationToken && tabName === 'HOME') {
    return `/exam/enter?token=${encodeURIComponent(invitationToken)}`;
  }

  const searchParams = new URLSearchParams({ tab: tabName });
  if (invitationToken) searchParams.set('inviteToken', invitationToken);
  return `/home?${searchParams.toString()}`;
};
