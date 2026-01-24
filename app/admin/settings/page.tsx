"use client";

import { useEffect, useState } from "react";

interface Setting {
  id: string;
  key: string;
  category: string;
  value: string;
  valueType: string;
  displayName: string;
  description: string | null;
  updatedAt: string;
}

interface GroupedSettings {
  [category: string]: Setting[];
}

const CATEGORY_LABELS: Record<string, string> = {
  general: "일반 설정",
  appearance: "외관 설정",
  footer: "푸터 설정",
  features: "기능 설정",
};

const CATEGORY_ICONS: Record<string, string> = {
  general: "🏢",
  appearance: "🎨",
  footer: "📄",
  features: "⚙️",
};

export default function AdminSettings() {
  const [settings, setSettings] = useState<Setting[]>([]);
  const [grouped, setGrouped] = useState<GroupedSettings>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeCategory, setActiveCategory] = useState("general");
  const [editedValues, setEditedValues] = useState<Record<string, string>>({});
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/admin/settings");
      if (response.ok) {
        const data = await response.json();
        setSettings(data.settings || []);
        setGrouped(data.grouped || {});

        // 초기 값 설정
        const initialValues: Record<string, string> = {};
        (data.settings || []).forEach((s: Setting) => {
          initialValues[s.key] = s.value;
        });
        setEditedValues(initialValues);
      }
    } catch (error) {
      console.error("설정 로드 실패:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleValueChange = (key: string, value: string) => {
    setEditedValues((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      // 변경된 설정만 저장
      const changedSettings = settings
        .filter((s) => editedValues[s.key] !== s.value)
        .map((s) => ({ key: s.key, value: editedValues[s.key] }));

      if (changedSettings.length === 0) {
        alert("변경된 설정이 없습니다.");
        return;
      }

      const response = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: changedSettings }),
      });

      if (response.ok) {
        await fetchSettings();
        setHasChanges(false);
        alert("설정이 저장되었습니다.");
      } else {
        const data = await response.json();
        alert(data.error || "저장 중 오류가 발생했습니다.");
      }
    } catch (error) {
      console.error("저장 실패:", error);
      alert("저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    const initialValues: Record<string, string> = {};
    settings.forEach((s) => {
      initialValues[s.key] = s.value;
    });
    setEditedValues(initialValues);
    setHasChanges(false);
  };

  const renderInput = (setting: Setting) => {
    const value = editedValues[setting.key] || "";

    switch (setting.valueType) {
      case "boolean":
        return (
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={value === "true"}
              onChange={(e) => handleValueChange(setting.key, e.target.checked ? "true" : "false")}
              className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-600">
              {value === "true" ? "활성화됨" : "비활성화됨"}
            </span>
          </label>
        );

      case "json":
        return (
          <textarea
            value={value}
            onChange={(e) => handleValueChange(setting.key, e.target.value)}
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-blue-500"
            placeholder="JSON 형식으로 입력"
          />
        );

      default:
        if (setting.key.includes("color")) {
          return (
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={value}
                onChange={(e) => handleValueChange(setting.key, e.target.value)}
                className="w-12 h-10 rounded cursor-pointer"
              />
              <input
                type="text"
                value={value}
                onChange={(e) => handleValueChange(setting.key, e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="#000000"
              />
            </div>
          );
        }

        if (setting.key.includes("message") || setting.key.includes("description")) {
          return (
            <textarea
              value={value}
              onChange={(e) => handleValueChange(setting.key, e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          );
        }

        return (
          <input
            type="text"
            value={value}
            onChange={(e) => handleValueChange(setting.key, e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const categories = Object.keys(grouped);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">사이트 설정</h1>
        <div className="flex gap-2">
          {hasChanges && (
            <button
              onClick={handleReset}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              되돌리기
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>

      <div className="flex gap-6">
        {/* 카테고리 탭 */}
        <div className="w-48 bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <nav className="space-y-1">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setActiveCategory(category)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors ${
                  activeCategory === category
                    ? "bg-blue-50 text-blue-700 font-medium"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                <span>{CATEGORY_ICONS[category] || "📌"}</span>
                <span>{CATEGORY_LABELS[category] || category}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* 설정 폼 */}
        <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900">
              {CATEGORY_ICONS[activeCategory]} {CATEGORY_LABELS[activeCategory] || activeCategory}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              사이트의 {CATEGORY_LABELS[activeCategory] || activeCategory}을 관리합니다.
            </p>
          </div>

          <div className="space-y-6">
            {(grouped[activeCategory] || []).map((setting) => (
              <div key={setting.key}>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {setting.displayName}
                </label>
                {renderInput(setting)}
                {setting.description && (
                  <p className="text-xs text-gray-400 mt-1">{setting.description}</p>
                )}
              </div>
            ))}
          </div>

          {hasChanges && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <p className="text-sm text-amber-600">
                  저장하지 않은 변경 사항이 있습니다.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleReset}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                  >
                    되돌리기
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {saving ? "저장 중..." : "저장"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
