"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui";
import { Button } from "@/components/ui";

interface CompanyProfile {
  companyName: string | null;
  ownerName: string | null;
  bizRegNo: string | null;
  corpRegNo: string | null;
  address: string | null;
  bizType: string | null;
  foundedDate: string | null;
  employeeCount: number;
  capital: number;
}

const EMPTY_PROFILE: CompanyProfile = {
  companyName: "",
  ownerName: "",
  bizRegNo: "",
  corpRegNo: "",
  address: "",
  bizType: "",
  foundedDate: "",
  employeeCount: 0,
  capital: 0,
};

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

// 자본금 표시 (만원 단위)
function formatCapitalDisplay(value: number): string {
  if (!value) return "";
  return value.toLocaleString("ko-KR");
}

export default function CompanyProfilePage() {
  const router = useRouter();
  const [form, setForm] = useState<CompanyProfile>(EMPTY_PROFILE);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const res = await fetch("/api/user/company-profile");
      const data = await res.json();
      if (data.success && data.data) {
        const p = data.data;
        setForm({
          companyName: p.companyName || "",
          ownerName: p.ownerName || "",
          bizRegNo: p.bizRegNo ? formatBizRegNo(p.bizRegNo) : "",
          corpRegNo: p.corpRegNo ? formatCorpRegNo(p.corpRegNo) : "",
          address: p.address || "",
          bizType: p.bizType || "",
          foundedDate: p.foundedDate ? p.foundedDate.split("T")[0] : "",
          employeeCount: p.employeeCount || 0,
          capital: p.capital || 0,
        });
      }
    } catch (error) {
      console.error("Failed to fetch company profile:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (field: keyof CompanyProfile, value: string | number) => {
    setErrors((prev) => ({ ...prev, [field]: "" }));
    setMessage(null);

    if (field === "bizRegNo") {
      setForm((prev) => ({ ...prev, bizRegNo: formatBizRegNo(String(value)) }));
      return;
    }
    if (field === "corpRegNo") {
      setForm((prev) => ({ ...prev, corpRegNo: formatCorpRegNo(String(value)) }));
      return;
    }

    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage(null);
    setErrors({});

    try {
      const payload = {
        companyName: form.companyName || null,
        ownerName: form.ownerName || null,
        bizRegNo: form.bizRegNo || null,
        corpRegNo: form.corpRegNo || null,
        address: form.address || null,
        bizType: form.bizType || null,
        foundedDate: form.foundedDate || null,
        employeeCount: Number(form.employeeCount) || 0,
        capital: Number(form.capital) || 0,
      };

      const res = await fetch("/api/user/company-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.details) {
          const fieldErrors: Record<string, string> = {};
          for (const [key, msgs] of Object.entries(data.details)) {
            fieldErrors[key] = (msgs as string[])[0];
          }
          setErrors(fieldErrors);
        }
        setMessage({ type: "error", text: data.error || "저장에 실패했습니다" });
        return;
      }

      setMessage({ type: "success", text: "기업 정보가 안전하게 저장되었습니다" });
    } catch (error) {
      console.error("Failed to save company profile:", error);
      setMessage({ type: "error", text: "서버 오류가 발생했습니다" });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* 헤더 */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
          <Link href="/mypage" className="hover:text-gray-700">
            마이페이지
          </Link>
          <span>/</span>
          <span className="text-gray-900">기업 정보 관리</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">기업 정보 관리</h1>
        <p className="text-gray-500 mt-1">
          등록된 기업 정보는 서류 자동 작성과 AI 상담 시 활용됩니다
        </p>
      </div>

      {/* 알림 메시지 */}
      {message && (
        <div
          className={`mb-6 p-4 rounded-lg border text-sm ${
            message.type === "success"
              ? "bg-green-50 border-green-200 text-green-800"
              : "bg-red-50 border-red-200 text-red-800"
          }`}
        >
          <div className="flex items-center gap-2">
            {message.type === "success" ? (
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : (
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            {message.text}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* 필수 식별 정보 */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              기본 정보
            </h2>

            <div className="grid md:grid-cols-2 gap-4">
              <FormField
                label="상호 (회사명)"
                value={form.companyName || ""}
                onChange={(v) => handleChange("companyName", v)}
                placeholder="예: 주식회사 어드미니"
                error={errors.companyName}
              />
              <FormField
                label="대표자명"
                value={form.ownerName || ""}
                onChange={(v) => handleChange("ownerName", v)}
                placeholder="예: 염현수"
                error={errors.ownerName}
              />
              <FormField
                label="사업자등록번호"
                value={form.bizRegNo || ""}
                onChange={(v) => handleChange("bizRegNo", v)}
                placeholder="000-00-00000"
                error={errors.bizRegNo}
                maxLength={12}
              />
              <FormField
                label="법인등록번호"
                value={form.corpRegNo || ""}
                onChange={(v) => handleChange("corpRegNo", v)}
                placeholder="000000-0000000 (선택)"
                error={errors.corpRegNo}
                maxLength={14}
                optional
              />
              <div className="md:col-span-2">
                <FormField
                  label="주소"
                  value={form.address || ""}
                  onChange={(v) => handleChange("address", v)}
                  placeholder="예: 서울특별시 강남구 테헤란로 123"
                  error={errors.address}
                />
              </div>
              <FormField
                label="업태/종목"
                value={form.bizType || ""}
                onChange={(v) => handleChange("bizType", v)}
                placeholder="예: 서비스업/행정사"
                error={errors.bizType}
              />
              <FormField
                label="설립일"
                value={form.foundedDate || ""}
                onChange={(v) => handleChange("foundedDate", v)}
                type="date"
                error={errors.foundedDate}
              />
            </div>
          </CardContent>
        </Card>

        {/* 부가 정보 */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              부가 정보
              <span className="text-xs font-normal text-gray-400">(인증/정책자금 분석 시 활용)</span>
            </h2>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  직원 수
                </label>
                <input
                  type="number"
                  value={form.employeeCount || ""}
                  onChange={(e) => handleChange("employeeCount", Number(e.target.value) || 0)}
                  placeholder="0"
                  min={0}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                />
                {errors.employeeCount && (
                  <p className="mt-1 text-xs text-red-600">{errors.employeeCount}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  자본금 (원)
                </label>
                <input
                  type="text"
                  value={form.capital ? formatCapitalDisplay(form.capital) : ""}
                  onChange={(e) => {
                    const num = Number(e.target.value.replace(/,/g, "")) || 0;
                    handleChange("capital", num);
                  }}
                  placeholder="예: 50,000,000"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                />
                {form.capital > 0 && (
                  <p className="mt-1 text-xs text-gray-500">
                    {form.capital >= 100000000
                      ? `${(form.capital / 100000000).toFixed(1)}억원`
                      : `${Math.round(form.capital / 10000).toLocaleString()}만원`}
                  </p>
                )}
                {errors.capital && (
                  <p className="mt-1 text-xs text-red-600">{errors.capital}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 안내 */}
        <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-100">
          <p className="text-sm text-blue-800">
            <strong>AI 비서 활용 안내:</strong> 저장된 기업 정보는 AI 상담 시 자동으로 참조되어,
            매번 사업자번호나 주소를 입력할 필요 없이 맞춤형 행정 서비스를 받으실 수 있습니다.
          </p>
        </div>

        {/* 버튼 */}
        <div className="flex items-center justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/mypage")}
          >
            돌아가기
          </Button>
          <Button type="submit" disabled={isSaving}>
            {isSaving ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                저장 중...
              </span>
            ) : (
              "저장하기"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

// 재사용 폼 필드 컴포넌트
function FormField({
  label,
  value,
  onChange,
  placeholder,
  error,
  type = "text",
  maxLength,
  optional,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
  type?: string;
  maxLength?: number;
  optional?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">
        {label}
        {optional && <span className="text-gray-400 font-normal ml-1">(선택)</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm ${
          error ? "border-red-300" : "border-gray-300"
        }`}
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
