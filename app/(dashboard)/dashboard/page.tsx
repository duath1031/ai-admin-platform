"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui";

export default function DashboardPage() {
  const { data: session } = useSession();

  const quickActions = [
    {
      title: "서류 작성",
      description: "진정서, 탄원서, 이의신청서 등",
      href: "/documents/new",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      color: "blue",
    },
    {
      title: "AI 상담",
      description: "행정 절차 및 인허가 상담",
      href: "/chat",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      ),
      color: "green",
    },
    {
      title: "건축행정AI",
      description: "GIS 기반 인허가 가능성 진단",
      href: "/permit-check",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      ),
      color: "teal",
    },
    {
      title: "서류 검토",
      description: "작성한 서류 AI 검토",
      href: "/review",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      ),
      color: "purple",
    },
    {
      title: "토지이용계획 조회",
      description: "주소로 용도지역 확인",
      href: "/chat?q=토지이용계획을 조회해주세요",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
        </svg>
      ),
      color: "orange",
    },
  ];

  const colorClasses: Record<string, string> = {
    blue: "bg-blue-50 text-blue-600 border-blue-100",
    green: "bg-green-50 text-green-600 border-green-100",
    teal: "bg-teal-50 text-teal-600 border-teal-100",
    purple: "bg-purple-50 text-purple-600 border-purple-100",
    orange: "bg-orange-50 text-orange-600 border-orange-100",
  };

  return (
    <div className="max-w-6xl mx-auto">
      {/* Welcome Section */}
      <div className="mb-4 sm:mb-8">
        <h1 className="text-lg sm:text-2xl font-bold text-gray-900 mb-1 sm:mb-2">
          안녕하세요, {session?.user?.name || "사용자"}님
        </h1>
        <p className="text-sm sm:text-base text-gray-600">
          AI행정사와 함께 행정 업무를 시작하세요
        </p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 md:gap-6 mb-4 sm:mb-8">
        {quickActions.map((action) => (
          <Link key={action.href} href={action.href}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
              <CardContent className="p-3 sm:p-4 md:p-6">
                <div
                  className={`w-9 h-9 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl flex items-center justify-center mb-2 sm:mb-4 ${
                    colorClasses[action.color]
                  }`}
                >
                  <div className="[&>svg]:w-4 [&>svg]:h-4 sm:[&>svg]:w-6 sm:[&>svg]:h-6">
                    {action.icon}
                  </div>
                </div>
                <h3 className="text-sm sm:text-lg font-semibold text-gray-900 mb-0.5 sm:mb-1">
                  {action.title}
                </h3>
                <p className="text-gray-600 text-[11px] sm:text-sm leading-tight">{action.description}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Example Questions */}
      <Card>
        <CardContent className="p-3 sm:p-4 md:p-6">
          <h2 className="text-sm sm:text-lg font-semibold text-gray-900 mb-2 sm:mb-4">
            이렇게 질문해보세요
          </h2>
          <div className="grid sm:grid-cols-2 gap-2 sm:gap-4">
            {[
              "일반음식점 영업신고 절차가 어떻게 되나요?",
              "건축허가 신청에 필요한 서류는 무엇인가요?",
              "조달청 나라장터 입찰 참가 방법을 알려주세요",
              "외국인 취업비자(E-7) 발급 요건은 무엇인가요?",
              "공장 설립 인허가 절차가 궁금합니다",
              "인천시 계양구 오조산로45번길 12 토지이용계획 확인해줘",
            ].map((question, index) => (
              <Link
                key={index}
                href={`/chat?q=${encodeURIComponent(question)}`}
                className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg hover:bg-gray-50 transition-colors group"
              >
                <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-primary-50 text-primary-600 flex items-center justify-center flex-shrink-0">
                  <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <span className="text-xs sm:text-base text-gray-700 group-hover:text-gray-900">
                  {question}
                </span>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Info Section */}
      <div className="mt-4 sm:mt-8 p-3 sm:p-4 bg-blue-50 rounded-xl border border-blue-100">
        <p className="text-xs sm:text-sm text-blue-800">
          <strong>새로운 기능:</strong> 채팅에서 주소를 입력하면 토지이용계획을 자동으로 조회하고,
          인허가 관련 질문 시 국가법령정보센터의 서식 다운로드 링크를 제공합니다.
        </p>
      </div>
    </div>
  );
}
