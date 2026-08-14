export const shouldRequestExamStartBypass = ({ shortcutEnabled, waitingRoomVisible, requestSent }) => (
  shortcutEnabled && waitingRoomVisible && !requestSent
);
