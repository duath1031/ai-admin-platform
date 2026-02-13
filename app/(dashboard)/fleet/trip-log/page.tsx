"use client";

import { useState, useEffect, useCallback, useMemo } from "react";

// ─── Types ───

interface Vehicle {
  id: string;
  plateNumber: string;
  vehicleType: string;
  manufacturer: string | null;
  modelName: string | null;
  ownershipType: string;
  currentMileage: number | null;
}

interface TripLog {
  id: string;
  vehicleId: string;
  tripDate: string;
  driverName: string;
  department: string | null;
  startMileage: number;
  endMileage: number;
  distance: number;
  departure: string;
  destination: string;
  purpose: string;
  startTime: string | null;
  endTime: string | null;
  fuelCost: number | null;
  tollCost: number | null;
  parkingCost: number | null;
  otherCost: number | null;
  costMemo: string | null;
  memo: string | null;
  createdAt: string;
  vehicle?: {
    plateNumber: string;
    modelName: string | null;
    manufacturer: string | null;
    ownershipType: string;
    vehicleType: string;
  };
}

interface TripForm {
  tripDate: string;
  driverName: string;
  department: string;
  startMileage: string;
  endMileage: string;
  departure: string;
  destination: string;
  purpose: string;
  startTime: string;
  endTime: string;
  fuelCost: string;
  tollCost: string;
  parkingCost: string;
  otherCost: string;
  costMemo: string;
  memo: string;
}

const EMPTY_FORM: TripForm = {
  tripDate: new Date().toISOString().substring(0, 10),
  driverName: "",
  department: "",
  startMileage: "",
  endMileage: "",
  departure: "",
  destination: "",
  purpose: "업무",
  startTime: "",
  endTime: "",
  fuelCost: "",
  tollCost: "",
  parkingCost: "",
  otherCost: "",
  costMemo: "",
  memo: "",
};

const PURPOSE_OPTIONS = [
  { value: "업무", label: "업무" },
  { value: "출장", label: "출장" },
  { value: "영업", label: "영업" },
  { value: "납품", label: "납품" },
  { value: "회의", label: "회의" },
  { value: "기타", label: "기타" },
];

const OWNERSHIP_LABELS: Record<string, string> = {
  owned: "자가",
  lease: "리스",
  rent: "렌트",
};

const VEHICLE_TYPE_LABELS: Record<string, string> = {
  sedan: "승용차",
  suv: "SUV/RV",
  van: "승합차",
  truck: "화물차",
  bus: "버스",
  special: "특수차",
};

// ─── Helpers ───

function formatNumber(v: string): string {
  const num = v.replace(/[^\d]/g, "");
  if (!num) return "";
  return Number(num).toLocaleString();
}

