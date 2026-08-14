import { useEffect, useState } from 'react';

// 응시자 화면의 임시 인증 버튼은 평소에는 숨겨두고, 개발·시연 점검 중에만 단축키로 꺼냅니다.
// Ctrl + Alt + M 을 누르면 표시 상태가 토글됩니다.
// 새로고침해도 유지되도록 sessionStorage에 저장하며, 탭을 닫으면 자동으로 해제됩니다.
export const TEST_SHORTCUT_STORAGE_KEY = 'applicantTestShortcuts';

const readInitialState = () => {
  try {
    return window.sessionStorage.getItem(TEST_SHORTCUT_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
};

export default function useTestShortcuts() {
  const [enabled, setEnabled] = useState(readInitialState);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (!event.ctrlKey || !event.altKey) return;
      if (event.key?.toLowerCase() !== 'm') return;
      event.preventDefault();
      setEnabled((previous) => {
        const next = !previous;
        try {
          if (next) window.sessionStorage.setItem(TEST_SHORTCUT_STORAGE_KEY, '1');
          else window.sessionStorage.removeItem(TEST_SHORTCUT_STORAGE_KEY);
        } catch {
          // 저장소를 못 쓰는 환경에서는 화면 상태만 바꿉니다.
        }
        return next;
      });
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return enabled;
}
