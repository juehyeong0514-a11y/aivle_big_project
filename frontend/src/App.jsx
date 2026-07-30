import React, { lazy, Suspense } from 'react';
import './styles/main.css';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Header from './components/Header';
const AuthPage = lazy(() => import('./pages/StaffAuthPage'));
const StaffSignupPage = lazy(() => import('./pages/StaffSignupPage'));
const HomePage = lazy(() => import('./pages/HomePage'));
const ExamCheckPage = lazy(() => import('./pages/ExamCheckPage'));
const ExamSessionPage = lazy(() => import('./pages/ExamSessionPage'));
const MobileProctoringPage = lazy(() => import('./pages/MobileProctoringPage'));
const MobileScanPage = lazy(() => import('./pages/MobileScanPage'));
const MobileMonitoringPage = lazy(() => import('./pages/MobileProctoringPage'));
const InvitePage = lazy(() => import('./pages/InvitePage'));
const AdminRoute = lazy(() => import('./components/AdminRoute'));
const SupervisorExamDashboard = lazy(() => import('./supervisor/SupervisorExamDashboard'));
const ManagerExamCreatePage = lazy(() => import('./manager/ManagerExamCreatePage'));
const ManagerExamDetailPage = lazy(() => import('./manager/ManagerExamDetailPage'));

function CandidateAccessRoute({ children }) {
  const hasCandidateAccess = Boolean(localStorage.getItem('candidateAccessToken'));
  return hasCandidateAccess ? children : <Navigate to="/" replace />;
}

function ManagerRoute({ children }) {
  const role = localStorage.getItem('userRole');
  return role === 'MANAGER' || role === 'SUPERVISOR' ? children : <Navigate to="/login" replace />;
}

function Layout({ children }) {
  const location = useLocation();
  const isMobilePage = location.pathname.startsWith('/mobile/');
  const isInvitePage = location.pathname.startsWith('/invite/');
  const isExamSessionPage = location.pathname === '/exam/session';
  // 💡 isAuthPage 조건 변수를 제거하여 로그인 및 회원가입 페이지에서도 Header가 숨겨지지 않도록 수정합니다.

  return (
    <div className="app-wrapper">
      {!isMobilePage && !isInvitePage && !isExamSessionPage && <Header />}
      {children}
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Suspense fallback={<main className="workspace-loading">화면을 불러오는 중입니다...</main>}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<AuthPage />} />
          <Route path="/signup" element={<StaffSignupPage />} />
          <Route path="/invite/:token" element={<InvitePage />} />
          <Route path="/exam/enter" element={<InvitePage />} />

          {/* 🌟 회원가입/로그인을 안 하더라도 홈 화면의 탭과 카드 목록은 열람이 가능합니다 */}
          <Route path="/home" element={<HomePage />} />
          <Route path="/manager/exams" element={<ManagerRoute><SupervisorExamDashboard /></ManagerRoute>} />
          <Route path="/manager/exams/new" element={<ManagerRoute><ManagerExamCreatePage /></ManagerRoute>} />
          <Route path="/manager/exams/:examId" element={<ManagerRoute><ManagerExamDetailPage /></ManagerRoute>} />

          {/* 장비 점검 등 실제 핵심 액션들은 회원 상태에서만 온전히 동작 */}
          <Route path="/exam/check" element={<CandidateAccessRoute><ExamCheckPage /></CandidateAccessRoute>} />
          <Route path="/exam/session" element={<CandidateAccessRoute><ExamSessionPage /></CandidateAccessRoute>} />

          {/* 🌟 분리된 모바일 스캔 및 모니터링 페이지 */}
          <Route path="/mobile/scan" element={<MobileScanPage />} />
          <Route path="/mobile/monitoring" element={<MobileMonitoringPage />} />

          {/* 기존 통합 페이지 (필요시 유지) */}
          <Route path="/mobile/proctoring" element={<MobileProctoringPage />} />

          <Route path="/admin/dashboard" element={<AdminRoute><div className="container">대시보드</div></AdminRoute>} />
          <Route path="/admin/report" element={<AdminRoute><div className="container">리포트</div></AdminRoute>} />

          <Route path="*" element={<Navigate to="/home" replace />} />
        </Routes>
        </Suspense>
      </Layout>
    </BrowserRouter>
  );
}
