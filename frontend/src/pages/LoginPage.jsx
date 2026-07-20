import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, User, ShieldCheck } from 'lucide-react';

export default function LoginPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    username: '',
    password: '',
  });
  const [errorMessage, setErrorMessage] = useState('');

  // 입력값 변경 핸들러
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // 로그인 제출 핸들러 (백엔드 API 연동 전까지는 더미 검증 수행)
  const handleSubmit = (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!formData.username || !formData.password) {
      setErrorMessage('수험 번호(아이디)와 비밀번호를 모두 입력해주세요.');
      return;
    }

    // [더미 검증] 추후 백엔드 Django API (예: /api/accounts/login/)로 교체될 영역입니다.
    // 서비스 플로우상 로그인 성공 시 시험 사전 점검 화면(/check)으로 이동합니다.
    console.log('로그인 시도:', formData);

    // 정상 로그인 가정 하에 페이지 이동
    navigate('/check');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 rounded-2xl bg-white p-8 shadow-xl border border-gray-100">

        {/* 헤더 타이틀 영역 */}
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-teal-50 text-teal-600">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <h2 className="mt-4 text-2xl font-bold tracking-tight text-gray-900">
            AI 리터러시 역량 테스트 플랫폼
          </h2>
          <p className="mt-2 text-sm text-gray-500">
            공정한 비대면 코딩 평가를 위한 안전한 접속 화면입니다.
          </p>
        </div>

        {/* 로그인 폼 */}
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {errorMessage && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 text-center font-medium">
              {errorMessage}
            </div>
          )}

          <div className="space-y-4 rounded-md shadow-sm">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                수험 번호 (이메일 / 아이디)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <User className="h-5 w-5" />
                </div>
                <input
                  name="username"
                  type="text"
                  required
                  value={formData.username}
                  onChange={handleChange}
                  className="block w-full rounded-lg border border-gray-300 bg-gray-50 py-2.5 pl-10 pr-3 text-gray-900 placeholder-gray-400 focus:border-teal-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal-500 sm:text-sm"
                  placeholder="예: aivle23_01"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                비밀번호
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <Lock className="h-5 w-5" />
                </div>
                <input
                  name="password"
                  type="password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                  className="block w-full rounded-lg border border-gray-300 bg-gray-50 py-2.5 pl-10 pr-3 text-gray-900 placeholder-gray-400 focus:border-teal-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal-500 sm:text-sm"
                  placeholder="••••••••"
                />
              </div>
            </div>
          </div>

          <div>
            <button
              type="submit"
              className="group relative flex w-full justify-center rounded-lg bg-teal-600 px-4 py-3 text-sm font-semibold text-white shadow-md hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 transition-all"
            >
              로그인 및 본인 확인 시작
            </button>
          </div>
        </form>

        {/* 하단 안내 문구 */}
        <div className="text-center text-xs text-gray-400 pt-4 border-t border-gray-100">
          KT AIVLE School 9기 빅프로젝트 23조 | 부정행위 방지 AI 감독 시스템
        </div>
      </div>
    </div>
  );
}