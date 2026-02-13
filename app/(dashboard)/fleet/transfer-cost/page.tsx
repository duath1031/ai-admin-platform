"use client";

import { useState, useCallback, useRef } from "react";
import {
  calculateTransferCost,
  REGIONS,
  VEHICLE_TYPES,
  FUEL_TYPES,
  type TransferCostInput,
  type TransferCostResult,
} from "@/lib/fleet/transferCostCalculator";

// ─── Helpers ───

function formatNumber(v: string): string {
  const num = v.replace(/[^\d]/g, "");
  if (!num) return "";
  return Number(num).toLocaleString();
}

function parseNumber(v: string): number {
  return Number(v.replace(/[^\d]/g, "")) || 0;
}

function formatWon(amount: number): string {
  if (amount >= 100_000_000) {
    const eok = Math.floor(amount / 100_000_000);
    const man = Math.floor((amount % 100_000_000) / 10_000);
    return man > 0 ? `${eok}억 ${man.toLocaleString()}만원` : `${eok}억원`;
  }
  if (amount >= 10_000) {
    const man = Math.floor(amount / 10_000);
    return `${man.toLocaleString()}만원`;
  }
  return `${amount.toLocaleString()}원`;
}

// ─── Main Page ───

export default function TransferCostPage() {
  // ── Input state ──
  const [vehicleType, setVehicleType] = useState<string>("sedan");
  const [purchasePriceStr, setPurchasePriceStr] = useState<string>("");
  const [displacementStr, setDisplacementStr] = useState<string>("");
  const [region, setRegion] = useState<string>("서울");
  const [transferType, setTransferType] = useState<"new" | "used">("new");
  const [isCommercial, setIsCommercial] = useState(false);
  const [isElectric, setIsElectric] = useState(false);
  const [isHybrid, setIsHybrid] = useState(false);
  const [isDisabled, setIsDisabled] = useState(false);
  const [isMultiChild, setIsMultiChild] = useState(false);

  // ── Result state ──
  const [result, setResult] = useState<TransferCostResult | null>(null);
  const [error, setError] = useState("");

  // ── Ref for print area ──
  const resultRef = useRef<HTMLDivElement>(null);

  // ── Calculate ──
  const handleCalculate = useCallback(() => {
    setError("");
    const purchasePrice = parseNumber(purchasePriceStr);
    if (!purchasePrice || purchasePrice <= 0) {
      setError("취득가액을 입력해주세요.");
      return;
    }

    const input: TransferCostInput = {
      vehicleType: vehicleType as TransferCostInput["vehicleType"],
      purchasePrice,
      displacement: displacementStr ? Number(displacementStr) : undefined,
      region,
      transferType,
      isCommercial,
      isElectric,
      isHybrid: isHybrid && !isElectric,
      isDisabled,
      isMultiChild,
    };

    try {
      const res = calculateTransferCost(input);
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "계산 중 오류가 발생했습니다.");
    }
  }, [
    vehicleType,
    purchasePriceStr,
    displacementStr,
    region,
    transferType,
    isCommercial,
    isElectric,
    isHybrid,
    isDisabled,
    isMultiChild,
  ]);

  // ── Reset ──
  const handleReset = () => {
    setVehicleType("sedan");
    setPurchasePriceStr("");
    setDisplacementStr("");
    setRegion("서울");
    setTransferType("new");
    setIsCommercial(false);
    setIsElectric(false);
    setIsHybrid(false);
    setIsDisabled(false);
    setIsMultiChild(false);
    setResult(null);
    setError("");
  };

  // ── Copy to clipboard ──
  const handleCopy = () => {
    if (!result) return;
    const lines = [
      `[취등록세 계산 결과]`,
      `취득가액: ${parseNumber(purchasePriceStr).toLocaleString()}원`,
      `차종: ${VEHICLE_TYPES.find((t) => t.value === vehicleType)?.label || vehicleType}`,
      `지역: ${region}`,
      `신차/중고: ${transferType === "new" ? "신차" : "중고차"}`,
      ``,
      ...result.breakdown.map(
        (b) => `${b.label}: ${b.amount.toLocaleString()}원${b.note ? ` (${b.note})` : ""}`
      ),
      ``,
      `세금 합계: ${result.totalTax.toLocaleString()}원`,
      `총 예상 비용: ${result.totalCost.toLocaleString()}원`,
    ];

    if (result.discounts.length > 0) {
      lines.push(``, `[감면 내역]`);
      result.discounts.forEach((d) => {
        lines.push(`${d.name}: -${d.amount.toLocaleString()}원`);
      });
    }

    lines.push(``, `* 어드미니(Admini) 취등록세 계산기`);

    navigator.clipboard.writeText(lines.join("\n")).then(() => {
      alert("클립보드에 복사되었습니다.");
    });
  };

  // ── Print ──
  const handlePrint = () => {
    window.print();
  };

  return (
    <>
      {/* Print-only result view */}
      {result && (
        <div className="hidden print:block fixed inset-0 bg-white z-[9999] p-8">
          <style>{`
            @media print {
              body * { visibility: hidden; }
              .print\\:block, .print\\:block * { visibility: visible !important; }
            }
          `}</style>
          <PrintResult
            result={result}
            vehicleType={vehicleType}
            purchasePrice={parseNumber(purchasePriceStr)}
            region={region}
            transferType={transferType}
            isCommercial={isCommercial}
            displacement={displacementStr ? Number(displacementStr) : undefined}
          />
        </div>
      )}

      {/* Main content */}
      <div className="max-w-7xl mx-auto space-y-6 print:hidden">
        {/* ── Header ── */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">취등록세 계산기</h1>
          <p className="text-sm text-gray-500 mt-1">
            자동차 이전등록 시 필요한 취득세, 등록면허세, 공채매입비 등을 계산합니다 (2026년 기준)
          </p>
        </div>

        {/* ── 2-Column Layout ── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* ── Left: Input Form ── */}
          <div className="lg:col-span-3 space-y-5">
            <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
              <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 15.75V18m-7.5-6.75h.008v.008H8.25v-.008Zm0 2.25h.008v.008H8.25V13.5Zm0 2.25h.008v.008H8.25v-.008Zm0 2.25h.008v.008H8.25V18Zm2.498-6.75h.007v.008h-.007v-.008Zm0 2.25h.007v.008h-.007V13.5Zm0 2.25h.007v.008h-.007v-.008Zm0 2.25h.007v.008h-.007V18Zm2.504-6.75h.008v.008h-.008v-.008Zm0 2.25h.008v.008h-.008V13.5Zm0 2.25h.008v.008h-.008v-.008Zm0 2.25h.008v.008h-.008V18Zm2.498-6.75h.008v.008h-.008v-.008Zm0 2.25h.008v.008h-.008V13.5ZM8.25 6h7.5v2.25h-7.5V6ZM12 2.25c-1.892 0-3.758.11-5.593.322C5.307 2.7 4.5 3.65 4.5 4.757V19.5a2.25 2.25 0 0 0 2.25 2.25h10.5a2.25 2.25 0 0 0 2.25-2.25V4.757c0-1.108-.806-2.057-1.907-2.185A48.507 48.507 0 0 0 12 2.25Z" />
                </svg>
                차량 정보 입력
              </h2>

              {/* 차종 */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">차종</label>
                <select
                  value={vehicleType}
                  onChange={(e) => setVehicleType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                >
                  {VEHICLE_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* 취득가액 */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  취득가액 (원) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={purchasePriceStr}
                  onChange={(e) => setPurchasePriceStr(formatNumber(e.target.value))}
                  placeholder="30,000,000"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-mono"
                />
                {purchasePriceStr && (
                  <p className="text-xs text-gray-400 mt-1">
                    {formatWon(parseNumber(purchasePriceStr))}
                  </p>
                )}
              </div>

              {/* 배기량 & 지역 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">배기량 (cc)</label>
                  <input
                    type="number"
                    value={displacementStr}
                    onChange={(e) => setDisplacementStr(e.target.value)}
                    placeholder="1598"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                  <p className="text-xs text-gray-400 mt-1">공채매입 비율 결정에 사용</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">지역</label>
                  <select
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  >
                    {REGIONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-400 mt-1">공채매입 비율이 지역별로 상이</p>
                </div>
              </div>

              {/* 신차/중고 */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-2">취득 유형</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="transferType"
                      checked={transferType === "new"}
                      onChange={() => setTransferType("new")}
                      className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">신차</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="transferType"
                      checked={transferType === "used"}
                      onChange={() => setTransferType("used")}
                      className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">중고차 (이전등록)</span>
                  </label>
                </div>
              </div>

              {/* Toggle options */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-3">감면/특수 조건</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <ToggleOption
                    checked={isCommercial}
                    onChange={setIsCommercial}
                    label="영업용 차량"
                    description="취득세율 4% 적용"
                  />
                  <ToggleOption
                    checked={isElectric}
                    onChange={(v) => {
                      setIsElectric(v);
                      if (v) setIsHybrid(false);
                    }}
                    label="전기차"
                    description="취득세 최대 140만원 감면"
                  />
                  <ToggleOption
                    checked={isHybrid}
                    onChange={(v) => {
                      setIsHybrid(v);
                      if (v) setIsElectric(false);
                    }}
                    label="하이브리드"
                    description="취득세 최대 40만원 감면"
                    disabled={isElectric}
                  />
                  <ToggleOption
                    checked={isDisabled}
                    onChange={setIsDisabled}
                    label="장애인 감면"
                    description="취득세 전액 면제"
                  />
                  <ToggleOption
                    checked={isMultiChild}
                    onChange={setIsMultiChild}
                    label="다자녀 감면 (3자녀 이상)"
                    description="취득세 50% 감면 (최대 140만원)"
                    disabled={isDisabled}
                  />
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleCalculate}
                  className="flex-1 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors text-sm"
                >
                  계산하기
                </button>
                <button
                  onClick={handleReset}
                  className="px-6 py-3 bg-gray-100 text-gray-600 font-medium rounded-lg hover:bg-gray-200 transition-colors text-sm"
                >
                  초기화
                </button>
              </div>
            </div>

            {/* ── Info note ── */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-sm text-yellow-800 space-y-1">
              <p className="font-semibold">참고 안내</p>
              <ul className="list-disc list-inside space-y-0.5 text-xs text-yellow-700">
                <li>본 계산기는 2026년 기준 세율로 계산되며, 실제 금액과 차이가 있을 수 있습니다.</li>
                <li>공채매입 할인율은 시장 상황에 따라 변동됩니다 (현재 4% 기준).</li>
                <li>정확한 금액은 관할 구청 또는 차량등록사업소에 문의하세요.</li>
                <li>경차(1000cc 이하)는 취득세율 4%가 자동 적용됩니다.</li>
              </ul>
            </div>
          </div>

          {/* ── Right: Result Panel ── */}
          <div className="lg:col-span-2">
            <div className="lg:sticky lg:top-6 space-y-4" ref={resultRef}>
              {result ? (
                <>
                  {/* Total cost hero */}
                  <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl p-6 text-white">
                    <p className="text-sm text-blue-200 mb-1">총 예상 비용</p>
                    <p className="text-3xl font-bold tracking-tight">
                      {result.totalCost.toLocaleString()}
                      <span className="text-lg font-normal ml-1">원</span>
                    </p>
                    <p className="text-xs text-blue-300 mt-2">
                      {formatWon(result.totalCost)}
                    </p>
                    <div className="mt-4 pt-3 border-t border-blue-500/40">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-blue-200">세금 합계</span>
                        <span className="font-semibold">{result.totalTax.toLocaleString()}원</span>
                      </div>
                      <div className="flex items-center justify-between text-sm mt-1">
                        <span className="text-blue-200">공채할인 + 기타</span>
                        <span className="font-semibold">
                          {(result.totalCost - result.totalTax).toLocaleString()}원
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Breakdown table */}
                  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                      <h3 className="text-sm font-semibold text-gray-800">비용 상세 내역</h3>
                    </div>
                    <div className="divide-y divide-gray-100">
                      {result.breakdown.map((item, i) => (
                        <div
                          key={i}
                          className="flex items-start justify-between px-4 py-3 text-sm"
                        >
                          <div>
                            <span className="text-gray-700 font-medium">{item.label}</span>
                            {item.note && (
                              <p className="text-xs text-gray-400 mt-0.5">{item.note}</p>
                            )}
                          </div>
                          <span className="font-mono text-gray-900 whitespace-nowrap ml-4">
                            {item.amount.toLocaleString()}원
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="px-4 py-3 bg-blue-50 border-t border-blue-100 flex items-center justify-between">
                      <span className="text-sm font-semibold text-blue-800">총 비용</span>
                      <span className="text-sm font-bold font-mono text-blue-900">
                        {result.totalCost.toLocaleString()}원
                      </span>
                    </div>
                  </div>

                  {/* Discounts */}
                  {result.discounts.length > 0 && (
                    <div className="bg-green-50 rounded-xl border border-green-200 overflow-hidden">
                      <div className="px-4 py-3 bg-green-100/50 border-b border-green-200">
                        <h3 className="text-sm font-semibold text-green-800">감면 내역</h3>
                      </div>
                      <div className="divide-y divide-green-100">
                        {result.discounts.map((d, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between px-4 py-3 text-sm"
                          >
                            <span className="text-green-700">{d.name}</span>
                            <span className="font-mono text-green-800 font-semibold">
                              -{d.amount.toLocaleString()}원
                            </span>
                          </div>
                        ))}
                      </div>
                      <div className="px-4 py-2.5 bg-green-100/30 border-t border-green-200 text-right">
                        <span className="text-xs text-green-600">
                          총 감면:{" "}
                          <span className="font-semibold">
                            -{result.discounts.reduce((sum, d) => sum + d.amount, 0).toLocaleString()}원
                          </span>
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Copy / Print buttons */}
                  <div className="flex gap-3">
                    <button
                      onClick={handleCopy}
                      className="flex-1 py-2.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors flex items-center justify-center gap-1.5"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9.75a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184" />
                      </svg>
                      복사
                    </button>
                    <button
                      onClick={handlePrint}
                      className="flex-1 py-2.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors flex items-center justify-center gap-1.5"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5Zm-3 0h.008v.008H15V10.5Z" />
                      </svg>
                      인쇄
                    </button>
                  </div>
                </>
              ) : (
                /* Placeholder when no result */
                <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-50 mb-4">
                    <svg className="w-8 h-8 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 15.75V18m-7.5-6.75h.008v.008H8.25v-.008Zm0 2.25h.008v.008H8.25V13.5Zm0 2.25h.008v.008H8.25v-.008Zm0 2.25h.008v.008H8.25V18Zm2.498-6.75h.007v.008h-.007v-.008Zm0 2.25h.007v.008h-.007V13.5Zm0 2.25h.007v.008h-.007v-.008Zm0 2.25h.007v.008h-.007V18Zm2.504-6.75h.008v.008h-.008v-.008Zm0 2.25h.008v.008h-.008V13.5Zm0 2.25h.008v.008h-.008v-.008Zm0 2.25h.008v.008h-.008V18Zm2.498-6.75h.008v.008h-.008v-.008Zm0 2.25h.008v.008h-.008V13.5ZM8.25 6h7.5v2.25h-7.5V6ZM12 2.25c-1.892 0-3.758.11-5.593.322C5.307 2.7 4.5 3.65 4.5 4.757V19.5a2.25 2.25 0 0 0 2.25 2.25h10.5a2.25 2.25 0 0 0 2.25-2.25V4.757c0-1.108-.806-2.057-1.907-2.185A48.507 48.507 0 0 0 12 2.25Z" />
                    </svg>
                  </div>
                  <p className="text-gray-500 text-sm font-medium">
                    차량 정보를 입력하고 계산하기를 클릭하세요
                  </p>
                  <p className="text-gray-400 text-xs mt-1">
                    취득세, 등록면허세, 공채매입비 등이 자동 계산됩니다
                  </p>

                  {/* Quick examples */}
                  <div className="mt-6 space-y-2">
                    <p className="text-xs text-gray-500 font-medium">빠른 예시</p>
                    <div className="flex flex-wrap justify-center gap-2">
                      <QuickButton
                        label="승용차 3천만원"
                        onClick={() => {
                          setVehicleType("sedan");
                          setPurchasePriceStr("30,000,000");
                          setDisplacementStr("1598");
                          setRegion("서울");
                          setTransferType("new");
                        }}
                      />
                      <QuickButton
                        label="SUV 5천만원"
                        onClick={() => {
                          setVehicleType("suv");
                          setPurchasePriceStr("50,000,000");
                          setDisplacementStr("2497");
                          setRegion("서울");
                          setTransferType("new");
                        }}
                      />
                      <QuickButton
                        label="전기차 6천만원"
                        onClick={() => {
                          setVehicleType("sedan");
                          setPurchasePriceStr("60,000,000");
                          setDisplacementStr("");
                          setRegion("서울");
                          setTransferType("new");
                          setIsElectric(true);
                          setIsHybrid(false);
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Toggle Option Component ───

function ToggleOption({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description: string;
  disabled?: boolean;
}) {
  return (
    <label
      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
        disabled
          ? "border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed"
          : checked
          ? "border-blue-200 bg-blue-50"
          : "border-gray-200 bg-white hover:bg-gray-50"
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => !disabled && onChange(e.target.checked)}
        disabled={disabled}
        className="mt-0.5 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
      />
      <div>
        <p className="text-sm font-medium text-gray-700">{label}</p>
        <p className="text-xs text-gray-400 mt-0.5">{description}</p>
      </div>
    </label>
  );
}

// ─── Quick Button Component ───

function QuickButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 bg-blue-50 text-blue-600 text-xs font-medium rounded-lg hover:bg-blue-100 transition-colors"
    >
      {label}
    </button>
  );
}

// ─── Print Result Component ───

function PrintResult({
  result,
  vehicleType,
  purchasePrice,
  region,
  transferType,
  isCommercial,
  displacement,
}: {
  result: TransferCostResult;
  vehicleType: string;
  purchasePrice: number;
  region: string;
  transferType: "new" | "used";
  isCommercial: boolean;
  displacement?: number;
}) {
  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="text-center border-b-2 border-gray-800 pb-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">자동차 취등록세 계산서</h1>
        <p className="text-sm text-gray-600 mt-1">2026년 기준</p>
      </div>

      {/* Vehicle info */}
      <div className="mb-6">
        <table className="w-full text-sm border border-gray-400">
          <tbody>
            <tr>
              <td className="bg-gray-100 border border-gray-400 px-3 py-2 font-medium w-24">차종</td>
              <td className="border border-gray-400 px-3 py-2">
                {VEHICLE_TYPES.find((t) => t.value === vehicleType)?.label || vehicleType}
              </td>
              <td className="bg-gray-100 border border-gray-400 px-3 py-2 font-medium w-24">취득가액</td>
              <td className="border border-gray-400 px-3 py-2 font-mono">
                {purchasePrice.toLocaleString()}원
              </td>
            </tr>
            <tr>
              <td className="bg-gray-100 border border-gray-400 px-3 py-2 font-medium">지역</td>
              <td className="border border-gray-400 px-3 py-2">{region}</td>
              <td className="bg-gray-100 border border-gray-400 px-3 py-2 font-medium">취득유형</td>
              <td className="border border-gray-400 px-3 py-2">
                {transferType === "new" ? "신차" : "중고차"} / {isCommercial ? "영업용" : "비영업용"}
              </td>
            </tr>
            {displacement && (
              <tr>
                <td className="bg-gray-100 border border-gray-400 px-3 py-2 font-medium">배기량</td>
                <td className="border border-gray-400 px-3 py-2" colSpan={3}>
                  {displacement.toLocaleString()}cc
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Breakdown */}
      <div className="mb-6">
        <h3 className="text-sm font-bold text-gray-900 mb-2 border-b border-gray-400 pb-1">비용 상세</h3>
        <table className="w-full text-sm border border-gray-400">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-400 px-3 py-1.5 text-left font-medium">항목</th>
              <th className="border border-gray-400 px-3 py-1.5 text-right font-medium w-32">금액</th>
              <th className="border border-gray-400 px-3 py-1.5 text-left font-medium">비고</th>
            </tr>
          </thead>
          <tbody>
            {result.breakdown.map((item, i) => (
              <tr key={i}>
                <td className="border border-gray-400 px-3 py-1.5">{item.label}</td>
                <td className="border border-gray-400 px-3 py-1.5 text-right font-mono">
                  {item.amount.toLocaleString()}
                </td>
                <td className="border border-gray-400 px-3 py-1.5 text-xs text-gray-600">
                  {item.note || ""}
                </td>
              </tr>
            ))}
            <tr className="bg-gray-100 font-bold">
              <td className="border border-gray-400 px-3 py-1.5">총 비용</td>
              <td className="border border-gray-400 px-3 py-1.5 text-right font-mono">
                {result.totalCost.toLocaleString()}
              </td>
              <td className="border border-gray-400 px-3 py-1.5"></td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Discounts */}
      {result.discounts.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-bold text-gray-900 mb-2 border-b border-gray-400 pb-1">감면 내역</h3>
          <table className="w-full text-sm border border-gray-400">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-400 px-3 py-1.5 text-left font-medium">항목</th>
                <th className="border border-gray-400 px-3 py-1.5 text-right font-medium w-32">감면액</th>
              </tr>
            </thead>
            <tbody>
              {result.discounts.map((d, i) => (
                <tr key={i}>
                  <td className="border border-gray-400 px-3 py-1.5">{d.name}</td>
                  <td className="border border-gray-400 px-3 py-1.5 text-right font-mono text-green-700">
                    -{d.amount.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Total */}
      <div className="border-2 border-gray-800 p-4 text-center mb-8">
        <p className="text-sm text-gray-600 mb-1">총 예상 비용</p>
        <p className="text-2xl font-bold font-mono">{result.totalCost.toLocaleString()}원</p>
      </div>

      {/* Disclaimer */}
      <div className="text-xs text-gray-500 space-y-1">
        <p>* 본 계산서는 2026년 기준 세율로 참고용으로 작성되었으며, 실제 금액과 차이가 있을 수 있습니다.</p>
        <p>* 정확한 금액은 관할 구청 또는 차량등록사업소에 문의하시기 바랍니다.</p>
      </div>

      {/* Footer */}
      <div className="mt-8 text-center">
        <p className="text-[10px] text-gray-400">어드미니(Admini) | aiadminplatform.vercel.app</p>
      </div>
    </div>
  );
}
