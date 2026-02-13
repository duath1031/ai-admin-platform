"use client";

import { useClientStore, ClientCompanyData } from "@/lib/store";
import Link from "next/link";

// ─── Helpers ───

function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return "-";
  if (value >= 100_000_000) {
    const eok = value / 100_000_000;
    return eok % 1 === 0 ? `${eok.toFixed(0)}억원` : `${eok.toFixed(1)}억원`;
  }
  if (value >= 10_000) {
    const man = value / 10_000;
    return man % 1 === 0 ? `${man.toFixed(0)}만원` : `${man.toFixed(1)}만원`;
  }
  return `${value.toLocaleString()}원`;
}

function formatBizRegNo(v: string | null | undefined): string {
  if (!v) return "-";
  const d = v.replace(/\D/g, "");
  if (d.length === 10) return `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}`;
  return v;
}

// ─── Sub-components ───

function KpiCard({
  icon,
  label,
  value,
  sub,
  progress,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  progress?: number;
}) {
  return (
    <div className="bg-white rounded-xl border border-blue-100 shadow-sm p-5 flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
          {icon}
        </div>
        <span className="text-sm text-gray-500">{label}</span>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
      {progress !== undefined && (
        <div className="w-full bg-gray-100 rounded-full h-2 mt-1">
          <div
            className="bg-blue-500 h-2 rounded-full transition-all"
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start py-2 border-b border-gray-50 last:border-0">
      <span className="w-32 shrink-0 text-sm text-gray-500">{label}</span>
      <span className="text-sm text-gray-900 font-medium">{value}</span>
    </div>
  );
}

function FeatureBadge({ label, active }: { label: string; active: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
        active
          ? "bg-green-50 text-green-700 border border-green-200"
          : "bg-gray-50 text-gray-400 border border-gray-200"
      }`}
    >
      <span className={`w-2 h-2 rounded-full ${active ? "bg-green-500" : "bg-gray-300"}`} />
      {label}
    </span>
  );
}

// ─── Quick Action Button ───

function QuickAction({
  href,
  icon,
  label,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-5 py-3 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl transition-colors border border-blue-100 text-sm font-medium"
    >
      {icon}
      {label}
    </Link>
  );
}

// ─── Main Page ───

export default function ClientDashboardPage() {
  const { selectedClient } = useClientStore();

  if (!selectedClient) {
    return (
      <div className="max-w-4xl mx-auto py-20 text-center">
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-10">
          <svg
            className="w-16 h-16 mx-auto text-blue-400 mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
            />
          </svg>
          <h2 className="text-xl font-bold text-gray-800 mb-2">거래처를 선택해주세요</h2>
          <p className="text-gray-500 mb-6">
            거래처 관리 페이지에서 거래처를 선택하면 종합 대시보드를 확인할 수 있습니다.
          </p>
          <Link
            href="/client-management"
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium"
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

  const c = selectedClient;
  const completeness = c.profileCompleteness ?? 0;
  const permanent = c.permanentEmployees ?? 0;
  const contract = c.contractEmployees ?? 0;
  const empTotal = c.employeeCount ?? permanent + contract;

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 space-y-8">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            {c.companyName}
            <span className="text-base font-normal text-gray-400">거래처 대시보드</span>
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            거래처의 종합 정보를 한눈에 확인할 수 있습니다.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold ${
              completeness >= 80
                ? "bg-green-100 text-green-700"
                : completeness >= 50
                ? "bg-yellow-100 text-yellow-700"
                : "bg-red-100 text-red-700"
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            프로필 {completeness}%
          </span>
          <Link
            href="/client-management"
            className="text-sm text-blue-600 hover:text-blue-800 underline underline-offset-2"
          >
            거래처 관리
          </Link>
        </div>
      </div>

      {/* ── 4 KPI Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          }
          label="직원 수"
          value={`${empTotal}명`}
          sub={`정규직 ${permanent}명 / 계약직 ${contract}명`}
        />
        <KpiCard
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          }
          label="자본금"
          value={formatCurrency(c.capital)}
        />
        <KpiCard
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
              />
            </svg>
          }
          label="매출액"
          value={formatCurrency(c.revenueYear1)}
          sub={c.revenueLabel1 ? `(${c.revenueLabel1})` : undefined}
        />
        <KpiCard
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
              />
            </svg>
          }
          label="프로필 완성도"
          value={`${completeness}%`}
          progress={completeness}
        />
      </div>

      {/* ── Info Cards Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 기업 정보 요약 */}
        <div className="bg-white rounded-xl border border-blue-100 shadow-sm p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
              />
            </svg>
            기업 정보 요약
          </h3>
          <div className="space-y-0">
            <InfoRow label="대표자" value={c.ownerName || "-"} />
            <InfoRow label="사업자등록번호" value={formatBizRegNo(c.bizRegNo)} />
            <InfoRow label="법인등록번호" value={c.corpRegNo || "-"} />
            <InfoRow
              label="업종 / 업태"
              value={
                [c.businessSector, c.bizType].filter(Boolean).join(" / ") || "-"
              }
            />
            <InfoRow label="설립일" value={c.foundedDate || "-"} />
            <InfoRow label="주소" value={c.address || "-"} />
            <InfoRow label="전화번호" value={c.phone || "-"} />
          </div>
        </div>

        {/* 보험 관리번호 */}
        <div className="bg-white rounded-xl border border-blue-100 shadow-sm p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
            보험 관리번호
          </h3>
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-xs font-bold shrink-0">
                국
              </div>
              <div>
                <p className="text-xs text-gray-500">국민연금 관리번호</p>
                <p className="text-sm font-mono font-medium text-gray-900">
                  {c.npBizNo || "미등록"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
              <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-600 text-xs font-bold shrink-0">
                건
              </div>
              <div>
                <p className="text-xs text-gray-500">건강보험 관리번호</p>
                <p className="text-sm font-mono font-medium text-gray-900">
                  {c.hiBizNo || "미등록"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-orange-50 rounded-lg">
              <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 text-xs font-bold shrink-0">
                고
              </div>
              <div>
                <p className="text-xs text-gray-500">고용산재 관리번호</p>
                <p className="text-sm font-mono font-medium text-gray-900">
                  {c.eiBizNo || "미등록"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── 사업장 특성 ── */}
      <div className="bg-white rounded-xl border border-blue-100 shadow-sm p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
            />
          </svg>
          사업장 특성
        </h3>
        <div className="flex flex-wrap gap-3">
          <FeatureBadge label="제조업" active={!!c.isManufacturer} />
          <FeatureBadge label="연구소 보유" active={!!c.hasResearchInstitute} />
          <FeatureBadge label="전담부서 보유" active={!!c.hasRndDepartment} />
          <FeatureBadge label="나라장터 등록" active={!!c.isG2bRegistered} />
          <FeatureBadge
            label="수출기업"
            active={!!(c as ClientCompanyData & { isExporter?: boolean }).isExporter}
          />
          <FeatureBadge label="외국인 고용" active={!!c.hasForeignWorkers} />
        </div>
      </div>

      {/* ── Quick Actions ── */}
      <div className="bg-white rounded-xl border border-blue-100 shadow-sm p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 10V3L4 14h7v7l9-11h-7z"
            />
          </svg>
          빠른 실행
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <QuickAction
            href="/labor/insurance-calc"
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                />
              </svg>
            }
            label="4대보험 계산"
          />
          <QuickAction
            href="/labor/payslip"
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z"
                />
              </svg>
            }
            label="급여명세서"
          />
          <QuickAction
            href="/certification-check"
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
                />
              </svg>
            }
            label="인증 진단"
          />
          <QuickAction
            href="/fund-matching"
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
            }
            label="정부지원 매칭"
          />
        </div>
      </div>
    </div>
  );
}
