"use client";

import { Card, CardContent } from "@/components/ui";
import { MoneyField, NumberField } from "./FormField";

interface Props {
  form: Record<string, any>;
  onChange: (field: string, value: any) => void;
}

export default function FinancialSection({ form, onChange }: Props) {
  const currentYear = new Date().getFullYear();

  return (
    <div className="space-y-6">
      {/* 매출액 (3개년) */}
      <Card>
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            매출액 (최근 3개년)
          </h2>
          <div className="grid md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i}>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  {form[`revenueLabel${i}`] || `${currentYear - i}년`}
                </label>
                <MoneyField
                  label={`매출액 ${i}차년도`}
                  value={form[`revenueYear${i}`]}
                  onChange={(v) => onChange(`revenueYear${i}`, v)}
                />
              </div>
            ))}
          </div>
          <div className="mt-3 grid md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i}>
                <label className="block text-xs text-gray-400 mb-1">연도 라벨</label>
                <input
                  type="text"
                  value={form[`revenueLabel${i}`] || ""}
                  onChange={(e) => onChange(`revenueLabel${i}`, e.target.value)}
                  placeholder={`${currentYear - i}년`}
                  className="w-full px-3 py-1.5 border border-gray-200 rounded text-xs text-gray-500"
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 영업이익 / 당기순이익 */}
      <Card>
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">손익 정보 (최근 3개년)</h2>
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-2">영업이익</p>
              <div className="grid md:grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                  <MoneyField key={i} label={form[`revenueLabel${i}`] || `${currentYear - i}년`} value={form[`operatingProfitYear${i}`]} onChange={(v) => onChange(`operatingProfitYear${i}`, v)} />
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600 mb-2">당기순이익</p>
              <div className="grid md:grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                  <MoneyField key={i} label={form[`revenueLabel${i}`] || `${currentYear - i}년`} value={form[`netIncomeYear${i}`]} onChange={(v) => onChange(`netIncomeYear${i}`, v)} />
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 자산/부채/R&D */}
      <Card>
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">재무 상태</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <MoneyField label="총자산 (원)" value={form.totalAssets} onChange={(v) => onChange("totalAssets", v)} />
            <MoneyField label="총부채 (원)" value={form.totalLiabilities} onChange={(v) => onChange("totalLiabilities", v)} />
            <MoneyField label="연구개발비 (원)" value={form.rndExpenditure} onChange={(v) => onChange("rndExpenditure", v)} />
            <MoneyField label="수출액 (원)" value={form.exportAmount} onChange={(v) => onChange("exportAmount", v)} />
          </div>
        </CardContent>
      </Card>

      {/* 고용 정보 */}
      <Card>
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            고용 정보
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            <NumberField label="정규직 수" value={form.permanentEmployees} onChange={(v) => onChange("permanentEmployees", v)} suffix="명" />
            <NumberField label="연구원 수" value={form.researcherCount} onChange={(v) => onChange("researcherCount", v)} suffix="명" />
            <NumberField label="외국인 근로자 수" value={form.foreignEmployees} onChange={(v) => onChange("foreignEmployees", v)} suffix="명" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
