"use client";

import { useClientStore } from "@/lib/store";
import Link from "next/link";

// ─── Planned Feature Item ───

function PlannedFeature({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <li className="flex items-start gap-3 py-2">
      <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-500 shrink-0 mt-0.5">
        {icon}
      </div>
      <span className="text-sm text-gray-700">{text}</span>
    </li>
  );
}

// ─── Main Page ───

export default function ClientDocumentsPage() {
  const { selectedClient } = useClientStore();

  // No client selected
  if (!selectedClient) {
    return (
      <div className="max-w-4xl mx-auto py-20 text-center">
        <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-10">
          <svg
            className="w-16 h-16 mx-auto text-indigo-400 mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
            />
          </svg>
          <h2 className="text-xl font-bold text-gray-800 mb-2">거래처를 선택해주세요</h2>
          <p className="text-gray-500 mb-6">
            거래처 관리 페이지에서 거래처를 선택하면 해당 거래처의 서류함을 확인할 수 있습니다.
          </p>
          <Link
            href="/client-management"
            className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors font-medium"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 7l5 5m0 0l-5 5m5-5H6"
              />
            </svg>
            거래처 관리로 이동
          </Link>
        </div>
      </div>
    );
  }

  // Client selected - show coming soon state
  return (
    <div className="max-w-4xl mx-auto py-8 px-4 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
          <svg className="w-7 h-7 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
            />
          </svg>
          {selectedClient.companyName} 서류함
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          거래처별로 생성/저장된 서류를 조회하고 관리합니다.
        </p>
      </div>

      {/* Coming Soon Card */}
      <div className="bg-white rounded-2xl border border-indigo-100 shadow-sm overflow-hidden">
        {/* Banner */}
        <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 px-8 py-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">서류함 기능 준비 중</h2>
              <p className="text-indigo-100 text-sm mt-1">
                거래처별 서류 자동 분류 및 관리 기능이 곧 추가됩니다.
              </p>
            </div>
          </div>
        </div>

        {/* Planned Features */}
        <div className="px-8 py-6">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
            예정 기능
          </h3>
          <ul className="space-y-1">
            <PlannedFeature
              icon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                  />
                </svg>
              }
              text="거래처별 서류 자동 분류"
            />
            <PlannedFeature
              icon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                  />
                </svg>
              }
              text="4대보험 신고서 자동 보관"
            />
            <PlannedFeature
              icon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z"
                  />
                </svg>
              }
              text="급여명세서 이력 관리"
            />
            <PlannedFeature
              icon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              }
              text="계약서/인허가 서류 보관"
            />
            <PlannedFeature
              icon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
              }
              text="PDF 다운로드 및 인쇄"
            />
          </ul>
        </div>

        {/* Action */}
        <div className="px-8 py-5 bg-gray-50 border-t border-gray-100">
          <Link
            href="/client-management"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
            거래처 관리로 이동
          </Link>
        </div>
      </div>
    </div>
  );
}
