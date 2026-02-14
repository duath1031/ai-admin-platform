"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const features = [
  {
    title: "AI 서류 작성",
    description: "진정서, 탄원서, 이의신청서, 각종 신청서 등 200종 이상의 행정 서류를 AI가 법적 형식에 맞게 자동 작성",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    color: "blue",
    badge: "핵심",
  },
  {
    title: "AI 행정 상담",
    description: "인허가 요건, 필요 서류, 행정 절차 등을 24시간 실시간 AI 상담으로 즉시 안내",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
    color: "green",
    badge: "핵심",
  },
  {
    title: "건축행정AI",
    description: "GIS 기반으로 사업장 위치의 용도지역을 분석하여 인허가 가능성을 자동 진단",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
    color: "teal",
  },
  {
    title: "비자AI",
    description: "E-7, F-2, F-5 등 체류자격별 요건 분석, 점수 계산, 체류자격 변경 경로를 AI가 안내",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    ),
    color: "orange",
  },
  {
    title: "나라장터 입찰 분석",
    description: "조달청 나라장터 공고를 AI가 분석하여 낙찰 가능성, 경쟁률, 최적 투찰가를 예측",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    color: "indigo",
  },
  {
    title: "인증 자가진단",
    description: "ISO, HACCP, 벤처인증 등 기업 인증 취득 요건을 분석하고 준비 상태를 점검",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
      </svg>
    ),
    color: "yellow",
  },
  {
    title: "정책자금 매칭",
    description: "중소기업 정책자금, 보조금, 지원사업을 기업 프로필에 맞춰 자동 매칭 및 신청 안내",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    color: "emerald",
  },
  {
    title: "AI 서류 검토",
    description: "작성된 서류를 업로드하면 AI가 법적 요건 충족 여부, 누락 항목, 오류를 자동 검토",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
    color: "purple",
  },
  {
    title: "민원 자동 접수",
    description: "정부24, 문서24 연동으로 민원 서류를 작성부터 온라인 접수까지 원클릭 자동 처리",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
      </svg>
    ),
    color: "rose",
    badge: "RPA",
  },
  {
    title: "문서24 공문 발송",
    description: "전자문서(문서24) 시스템과 연동하여 공문 작성부터 수신기관 선택, 발송까지 자동화",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
    color: "sky",
    badge: "RPA",
  },
  {
    title: "HWPX 서식 자동 생성",
    description: "국가법령 기반 200종 이상의 공식 신청서 서식을 HWPX 포맷으로 자동 생성 및 다운로드",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    ),
    color: "cyan",
    badge: "신규",
  },
];

const stats = [
  { label: "지원 서류 종류", value: "200+", suffix: "종" },
  { label: "행정 서비스", value: "11", suffix: "개" },
  { label: "법령 데이터", value: "1,000+", suffix: "건" },
  { label: "처리 시간 단축", value: "90", suffix: "%" },
];

const colorMap: Record<string, { bg: string; text: string; border: string; iconBg: string }> = {
  blue: { bg: "from-blue-50 to-blue-50/30", text: "text-blue-600", border: "border-blue-100", iconBg: "bg-blue-100" },
  green: { bg: "from-green-50 to-green-50/30", text: "text-green-600", border: "border-green-100", iconBg: "bg-green-100" },
  teal: { bg: "from-teal-50 to-teal-50/30", text: "text-teal-600", border: "border-teal-100", iconBg: "bg-teal-100" },
  orange: { bg: "from-orange-50 to-orange-50/30", text: "text-orange-600", border: "border-orange-100", iconBg: "bg-orange-100" },
  indigo: { bg: "from-indigo-50 to-indigo-50/30", text: "text-indigo-600", border: "border-indigo-100", iconBg: "bg-indigo-100" },
  yellow: { bg: "from-yellow-50 to-yellow-50/30", text: "text-yellow-600", border: "border-yellow-100", iconBg: "bg-yellow-100" },
  emerald: { bg: "from-emerald-50 to-emerald-50/30", text: "text-emerald-600", border: "border-emerald-100", iconBg: "bg-emerald-100" },
  purple: { bg: "from-purple-50 to-purple-50/30", text: "text-purple-600", border: "border-purple-100", iconBg: "bg-purple-100" },
  rose: { bg: "from-rose-50 to-rose-50/30", text: "text-rose-600", border: "border-rose-100", iconBg: "bg-rose-100" },
  sky: { bg: "from-sky-50 to-sky-50/30", text: "text-sky-600", border: "border-sky-100", iconBg: "bg-sky-100" },
  cyan: { bg: "from-cyan-50 to-cyan-50/30", text: "text-cyan-600", border: "border-cyan-100", iconBg: "bg-cyan-100" },
};

