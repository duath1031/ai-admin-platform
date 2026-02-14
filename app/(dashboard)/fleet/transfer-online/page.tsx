"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type ServiceType = "online_self" | "agent_visit" | null;

interface FormData {
  // 양도인
  sellerName: string;
  sellerPhone: string;
  sellerIdNumber: string;
  // 양수인
  buyerName: string;
  buyerPhone: string;
  buyerIdNumber: string;
  buyerAddress: string;
  // 차량
  vehicleName: string;
  plateNumber: string;
  modelYear: string;
  mileage: string;
  // 거래
  salePrice: string;
  transferDate: string;
  region: string;
  specialTerms: string;
}

const INITIAL_FORM: FormData = {
  sellerName: "",
  sellerPhone: "",
  sellerIdNumber: "",
  buyerName: "",
  buyerPhone: "",
  buyerIdNumber: "",
  buyerAddress: "",
  vehicleName: "",
  plateNumber: "",
  modelYear: "",
  mileage: "",
  salePrice: "",
  transferDate: new Date().toISOString().substring(0, 10),
  region: "서울",
  specialTerms: "",
};

const REGIONS = [
  "서울", "부산", "대구", "인천", "광주", "대전", "울산", "세종",
  "경기", "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주",
];

export default function TransferOnlinePage() {
  const router = useRouter();
  const [serviceType, setServiceType] = useState<ServiceType>(null);
  const [step, setStep] = useState(1); // 1: 양도인/양수인, 2: 차량/거래, 3: 확인, 4: 본인인증
  const [form, setForm] = useState<FormData>(INITIAL_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{ requestNumber: string; requestId: string } | null>(null);
  const [error, setError] = useState("");
  // RPA 본인인증 상태
  const [authStep, setAuthStep] = useState<"idle" | "requesting" | "waiting" | "confirming" | "done">("idle");
  const [rpaTaskId, setRpaTaskId] = useState("");
  const [carrier, setCarrier] = useState("SKT");

  const updateForm = (key: keyof FormData, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  // Step 1: DB 접수 + RPA 본인인증 요청
  const handleStartAuth = async () => {
    setIsSubmitting(true);
    setError("");
    setAuthStep("requesting");
    try {
      // DB에 접수 먼저 저장
      const dbRes = await fetch("/api/fleet/transfer-online", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceType: "online_self",
          sellerName: form.sellerName,
          sellerPhone: form.sellerPhone,
          sellerIdNumber: form.sellerIdNumber,
          buyerName: form.buyerName,
          buyerPhone: form.buyerPhone,
          buyerIdNumber: form.buyerIdNumber,
          buyerAddress: form.buyerAddress,
          vehicleName: form.vehicleName,
          plateNumber: form.plateNumber,
          modelYear: form.modelYear ? Number(form.modelYear) : null,
          mileage: form.mileage ? Number(form.mileage) : null,
          salePrice: Number(form.salePrice),
          transferDate: form.transferDate,
          region: form.region,
          specialTerms: form.specialTerms,
          agencyFee: 16500,
        }),
      });
      const dbData = await dbRes.json();
      if (!dbRes.ok) throw new Error(dbData.error || "접수 실패");

      // RPA 본인인증 요청
      const rpaRes = await fetch("/api/rpa/car365-transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "start",
          name: form.buyerName,
          phoneNumber: form.buyerPhone,
          carrier,
          birthDate: form.buyerIdNumber, // 생년월일 6자리
          sellerName: form.sellerName,
          sellerPhone: form.sellerPhone,
          buyerName: form.buyerName,
          buyerPhone: form.buyerPhone,
          buyerAddress: form.buyerAddress,
          vehicleName: form.vehicleName,
          plateNumber: form.plateNumber,
          modelYear: form.modelYear,
          mileage: form.mileage,
          salePrice: form.salePrice,
          transferDate: form.transferDate,
          region: form.region,
        }),
      });
      const rpaData = await rpaRes.json();

      if (rpaData.taskId) {
        setRpaTaskId(rpaData.taskId);
        setAuthStep("waiting");
        setStep(4);
      } else {
        // RPA 실패 시에도 DB 접수는 완료됨
        setResult({ requestNumber: dbData.data.requestNumber, requestId: dbData.data.requestId });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "접수 중 오류가 발생했습니다.");
      setAuthStep("idle");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Step 2: 인증 완료 후 RPA로 이전등록 제출
  const handleConfirmAuth = async () => {
    setIsSubmitting(true);
    setError("");
    setAuthStep("confirming");
    try {
      const res = await fetch("/api/rpa/car365-transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "confirm",
          taskId: rpaTaskId,
          autoSubmit: true,
        }),
      });
      const data = await res.json();

      if (data.success) {
        setAuthStep("done");
        setResult({
          requestNumber: data.receiptNumber || rpaTaskId.slice(0, 12),
          requestId: rpaTaskId,
        });
      } else {
        setError(data.error || "이전등록 제출에 실패했습니다.");
        setAuthStep("waiting");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "제출 중 오류가 발생했습니다.");
      setAuthStep("waiting");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── 접수 완료 화면 ──
  if (result) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center space-y-6">
        <div className="w-20 h-20 mx-auto bg-green-100 rounded-full flex items-center justify-center">
          <svg className="w-10 h-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-900">접수가 완료되었습니다!</h2>
        <div className="bg-gray-50 rounded-xl p-6 inline-block">
          <p className="text-sm text-gray-500">접수번호</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{result.requestNumber}</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 max-w-md mx-auto text-left">
          <h3 className="text-sm font-bold text-blue-800 mb-2">다음 절차 안내</h3>
          <ol className="text-sm text-blue-700 space-y-1.5 list-decimal list-inside">
            <li>접수 확인 후 자동차365에서 RPA로 이전등록 신청이 진행됩니다.</li>
            <li>양도인(매도인)에게 동의 요청 알림이 발송됩니다.</li>
            <li>양도인이 동의하면 이전등록 절차가 완료됩니다.</li>
            <li>완료 시 결과를 알려드립니다.</li>
          </ol>
        </div>
        <p className="text-sm text-gray-500">
          대행 비용: <strong>16,500원</strong> (VAT 포함) | 취등록세 별도
        </p>
        <div className="flex gap-3 justify-center pt-2">
          <button
            onClick={() => router.push("/fleet")}
            className="px-6 py-2.5 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
          >
            차량 관리
          </button>
          <button
            onClick={() => { setResult(null); setServiceType(null); setStep(1); setForm(INITIAL_FORM); }}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            새 접수
          </button>
        </div>
      </div>
    );
  }

  // ── 서비스 선택 전 ──
  if (!serviceType) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">이전등록 대행 접수</h1>
          <p className="text-sm text-gray-500 mt-1">원하시는 대행 방식을 선택해 주세요.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 온라인 이전대행 (자동차365) */}
          <button
            onClick={() => setServiceType("online_self")}
            className="group relative bg-white rounded-2xl border-2 border-gray-200 hover:border-blue-500 p-6 text-left transition-all hover:shadow-lg"
          >
            <div className="absolute top-4 right-4">
              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-bold rounded-full">추천</span>
            </div>
            <div className="w-14 h-14 rounded-xl bg-blue-50 group-hover:bg-blue-100 flex items-center justify-center mb-4 transition-colors">
              <svg className="w-7 h-7 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 0 1-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0 1 15 18.257V17.25m6-12V15a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 15V5.25m18 0A2.25 2.25 0 0 0 18.75 3H5.25A2.25 2.25 0 0 0 3 5.25m18 0V12a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 12V5.25" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">온라인 이전대행</h3>
            <p className="text-sm text-gray-500 mb-3">자동차365 RPA 자동 접수</p>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-blue-600">16,500</span>
              <span className="text-sm text-gray-500">원 (VAT 포함)</span>
            </div>
            <ul className="mt-4 space-y-1.5 text-xs text-gray-600">
              <li className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-blue-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                정보 입력 → 자동차365 자동 신청
              </li>
              <li className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-blue-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                양도인에게 동의 알림 자동 발송
              </li>
              <li className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-blue-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                동의 완료 시 이전등록 자동 처리
              </li>
              <li className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-blue-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                방문 없이 100% 온라인 처리
              </li>
            </ul>
          </button>

          {/* 행정사 직접 대행 */}
          <button
            onClick={() => setServiceType("agent_visit")}
            className="group bg-white rounded-2xl border-2 border-gray-200 hover:border-purple-500 p-6 text-left transition-all hover:shadow-lg"
          >
            <div className="w-14 h-14 rounded-xl bg-purple-50 group-hover:bg-purple-100 flex items-center justify-center mb-4 transition-colors">
              <svg className="w-7 h-7 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">행정사 직접 대행</h3>
            <p className="text-sm text-gray-500 mb-3">전문 행정사가 직접 방문 처리</p>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-purple-600">50,000</span>
              <span className="text-sm text-gray-500">원~ (별도 협의)</span>
            </div>
            <ul className="mt-4 space-y-1.5 text-xs text-gray-600">
              <li className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-purple-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                전화 상담 후 서류 전달
              </li>
              <li className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-purple-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                관할 차량등록사업소 직접 방문
              </li>
              <li className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-purple-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                법인·특수차량·저당 건 처리 가능
              </li>
              <li className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-purple-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                차종·지역에 따라 비용 상이
              </li>
            </ul>
          </button>
        </div>

        {/* 취등록세 계산기 링크 */}
        <div className="bg-gray-50 rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-semibold text-gray-800">취등록세가 얼마인지 궁금하신가요?</h4>
              <p className="text-xs text-gray-500 mt-0.5">차량 매매금액으로 취등록세를 미리 계산해 볼 수 있습니다.</p>
            </div>
            <a
              href="/fleet/transfer-cost"
              className="px-4 py-2 bg-white text-blue-600 text-sm font-medium rounded-lg border border-blue-200 hover:bg-blue-50 transition-colors flex-shrink-0 ml-4"
            >
              취등록세 계산
            </a>
          </div>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════
  // ── 행정사 직접 대행 (전화 접수) ──
  // ══════════════════════════════════════
  if (serviceType === "agent_visit") {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => setServiceType(null)} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
            <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">행정사 직접 대행</h1>
            <p className="text-sm text-gray-500">행정사합동사무소 정의 | 50,000원~ (별도 협의)</p>
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-600 to-purple-700 rounded-2xl p-6 text-white">
          <h2 className="text-lg font-bold mb-2">전문 행정사가 직접 처리합니다</h2>
          <p className="text-sm text-purple-200 leading-relaxed">
            관할 차량등록사업소(구청)에 직접 방문하여 이전등록을 대행합니다.
            법인 차량, 저당 설정 차량, 특수차량 등 온라인 처리가 어려운 건도 처리 가능합니다.
          </p>
        </div>

        {/* 필요서류 안내 */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-base font-bold text-gray-900 mb-4">필요서류 안내</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-red-50 rounded-xl p-5 border border-red-100">
              <h4 className="text-sm font-bold text-red-700 mb-3">매도인 (양도인)</h4>
              <ul className="space-y-2 text-sm text-gray-700">
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-red-200 text-red-700 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">1</span>
                  자동차등록증 원본
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-red-200 text-red-700 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">2</span>
                  <div>매매용 인감증명서<br /><span className="text-xs text-gray-500">매수인 인적사항 기재 필수</span></div>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-red-200 text-red-700 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">3</span>
                  <div>현재 운행 키로수<br /><span className="text-xs text-gray-500">사진 또는 구두 전달</span></div>
                </li>
              </ul>
            </div>
            <div className="bg-blue-50 rounded-xl p-5 border border-blue-100">
              <h4 className="text-sm font-bold text-blue-700 mb-3">매수인 (양수인)</h4>
              <ul className="space-y-2 text-sm text-gray-700">
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-blue-200 text-blue-700 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">1</span>
                  신분증 사본
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-blue-200 text-blue-700 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">2</span>
                  <div>자동차보험 가입<br /><span className="text-xs text-gray-500">이전등록 전 반드시 가입 필수</span></div>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* 주의사항 */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
          <h4 className="text-sm font-semibold text-amber-800 mb-2">주의사항</h4>
          <ul className="space-y-1 text-xs text-amber-700">
            <li>- 차량에 <strong>저당(근저당)</strong>이 설정되어 있는 경우 별도 상담이 필요합니다.</li>
            <li>- <strong>법인 차량</strong>의 경우 추가 서류가 필요할 수 있습니다.</li>
            <li>- 지게차(건설기계), 수출말소 차량, 영업용 차량(노란색 번호판)은 별도 문의하세요.</li>
            <li>- 서류는 <strong>등기 발송</strong> 또는 <strong>방문 전달</strong>로 보내주셔야 합니다.</li>
          </ul>
        </div>

        {/* 전화 접수 CTA */}
        <div className="bg-white rounded-2xl border-2 border-purple-200 p-8 text-center">
          <h3 className="text-xl font-bold text-gray-900 mb-2">전화로 바로 접수하세요</h3>
          <p className="text-sm text-gray-500 mb-5">
            필요서류를 준비하신 후 전화해 주시면 담당 행정사가 안내해 드립니다.
          </p>
          <a
            href="tel:070-8657-1888"
            className="inline-flex items-center gap-3 px-8 py-4 bg-purple-600 text-white text-lg font-bold rounded-xl hover:bg-purple-700 transition-colors shadow-lg shadow-purple-200"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
            </svg>
            070-8657-1888
          </a>
          <p className="text-xs text-gray-400 mt-3">행정사합동사무소 정의 | 평일 09:00~18:00</p>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════
  // ── 온라인 이전대행 (자동차365 RPA) ──
  // ══════════════════════════════════════
  const canProceedStep1 = form.sellerName && form.buyerName && form.buyerPhone;
  const canProceedStep2 = form.vehicleName && form.salePrice && Number(form.salePrice) > 0;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* 헤더 */}
      <div className="flex items-center gap-3">
        <button onClick={() => setServiceType(null)} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
          <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">온라인 이전대행 신청</h1>
          <p className="text-sm text-gray-500">자동차365 RPA 자동 접수 | 16,500원 (VAT 포함)</p>
        </div>
      </div>

      {/* 진행 단계 표시 */}
      <div className="flex items-center gap-2">
        {[
          { num: 1, label: "당사자 정보" },
          { num: 2, label: "차량·거래" },
          { num: 3, label: "확인" },
          { num: 4, label: "본인인증" },
        ].map((s, i) => (
          <div key={s.num} className="flex items-center gap-2 flex-1">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
              step >= s.num ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-500"
            }`}>
              {step > s.num ? (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
              ) : s.num}
            </div>
            <span className={`text-xs font-medium hidden sm:inline ${step >= s.num ? "text-blue-600" : "text-gray-400"}`}>{s.label}</span>
            {i < 3 && <div className={`flex-1 h-0.5 ${step > s.num ? "bg-blue-600" : "bg-gray-200"}`} />}
          </div>
        ))}
      </div>

      {/* ─── Step 1: 양도인/양수인 정보 ─── */}
      {step === 1 && (
        <div className="space-y-5">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-xs font-bold">매</span>
              양도인 (매도인) 정보
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">성명 <span className="text-red-500">*</span></label>
                <input type="text" value={form.sellerName} onChange={(e) => updateForm("sellerName", e.target.value)}
                  placeholder="양도인 성명" className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">연락처</label>
                <input type="tel" value={form.sellerPhone} onChange={(e) => updateForm("sellerPhone", e.target.value)}
                  placeholder="010-0000-0000" className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">주민등록번호 (앞 6자리)</label>
                <input type="text" value={form.sellerIdNumber} onChange={(e) => updateForm("sellerIdNumber", e.target.value)}
                  placeholder="생년월일 6자리" maxLength={6} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold">매</span>
              양수인 (매수인) 정보
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">성명 <span className="text-red-500">*</span></label>
                <input type="text" value={form.buyerName} onChange={(e) => updateForm("buyerName", e.target.value)}
                  placeholder="양수인 성명" className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">연락처 <span className="text-red-500">*</span></label>
                <input type="tel" value={form.buyerPhone} onChange={(e) => updateForm("buyerPhone", e.target.value)}
                  placeholder="010-0000-0000" className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">주민등록번호 (앞 6자리)</label>
                <input type="text" value={form.buyerIdNumber} onChange={(e) => updateForm("buyerIdNumber", e.target.value)}
                  placeholder="생년월일 6자리" maxLength={6} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">주소</label>
                <input type="text" value={form.buyerAddress} onChange={(e) => updateForm("buyerAddress", e.target.value)}
                  placeholder="등록지 주소" className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={() => setStep(2)}
              disabled={!canProceedStep1}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              다음
            </button>
          </div>
        </div>
      )}

      {/* ─── Step 2: 차량·거래 정보 ─── */}
      {step === 2 && (
        <div className="space-y-5">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-base font-bold text-gray-900 mb-4">차량 정보</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">차명 <span className="text-red-500">*</span></label>
                <input type="text" value={form.vehicleName} onChange={(e) => updateForm("vehicleName", e.target.value)}
                  placeholder="예: 쏘나타 DN8" className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">차량번호</label>
                <input type="text" value={form.plateNumber} onChange={(e) => updateForm("plateNumber", e.target.value)}
                  placeholder="12가 3456" className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">연식</label>
                <input type="text" value={form.modelYear} onChange={(e) => updateForm("modelYear", e.target.value)}
                  placeholder="2023" maxLength={4} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">주행거리 (km)</label>
                <input type="text" value={form.mileage} onChange={(e) => updateForm("mileage", e.target.value.replace(/\D/g, ""))}
                  placeholder="50000" className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-base font-bold text-gray-900 mb-4">거래 정보</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">매매금액 (원) <span className="text-red-500">*</span></label>
                <input type="text" value={form.salePrice} onChange={(e) => updateForm("salePrice", e.target.value.replace(/\D/g, ""))}
                  placeholder="15000000" className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                {form.salePrice && (
                  <p className="text-xs text-gray-500 mt-1">{Number(form.salePrice).toLocaleString()}원</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">양도일자</label>
                <input type="date" value={form.transferDate} onChange={(e) => updateForm("transferDate", e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">등록 지역</label>
                <select value={form.region} onChange={(e) => updateForm("region", e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                  {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">특약사항</label>
                <input type="text" value={form.specialTerms} onChange={(e) => updateForm("specialTerms", e.target.value)}
                  placeholder="선택 입력" className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
              </div>
            </div>
          </div>

          <div className="flex justify-between">
            <button onClick={() => setStep(1)} className="px-6 py-2.5 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors">
              이전
            </button>
            <button
              onClick={() => setStep(3)}
              disabled={!canProceedStep2}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              다음
            </button>
          </div>
        </div>
      )}

      {/* ─── Step 3: 확인·접수 ─── */}
      {step === 3 && (
        <div className="space-y-5">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-base font-bold text-gray-900 mb-4">신청 내용 확인</h3>

            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">양도인 (매도인)</h4>
                <p className="text-sm font-medium">{form.sellerName} {form.sellerPhone && `/ ${form.sellerPhone}`}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">양수인 (매수인)</h4>
                <p className="text-sm font-medium">{form.buyerName} / {form.buyerPhone}</p>
                {form.buyerAddress && <p className="text-xs text-gray-500 mt-0.5">{form.buyerAddress}</p>}
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">차량</h4>
                <p className="text-sm font-medium">{form.vehicleName} {form.plateNumber && `(${form.plateNumber})`}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {form.modelYear && `${form.modelYear}년식`}
                  {form.mileage && ` / ${Number(form.mileage).toLocaleString()}km`}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">거래</h4>
                <p className="text-sm font-medium">매매금액: {Number(form.salePrice).toLocaleString()}원</p>
                <p className="text-xs text-gray-500 mt-0.5">양도일: {form.transferDate} / 지역: {form.region}</p>
                {form.specialTerms && <p className="text-xs text-gray-500 mt-0.5">특약: {form.specialTerms}</p>}
              </div>
            </div>
          </div>

          {/* 비용 안내 */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
            <h4 className="text-sm font-bold text-blue-800 mb-3">비용 안내</h4>
            <div className="flex justify-between items-center py-2 border-b border-blue-200">
              <span className="text-sm text-blue-700">온라인 이전대행 수수료</span>
              <span className="text-sm font-bold text-blue-900">16,500원</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-sm text-blue-700">취등록세 (별도)</span>
              <span className="text-sm text-blue-600">차량 등록 시 납부</span>
            </div>
            <p className="text-xs text-blue-500 mt-2">* 대행 수수료는 접수 확인 후 별도 안내됩니다.</p>
          </div>

          {/* 절차 안내 */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h4 className="text-sm font-bold text-gray-800 mb-3">접수 후 절차</h4>
            <ol className="space-y-2 text-sm text-gray-600">
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold flex-shrink-0">1</span>
                접수 확인 후 <strong>자동차365</strong>에서 RPA로 양수인 이전등록 신청
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold flex-shrink-0">2</span>
                양도인(매도인)에게 <strong>동의 요청 알림</strong> 자동 발송
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold flex-shrink-0">3</span>
                양도인이 동의하면 이전등록 <strong>자동 완료</strong>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-xs font-bold flex-shrink-0">4</span>
                처리 결과 알림 발송
              </li>
            </ol>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* 본인인증 수단 */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h4 className="text-sm font-bold text-gray-800 mb-3">본인인증 (양수인)</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">통신사</label>
                <select value={carrier} onChange={(e) => setCarrier(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                  <option value="SKT">SKT</option>
                  <option value="KT">KT</option>
                  <option value="LGU+">LG U+</option>
                  <option value="SKT_MVNO">SKT 알뜰폰</option>
                  <option value="KT_MVNO">KT 알뜰폰</option>
                  <option value="LGU+_MVNO">LG 알뜰폰</option>
                </select>
              </div>
              <div className="flex items-end">
                <p className="text-xs text-gray-500 pb-2">
                  자동차365에서 휴대폰 본인인증이 진행됩니다.
                </p>
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex justify-between">
            <button onClick={() => setStep(2)} className="px-6 py-2.5 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors">
              이전
            </button>
            <button
              onClick={handleStartAuth}
              disabled={isSubmitting}
              className="px-8 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>
                  인증 요청 중...
                </>
              ) : "본인인증 후 접수하기"}
            </button>
          </div>
        </div>
      )}

      {/* ─── Step 4: 본인인증 대기 ─── */}
      {step === 4 && (
        <div className="space-y-5">
          <div className="bg-white rounded-xl border-2 border-blue-200 p-8 text-center">
            <div className="w-20 h-20 mx-auto bg-blue-50 rounded-full flex items-center justify-center mb-4">
              <svg className="w-10 h-10 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 0 0 6 3.75v16.5a2.25 2.25 0 0 0 2.25 2.25h7.5A2.25 2.25 0 0 0 18 20.25V3.75a2.25 2.25 0 0 0-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">휴대폰 본인인증</h3>
            <p className="text-sm text-gray-600 mb-1">
              <strong>{form.buyerName}</strong>님의 휴대폰으로 인증 요청이 발송되었습니다.
            </p>
            <p className="text-sm text-gray-500 mb-6">
              휴대폰에서 인증을 완료한 후 아래 버튼을 눌러주세요.
            </p>

            <div className="bg-blue-50 rounded-xl p-4 mb-6 max-w-sm mx-auto">
              <div className="flex items-center gap-3 justify-center">
                {authStep === "waiting" && (
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-yellow-400 rounded-full animate-pulse" />
                    <span className="text-sm font-medium text-yellow-700">인증 대기 중</span>
                  </div>
                )}
                {authStep === "confirming" && (
                  <div className="flex items-center gap-2">
                    <svg className="animate-spin w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>
                    <span className="text-sm font-medium text-blue-700">이전등록 처리 중...</span>
                  </div>
                )}
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700 mb-4 max-w-sm mx-auto">
                {error}
              </div>
            )}

            <button
              onClick={handleConfirmAuth}
              disabled={isSubmitting || authStep === "confirming"}
              className="px-8 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors text-lg"
            >
              {authStep === "confirming" ? "처리 중..." : "인증 완료 - 이전등록 진행"}
            </button>

            <p className="text-xs text-gray-400 mt-4">
              인증이 오지 않으면 이전 단계로 돌아가 다시 시도해 주세요.
            </p>
            <button
              onClick={() => { setStep(3); setAuthStep("idle"); setError(""); }}
              className="text-sm text-gray-500 underline mt-2 hover:text-gray-700"
            >
              이전 단계로 돌아가기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
