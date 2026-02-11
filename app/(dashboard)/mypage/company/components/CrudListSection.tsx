"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui";
import { Button } from "@/components/ui";

interface FieldDef {
  key: string;
  label: string;
  type: "text" | "number" | "date" | "select" | "money";
  required?: boolean;
  placeholder?: string;
  options?: { value: string; label: string }[];
}

interface Props {
  title: string;
  icon: React.ReactNode;
  items: any[];
  fields: FieldDef[];
  apiPath: string;
  onRefresh: () => void;
  displayColumns: { key: string; label: string; render?: (item: any) => string }[];
}

function formatMoney(v: number | null | undefined): string {
  if (!v) return "-";
  if (v >= 100000000) return `${(v / 100000000).toFixed(1)}억`;
  if (v >= 10000) return `${Math.round(v / 10000).toLocaleString()}만`;
  return v.toLocaleString() + "원";
}

export default function CrudListSection({ title, icon, items, fields, apiPath, onRefresh, displayColumns }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const resetForm = () => {
    setFormData({});
    setEditId(null);
    setShowForm(false);
  };

  const openEdit = (item: any) => {
    const data: Record<string, any> = {};
    fields.forEach((f) => {
      if (f.type === "date" && item[f.key]) {
        data[f.key] = item[f.key].split("T")[0];
      } else if (f.type === "money" && item[f.key] != null) {
        data[f.key] = Number(item[f.key]);
      } else {
        data[f.key] = item[f.key] ?? "";
      }
    });
    setFormData(data);
    setEditId(item.id);
    setShowForm(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: Record<string, any> = {};
      fields.forEach((f) => {
        const val = formData[f.key];
        if (f.type === "money" || f.type === "number") {
          payload[f.key] = val ? Number(val) : null;
        } else if (f.type === "date") {
          payload[f.key] = val || null;
        } else {
          payload[f.key] = val || null;
        }
      });

      if (editId) {
        payload.id = editId;
        await fetch(apiPath, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        await fetch(apiPath, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      resetForm();
      onRefresh();
    } catch (err) {
      console.error("Save error:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("삭제하시겠습니까?")) return;
    setDeleting(id);
    try {
      await fetch(`${apiPath}?id=${id}`, { method: "DELETE" });
      onRefresh();
    } catch (err) {
      console.error("Delete error:", err);
    } finally {
      setDeleting(null);
    }
  };

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            {icon}
            {title}
            <span className="text-sm font-normal text-gray-400">({items.length}건)</span>
          </h2>
          <Button
            type="button"
            onClick={() => { resetForm(); setShowForm(true); }}
            className="text-sm"
          >
            + 추가
          </Button>
        </div>

        {/* 목록 테이블 */}
        {items.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b">
                  {displayColumns.map((col) => (
                    <th key={col.key} className="px-3 py-2 text-left font-medium text-gray-600">{col.label}</th>
                  ))}
                  <th className="px-3 py-2 text-center font-medium text-gray-600 w-24">관리</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b hover:bg-gray-50">
                    {displayColumns.map((col) => (
                      <td key={col.key} className="px-3 py-2.5 text-gray-700">
                        {col.render ? col.render(item) : (item[col.key] ?? "-")}
                      </td>
                    ))}
                    <td className="px-3 py-2.5 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => openEdit(item)} className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50">수정</button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          disabled={deleting === item.id}
                          className="text-xs text-red-600 hover:text-red-800 px-2 py-1 rounded hover:bg-red-50 disabled:opacity-50"
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
        ) : (
          <div className="text-center py-8 text-gray-400 text-sm">
            등록된 항목이 없습니다. &quot;+ 추가&quot; 버튼으로 등록하세요.
          </div>
        )}

        {/* 추가/수정 폼 */}
        {showForm && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">{editId ? "수정" : "새로 추가"}</h3>
            <div className="grid md:grid-cols-2 gap-3">
              {fields.map((f) => (
                <div key={f.key}>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    {f.label} {f.required && <span className="text-red-500">*</span>}
                  </label>
                  {f.type === "select" ? (
                    <select
                      value={formData[f.key] || ""}
                      onChange={(e) => setFormData((prev) => ({ ...prev, [f.key]: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    >
                      <option value="">선택</option>
                      {f.options?.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  ) : f.type === "money" ? (
                    <input
                      type="text"
                      value={formData[f.key] ? Number(formData[f.key]).toLocaleString() : ""}
                      onChange={(e) => setFormData((prev) => ({ ...prev, [f.key]: Number(e.target.value.replace(/,/g, "")) || 0 }))}
                      placeholder={f.placeholder || "0"}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  ) : (
                    <input
                      type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
                      value={formData[f.key] || ""}
                      onChange={(e) => setFormData((prev) => ({ ...prev, [f.key]: e.target.value }))}
                      placeholder={f.placeholder}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button type="button" variant="outline" onClick={resetForm}>취소</Button>
              <Button type="button" onClick={handleSave} disabled={saving}>
                {saving ? "저장 중..." : editId ? "수정" : "추가"}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export { formatMoney };
