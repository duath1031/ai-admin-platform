"use client";

import { Card, CardContent } from "@/components/ui";
import { FormField, CheckboxField } from "./FormField";

interface Props {
  form: Record<string, any>;
  onChange: (field: string, value: any) => void;
}

export default function RndProcurementSection({ form, onChange }: Props) {
  return (
    <div className="space-y-6">
      {/* 연구소/전담부서 */}
      <Card>
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
            연구소 / 전담부서
          </h2>
          <div className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <CheckboxField label="기업부설연구소 보유" checked={form.hasResearchInstitute || false} onChange={(v) => onChange("hasResearchInstitute", v)} description="한국산업기술진흥협회 인정" />
              <CheckboxField label="연구개발전담부서 보유" checked={form.hasRndDepartment || false} onChange={(v) => onChange("hasRndDepartment", v)} description="한국산업기술진흥협회 인정" />
            </div>
            {(form.hasResearchInstitute || form.hasRndDepartment) && (
              <FormField label="연구소/전담부서 인정일" value={form.researchInstituteDate || ""} onChange={(v) => onChange("researchInstituteDate", v)} type="date" optional />
            )}
          </div>
        </CardContent>
      </Card>

      {/* 조달 정보 */}
      <Card>
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            조달 / 나라장터 정보
          </h2>
          <div className="space-y-4">
            <CheckboxField label="나라장터(G2B) 등록 업체" checked={form.isG2bRegistered || false} onChange={(v) => onChange("isG2bRegistered", v)} />
            {form.isG2bRegistered && (
              <FormField label="나라장터 업체등록번호" value={form.g2bRegistrationNumber || ""} onChange={(v) => onChange("g2bRegistrationNumber", v)} placeholder="업체등록번호" />
            )}
            <div className="grid md:grid-cols-2 gap-4">
              <CheckboxField label="직접생산확인증명 보유" checked={form.hasDirectProductionCert || false} onChange={(v) => onChange("hasDirectProductionCert", v)} />
              <CheckboxField label="다수공급자계약(MAS) 체결" checked={form.hasMasContract || false} onChange={(v) => onChange("hasMasContract", v)} />
            </div>
            <FormField label="주요 생산품목" value={form.mainProducts || ""} onChange={(v) => onChange("mainProducts", v)} placeholder="예: 소프트웨어, 서버 장비 (쉼표 구분)" optional />
            <FormField label="물품분류번호" value={form.productClassificationCodes || ""} onChange={(v) => onChange("productClassificationCodes", v)} placeholder="예: 43211500, 81112200 (쉼표 구분)" optional />
            {form.hasMasContract && (
              <FormField label="MAS 계약 품목" value={form.masItems || ""} onChange={(v) => onChange("masItems", v)} placeholder="예: 소프트웨어 라이선스 (쉼표 구분)" optional />
            )}
          </div>
        </CardContent>
      </Card>

      {/* 수출 정보 */}
      <Card>
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">수출 / 수입 정보</h2>
          <div className="space-y-4">
            <CheckboxField label="수출 기업" checked={form.isExporter || false} onChange={(v) => onChange("isExporter", v)} />
            {form.isExporter && (
              <>
                <FormField label="수출 대상국" value={form.exportCountries || ""} onChange={(v) => onChange("exportCountries", v)} placeholder="예: 미국, 일본, 베트남 (쉼표 구분)" />
                <FormField label="수입 품목" value={form.importItems || ""} onChange={(v) => onChange("importItems", v)} placeholder="예: 반도체 부품, 원자재 (쉼표 구분)" optional />
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 외국인 고용 */}
      <Card>
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">외국인 근로자 정보</h2>
          <div className="space-y-4">
            <CheckboxField label="외국인 근로자 고용 중" checked={form.hasForeignWorkers || false} onChange={(v) => onChange("hasForeignWorkers", v)} />
            {form.hasForeignWorkers && (
              <FormField label="비자 유형" value={form.foreignWorkerVisaTypes || ""} onChange={(v) => onChange("foreignWorkerVisaTypes", v)} placeholder="예: E-9, H-2, E-7 (쉼표 구분)" />
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
