"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui";

const serviceCategories = [
  {
    title: "행정·민원",
    emoji: "📋",
    color: "blue",
    items: [
      { name: "AI 행정 상담", href: "/chat", desc: "인허가·절차 AI 상담" },
      { name: "민원 자동접수", href: "/submission", desc: "정부24·문서24 접수" },
      { name: "자동차 이전등록", href: "/car-transfer", desc: "온라인 명의이전" },
      { name: "저작권 등록", href: "/copyright", desc: "등록 가이드·신청서" },
      { name: "과태료 감경", href: "/chat?q=과태료 감경 신청을 도와주세요", desc: "감경 신청서 자동작성" },
      { name: "토지이용계획", href: "/chat?q=토지이용계획을 조회해주세요", desc: "용도지역 확인" },
    ],
  },
  {
    title: "노무·HR",
    emoji: "👷",
    color: "green",
    items: [
      { name: "4대보험 계산기", href: "/labor/insurance-calc", desc: "보험료·소득세 계산" },
      { name: "급여명세서", href: "/labor/payslip", desc: "명세서 생성·인쇄" },
      { name: "근로계약서 AI", href: "/labor/contract", desc: "계약서 자동 생성" },
      { name: "퇴직금 계산기", href: "/labor/severance-calc", desc: "퇴직금·퇴직소득세" },
      { name: "연차 계산기", href: "/labor/annual-leave", desc: "연차 자동 산정" },
      { name: "주휴수당 계산기", href: "/labor/weekly-holiday-pay", desc: "주휴수당·실질시급" },
    ],
  },
  {
    title: "자금·컨설팅",
    emoji: "💰",
    color: "purple",
    items: [
      { name: "정책자금 매칭", href: "/fund-matching", desc: "보조금24 통합 매칭" },
      { name: "인증 자가진단", href: "/certification-check", desc: "벤처·ISO·이노비즈" },
      { name: "사업계획서 AI", href: "/chat?q=사업계획서 작성을 도와주세요", desc: "AI 대필·검토" },
      { name: "직접생산확인", href: "/direct-production", desc: "자가진단 엔진" },
    ],
  },
  {
    title: "입찰·조달",
    emoji: "📊",
    color: "orange",
    items: [
      { name: "나라장터 검색", href: "/procurement", desc: "스마트 입찰 필터" },
      { name: "사정률 시뮬레이터", href: "/bid-simulation", desc: "투찰금액 분석" },
      { name: "경쟁사 분석", href: "/procurement", desc: "투찰 패턴 인사이트" },
    ],
  },
  {
    title: "서류·계약",
    emoji: "📄",
    color: "teal",
    items: [
      { name: "서류 작성", href: "/documents/new", desc: "206종 법정 서식" },
      { name: "서류 검토 AI", href: "/review", desc: "AI 검증·독소조항" },
      { name: "내용증명", href: "/certified-mail", desc: "내용증명 작성" },
      { name: "회의록 AI", href: "/meeting-minutes", desc: "녹취록 요약" },
    ],
  },
  {
    title: "연구·관리",
    emoji: "🔬",
    color: "indigo",
    items: [
      { name: "연구노트 (KOITA)", href: "/research-note", desc: "표준 양식·타임스탬프" },
      { name: "법인차량 운행일지", href: "/fleet", desc: "운행기록 관리" },
      { name: "거래처 관리", href: "/clients", desc: "거래처별 서류함" },
    ],
  },
];

