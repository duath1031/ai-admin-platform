"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";
import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import SocialLoginButtons from "@/components/auth/SocialLoginButtons";

function LoginContent() {
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [showTestLogin, setShowTestLogin] = useState(false);

  const error = searchParams.get("error");
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";

  const handleTestLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setIsLoading(true);
    await signIn("credentials", { email, callbackUrl });
  };

  return (
    <>
      {/* Logo */}
      <div className="text-center mb-5 sm:mb-8">
        <Link href="/" className="inline-flex flex-col items-center gap-1.5 sm:gap-2">
          <div className="flex items-center">
            <span className="text-3xl sm:text-4xl font-black bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              Adm
            </span>
            <span className="text-3xl sm:text-4xl font-black bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Ini
            </span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-xs sm:text-sm text-gray-500">주식회사 어드미니</span>
            <span className="text-xs sm:text-sm font-medium text-primary-600">AI 행정사 플랫폼</span>
          </div>
        </Link>
      </div>

      {/* Login Card */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-5 sm:p-8">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 text-center mb-1.5 sm:mb-2">
          로그인
        </h1>
        <p className="text-sm sm:text-base text-gray-600 text-center mb-5 sm:mb-8">
          소셜 계정으로 간편하게 시작하세요
        </p>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">
              {error === "OAuthSignin" && "소셜 로그인 중 오류가 발생했습니다."}
              {error === "OAuthCallback" && "인증 콜백 처리 중 오류가 발생했습니다."}
              {error === "OAuthCreateAccount" && "계정 생성 중 오류가 발생했습니다."}
              {error === "Callback" && "로그인 처리 중 오류가 발생했습니다."}
              {error === "AccessDenied" && "접근이 거부되었습니다."}
              {!["OAuthSignin", "OAuthCallback", "OAuthCreateAccount", "Callback", "AccessDenied"].includes(error) &&
                "로그인 중 오류가 발생했습니다. 다시 시도해주세요."}
            </p>
          </div>
        )}

        {/* Social Login Buttons */}
        <SocialLoginButtons callbackUrl={callbackUrl} />

        {/* Divider - Test Login */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200" />
          </div>
          <div className="relative flex justify-center">
            <button
              onClick={() => setShowTestLogin(!showTestLogin)}
              className="bg-white px-3 text-sm text-gray-400 hover:text-gray-600"
            >
              {showTestLogin ? "테스트 로그인 숨기기" : "테스트 로그인 (개발용)"}
            </button>
          </div>
        </div>

        {/* Test Login Form */}
        {showTestLogin && (
          <form onSubmit={handleTestLogin}>
            <div className="mb-4">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="테스트 이메일 입력 (예: test@test.com)"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <button
              type="submit"
              disabled={isLoading || !email}
              className="w-full bg-gray-600 hover:bg-gray-700 text-white font-medium py-3 px-4 rounded-xl transition-colors disabled:opacity-50"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" />
              ) : (
                "테스트 로그인"
              )}
            </button>
          </form>
        )}

        <p className="text-xs text-gray-500 text-center mt-6">
          로그인 시 <Link href="/terms" className="underline hover:text-gray-700">이용약관</Link> 및{" "}
          <Link href="/privacy" className="underline hover:text-gray-700">개인정보처리방침</Link>에 동의하게 됩니다.
        </p>
      </div>

      {/* Features */}
      <div className="mt-5 sm:mt-8 grid grid-cols-3 gap-3 sm:gap-4 text-center text-xs sm:text-sm text-gray-600">
        <div>
          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-1.5 sm:mb-2">
            <svg className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <span>간편 인증</span>
        </div>
        <div>
          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-1.5 sm:mb-2">
            <svg className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <span>안전한 보안</span>
        </div>
        <div>
          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-1.5 sm:mb-2">
            <svg className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <span>빠른 처리</span>
        </div>
      </div>

      {/* Footer */}
      <p className="text-center text-gray-500 text-xs sm:text-sm mt-5 sm:mt-8">
        행정사합동사무소 정의 (대표 염현수행정사)
      </p>
    </>
  );
}

function LoginFallback() {
  return (
    <div className="text-center">
      <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
      <p className="text-gray-500">로딩 중...</p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <Suspense fallback={<LoginFallback />}>
          <LoginContent />
        </Suspense>
      </div>
    </div>
  );
}
