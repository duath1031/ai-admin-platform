"use client";

import Link from "next/link";
import Image from "next/image";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const stats = [
  { label: "지원 서류 종류", value: "200+", suffix: "종" },
  { label: "AI 행정 서비스", value: "30+", suffix: "개" },
  { label: "법령 데이터", value: "1,000+", suffix: "건" },
  { label: "처리 시간 단축", value: "90", suffix: "%" },
];

const fullFeatureGrid = [
  {
    category: "행정·민원",
    items: [
      { emoji: "📋", name: "민원 자동접수", href: "/submission" },
      { emoji: "🚗", name: "자동차 온라인 이전", href: "/chat" },
      { emoji: "📜", name: "인허가 자가진단", href: "/chat" },
      { emoji: "🔍", name: "토지이용계획 조회", href: "/chat" },
      { emoji: "⚖️", name: "과태료 감경 신청", href: "/chat" },
      { emoji: "📝", name: "저작권 등록 가이드", href: "/chat" },
    ],
  },
  {
    category: "노무·HR",
    items: [
      { emoji: "👷", name: "4대보험 취득/상실", href: "/labor/insurance-calc" },
      { emoji: "💵", name: "급여 계산기", href: "/labor/insurance-calc" },
      { emoji: "📝", name: "근로계약서 자동 생성", href: "/labor/contract" },
      { emoji: "🛂", name: "외국인 비자 (E-7/E-9)", href: "/chat" },
      { emoji: "💼", name: "퇴직금 정산", href: "/labor/severance-calc" },
      { emoji: "📄", name: "4대보험 신고서", href: "/labor/insurance-calc" },
    ],
  },
  {
    category: "자금·컨설팅",
    items: [
      { emoji: "💰", name: "정책자금 매칭", href: "/fund-matching" },
      { emoji: "🎯", name: "보조금24 매칭", href: "/fund-matching" },
      { emoji: "📊", name: "인증 자가진단", href: "/certification-check" },
      { emoji: "📋", name: "사업계획서 AI 대필", href: "/chat" },
      { emoji: "🏆", name: "벤처/ISO/이노비즈", href: "/certification-check" },
      { emoji: "💡", name: "AI 전략 컨설팅", href: "/chat" },
    ],
  },
  {
    category: "입찰·조달",
    items: [
      { emoji: "📊", name: "입찰 스마트 필터", href: "/procurement" },
      { emoji: "📈", name: "사정율 시뮬레이터", href: "/bid-simulation" },
      { emoji: "🔎", name: "경쟁사 입찰 분석", href: "/procurement" },
      { emoji: "🛡️", name: "보증보험 서류 생성", href: "/chat" },
      { emoji: "🏗️", name: "토지이용계획 조회", href: "/chat" },
      { emoji: "✅", name: "직접생산확인 진단", href: "/chat" },
    ],
  },
  {
    category: "서류·계약",
    items: [
      { emoji: "📄", name: "206종 법정 서식", href: "/documents" },
      { emoji: "✍️", name: "AI 서류 자동 작성", href: "/documents" },
      { emoji: "🔍", name: "계약서 독소조항 검출", href: "/chat" },
      { emoji: "📋", name: "서류 검토 (AI 검증)", href: "/chat" },
      { emoji: "📑", name: "위임장 자동 생성", href: "/documents" },
      { emoji: "📝", name: "내용증명", href: "/chat" },
    ],
  },
  {
    category: "연구·관리",
    items: [
      { emoji: "📝", name: "연구노트 (KOITA)", href: "/research-note" },
      { emoji: "🔬", name: "기업부설연구소", href: "/chat" },
      { emoji: "✅", name: "전자결재", href: "/chat" },
      { emoji: "⏰", name: "기한 알림 (D-Day)", href: "/chat" },
      { emoji: "📅", name: "세금 캘린더", href: "/chat" },
      { emoji: "🚗", name: "법인차량 운행일지", href: "/fleet" },
    ],
  },
];