export default function LandingPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (status === "authenticated") {
      router.push("/dashboard");
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-blue-50/30">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 bg-white/90 backdrop-blur-md border-b border-gray-100 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14 sm:h-16">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-sm">
                <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="flex flex-col">
                <span className="text-base sm:text-lg font-bold text-gray-900 leading-tight">AI행정사 어드미니</span>
                <span className="text-[10px] sm:text-xs text-gray-500 leading-tight hidden sm:block">행정사합동사무소 정의</span>
              </div>
            </div>
            {/* Desktop Nav */}
            <div className="hidden sm:flex items-center gap-3">
              <Link href="/login" className="text-sm text-gray-600 hover:text-gray-900 font-medium px-3 py-2">
                로그인
              </Link>
              <Link href="/login" className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-4 py-2 rounded-lg font-medium text-sm transition-all shadow-sm">
                무료로 시작하기
              </Link>
            </div>
            {/* Mobile Nav */}
            <div className="flex sm:hidden items-center gap-2">
              <Link href="/login" className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-3 py-1.5 rounded-lg font-medium text-xs">
                시작하기
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-20 sm:pt-28 pb-8 sm:pb-16 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-full mb-4 sm:mb-6">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-xs sm:text-sm font-medium text-blue-700">행정사가 만든 AI 행정 플랫폼</span>
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 mb-3 sm:mb-5 leading-tight">
            <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">AI행정 + 경리 + 노무</span>
            <br className="sm:hidden" />
            가 한번에
          </h1>
          <p className="text-sm sm:text-base md:text-lg text-gray-600 mb-6 sm:mb-8 max-w-2xl mx-auto leading-relaxed">
            서류 작성, 건축행정, 입찰 분석, 민원 접수, 보조금 매칭까지
            <br className="hidden sm:block" />
            {" "}경리 + 노무사 + 행정사 + 입찰담당의 역할을 AI가 대신합니다
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-8 sm:mb-12">
            <Link href="/login" className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-6 sm:px-8 py-3 sm:py-3.5 rounded-xl font-medium text-sm sm:text-base transition-all shadow-lg shadow-blue-200">
              무료로 시작하기
            </Link>
            <Link href="#features" className="border border-gray-200 hover:border-gray-300 bg-white text-gray-700 px-6 sm:px-8 py-3 sm:py-3.5 rounded-xl font-medium text-sm sm:text-base transition-all">
              서비스 둘러보기
            </Link>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-6 max-w-3xl mx-auto">
            {stats.map((stat) => (
              <div key={stat.label} className="bg-white/80 backdrop-blur-sm rounded-xl p-3 sm:p-4 border border-gray-100 shadow-sm">
                <div className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900">
                  {stat.value}<span className="text-sm sm:text-base font-medium text-gray-500">{stat.suffix}</span>
                </div>
                <div className="text-[11px] sm:text-xs text-gray-500 mt-0.5">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-10 sm:py-16 md:py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-8 sm:mb-12">
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 mb-2 sm:mb-3">
              11가지 AI 행정 서비스
            </h2>
            <p className="text-sm sm:text-base text-gray-600 max-w-2xl mx-auto">
              행정사 실무 경험을 바탕으로 설계된 전문 AI 서비스
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 md:gap-6">
            {features.map((feature) => {
              const colors = colorMap[feature.color] || colorMap.blue;
              return (
                <div
                  key={feature.title}
                  className={`group bg-gradient-to-br ${colors.bg} p-4 sm:p-5 md:p-6 rounded-xl sm:rounded-2xl border ${colors.border} hover:shadow-md transition-all duration-200`}
                >
                  <div className="flex items-start gap-3 sm:gap-4">
                    <div className={`w-10 h-10 sm:w-11 sm:h-11 ${colors.iconBg} rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0 ${colors.text}`}>
                      {feature.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm sm:text-base font-bold text-gray-900">{feature.title}</h3>
                        {feature.badge && (
                          <span className={`text-[10px] sm:text-xs font-medium px-1.5 py-0.5 rounded-full ${
                            feature.badge === "핵심" ? "bg-blue-100 text-blue-700" :
                            feature.badge === "RPA" ? "bg-rose-100 text-rose-700" :
                            "bg-cyan-100 text-cyan-700"
                          }`}>
                            {feature.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-xs sm:text-sm text-gray-600 leading-relaxed line-clamp-2">
                        {feature.description}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-10 sm:py-16 md:py-20 px-4 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-8 sm:mb-12">
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 mb-2 sm:mb-3">
              이용 방법
            </h2>
            <p className="text-sm sm:text-base text-gray-600">
              3단계로 간편하게 시작하세요
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-8">
            {[
              {
                step: "1",
                title: "회원가입",
                desc: "소셜 로그인으로 10초 만에 가입. 카카오, 네이버, 구글 지원",
                icon: (
                  <svg className="w-6 h-6 sm:w-7 sm:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                  </svg>
                ),
              },
              {
                step: "2",
                title: "서비스 선택",
                desc: "필요한 행정 서비스를 선택하면 AI가 맞춤 안내를 시작합니다",
                icon: (
                  <svg className="w-6 h-6 sm:w-7 sm:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                ),
              },
              {
                step: "3",
                title: "결과 확인",
                desc: "AI가 작성한 서류 확인, 다운로드, 필요시 자동 접수까지 완료",
                icon: (
                  <svg className="w-6 h-6 sm:w-7 sm:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ),
              },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-3 sm:mb-4 text-blue-600">
                  {item.icon}
                </div>
                <div className="text-xs sm:text-sm font-bold text-blue-600 mb-1">STEP {item.step}</div>
                <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-1 sm:mb-2">{item.title}</h3>
                <p className="text-xs sm:text-sm text-gray-600">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust Section */}
      <section className="py-10 sm:py-16 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl sm:rounded-3xl p-6 sm:p-10 md:p-14 text-center">
            <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-white mb-2 sm:mb-3">
              행정사가 직접 만든 AI 행정 플랫폼
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 mb-6 sm:mb-8 max-w-xl mx-auto leading-relaxed">
              행정사합동사무소 정의(대표 염현수행정사)의 실무 경험과 AI 기술을 결합하여
              <br className="hidden sm:block" />
              누구나 쉽게 행정 업무를 처리할 수 있도록 설계되었습니다
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-6 mb-6 sm:mb-8">
              {[
                { icon: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z", label: "AES-256 암호화" },
                { icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z", label: "행정사 검증" },
                { icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z", label: "24시간 운영" },
                { icon: "M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z", label: "클라우드 안전" },
              ].map((item) => (
                <div key={item.label} className="flex flex-col items-center gap-1.5 sm:gap-2">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 bg-white/10 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                    </svg>
                  </div>
                  <span className="text-[10px] sm:text-xs text-slate-300">{item.label}</span>
                </div>
              ))}
            </div>
            <Link
              href="/login"
              className="inline-block bg-white text-slate-900 px-6 sm:px-8 py-2.5 sm:py-3 rounded-xl font-medium text-sm sm:text-base hover:bg-blue-50 transition-colors shadow-lg"
            >
              무료로 시작하기
            </Link>
          </div>
        </div>
      </section>

      {/* Pricing Preview */}
      <section className="py-10 sm:py-16 px-4 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-6 sm:mb-10">
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 mb-2 sm:mb-3">
              AI 직원 1명, 월 9만원부터
            </h2>
            <p className="text-sm sm:text-base text-gray-600 mb-4">
              연결제 시 최대 10% 할인! 필요에 맞는 플랜을 선택하세요
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {[
              { name: "Starter", price: "무료", monthlyPrice: 0, desc: "체험용 (1회)", features: ["AI 상담 1회", "서류 1건", "계정당 평생 1회"] },
              { name: "Standard", monthlyPrice: 99000, annualMonthly: 90000, desc: "일반인, 소상공인", features: ["AI 상담 (토큰차감)", "서류 작성 20건/월", "건축행정AI", "서류 검토", "월 100만 토큰"] },
              { name: "Pro", monthlyPrice: 165000, annualMonthly: 150000, desc: "행정사, 기업담당자, 공무원", features: ["Standard 전체 포함", "입찰 분석", "비자AI", "정책자금 매칭", "월 300만 토큰"], popular: true },
              { name: "Pro Plus", monthlyPrice: 300000, annualMonthly: 250000, desc: "전문행정사, 기업법무팀", features: ["Pro 전체 포함", "거래처 50개 관리", "일괄 보조금매칭", "우선 고객지원", "월 500만 토큰"] },
            ].map((plan) => (
              <div
                key={plan.name}
                className={`relative rounded-xl sm:rounded-2xl p-4 sm:p-5 border ${
                  plan.popular
                    ? "border-purple-300 bg-purple-50/50 shadow-md ring-2 ring-purple-400"
                    : "border-gray-200 bg-white"
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-purple-600 to-blue-600 text-white text-[10px] sm:text-xs font-bold px-3 py-0.5 rounded-full">
                    BEST
                  </div>
                )}
                <h3 className="text-sm sm:text-base font-bold text-gray-900">{plan.name}</h3>
                <p className="text-[11px] sm:text-xs text-gray-500 mb-2 sm:mb-3">{plan.desc}</p>
                <div className="mb-3 sm:mb-4">
                  {plan.price === "무료" ? (
                    <span className="text-xl sm:text-2xl font-bold text-gray-900">무료</span>
                  ) : (
                    <>
                      {plan.monthlyPrice > (plan.annualMonthly || 0) && (
                        <div className="text-xs text-gray-400 line-through">월 {plan.monthlyPrice.toLocaleString()}원</div>
                      )}
                      <span className="text-xl sm:text-2xl font-bold text-gray-900">
                        {(plan.annualMonthly || plan.monthlyPrice).toLocaleString()}
                      </span>
                      <span className="text-xs sm:text-sm text-gray-500">원/월</span>
                      <div className="text-[10px] text-gray-400">연결제 기준</div>
                      {plan.annualMonthly && plan.monthlyPrice > plan.annualMonthly && (
                        <span className="inline-block mt-0.5 text-[10px] font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full">
                          {Math.round(((plan.monthlyPrice - plan.annualMonthly) / plan.monthlyPrice) * 100)}% 할인
                        </span>
                      )}
                    </>
                  )}
                </div>
                <ul className="space-y-1.5 sm:space-y-2 mb-4">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-1.5 text-[11px] sm:text-xs text-gray-600">
                      <svg className="w-3.5 h-3.5 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/login"
                  className={`block text-center py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                    plan.popular
                      ? "bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700"
                      : plan.price === "무료"
                      ? "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      : "bg-blue-600 text-white hover:bg-blue-700"
                  }`}
                >
                  {plan.price === "무료" ? "무료로 시작" : "시작하기"}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-10 sm:py-16 md:py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 mb-2 sm:mb-3">
            지금 바로 시작하세요
          </h2>
          <p className="text-sm sm:text-base text-gray-600 mb-6 sm:mb-8">
            복잡한 행정 업무, AI행정사와 함께라면 쉬워집니다
          </p>
          <Link
            href="/login"
            className="inline-block bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-8 sm:px-10 py-3 sm:py-4 rounded-xl font-medium text-sm sm:text-base transition-all shadow-lg shadow-blue-200"
          >
            무료로 시작하기
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 sm:py-12 px-4 bg-gray-900">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-4 sm:mb-6">
            <p className="text-base sm:text-lg font-bold text-white mb-1">행정사가 만든 AI행정사플랫폼 어드미니!</p>
            <p className="text-xs sm:text-sm text-gray-400">(행정사합동사무소정의 - 대표 염현수행정사)</p>
          </div>
          <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-4 sm:pt-6 border-t border-gray-700">
            <div className="text-gray-400 text-[11px] sm:text-sm text-center sm:text-left">
              AI행정사 어드미니는 행정사합동사무소 정의(대표 염현수행정사)의 플랫폼입니다.
            </div>
            <div className="flex gap-4 sm:gap-6 text-[11px] sm:text-sm text-gray-400">
              <a href="https://www.jungeui.com/" target="_blank" rel="noopener noreferrer" className="hover:text-white">
                공식 홈페이지
              </a>
              <span className="hidden sm:inline">|</span>
              <span>070-8657-1888</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