function parseNumber(v: string): number {
  const num = v.replace(/[^\d]/g, "");
  return num ? Number(num) : 0;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getTotalCost(log: TripLog): number {
  return (log.fuelCost || 0) + (log.tollCost || 0) + (log.parkingCost || 0) + (log.otherCost || 0);
}

// ─── Main Page ───

export default function TripLogPage() {
  // ── Data state ──
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>("");
  const [tripLogs, setTripLogs] = useState<TripLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // ── Tab state ──
  const [activeTab, setActiveTab] = useState<"records" | "create">("records");

  // ── Filter state ──
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");

  // ── Form state ──
  const [form, setForm] = useState<TripForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [editingLog, setEditingLog] = useState<TripLog | null>(null);

  // ── Selected vehicle ──
  const selectedVehicle = useMemo(
    () => vehicles.find((v) => v.id === selectedVehicleId) || null,
    [vehicles, selectedVehicleId]
  );

  // ── Fetch vehicles ──
  const fetchVehicles = useCallback(async () => {
    try {
      const res = await fetch("/api/fleet/vehicles?active=true&clientCompanyId=all");
      if (!res.ok) throw new Error("차량 목록 조회 실패");
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "차량 목록 조회 실패");
      setVehicles(json.data || []);
      // 첫 번째 차량 자동 선택
      if (json.data?.length > 0 && !selectedVehicleId) {
        setSelectedVehicleId(json.data[0].id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "차량 목록 조회 실패");
    }
  }, [selectedVehicleId]);

  useEffect(() => {
    fetchVehicles();
  }, [fetchVehicles]);

  // ── Fetch trip logs ──
  const fetchTripLogs = useCallback(async () => {
    if (!selectedVehicleId) return;
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ vehicleId: selectedVehicleId });
      if (filterStartDate) params.set("startDate", filterStartDate);
      if (filterEndDate) params.set("endDate", filterEndDate);

      const res = await fetch(`/api/fleet/trip-logs?${params.toString()}`);
      if (!res.ok) throw new Error("운행일지 조회 실패");
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "운행일지 조회 실패");
      setTripLogs(json.data || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "운행일지 조회 실패");
    } finally {
      setLoading(false);
    }
  }, [selectedVehicleId, filterStartDate, filterEndDate]);

  useEffect(() => {
    fetchTripLogs();
  }, [fetchTripLogs]);

  // ── Summary ──
  const summary = useMemo(() => {
    const totalDistance = tripLogs.reduce((sum, log) => sum + log.distance, 0);
    const totalCost = tripLogs.reduce((sum, log) => sum + getTotalCost(log), 0);

    // 이번 달 요약
    const now = new Date();
    const thisMonth = tripLogs.filter((log) => {
      const d = new Date(log.tripDate);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    });
    const monthDistance = thisMonth.reduce((sum, log) => sum + log.distance, 0);
    const monthCost = thisMonth.reduce((sum, log) => sum + getTotalCost(log), 0);

    return { totalDistance, totalCost, monthDistance, monthCost, monthCount: thisMonth.length };
  }, [tripLogs]);

  // ── Form handlers ──
  const updateForm = (field: keyof TripForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const computedDistance = useMemo(() => {
    const start = parseNumber(form.startMileage);
    const end = parseNumber(form.endMileage);
    if (start > 0 && end > start) return end - start;
    return 0;
  }, [form.startMileage, form.endMileage]);

  // ── Set form defaults when switching to create tab ──
  const handleSwitchToCreate = (log?: TripLog) => {
    if (log) {
      // 수정 모드
      setEditingLog(log);
      setForm({
        tripDate: formatDate(log.tripDate),
        driverName: log.driverName,
        department: log.department || "",
        startMileage: log.startMileage.toLocaleString(),
        endMileage: log.endMileage.toLocaleString(),
        departure: log.departure,
        destination: log.destination,
        purpose: log.purpose,
        startTime: log.startTime || "",
        endTime: log.endTime || "",
        fuelCost: log.fuelCost ? log.fuelCost.toLocaleString() : "",
        tollCost: log.tollCost ? log.tollCost.toLocaleString() : "",
        parkingCost: log.parkingCost ? log.parkingCost.toLocaleString() : "",
        otherCost: log.otherCost ? log.otherCost.toLocaleString() : "",
        costMemo: log.costMemo || "",
        memo: log.memo || "",
      });
    } else {
      // 신규 모드 - 차량의 currentMileage를 출발 키로수 기본값으로
      setEditingLog(null);
      setForm({
        ...EMPTY_FORM,
        tripDate: new Date().toISOString().substring(0, 10),
        startMileage: selectedVehicle?.currentMileage
          ? selectedVehicle.currentMileage.toLocaleString()
          : "",
      });
    }
    setActiveTab("create");
  };

  // ── Save trip log ──
  const handleSave = async () => {
    if (!selectedVehicleId) {
      setError("차량을 선택해주세요.");
      return;
    }
    if (!form.driverName.trim()) {
      setError("운전자명은 필수입니다.");
      return;
    }
    if (!form.departure.trim() || !form.destination.trim()) {
      setError("출발지와 목적지는 필수입니다.");
      return;
    }

    const startMileage = parseNumber(form.startMileage);
    const endMileage = parseNumber(form.endMileage);

    if (!startMileage || !endMileage) {
      setError("출발 전/도착 후 키로수를 입력해주세요.");
      return;
    }
    if (endMileage <= startMileage) {
      setError("도착 후 키로수는 출발 전 키로수보다 커야 합니다.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccessMsg("");

    try {
      const payload = {
        vehicleId: selectedVehicleId,
        tripDate: form.tripDate,
        driverName: form.driverName.trim(),
        department: form.department.trim() || null,
        startMileage,
        endMileage,
        departure: form.departure.trim(),
        destination: form.destination.trim(),
        purpose: form.purpose,
        startTime: form.startTime || null,
        endTime: form.endTime || null,
        fuelCost: parseNumber(form.fuelCost) || null,
        tollCost: parseNumber(form.tollCost) || null,
        parkingCost: parseNumber(form.parkingCost) || null,
        otherCost: parseNumber(form.otherCost) || null,
        costMemo: form.costMemo.trim() || null,
        memo: form.memo.trim() || null,
      };

      let res: Response;
      if (editingLog) {
        res = await fetch(`/api/fleet/trip-logs/${editingLog.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch("/api/fleet/trip-logs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      const json = await res.json();
      if (!json.success) throw new Error(json.error || "저장 실패");

      setSuccessMsg(editingLog ? "운행일지가 수정되었습니다." : "운행일지가 등록되었습니다.");
      setEditingLog(null);
      setForm(EMPTY_FORM);

      // 차량 키로수 갱신을 위해 차량 목록 다시 조회
      await fetchVehicles();
      await fetchTripLogs();
      setActiveTab("records");

      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  };

  // ── Delete trip log ──
  const handleDelete = async (log: TripLog) => {
    if (!confirm(`${formatDate(log.tripDate)} ${log.departure} -> ${log.destination} 운행일지를 삭제하시겠습니까?`)) {
      return;
    }
    try {
      const res = await fetch(`/api/fleet/trip-logs/${log.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "삭제 실패");
      setSuccessMsg("운행일지가 삭제되었습니다.");
      await fetchVehicles();
      await fetchTripLogs();
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "삭제 실패");
    }
  };

  // ── Print function ──
  const handlePrint = () => {
    if (!selectedVehicle || tripLogs.length === 0) return;

    const v = selectedVehicle;
    const vehicleInfo = `${v.plateNumber} / ${v.manufacturer || ""} ${v.modelName || ""} / ${OWNERSHIP_LABELS[v.ownershipType] || v.ownershipType}`;
    const periodStr = filterStartDate && filterEndDate
      ? `${filterStartDate} ~ ${filterEndDate}`
      : filterStartDate
        ? `${filterStartDate} ~`
        : filterEndDate
          ? `~ ${filterEndDate}`
          : "전체 기간";

    const rows = tripLogs
      .map(
        (log) => `
        <tr>
          <td>${formatDate(log.tripDate)}</td>
          <td>${log.driverName}</td>
          <td>${log.departure}</td>
          <td>${log.destination}</td>
          <td class="num">${log.startMileage.toLocaleString()}</td>
          <td class="num">${log.endMileage.toLocaleString()}</td>
          <td class="num">${log.distance.toLocaleString()}</td>
          <td class="num">${getTotalCost(log) > 0 ? getTotalCost(log).toLocaleString() : "-"}</td>
          <td>${log.purpose}</td>
        </tr>`
      )
      .join("");

    const totalDistance = tripLogs.reduce((s, l) => s + l.distance, 0);
    const totalCost = tripLogs.reduce((s, l) => s + getTotalCost(l), 0);

    const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>법인차량 운행일지</title>
  <style>
    @page { size: A4 landscape; margin: 15mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Malgun Gothic', '맑은 고딕', sans-serif; font-size: 11px; color: #333; }
    .title { text-align: center; font-size: 20px; font-weight: bold; margin-bottom: 16px; }
    .info { display: flex; justify-content: space-between; margin-bottom: 12px; font-size: 12px; }
    .info span { color: #555; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: center; font-size: 11px; }
    th { background-color: #f5f5f5; font-weight: 600; }
    td.num { text-align: right; font-family: monospace; }
    .footer { text-align: center; font-size: 10px; color: #999; margin-top: 20px; }
    .total-row td { font-weight: bold; background-color: #fafafa; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style>
</head>
<body>
  <div class="title">법인차량 운행일지</div>
  <div class="info">
    <span><b>차량:</b> ${vehicleInfo}</span>
    <span><b>기간:</b> ${periodStr}</span>
  </div>
  <table>
    <thead>
      <tr>
        <th>날짜</th>
        <th>운전자</th>
        <th>출발지</th>
        <th>목적지</th>
        <th>출발 km</th>
        <th>도착 km</th>
        <th>거리 km</th>
        <th>비용(원)</th>
        <th>목적</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
      <tr class="total-row">
        <td colspan="6">합계</td>
        <td class="num">${totalDistance.toLocaleString()}</td>
        <td class="num">${totalCost > 0 ? totalCost.toLocaleString() : "-"}</td>
        <td></td>
      </tr>
    </tbody>
  </table>
  <div class="footer">어드미니(Admini) AI 행정서비스</div>
  <script>window.onload = function() { window.print(); }</script>
</body>
</html>`;

    const printWin = window.open("", "_blank", "width=1100,height=700");
    if (printWin) {
      printWin.document.write(html);
      printWin.document.close();
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* ── Header ── */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">운행일지</h1>
        <p className="text-sm text-gray-500 mt-1">
          법인차량의 운행 기록을 관리합니다
        </p>
      </div>

      {/* ── Vehicle Selector + Current Mileage ── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4">
          <div className="flex-1 min-w-0">
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              차량 선택
            </label>
            <select
              value={selectedVehicleId}
              onChange={(e) => setSelectedVehicleId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            >
              <option value="">차량을 선택하세요</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.plateNumber}
                  {v.manufacturer || v.modelName
                    ? ` (${[v.manufacturer, v.modelName].filter(Boolean).join(" ")})`
                    : ""}
                </option>
              ))}
            </select>
          </div>
          {selectedVehicle && (
            <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-2.5 flex items-center gap-2">
              <svg className="w-4 h-4 text-blue-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25Z" />
              </svg>
              <div>
                <span className="text-xs text-blue-600 font-medium">현재 키로수</span>
                <span className="ml-2 text-sm font-bold text-blue-800">
                  {selectedVehicle.currentMileage != null
                    ? `${selectedVehicle.currentMileage.toLocaleString()} km`
                    : "미등록"}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Messages ── */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError("")} className="text-red-500 hover:text-red-700 text-xs underline ml-3">
            닫기
          </button>
        </div>
      )}
      {successMsg && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">
          {successMsg}
        </div>
      )}

      {/* ── Tabs ── */}
      <div className="flex items-center gap-1 border-b border-gray-200">
        <button
          onClick={() => { setActiveTab("records"); setEditingLog(null); }}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "records"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          운행 기록
        </button>
        <button
          onClick={() => handleSwitchToCreate()}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "create"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          {editingLog ? "일지 수정" : "일지 작성"}
        </button>
      </div>

      {/* ═══ Tab 1: 운행 기록 ═══ */}
      {activeTab === "records" && (
        <div className="space-y-4">
          {/* ── Date Filter + Print ── */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">시작일</label>
                <input
                  type="date"
                  value={filterStartDate}
                  onChange={(e) => setFilterStartDate(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">종료일</label>
                <input
                  type="date"
                  value={filterEndDate}
                  onChange={(e) => setFilterEndDate(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
              <button
                onClick={() => { setFilterStartDate(""); setFilterEndDate(""); }}
                className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                초기화
              </button>
              <div className="sm:ml-auto">
                <button
                  onClick={handlePrint}
                  disabled={tripLogs.length === 0}
                  className="px-4 py-2 bg-gray-700 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18.75 3.75h-1.875M18.75 3.75h.375" />
                  </svg>
                  운행일지 인쇄
                </button>
              </div>
            </div>
          </div>

          {/* ── Monthly Summary Cards ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
              <span className="text-xs font-medium text-gray-500">이번달 운행</span>
              <div className="text-2xl font-bold text-blue-700 mt-1">{summary.monthCount}건</div>
            </div>
            <div className="bg-green-50 rounded-xl p-4 border border-green-100">
              <span className="text-xs font-medium text-gray-500">이번달 운행거리</span>
              <div className="text-2xl font-bold text-green-700 mt-1">{summary.monthDistance.toLocaleString()} km</div>
            </div>
            <div className="bg-yellow-50 rounded-xl p-4 border border-yellow-100">
              <span className="text-xs font-medium text-gray-500">이번달 비용</span>
              <div className="text-2xl font-bold text-yellow-700 mt-1">{summary.monthCost > 0 ? `${summary.monthCost.toLocaleString()}원` : "-"}</div>
            </div>
            <div className="bg-purple-50 rounded-xl p-4 border border-purple-100">
              <span className="text-xs font-medium text-gray-500">조회 기간 총 거리</span>
              <div className="text-2xl font-bold text-purple-700 mt-1">{summary.totalDistance.toLocaleString()} km</div>
            </div>
          </div>

          {/* ── Trip Log Table ── */}
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : !selectedVehicleId ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-16 text-center">
              <p className="text-gray-500 text-sm">차량을 선택해주세요.</p>
            </div>
          ) : tripLogs.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-16 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                </svg>
              </div>
              <p className="text-gray-500 text-sm font-medium">운행 기록이 없습니다.</p>
              <p className="text-gray-400 text-xs mt-1">&quot;일지 작성&quot; 탭에서 운행일지를 등록하세요.</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left px-4 py-3 font-medium text-gray-600">운행일</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">운전자</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">출발지 / 목적지</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-600 hidden md:table-cell">출발 km</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-600 hidden md:table-cell">도착 km</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-600">운행거리</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-600 hidden lg:table-cell">비용합계</th>
                      <th className="text-center px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">목적</th>
                      <th className="text-center px-4 py-3 font-medium text-gray-600">관리</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {tripLogs.map((log) => {
                      const cost = getTotalCost(log);
                      return (
                        <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3">
                            <div className="font-medium text-gray-900">{formatDate(log.tripDate)}</div>
                            {log.startTime && (
                              <div className="text-xs text-gray-400">{log.startTime}{log.endTime ? ` ~ ${log.endTime}` : ""}</div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-gray-800">{log.driverName}</div>
                            {log.department && <div className="text-xs text-gray-400">{log.department}</div>}
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-gray-800">
                              {log.departure}
                              <span className="mx-1 text-gray-400">&rarr;</span>
                              {log.destination}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-gray-600 hidden md:table-cell">
                            {log.startMileage.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-gray-600 hidden md:table-cell">
                            {log.endMileage.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-semibold text-gray-900">
                            {log.distance.toLocaleString()} km
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-gray-600 hidden lg:table-cell">
                            {cost > 0 ? `${cost.toLocaleString()}원` : "-"}
                          </td>
                          <td className="px-4 py-3 text-center hidden sm:table-cell">
                            <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                              {log.purpose}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => handleSwitchToCreate(log)}
                                className="px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded transition-colors"
                              >
                                수정
                              </button>
                              <button
                                onClick={() => handleDelete(log)}
                                className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded transition-colors"
                              >
                                삭제
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Table footer - 합계 */}
              <div className="bg-gray-50 border-t border-gray-200 px-4 py-3 flex flex-wrap items-center gap-4 text-sm">
                <span className="text-gray-500">
                  총 <span className="font-semibold text-gray-900">{tripLogs.length}건</span>
                </span>
                <span className="text-gray-300">|</span>
                <span className="text-gray-500">
                  총 운행거리 <span className="font-semibold text-gray-900">{summary.totalDistance.toLocaleString()} km</span>
                </span>
                <span className="text-gray-300">|</span>
                <span className="text-gray-500">
                  총 비용 <span className="font-semibold text-gray-900">{summary.totalCost > 0 ? `${summary.totalCost.toLocaleString()}원` : "-"}</span>
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ Tab 2: 일지 작성/수정 ═══ */}
      {activeTab === "create" && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-6">
          {/* 차량 현재 키로수 (읽기전용) */}
          {selectedVehicle && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 flex items-center gap-3">
              <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0H21M3.375 14.25h.008M21 14.25h-2.625m0 0h-2.25m4.875 0V7.5a1.125 1.125 0 0 0-1.125-1.125H5.25A1.125 1.125 0 0 0 4.125 7.5v6.75" />
              </svg>
              <div>
                <span className="text-xs text-gray-500">
                  {selectedVehicle.plateNumber}
                  {selectedVehicle.manufacturer || selectedVehicle.modelName
                    ? ` (${[selectedVehicle.manufacturer, selectedVehicle.modelName].filter(Boolean).join(" ")})`
                    : ""}
                  {" / "}
                  {VEHICLE_TYPE_LABELS[selectedVehicle.vehicleType] || selectedVehicle.vehicleType}
                </span>
                <div className="text-sm font-semibold text-gray-800">
                  현재 키로수:{" "}
                  {selectedVehicle.currentMileage != null
                    ? `${selectedVehicle.currentMileage.toLocaleString()} km`
                    : "미등록"}
                </div>
              </div>
            </div>
          )}

          {/* 운행일 + 운전자 + 부서 */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                운행일 <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={form.tripDate}
                onChange={(e) => updateForm("tripDate", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                운전자명 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.driverName}
                onChange={(e) => updateForm("driverName", e.target.value)}
                placeholder="홍길동"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">부서</label>
              <input
                type="text"
                value={form.department}
                onChange={(e) => updateForm("department", e.target.value)}
                placeholder="영업부"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
          </div>

          {/* 키로수 */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                출발 전 키로수 (km) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.startMileage}
                onChange={(e) => updateForm("startMileage", formatNumber(e.target.value))}
                placeholder={selectedVehicle?.currentMileage != null ? selectedVehicle.currentMileage.toLocaleString() : "0"}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                도착 후 키로수 (km) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.endMileage}
                onChange={(e) => updateForm("endMileage", formatNumber(e.target.value))}
                placeholder="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">운행거리 (자동계산)</label>
              <div className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-700 font-semibold">
                {computedDistance > 0 ? `${computedDistance.toLocaleString()} km` : "-"}
              </div>
            </div>
          </div>

          {/* 출발지 + 목적지 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                출발지 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.departure}
                onChange={(e) => updateForm("departure", e.target.value)}
                placeholder="서울 본사"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                목적지 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.destination}
                onChange={(e) => updateForm("destination", e.target.value)}
                placeholder="인천 공장"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
          </div>

          {/* 운행목적 */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              운행목적 <span className="text-red-500">*</span>
            </label>
            <select
              value={form.purpose}
              onChange={(e) => updateForm("purpose", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            >
              {PURPOSE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          {/* 출발시간 + 도착시간 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">출발시간</label>
              <input
                type="time"
                value={form.startTime}
                onChange={(e) => updateForm("startTime", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">도착시간</label>
              <input
                type="time"
                value={form.endTime}
                onChange={(e) => updateForm("endTime", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
          </div>

          {/* 비용 섹션 */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
              <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />
              </svg>
              비용 정보
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">주유비 (원)</label>
                <input
                  type="text"
                  value={form.fuelCost}
                  onChange={(e) => updateForm("fuelCost", formatNumber(e.target.value))}
                  placeholder="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">통행료 (원)</label>
                <input
                  type="text"
                  value={form.tollCost}
                  onChange={(e) => updateForm("tollCost", formatNumber(e.target.value))}
                  placeholder="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">주차비 (원)</label>
                <input
                  type="text"
                  value={form.parkingCost}
                  onChange={(e) => updateForm("parkingCost", formatNumber(e.target.value))}
                  placeholder="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">기타비용 (원)</label>
                <input
                  type="text"
                  value={form.otherCost}
                  onChange={(e) => updateForm("otherCost", formatNumber(e.target.value))}
                  placeholder="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
            </div>
            <div className="mt-3">
              <label className="block text-xs font-medium text-gray-600 mb-1">비용 메모</label>
              <input
                type="text"
                value={form.costMemo}
                onChange={(e) => updateForm("costMemo", e.target.value)}
                placeholder="주유소명, 톨게이트 구간 등"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
          </div>

          {/* 메모 */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">메모</label>
            <textarea
              value={form.memo}
              onChange={(e) => updateForm("memo", e.target.value)}
              placeholder="기타 참고 사항"
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
            />
          </div>

          {/* 저장 버튼 */}
          <div className="flex items-center justify-end gap-3 pt-2">
            {editingLog && (
              <button
                onClick={() => {
                  setEditingLog(null);
                  setForm(EMPTY_FORM);
                  setActiveTab("records");
                }}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
              >
                취소
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={saving || !selectedVehicleId}
              className="px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  저장 중...
                </>
              ) : editingLog ? (
                "수정 저장"
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  운행일지 저장
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
