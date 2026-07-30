import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="site-footer" aria-label="사이트 하단 정보">
      <div className="site-footer-links">
        <Link to="/terms" className="site-footer-link">이용약관</Link>
        <Link to="/privacy" className="site-footer-link">개인정보처리방침</Link>
        <Link to="/faq" className="site-footer-link">FAQ</Link>
      </div>
      <div className="site-footer-meta">
        <span>© 2026 AI 리터러시 역량 테스트 플랫폼</span>
        <span>KT AIVLE SCHOOL Team23</span>
      </div>
    </footer>
  );
}
