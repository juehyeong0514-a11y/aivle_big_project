import React from 'react';
import './styles/main.css';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Header from './components/Header';
import AuthPage from './pages/AuthPage';
import HomePage from './pages/HomePage';
import ExamCheckPage from './pages/ExamCheckPage';
import MobileProctoringPage from './pages/MobileProctoringPage';
import MobileScanPage from './pages/MobileScanPage';
import MobileMonitoringPage from './pages/MobileProctoringPage';
import AdminRoute from './components/AdminRoute';

function Layout({ children }) {
  const location = useLocation();
  const isMobilePage = location.pathname.startsWith('/mobile/');

  return (
    <div className="app-wrapper">
      {!isMobilePage && <Header />}
      {children}
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<AuthPage />} />

          {/* 🌟 회원가입/로그인을 안 하더라도 홈 화면의 탭과 카드 목록은 열람이 가능합니다 */}
          <Route path="/home" element={<HomePage />} />

          {/* 장비 점검 등 실제 핵심 액션들은 회원 상태에서만 온전히 동작 */}
          <Route path="/exam/check" element={<ExamCheckPage />} />

          {/* 🌟 분리된 모바일 스캔 및 모니터링 페이지 */}
          <Route path="/mobile/scan" element={<MobileScanPage />} />
          <Route path="/mobile/monitoring" element={<MobileMonitoringPage />} />

          {/* 기존 통합 페이지 (필요시 유지) */}
          <Route path="/mobile/proctoring" element={<MobileProctoringPage />} />

          <Route path="/admin/dashboard" element={<AdminRoute><div className="container">대시보드</div></AdminRoute>} />
          <Route path="/admin/report" element={<AdminRoute><div className="container">리포트</div></AdminRoute>} />

          <Route path="*" element={<Navigate to="/home" replace />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}