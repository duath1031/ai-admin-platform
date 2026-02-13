"use client";

import { useState, useEffect, useCallback } from "react";
import ClientSelector from "@/components/common/ClientSelector";
import { useClientStore } from "@/lib/store";

// ─── Types ───

interface Vehicle {
  id: string;
  plateNumber: string;
  vehicleType: string;
  manufacturer: string | null;
  modelName: string | null;
  modelYear: number | null;
  displacement: number | null;
  fuelType: string | null;
  color: string | null;
  purchasePrice: number | null;
  purchaseDate: string | null;
  ownershipType: string;
  assignedDriver: string | null;
  purpose: string | null;
  memo: string | null;
  status: string;
  mileage: number | null;
  createdAt: string;
}

interface VehicleForm {
  plateNumber: string;
  vehicleType: string;
  manufacturer: string;
  modelName: string;
  modelYear: string;
  displacement: string;
  fuelType: string;
  color: string;
  purchasePrice: string;
  purchaseDate: string;
  ownershipType: string;
  assignedDriver: string;
  purpose: string;
  memo: string;
}

const EMPTY_FORM: VehicleForm = {
  plateNumber: "",
  vehicleType: "sedan",
  manufacturer: "",
  modelName: "",
  modelYear: "",
  displacement: "",
  fuelType: "gasoline",
  color: "",
  purchasePrice: "",
  purchaseDate: "",
  ownershipType: "owned",
  assignedDriver: "",
  purpose: "",
  memo: "",
};

// ─── Options ───

const VEHICLE_TYPE_OPTIONS = [
  { value: "sedan", label: "승용차" },
  { value: "suv", label: "SUV/RV" },
  { value: "van", label: "승합차" },
  { value: "truck", label: "화물차" },
  { value: "bus", label: "버스" },
  { value: "special", label: "특수차" },
];

const FUEL_TYPE_OPTIONS = [
  { value: "gasoline", label: "가솔린" },
  { value: "diesel", label: "디젤" },
  { value: "lpg", label: "LPG" },
  { value: "electric", label: "전기" },
  { value: "hybrid", label: "하이브리드" },
  { value: "hydrogen", label: "수소" },
];

const OWNERSHIP_OPTIONS = [
  { value: "owned", label: "자가" },
  { value: "lease", label: "리스" },
  { value: "rent", label: "렌트" },
];

const STATUS_OPTIONS = [
  { value: "all", label: "전체" },
  { value: "active", label: "운행 중" },
  { value: "maintenance", label: "정비 중" },
  { value: "disposed", label: "처분" },
  { value: "transferred", label: "이전" },
];

const STATUS_LABELS: Record<string, string> = {
  active: "운행 중",
  maintenance: "정비 중",
  disposed: "처분",
  transferred: "이전",
};

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  maintenance: "bg-yellow-100 text-yellow-700",
  disposed: "bg-gray-100 text-gray-600",
  transferred: "bg-blue-100 text-blue-700",
};

const VEHICLE_TYPE_LABELS: Record<string, string> = {
  sedan: "승용차",
  suv: "SUV/RV",
  van: "승합차",
  truck: "화물차",
  bus: "버스",
  special: "특수차",
};

const FUEL_TYPE_LABELS: Record<string, string> = {
  gasoline: "가솔린",
  diesel: "디젤",
  lpg: "LPG",
  electric: "전기",
  hybrid: "하이브리드",
  hydrogen: "수소",
};

const OWNERSHIP_LABELS: Record<string, string> = {
  owned: "자가",
  lease: "리스",
  rent: "렌트",
};

// ─── Helpers ───

function formatNumber(v: string): string {
  const num = v.replace(/[^\d]/g, "");
  if (!num) return "";
  return Number(num).toLocaleString();
}

function parseNumber(v: string): string {
  return v.replace(/[^\d]/g, "");
}

// ─── Main Page ───

