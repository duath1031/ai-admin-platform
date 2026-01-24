"use client";

import { useEffect, useState } from "react";

interface SystemPrompt {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  content: string;
  isActive: boolean;
  isDefault: boolean;
  version: number;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function AdminPrompts() {
  const [prompts, setPrompts] = useState<SystemPrompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPrompt, setSelectedPrompt] = useState<SystemPrompt | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    displayName: "",
    description: "",
    content: "",
    isActive: true,
    isDefault: false,
  });

  useEffect(() => {
    fetchPrompts();
  }, []);

  const fetchPrompts = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/admin/prompts");
      if (response.ok) {
        const data = await response.json();
        setPrompts(data.prompts || []);
      }
    } catch (error) {
      console.error("프롬프트 로드 실패:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setFormData({
      name: "",
      displayName: "",
      description: "",
      content: "",
      isActive: true,
      isDefault: false,
    });
    setSelectedPrompt(null);
    setIsCreating(true);
    setIsEditing(true);
  };

  const handleEdit = (prompt: SystemPrompt) => {
    setFormData({
      name: prompt.name,
      displayName: prompt.displayName,
      description: prompt.description || "",
      content: prompt.content,
      isActive: prompt.isActive,
      isDefault: prompt.isDefault,
    });
    setSelectedPrompt(prompt);
    setIsCreating(false);
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setIsCreating(false);
    setSelectedPrompt(null);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.displayName || !formData.content) {
      alert("필수 항목을 모두 입력해주세요.");
      return;
    }

    try {
      setSaving(true);
      const url = isCreating
        ? "/api/admin/prompts"
        : `/api/admin/prompts/${selectedPrompt?.id}`;
      const method = isCreating ? "POST" : "PUT";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        await fetchPrompts();
        handleCancel();
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

  const handleDelete = async (prompt: SystemPrompt) => {
    if (!confirm(`"${prompt.displayName}" 프롬프트를 삭제하시겠습니까?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/prompts/${prompt.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        await fetchPrompts();
        if (selectedPrompt?.id === prompt.id) {
          handleCancel();
        }
      } else {
        const data = await response.json();
        alert(data.error || "삭제 중 오류가 발생했습니다.");
      }
    } catch (error) {
      console.error("삭제 실패:", error);
      alert("삭제 중 오류가 발생했습니다.");
    }
  };

  const handleSetDefault = async (prompt: SystemPrompt) => {
    try {
      const response = await fetch(`/api/admin/prompts/${prompt.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDefault: true }),
      });

      if (response.ok) {
        await fetchPrompts();
      }
    } catch (error) {
      console.error("기본 설정 실패:", error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">AI 시스템 프롬프트 관리</h1>
        {!isEditing && (
          <button
            onClick={handleCreate}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
          >
            + 새 프롬프트
          </button>
        )}
      </div>

      <div className="flex gap-6">
        {/* 프롬프트 목록 */}
        <div className={`${isEditing ? "w-1/3" : "w-full"} bg-white rounded-xl shadow-sm border border-gray-200`}>
          <div className="p-4 border-b border-gray-200">
            <p className="text-sm text-gray-500">
              AI 어시스턴트의 시스템 프롬프트를 관리합니다. 기본 프롬프트는 채팅에 자동 적용됩니다.
            </p>
          </div>

          {prompts.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <p>등록된 프롬프트가 없습니다.</p>
              <button
                onClick={handleCreate}
                className="mt-4 text-blue-600 hover:underline"
              >
                첫 프롬프트 만들기
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {prompts.map((prompt) => (
                <div
                  key={prompt.id}
                  className={`p-4 hover:bg-gray-50 cursor-pointer ${
                    selectedPrompt?.id === prompt.id ? "bg-blue-50" : ""
                  }`}
                  onClick={() => !isEditing && handleEdit(prompt)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-gray-900">{prompt.displayName}</h3>
                        {prompt.isDefault && (
                          <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full">
                            기본
                          </span>
                        )}
                        {!prompt.isActive && (
                          <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-500 rounded-full">
                            비활성
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 mt-1">{prompt.name}</p>
                      {prompt.description && (
                        <p className="text-sm text-gray-400 mt-1">{prompt.description}</p>
                      )}
                    </div>
                    {!isEditing && (
                      <div className="flex items-center gap-2">
                        {!prompt.isDefault && prompt.isActive && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSetDefault(prompt);
                            }}
                            className="text-xs text-blue-600 hover:underline"
                          >
                            기본으로
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEdit(prompt);
                          }}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          수정
                        </button>
                        {!prompt.isDefault && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(prompt);
                            }}
                            className="text-red-400 hover:text-red-600"
                          >
                            삭제
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="mt-2 text-xs text-gray-400">
                    v{prompt.version} | {new Date(prompt.updatedAt).toLocaleDateString("ko-KR")} 수정
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 편집 패널 */}
        {isEditing && (
          <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">
                {isCreating ? "새 프롬프트 만들기" : "프롬프트 수정"}
              </h2>
              <button
                onClick={handleCancel}
                className="text-gray-400 hover:text-gray-600"
              >
                취소
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    고유 이름 (영문) *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="예: main, immigration, permit"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={!isCreating}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    표시 이름 *
                  </label>
                  <input
                    type="text"
                    value={formData.displayName}
                    onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                    placeholder="예: 메인 AI 프롬프트"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  설명
                </label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="프롬프트에 대한 간단한 설명"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  시스템 프롬프트 내용 *
                </label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  placeholder="AI 어시스턴트에게 전달할 시스템 지침을 입력하세요..."
                  rows={16}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                />
                <p className="text-xs text-gray-400 mt-1">
                  마크다운 형식 지원. 현재 {formData.content.length}자
                </p>
              </div>

              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">활성화</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.isDefault}
                    onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">기본 프롬프트로 설정</span>
                </label>
              </div>

              <div className="pt-4 border-t border-gray-200 flex justify-end gap-3">
                <button
                  onClick={handleCancel}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  취소
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? "저장 중..." : isCreating ? "생성" : "저장"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
