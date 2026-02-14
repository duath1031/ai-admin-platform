"use client";

import { Card, CardContent } from "@/components/ui";
import { FormField, MoneyField, NumberField } from "./FormField";

// 사업자등록번호 자동 하이픈
function formatBizRegNo(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
}

// 법인등록번호 자동 하이픈
function formatCorpRegNo(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 13);
  if (digits.length <= 6) return digits;
  return `${digits.slice(0, 6)}-${digits.slice(6)}`;
}

const BUSINESS_SECTORS = [
  "", "제조업", "건설업", "서비스업", "도소매업", "정보통신업",
  "금융보험업", "부동산업", "전문과학기술서비스업", "교육서비스업",
  "보건복지업", "예술스포츠여가", "농림어업", "광업", "운수창고업", "기타",
];

interface Props {
  form: Record<string, any>;
  onChange: (field: string, value: any) => void;
  errors: Record<string, string>;
}

export default function BasicInfoSection({ form, onChange, errors }: Props) {
  return (
    <div className="space-y-6">
      {/* 기본 식별 정보 */}
      <Card>
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            기본 정보
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            <FormField label="상호 (회사명)" value={form.companyName || ""} onChange={(v) => onChange("companyName", v)} placeholder="예: 주식회사 어드미니" error={errors.companyName} />
            <FormField label="대표자명" value={form.ownerName || ""} onChange={(v) => onChange("ownerName", v)} placeholder="예: 염현수" error={errors.ownerName} />
            <FormField label="사업자등록번호" value={form.bizRegNo || ""} onChange={(v) => onChange("bizRegNo", formatBizRegNo(v))} placeholder="000-00-00000" error={errors.bizRegNo} maxLength={12} />
            <FormField label="법인등록번호" value={form.corpRegNo || ""} onChange={(v) => onChange("corpRegNo", formatCorpRegNo(v))} placeholder="000000-0000000" error={errors.corpRegNo} maxLength={14} optional />
            <div className="md:col-span-2">
              <FormField label="주소" value={form.address || ""} onChange={(v) => onChange("address", v)} placeholder="예: 서울특별시 강남구 테헤란로 123" error={errors.address} />
            </div>
            <FormField label="업태/종목" value={form.bizType || ""} onChange={(v) => onChange("bizType", v)} placeholder="예: 서비스업/행정사" error={errors.bizType} />
            <FormField label="설립일" value={form.foundedDate || ""} onChange={(v) => onChange("foundedDate", v)} type="date" error={errors.foundedDate} />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">대표자 성별</label>
              <select
                value={form.ceoGender || ""}
                onChange={(e) => onChange("ceoGender", e.target.value || null)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
              >
                <option value="">선택하세요</option>
                <option value="male">남성</option>
                <option value="female">여성</option>
              </select>
              <p className="text-xs text-gray-400 mt-1">여성기업 인증 진단에 활용됩니다</p>
            </div>
            <div className="flex items-start gap-3 md:col-span-2 mt-2">
              <label className="relative flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isYouthEntrepreneur || false}
                  onChange={(e) => onChange("isYouthEntrepreneur", e.target.checked)}
                  className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                />
                <span className="ml-2 text-sm font-medium text-gray-700">청년 창업자 (만 39세 이하)</span>
              </label>
              <p className="text-xs text-gray-400 mt-0.5">청년 정책자금, 보조금 매칭에 활용됩니다</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 업종 상세 */}
      <Card>
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
            업종 상세
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">업종 대분류</label>
              <select
                value={form.businessSector || ""}
                onChange={(e) => onChange("businessSector", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
              >
                <option value="">선택하세요</option>
                {BUSINESS_SECTORS.filter(Boolean).map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <FormField label="세부업종" value={form.businessSubType || ""} onChange={(v) => onChange("businessSubType", v)} placeholder="예: 소프트웨어 개발" optional />
            <FormField label="한국표준산업분류 코드" value={form.industryCode || ""} onChange={(v) => onChange("industryCode", v)} placeholder="예: J62010" optional />
            <FormField label="산업분류명" value={form.industryName || ""} onChange={(v) => onChange("industryName", v)} placeholder="예: 컴퓨터 프로그래밍 서비스업" optional />
            <FormField label="사업 개시일" value={form.establishmentDate || ""} onChange={(v) => onChange("establishmentDate", v)} type="date" optional />
          </div>
        </CardContent>
      </Card>

      {/* 기본 규모 */}
      <Card>
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">규모 정보</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <NumberField label="상시근로자 수" value={form.employeeCount} onChange={(v) => onChange("employeeCount", v ?? 0)} placeholder="0" suffix="명" />
            <MoneyField label="자본금 (원)" value={form.capital} onChange={(v) => onChange("capital", v ?? 0)} placeholder="예: 50,000,000" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