export default function FleetPage() {
  const { selectedClient } = useClientStore();

  // ── Data state ──
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // ── Filter ──
  const [statusFilter, setStatusFilter] = useState("all");

  // ── Modal state ──
  const [showModal, setShowModal] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [form, setForm] = useState<VehicleForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // ── Build API url with clientCompanyId ──
  const buildUrl = useCallback(
    (path: string, params?: Record<string, string>) => {
      const url = new URL(path, window.location.origin);
      if (selectedClient?.id) {
        url.searchParams.set("clientCompanyId", selectedClient.id);
      }
      if (params) {
        Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
      }
      return url.toString();
    },
    [selectedClient]
  );

  // ── Fetch vehicles ──
  const fetchVehicles = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(buildUrl("/api/fleet/vehicles"));
      if (!res.ok) throw new Error("차량 목록 조회에 실패했습니다.");
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "차량 목록 조회 실패");
      setVehicles(json.data || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "차량 목록 조회 실패");
    } finally {
      setLoading(false);
    }
  }, [buildUrl]);

  useEffect(() => {
    fetchVehicles();
  }, [fetchVehicles]);

  // ── Filtered list ──
  const filtered =
    statusFilter === "all"
      ? vehicles
      : vehicles.filter((v) => v.status === statusFilter);

  // ── Summary counts ──
  const totalCount = vehicles.length;
  const activeCount = vehicles.filter((v) => v.status === "active").length;
  const maintenanceCount = vehicles.filter((v) => v.status === "maintenance").length;
  const leaseRentCount = vehicles.filter(
    (v) => v.ownershipType === "lease" || v.ownershipType === "rent"
  ).length;

  // ── Open add/edit modal ──
  const handleOpenModal = (vehicle?: Vehicle) => {
    if (vehicle) {
      setEditingVehicle(vehicle);
      setForm({
        plateNumber: vehicle.plateNumber,
        vehicleType: vehicle.vehicleType,
        manufacturer: vehicle.manufacturer || "",
        modelName: vehicle.modelName || "",
        modelYear: vehicle.modelYear ? String(vehicle.modelYear) : "",
        displacement: vehicle.displacement ? String(vehicle.displacement) : "",
        fuelType: vehicle.fuelType || "gasoline",
        color: vehicle.color || "",
        purchasePrice: vehicle.purchasePrice
          ? vehicle.purchasePrice.toLocaleString()
          : "",
        purchaseDate: vehicle.purchaseDate
          ? vehicle.purchaseDate.substring(0, 10)
          : "",
        ownershipType: vehicle.ownershipType || "owned",
        assignedDriver: vehicle.assignedDriver || "",
        purpose: vehicle.purpose || "",
        memo: vehicle.memo || "",
      });
    } else {
      setEditingVehicle(null);
      setForm(EMPTY_FORM);
    }
    setShowModal(true);
  };

  // ── Save (create / update) ──
  const handleSave = async () => {
    if (!form.plateNumber.trim()) {
      setError("차량번호는 필수입니다.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const payload: Record<string, unknown> = {
        plateNumber: form.plateNumber.trim(),
        vehicleType: form.vehicleType,
        manufacturer: form.manufacturer.trim() || null,
        modelName: form.modelName.trim() || null,
        modelYear: form.modelYear ? Number(form.modelYear) : null,
        displacement: form.displacement ? Number(form.displacement) : null,
        fuelType: form.fuelType || null,
        color: form.color.trim() || null,
        purchasePrice: form.purchasePrice
          ? Number(parseNumber(form.purchasePrice))
          : null,
        purchaseDate: form.purchaseDate || null,
        ownershipType: form.ownershipType,
        assignedDriver: form.assignedDriver.trim() || null,
        purpose: form.purpose.trim() || null,
        memo: form.memo.trim() || null,
      };

      if (selectedClient?.id) {
        payload.clientCompanyId = selectedClient.id;
      }

      let res: Response;
      if (editingVehicle) {
        res = await fetch(`/api/fleet/vehicles/${editingVehicle.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch("/api/fleet/vehicles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      const json = await res.json();
      if (!json.success) throw new Error(json.error || "저장 실패");

      setShowModal(false);
      fetchVehicles();
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ──
  const handleDelete = async (id: string, plate: string) => {
    if (!confirm(`${plate} 차량을 삭제하시겠습니까?`)) return;
    try {
      const res = await fetch(`/api/fleet/vehicles/${id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "삭제 실패");
      fetchVehicles();
    } catch (e) {
      setError(e instanceof Error ? e.message : "삭제 실패");
    }
  };

  // ── Status change ──
  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/fleet/vehicles/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "상태 변경 실패");
      fetchVehicles();
    } catch (e) {
      setError(e instanceof Error ? e.message : "상태 변경 실패");
    }
  };

  // ── Form field updater ──
  const updateForm = (field: keyof VehicleForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">법인차량 관리</h1>
          <p className="text-sm text-gray-500 mt-1">
            법인 차량의 등록, 운행, 정비 현황을 관리합니다
          </p>
        </div>
        <ClientSelector />
      </div>

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          label="전체 차량"
          value={totalCount}
          color="blue"
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0H21M3.375 14.25h.008M21 14.25h-2.625m0 0h-2.25m4.875 0V7.5a1.125 1.125 0 0 0-1.125-1.125H5.25A1.125 1.125 0 0 0 4.125 7.5v6.75" />
            </svg>
          }
        />
        <SummaryCard
          label="운행 중"
          value={activeCount}
          color="green"
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          }
        />
        <SummaryCard
          label="정비 중"
          value={maintenanceCount}
          color="yellow"
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 0 0 4.486-6.336l-3.276 3.277a3.004 3.004 0 0 1-2.25-2.25l3.276-3.276a4.5 4.5 0 0 0-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085" />
            </svg>
          }
        />
        <SummaryCard
          label="리스/렌트"
          value={leaseRentCount}
          color="purple"
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z" />
            </svg>
          }
        />
      </div>

      {/* ── Action Bar ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setStatusFilter(opt.value)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === opt.value
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {opt.label}
              {opt.value !== "all" && (
                <span className="ml-1 text-xs opacity-70">
                  ({vehicles.filter((v) =>
                    opt.value === "all" ? true : v.status === opt.value
                  ).length})
                </span>
              )}
            </button>
          ))}
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1.5"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          차량 등록
        </button>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 flex items-center justify-between">
          <span>{error}</span>
          <button
            onClick={() => setError("")}
            className="text-red-500 hover:text-red-700 text-xs underline ml-3"
          >
            닫기
          </button>
        </div>
      )}

      {/* ── Vehicle Table ── */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-16 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0H21M3.375 14.25h.008M21 14.25h-2.625m0 0h-2.25m4.875 0V7.5a1.125 1.125 0 0 0-1.125-1.125H5.25A1.125 1.125 0 0 0 4.125 7.5v6.75" />
            </svg>
          </div>
          <p className="text-gray-500 text-sm font-medium">
            {statusFilter === "all"
              ? "등록된 차량이 없습니다."
              : `${STATUS_LABELS[statusFilter] || statusFilter} 상태의 차량이 없습니다.`}
          </p>
          <p className="text-gray-400 text-xs mt-1">
            &quot;차량 등록&quot; 버튼을 클릭하여 법인차량을 등록하세요.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 font-medium text-gray-600">차량번호</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">차종</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">모델</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600 hidden md:table-cell">연식</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600 hidden lg:table-cell">연료</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">상태</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600 hidden lg:table-cell">주행거리</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((v) => (
                  <tr key={v.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-gray-900">{v.plateNumber}</div>
                      <div className="text-xs text-gray-400 sm:hidden">
                        {VEHICLE_TYPE_LABELS[v.vehicleType] || v.vehicleType}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">
                      <span className="inline-flex items-center gap-1">
                        {VEHICLE_TYPE_LABELS[v.vehicleType] || v.vehicleType}
                        {v.ownershipType !== "owned" && (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-purple-50 text-purple-600">
                            {OWNERSHIP_LABELS[v.ownershipType] || v.ownershipType}
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-800">
                        {v.manufacturer && v.modelName
                          ? `${v.manufacturer} ${v.modelName}`
                          : v.manufacturer || v.modelName || "-"}
                      </div>
                      {v.displacement && (
                        <div className="text-xs text-gray-400">
                          {v.displacement.toLocaleString()}cc
                          {v.color ? ` / ${v.color}` : ""}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-600 hidden md:table-cell">
                      {v.modelYear ? `${v.modelYear}년` : "-"}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-600 hidden lg:table-cell">
                      {v.fuelType ? FUEL_TYPE_LABELS[v.fuelType] || v.fuelType : "-"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <select
                        value={v.status}
                        onChange={(e) => handleStatusChange(v.id, e.target.value)}
                        className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border-0 cursor-pointer appearance-none text-center ${
                          STATUS_COLORS[v.status] || "bg-gray-100 text-gray-600"
                        }`}
                        style={{ backgroundImage: "none" }}
                      >
                        <option value="active">운행 중</option>
                        <option value="maintenance">정비 중</option>
                        <option value="disposed">처분</option>
                        <option value="transferred">이전</option>
                      </select>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-gray-600 hidden lg:table-cell">
                      {v.mileage != null ? `${v.mileage.toLocaleString()} km` : "-"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleOpenModal(v)}
                          className="px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        >
                          수정
                        </button>
                        <button
                          onClick={() => handleDelete(v.id, v.plateNumber)}
                          className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded transition-colors"
                        >
                          삭제
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Table footer */}
          <div className="bg-gray-50 border-t border-gray-200 px-4 py-2.5 text-xs text-gray-500">
            {statusFilter === "all"
              ? `전체 ${totalCount}대`
              : `${STATUS_LABELS[statusFilter] || statusFilter} ${filtered.length}대 / 전체 ${totalCount}대`}
          </div>
        </div>
      )}

      {/* ── Add / Edit Modal ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setShowModal(false)}
          />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            {/* Modal header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-xl z-10">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingVehicle ? "차량 정보 수정" : "차량 등록"}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-xl leading-none"
              >
                &times;
              </button>
            </div>

            {/* Modal body */}
            <div className="p-6 space-y-5">
              {/* 차량번호 */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  차량번호 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.plateNumber}
                  onChange={(e) => updateForm("plateNumber", e.target.value)}
                  placeholder="12가 3456"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>

              {/* 차종 & 연료 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">차종</label>
                  <select
                    value={form.vehicleType}
                    onChange={(e) => updateForm("vehicleType", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  >
                    {VEHICLE_TYPE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">연료</label>
                  <select
                    value={form.fuelType}
                    onChange={(e) => updateForm("fuelType", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  >
                    {FUEL_TYPE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 제조사 & 모델명 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">제조사</label>
                  <input
                    type="text"
                    value={form.manufacturer}
                    onChange={(e) => updateForm("manufacturer", e.target.value)}
                    placeholder="현대"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">모델명</label>
                  <input
                    type="text"
                    value={form.modelName}
                    onChange={(e) => updateForm("modelName", e.target.value)}
                    placeholder="아반떼 CN7"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
              </div>

              {/* 연식 & 배기량 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">연식</label>
                  <input
                    type="number"
                    value={form.modelYear}
                    onChange={(e) => updateForm("modelYear", e.target.value)}
                    placeholder="2026"
                    min="1990"
                    max="2030"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">배기량 (cc)</label>
                  <input
                    type="number"
                    value={form.displacement}
                    onChange={(e) => updateForm("displacement", e.target.value)}
                    placeholder="1598"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
              </div>

              {/* 색상 & 소유형태 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">색상</label>
                  <input
                    type="text"
                    value={form.color}
                    onChange={(e) => updateForm("color", e.target.value)}
                    placeholder="흰색"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">소유형태</label>
                  <select
                    value={form.ownershipType}
                    onChange={(e) => updateForm("ownershipType", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  >
                    {OWNERSHIP_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 취득가액 & 취득일 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    취득가액 (원)
                  </label>
                  <input
                    type="text"
                    value={form.purchasePrice}
                    onChange={(e) =>
                      updateForm("purchasePrice", formatNumber(e.target.value))
                    }
                    placeholder="30,000,000"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                  {form.purchasePrice && (
                    <p className="text-xs text-gray-400 mt-1">
                      {Number(parseNumber(form.purchasePrice)).toLocaleString()}원
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">취득일</label>
                  <input
                    type="date"
                    value={form.purchaseDate}
                    onChange={(e) => updateForm("purchaseDate", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
              </div>

              {/* 배정 운전자 & 용도 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">배정 운전자</label>
                  <input
                    type="text"
                    value={form.assignedDriver}
                    onChange={(e) => updateForm("assignedDriver", e.target.value)}
                    placeholder="김운전"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">용도</label>
                  <input
                    type="text"
                    value={form.purpose}
                    onChange={(e) => updateForm("purpose", e.target.value)}
                    placeholder="영업용, 출퇴근용 등"
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
                  placeholder="차량 관련 참고 사항을 입력하세요"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                />
              </div>

              {/* Error in modal */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                  {error}
                </div>
              )}
            </div>

            {/* Modal footer */}
            <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 rounded-b-xl flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? "저장 중..." : editingVehicle ? "수정" : "등록"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Summary Card Component ───

function SummaryCard({
  label,
  value,
  color,
  icon,
}: {
  label: string;
  value: number;
  color: "blue" | "green" | "yellow" | "purple";
  icon: React.ReactNode;
}) {
  const colorMap = {
    blue: {
      bg: "bg-blue-50",
      icon: "text-blue-600",
      value: "text-blue-700",
    },
    green: {
      bg: "bg-green-50",
      icon: "text-green-600",
      value: "text-green-700",
    },
    yellow: {
      bg: "bg-yellow-50",
      icon: "text-yellow-600",
      value: "text-yellow-700",
    },
    purple: {
      bg: "bg-purple-50",
      icon: "text-purple-600",
      value: "text-purple-700",
    },
  };

  const c = colorMap[color];

  return (
    <div className={`${c.bg} rounded-xl p-4 border border-${color}-100`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-gray-500">{label}</span>
        <div className={c.icon}>{icon}</div>
      </div>
      <div className={`text-2xl font-bold ${c.value}`}>{value}대</div>
    </div>
  );
}