export default function LandingPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  // 로그인 상태에서도 메인페이지 표시 (리다이렉트 없음)

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-blue-50/30">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 bg-white/90 backdrop-blur-md border-b border-gray-100 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14 sm:h-16">
            <div className="flex items-center gap-2 sm:gap-3">
              {/* AdmIni 로고 */}
              <div className="flex items-center">
                <span className="text-xl sm:text-2xl font-black bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  Adm
                </span>
                <span className="text-xl sm:text-2xl font-black bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  Ini
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-sm sm:text-base font-bold text-gray-900 leading-tight">AI행정사 어드미니</span>
                <span className="text-[10px] sm:text-xs text-gray-500 leading-tight hidden sm:block">행정사합동사무소 정의</span>
              </div>
            </div>
            {session?.user ? (
              <>
                {/* 로그인 상태 - Desktop */}
                <div className="hidden sm:flex items-center gap-3">
                  <Link href="/dashboard" className="text-sm text-gray-600 hover:text-gray-900 font-medium px-3 py-2">
                    대시보드
                  </Link>
                  <div className="relative">
                    <button
                      onClick={() => setShowDropdown(!showDropdown)}
                      className="flex items-center gap-2 p-1.5 hover:bg-gray-100 rounded-lg"
                    >
                      {session.user.image ? (
                        <Image
                          src={session.user.image}
                          alt={session.user.name || ""}
                          width={32}
                          height={32}
                          className="rounded-full"
                        />
                      ) : (
                        <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-full flex items-center justify-center">
                          <span className="text-sm font-medium text-white">
                            {session.user.name?.[0] || "U"}
                          </span>
                        </div>
                      )}
                      <span className="text-sm font-medium text-gray-700">
                        {session.user.name}
                      </span>
                    </button>
                    {showDropdown && (
                      <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-2">
                        <Link href="/dashboard" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50" onClick={() => setShowDropdown(false)}>
                          대시보드
                        </Link>
                        <Link href="/mypage" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50" onClick={() => setShowDropdown(false)}>
                          마이페이지
                        </Link>
                        <button onClick={() => signOut()} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-50">
                          로그아웃
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                {/* 로그인 상태 - Mobile */}
                <div className="flex sm:hidden items-center gap-2">
                  <Link href="/dashboard" className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-3 py-1.5 rounded-lg font-medium text-xs">
                    대시보드
                  </Link>
                  <button
                    onClick={() => setShowDropdown(!showDropdown)}
                    className="p-1"
                  >
                    {session.user.image ? (
                      <Image src={session.user.image} alt="" width={28} height={28} className="rounded-full" />
                    ) : (
                      <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-full flex items-center justify-center">
                        <span className="text-xs font-medium text-white">{session.user.name?.[0] || "U"}</span>
                      </div>
                    )}
                  </button>
                  {showDropdown && (
                    <div className="absolute top-12 right-4 w-44 bg-white rounded-lg shadow-lg border border-gray-200 py-1.5">
                      <Link href="/mypage" className="block px-3 py-2 text-xs text-gray-700 hover:bg-gray-50" onClick={() => setShowDropdown(false)}>마이페이지</Link>
                      <button onClick={() => signOut()} className="w-full text-left px-3 py-2 text-xs text-red-600 hover:bg-gray-50">로그아웃</button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                {/* 비로그인 상태 - Desktop */}
                <div className="hidden sm:flex items-center gap-3">
                  <Link href="/login" className="text-sm text-gray-600 hover:text-gray-900 font-medium px-3 py-2">
                    로그인
                  </Link>
                  <Link href="/login" className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-4 py-2 rounded-lg font-medium text-sm transition-all shadow-sm">
                    무료로 시작하기
                  </Link>
                </div>
                {/* 비로그인 상태 - Mobile */}
                <div className="flex sm:hidden items-center gap-2">
                  <Link href="/login" className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-3 py-1.5 rounded-lg font-medium text-xs">
                    시작하기
                  </Link>
                </div>
              </>
            )}
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
            <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">경리 + 노무 + 행정사</span>
            <br className="sm:hidden" />
            가 한번에!
          </h1>
          <p className="text-sm sm:text-base md:text-lg text-gray-600 mb-6 sm:mb-8 max-w-2xl mx-auto leading-relaxed">
            AI 직원 1명이면 다 됩니다. 월 10만원부터.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-8 sm:mb-12">
            {session?.user ? (
              <Link href="/dashboard" className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-6 sm:px-8 py-3 sm:py-3.5 rounded-xl font-medium text-sm sm:text-base transition-all shadow-lg shadow-blue-200">
                대시보드로 이동
              </Link>
            ) : (
              <Link href="/login" className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-6 sm:px-8 py-3 sm:py-3.5 rounded-xl font-medium text-sm sm:text-base transition-all shadow-lg shadow-blue-200">
                1일 무료 체험 시작하기
              </Link>
            )}
            <Link href="#features" className="border border-gray-200 hover:border-gray-300 bg-white text-gray-700 px-6 sm:px-8 py-3 sm:py-3.5 rounded-xl font-medium text-sm sm:text-base transition-all">
              기능 둘러보기 ↓
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

      {/* Section A: 이런 것까지 다 됩니다 */}
      <section id="features" className="py-10 sm:py-16 md:py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-8 sm:mb-12">
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 mb-2 sm:mb-3">
              이런 것까지 다 됩니다
            </h2>
            <p className="text-sm sm:text-base text-gray-600 max-w-2xl mx-auto">
              행정사 실무 경험을 바탕으로 설계된 전문 AI 서비스
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            {/* Card 1: 행정·민원 */}
            <div className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-2xl">📋</span>
                <h3 className="text-base sm:text-lg font-bold text-gray-900">행정·민원, AI가 알아서</h3>
              </div>
              <ul className="space-y-2 mb-5 text-sm text-gray-600">
                <li>• 인허가 신청서 자동 작성</li>
                <li>• 정부24 민원접수 (3-Way)</li>
                <li>• 자동차 온라인 이전등록 OK</li>
                <li>• 저작권 등록 가이드</li>
                <li>• 과태료 감경 신청서 자동 생성</li>
              </ul>
              <Link href="/submission" className="text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors">
                민원 접수하기 →
              </Link>
            </div>

            {/* Card 2: 4대보험·노무 */}
            <div className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-2xl">👷</span>
                <h3 className="text-base sm:text-lg font-bold text-gray-900">4대보험·노무, 한마디면 끝</h3>
              </div>
              <ul className="space-y-2 mb-5 text-sm text-gray-600">
                <li>• &quot;김철수 입사&quot; → 근로계약서 + 4대보험 취득신고</li>
                <li>• 급여 계산기 (4대보험+소득세)</li>
                <li>• 퇴직금 정산 + 상실신고</li>
                <li>• 외국인 비자 (E-7, E-9) 서류</li>
              </ul>
              <Link href="/labor/insurance-calc" className="text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors">
                노무 관리하기 →
              </Link>
            </div>

            {/* Card 3: 정책자금·보조금 */}
            <div className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-2xl">💰</span>
                <h3 className="text-base sm:text-lg font-bold text-gray-900">정책자금·보조금, 맞춤 매칭</h3>
              </div>
              <p className="text-sm text-gray-500 mb-3 italic">&quot;내가 받을 수 있는 보조금이 이렇게 많았어?&quot;</p>
              <ul className="space-y-2 mb-5 text-sm text-gray-600">
                <li>• 보조금24 + 기업마당 통합 매칭</li>
                <li>• AI 전략 컨설팅 + 합격 전략</li>
                <li>• 사업계획서 자동 대필</li>
              </ul>
              <Link href="/fund-matching" className="text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors">
                보조금 매칭 시작 →
              </Link>
            </div>

            {/* Card 4: 입찰 분석 */}
            <div className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-2xl">📊</span>
                <h3 className="text-base sm:text-lg font-bold text-gray-900">입찰 분석, 낙찰의 기술</h3>
              </div>
              <ul className="space-y-2 mb-5 text-sm text-gray-600">
                <li>• 나라장터 공고 스마트 필터</li>
                <li>• 사정율 히트맵 + 시뮬레이터</li>
                <li>• 경쟁사 투찰 패턴 분석</li>
                <li>• 보증보험 서류 자동 생성</li>
                <li>• 발주처별 낙찰 경향 인사이트</li>
              </ul>
              <Link href="/procurement" className="text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors">
                입찰 분석하기 →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Impact Banner */}
      <section className="py-10 sm:py-14 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl sm:rounded-3xl p-8 sm:p-12 text-center">
            <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-white mb-2 sm:mb-3">
              💡 보조금 하나만 받으면 구독료 수년치 회수!
            </h2>
            <p className="text-sm sm:text-base text-blue-100 mb-6 sm:mb-8 max-w-xl mx-auto leading-relaxed">
              마스터 프로필만 등록하면 AI가 알아서 매칭해드립니다.
            </p>
            <Link
              href="/fund-matching"
              className="inline-block bg-white text-blue-700 px-6 sm:px-8 py-2.5 sm:py-3 rounded-xl font-medium text-sm sm:text-base hover:bg-blue-50 transition-colors shadow-lg"
            >
              지금 매칭 시작하기
            </Link>
          </div>
        </div>
      </section>

      {/* Section B: 이것까지? */}
      <section className="py-10 sm:py-16 md:py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-8 sm:mb-12">
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 mb-2 sm:mb-3">
              이것까지?
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            {/* Card 5: 기업인증 컨설팅 */}
            <div className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-2xl">🏆</span>
                <h3 className="text-base sm:text-lg font-bold text-gray-900">기업인증 컨설팅</h3>
              </div>
              <p className="text-sm text-gray-500 mb-3">기업인증 컨설팅 및 사업계획서도, 정책자금 매칭도, 정부지원 매칭도 맞춤형으로!</p>
              <ul className="space-y-2 mb-5 text-sm text-gray-600">
                <li>• 벤처인증 · ISO · 이노비즈</li>
                <li>• 인증 자가진단 엔진</li>
              </ul>
              <Link href="/certification-check" className="text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors">
                인증 진단하기 →
              </Link>
            </div>

            {/* Card 6: 연구노트 */}
            <div className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 relative">
              <span className="absolute top-4 right-4 text-[10px] sm:text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                준비 중
              </span>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-2xl">📝</span>
                <h3 className="text-base sm:text-lg font-bold text-gray-900">연구노트도 한번에!</h3>
              </div>
              <p className="text-sm text-gray-500 mb-3">기업부설연구소 연구노트도 OK.</p>
              <ul className="space-y-2 mb-5 text-sm text-gray-600">
                <li>• KOITA 표준 양식 자동 변환</li>
                <li>• 타임스탬프 자동 부여</li>
                <li>• R&D 세액공제 증빙까지</li>
                <li>• 전자결재 (상신→검토→승인)</li>
              </ul>
              <Link href="/research-note" className="text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors">
                연구노트 작성 →
              </Link>
            </div>

            {/* Card 7: AI 서류 공장 */}
            <div className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-2xl">📄</span>
                <h3 className="text-base sm:text-lg font-bold text-gray-900">AI 서류 공장</h3>
              </div>
              <ul className="space-y-2 mb-5 text-sm text-gray-600">
                <li>• 인허가 신청서 자동 작성</li>
                <li>• 사업계획서 AI 대필</li>
                <li>• 계약서 업로드 → 독소조항 검출</li>
                <li>• 근로계약서 + 급여 자동 계산</li>
                <li>• 위임장·정보공개청구서 등</li>
                <li>• 206종 법정 서식 DB</li>
              </ul>
              <Link href="/documents" className="text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors">
                서류 작성하기 →
              </Link>
            </div>

            {/* Card 8: 행정사·컨설턴트라면? */}
            <div className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-2xl">🏛️</span>
                <h3 className="text-base sm:text-lg font-bold text-gray-900">행정사·컨설턴트라면?</h3>
              </div>
              <p className="text-sm text-gray-500 mb-3">거래처별 맞춤형 매칭, 컨설팅을 알아서 해드립니다.</p>
              <ul className="space-y-2 mb-5 text-sm text-gray-600">
                <li>• 50개까지 거래처 등록 가능!</li>
                <li>• 거래처별 개별 서류함</li>
                <li>• 일괄 보조금 매칭</li>
                <li>• 진행현황 PDF 리포트 자동 생성</li>
              </ul>
              <Link href="/pricing" className="text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors">
                Pro Plus 알아보기 →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Full Feature Grid: 전체 기능 한눈에 */}
      <section className="py-10 sm:py-16 md:py-20 px-4 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-8 sm:mb-12">
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 mb-2 sm:mb-3">
              전체 기능 한눈에
            </h2>
            <p className="text-sm sm:text-base text-gray-600 max-w-2xl mx-auto">
              6개 카테고리, 36개 이상의 AI 행정 기능
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {fullFeatureGrid.map((group) => (
              <div key={group.category}>
                <h3 className="text-sm sm:text-base font-bold text-gray-900 mb-3 pb-2 border-b border-gray-200">
                  {group.category}
                </h3>
                <ul className="space-y-2">
                  {group.items.map((item) => (
                    <li key={item.name}>
                      <Link
                        href={item.href}
                        className="flex items-center gap-2 text-sm text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg px-2 py-1.5 transition-colors"
                      >
                        <span>{item.emoji}</span>
                        <span>{item.name}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Delegation Section */}
      <section className="py-10 sm:py-14 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="bg-gray-50 border border-gray-200 rounded-2xl sm:rounded-3xl p-8 sm:p-12 text-center">
            <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900 mb-2 sm:mb-3">
              🏛️ 직접 하기 번거로우신가요?
            </h2>
            <p className="text-sm sm:text-base text-gray-600 mb-6 sm:mb-8">
              전문 행정사가 대행해드립니다.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6">
              <span className="text-sm sm:text-base font-medium text-gray-700">📞 070-8657-1888</span>
              <a
                href="https://www.jungeui.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block bg-gradient-to-r from-gray-800 to-gray-900 hover:from-gray-900 hover:to-black text-white px-6 sm:px-8 py-2.5 sm:py-3 rounded-xl font-medium text-sm sm:text-base transition-all shadow-sm"
              >
                대리의뢰하기 → jungeui.com
              </a>
            </div>
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
              AI 직원 1명, 월 10만원부터
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