const colorMap: Record<string, { bg: string; text: string; border: string; iconBg: string }> = {
  blue: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-100", iconBg: "bg-blue-100" },
  green: { bg: "bg-green-50", text: "text-green-700", border: "border-green-100", iconBg: "bg-green-100" },
  purple: { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-100", iconBg: "bg-purple-100" },
  orange: { bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-100", iconBg: "bg-orange-100" },
  teal: { bg: "bg-teal-50", text: "text-teal-700", border: "border-teal-100", iconBg: "bg-teal-100" },
  indigo: { bg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-100", iconBg: "bg-indigo-100" },
};

const quickStartQuestions = [
  "일반음식점 영업신고 절차가 어떻게 되나요?",
  "외국인 취업비자(E-7) 발급 요건은?",
  "조달청 나라장터 입찰 참가 방법을 알려주세요",
  "건축허가 신청에 필요한 서류는 무엇인가요?",
];

export default function DashboardPage() {
  const { data: session } = useSession();

  return (
    <div className="max-w-7xl mx-auto">
      {/* Welcome */}
      <div className="mb-6 sm:mb-8">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-1">
          안녕하세요, {session?.user?.name || "사용자"}님
        </h1>
        <p className="text-sm sm:text-base text-gray-500">
          AI행정사 어드미니와 함께 업무를 시작하세요
        </p>
      </div>

      {/* Quick Start - AI 상담 */}
      <Card className="mb-6 sm:mb-8 border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50">
        <CardContent className="p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <h2 className="text-base sm:text-lg font-bold text-gray-900">AI 행정 상담</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {quickStartQuestions.map((q, i) => (
              <Link
                key={i}
                href={`/chat?q=${encodeURIComponent(q)}`}
                className="flex items-center gap-2 px-3 py-2.5 bg-white/80 hover:bg-white rounded-lg transition-colors group border border-blue-100/50"
              >
                <svg className="w-4 h-4 text-blue-400 flex-shrink-0 group-hover:text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-xs sm:text-sm text-gray-700 group-hover:text-gray-900 truncate">{q}</span>
              </Link>
            ))}
          </div>
          <div className="mt-3 text-center">
            <Link href="/chat" className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-800">
              자유롭게 질문하기
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Service Categories Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
        {serviceCategories.map((cat) => {
          const colors = colorMap[cat.color];
          return (
            <Card key={cat.title} className="overflow-hidden">
              <CardContent className="p-0">
                {/* Category Header */}
                <div className={`px-4 py-3 ${colors.bg} border-b ${colors.border}`}>
                  <h3 className={`text-sm sm:text-base font-bold ${colors.text} flex items-center gap-2`}>
                    <span>{cat.emoji}</span>
                    {cat.title}
                  </h3>
                </div>
                {/* Items */}
                <div className="p-2">
                  {cat.items.map((item) => (
                    <Link
                      key={item.name}
                      href={item.href}
                      className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg hover:bg-gray-50 transition-colors group"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-gray-900 group-hover:text-blue-600 truncate">
                          {item.name}
                        </div>
                        <div className="text-[11px] text-gray-400 truncate">{item.desc}</div>
                      </div>
                      <svg className="w-4 h-4 text-gray-300 group-hover:text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Bottom Quick Links */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-6">
        <Link href="/mypage/company" className="block">
          <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-slate-50 to-gray-50 border border-gray-200 rounded-xl hover:shadow-md transition-all">
            <div className="w-10 h-10 bg-gradient-to-br from-slate-600 to-gray-700 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div>
              <div className="text-sm font-bold text-gray-900">마스터 프로필</div>
              <div className="text-[11px] text-gray-500">기업 정보 등록·수정</div>
            </div>
          </div>
        </Link>
        <Link href="/pricing" className="block">
          <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-100 rounded-xl hover:shadow-md transition-all">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <div className="text-sm font-bold text-gray-900">요금제 / 토큰</div>
              <div className="text-[11px] text-gray-500">플랜 변경·충전</div>
            </div>
          </div>
        </Link>
        <a href="https://www.jungeui.com/" target="_blank" rel="noopener noreferrer" className="block">
          <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-100 rounded-xl hover:shadow-md transition-all">
            <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-500 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
            </div>
            <div>
              <div className="text-sm font-bold text-gray-900">대행 의뢰</div>
              <div className="text-[11px] text-gray-500">070-8657-1888</div>
            </div>
          </div>
        </a>
      </div>

      {/* Info Banner */}
      <div className="p-3 sm:p-4 bg-blue-50 rounded-xl border border-blue-100">
        <p className="text-xs sm:text-sm text-blue-800">
          <strong>Tip:</strong> 마스터 프로필을 등록하면 AI가 기업 맞춤형 상담을 제공합니다.
          보조금 매칭, 인증 진단, 서류 자동작성 등 모든 기능이 프로필 기반으로 동작합니다.
        </p>
      </div>
    </div>
  );
}
