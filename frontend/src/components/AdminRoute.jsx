import React from 'react';
import { Navigate } from 'react-router-dom';

export default function AdminRoute({ children }) {
  // 로컬 스토리지에 저장된 사용자 권한 확인
  const userRole = localStorage.getItem('userRole');

  // 관리자(ADMIN) 권한이 아닌 경우 경고를 띄우고 홈 화면으로 강제 이동
  if (userRole !== 'ADMIN') {
    alert('🚨 접근 권한이 없습니다! 응시자는 관리자 페이지에 접근할 수 없습니다.');
    return <Navigate to="/home" replace />;
  }

  // 관리자일 경우에만 요청한 페이지를 렌더링
  return children;
}