import React from 'react';
import './styles/main.css';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Header from './components/Header';
import LandingPage from './pages/LandingPage';
import AuthPage from './pages/AuthPage';
import HomePage from './pages/HomePage';
import ExamCheckPage from './pages/ExamCheckPage';
import AdminRoute from './components/AdminRoute';

function Layout({ children }) {
  const location = useLocation();
  const isLandingPage = location.pathname === '/';

  return (
    <div className="app-wrapper">
      {!isLandingPage && <Header />}
      <main>{children}</main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<AuthPage />} />

          {/* 🌟 회원가입/로그인을 안 하더라도 홈 화면의 탭과 카드 목록은 열람이 가능합니다 */}
          <Route path="/home" element={<HomePage />} />

          {/* 장비 점검 등 실제 핵심 액션들은 회원 상태에서만 온전히 동작 */}
          <Route path="/exam/check" element={<ExamCheckPage />} />

          <Route path="/admin/dashboard" element={<AdminRoute><div className="container">대시보드</div></AdminRoute>} />
          <Route path="/admin/report" element={<AdminRoute><div className="container">리포트</div></AdminRoute>} />

          <Route path="*" element={<Navigate to="/home" replace />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}