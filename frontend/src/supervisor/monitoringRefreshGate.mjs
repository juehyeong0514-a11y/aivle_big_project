export const createMonitoringRefreshGate = () => {
  let isSuspended = false;
  let pendingSnapshot = null;

  return {
    suspend() {
      isSuspended = true;
    },
    resume() {
      isSuspended = false;
      const snapshot = pendingSnapshot;
      pendingSnapshot = null;
      return snapshot;
    },
    discard() {
      isSuspended = false;
      pendingSnapshot = null;
    },
    receive(snapshot) {
      if (!isSuspended) return snapshot;
      pendingSnapshot = snapshot;
      return null;
    }
  };
};
