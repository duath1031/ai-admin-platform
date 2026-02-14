"use client";

import { useState, useEffect, useCallback } from "react";
import ClientSelector from "@/components/common/ClientSelector";
import { useClientStore } from "@/lib/store";
import ResearchNotePdf from "@/components/labor/ResearchNotePdf";

// ─── Types ───

interface Attachment {
  name: string;
  type: string;
  data: string; // base64
  caption: string;
}

interface ResearchNote {
  id: string;
  userId: string;
  clientCompanyId: string | null;
  projectName: string;
  projectCode: string | null;
  researchPeriod: string | null;
  noteDate: string;
  noteNumber: number;
  title: string;
  purpose: string | null;
  content: string;
  result: string | null;
  conclusion: string | null;
  nextPlan: string | null;
  materials: string | null;
  equipment: string | null;
  researcherName: string | null;
  supervisorName: string | null;
  attachments: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface NoteForm {
  projectName: string;
  projectCode: string;
  researchPeriod: string;
  noteDate: string;
  noteNumber: string;
  title: string;
  purpose: string;
  content: string;
  result: string;
  conclusion: string;
  nextPlan: string;
  materials: string;
  equipment: string;
  researcherName: string;
  supervisorName: string;
  status: string;
}

const EMPTY_FORM: NoteForm = {
  projectName: "",
  projectCode: "",
  researchPeriod: "",
  noteDate: new Date().toISOString().split("T")[0],
  noteNumber: "",
  title: "",
  purpose: "",
  content: "",
  result: "",
  conclusion: "",
  nextPlan: "",
  materials: "",
  equipment: "",
  researcherName: "",
  supervisorName: "",
  status: "draft",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "수정중",
  completed: "작성완료",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-yellow-100 text-yellow-800",
  completed: "bg-green-100 text-green-800",
};

const MAX_ATTACHMENT_SIZE = 5 * 1024 * 1024; // 5MB per file
const MAX_ATTACHMENTS = 10;

type TabKey = "list" | "write" | "ai";

export default function ResearchNotePage() {
  const { selectedClient } = useClientStore();

  // ─── State ───
  const [activeTab, setActiveTab] = useState<TabKey>("list");
  const [notes, setNotes] = useState<ResearchNote[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<NoteForm>({ ...EMPTY_FORM });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewNote, setViewNote] = useState<ResearchNote | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // AI 보강 탭
  const [aiMemo, setAiMemo] = useState("");
  const [aiProjectName, setAiProjectName] = useState("");
  const [aiTitle, setAiTitle] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<{
    purpose: string;
    content: string;
    result: string;
    conclusion: string;
    nextPlan: string;
  } | null>(null);

  // ─── Fetch ───
  const fetchNotes = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedClient?.id) {
        params.set("clientCompanyId", selectedClient.id);
      }
      const res = await fetch(`/api/labor/research-note?${params.toString()}`);
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setNotes(json.data);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [selectedClient?.id]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  // ─── Handlers ───
  const showMessage = (type: "success" | "error", text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleFormChange = (
    field: keyof NoteForm,
    value: string
  ) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const resetForm = () => {
    setForm({ ...EMPTY_FORM, noteDate: new Date().toISOString().split("T")[0] });
    setEditingId(null);
    setAttachments([]);
  };

  // ─── Attachment Handlers ───
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    if (attachments.length + files.length > MAX_ATTACHMENTS) {
      showMessage("error", `첨부파일은 최대 ${MAX_ATTACHMENTS}개까지 가능합니다.`);
      return;
    }

    Array.from(files).forEach((file) => {
      if (file.size > MAX_ATTACHMENT_SIZE) {
        showMessage("error", `${file.name}: 파일 크기가 5MB를 초과합니다.`);
        return;
      }
      if (!file.type.startsWith("image/")) {
        showMessage("error", `${file.name}: 이미지 파일만 첨부 가능합니다.`);
        return;
      }

      const reader = new FileReader();
      reader.onload = (ev) => {
        const base64 = ev.target?.result as string;
        setAttachments((prev) => [
          ...prev,
          { name: file.name, type: file.type, data: base64, caption: "" },
        ]);
      };
      reader.readAsDataURL(file);
    });

    // reset input
    e.target.value = "";
  };

  const handleAttachmentCaption = (index: number, caption: string) => {
    setAttachments((prev) =>
      prev.map((att, i) => (i === index ? { ...att, caption } : att))
    );
  };

  const handleRemoveAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!form.projectName.trim()) {
      showMessage("error", "과제명을 입력해주세요.");
      return;
    }
    if (!form.title.trim()) {
      showMessage("error", "제목을 입력해주세요.");
      return;
    }
    if (!form.content.trim()) {
      showMessage("error", "연구내용을 입력해주세요.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...form,
        clientCompanyId: selectedClient?.id || null,
        noteNumber: form.noteNumber ? Number(form.noteNumber) : undefined,
        attachments: attachments.length > 0 ? attachments : null,
      };

      let res;
      if (editingId) {
        res = await fetch(`/api/labor/research-note/${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch("/api/labor/research-note", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      const json = await res.json();
      if (json.success) {
        showMessage("success", editingId ? "연구노트가 수정되었습니다." : "연구노트가 저장되었습니다.");
        resetForm();
        fetchNotes();
        setActiveTab("list");
      } else {
        showMessage("error", json.error || "저장에 실패했습니다.");
      }
    } catch {
      showMessage("error", "저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (note: ResearchNote) => {
    setForm({
      projectName: note.projectName,
      projectCode: note.projectCode || "",
      researchPeriod: note.researchPeriod || "",
      noteDate: note.noteDate ? new Date(note.noteDate).toISOString().split("T")[0] : "",
      noteNumber: String(note.noteNumber),
      title: note.title,
      purpose: note.purpose || "",
      content: note.content,
      result: note.result || "",
      conclusion: note.conclusion || "",
      nextPlan: note.nextPlan || "",
      materials: note.materials || "",
      equipment: note.equipment || "",
      researcherName: note.researcherName || "",
      supervisorName: note.supervisorName || "",
      status: note.status || "draft",
    });
    // 첨부파일 로딩
    if (note.attachments) {
      try {
        const parsed = JSON.parse(note.attachments);
        setAttachments(Array.isArray(parsed) ? parsed : []);
      } catch {
        setAttachments([]);
      }
    } else {
      setAttachments([]);
    }
    setEditingId(note.id);
    setViewNote(null);
    setActiveTab("write");
  };

  const handleDelete = async (id: string) => {
    if (!confirm("이 연구노트를 삭제하시겠습니까?")) return;

    try {
      const res = await fetch(`/api/labor/research-note/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.success) {
        showMessage("success", "연구노트가 삭제되었습니다.");
        if (viewNote?.id === id) setViewNote(null);
        fetchNotes();
      } else {
        showMessage("error", json.error || "삭제에 실패했습니다.");
      }
    } catch {
      showMessage("error", "삭제 중 오류가 발생했습니다.");
    }
  };

  const handleView = (note: ResearchNote) => {
    setViewNote(note);
  };

  // AI 보강
  const handleAiGenerate = async () => {
    if (!aiMemo.trim()) {
      showMessage("error", "AI 보강을 위한 메모를 입력해주세요.");
      return;
    }

    setAiLoading(true);
    setAiResult(null);
    try {
      const res = await fetch("/api/labor/research-note/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memo: aiMemo,
          projectName: aiProjectName || undefined,
          title: aiTitle || undefined,
        }),
      });

      const json = await res.json();
      if (json.success && json.data) {
        setAiResult(json.data);
        showMessage("success", "AI 보강이 완료되었습니다.");
      } else {
        showMessage("error", json.error || "AI 보강에 실패했습니다.");
      }
    } catch {
      showMessage("error", "AI 보강 중 오류가 발생했습니다.");
    } finally {
      setAiLoading(false);
    }
  };

  const handleApplyAiResult = () => {
    if (!aiResult) return;
    setForm((prev) => ({
      ...prev,
      projectName: aiProjectName || prev.projectName,
      title: aiTitle || prev.title,
      purpose: aiResult.purpose || prev.purpose,
      content: aiResult.content || prev.content,
      result: aiResult.result || prev.result,
      conclusion: aiResult.conclusion || prev.conclusion,
      nextPlan: aiResult.nextPlan || prev.nextPlan,
    }));
    setActiveTab("write");
    showMessage("success", "AI 결과가 노트 작성 탭에 반영되었습니다.");
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
    } catch {
      return dateStr;
    }
  };

  // ─── Tabs ───
  const tabs: { key: TabKey; label: string }[] = [
    { key: "list", label: "노트 목록" },
    { key: "write", label: editingId ? "노트 수정" : "노트 작성" },
    { key: "ai", label: "AI 보강" },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* ─── Header ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            연구노트 (R&D Note)
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            KOITA 표준 양식 연구노트 작성 및 관리
          </p>
        </div>
        <ClientSelector />
      </div>

      {/* ─── Message ─── */}
      {message && (
        <div
          className={`mb-4 px-4 py-3 rounded-lg text-sm font-medium ${
            message.type === "success"
              ? "bg-green-50 text-green-700 border border-green-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* ─── View Note (Modal-like) ─── */}
      {viewNote && (
        <div className="mb-6 bg-white rounded-xl shadow-sm border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">연구노트 상세</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleEdit(viewNote)}
                className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                수정
              </button>
              <button
                onClick={() => setViewNote(null)}
                className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                닫기
              </button>
            </div>
          </div>
          <ResearchNotePdf
            note={{
              projectName: viewNote.projectName,
              projectCode: viewNote.projectCode,
              researchPeriod: viewNote.researchPeriod,
              noteDate: viewNote.noteDate,
              noteNumber: viewNote.noteNumber,
              title: viewNote.title,
              purpose: viewNote.purpose,
              content: viewNote.content,
              result: viewNote.result,
              conclusion: viewNote.conclusion,
              nextPlan: viewNote.nextPlan,
              materials: viewNote.materials,
              equipment: viewNote.equipment,
              researcherName: viewNote.researcherName,
              supervisorName: viewNote.supervisorName,
            }}
          />
        </div>
      )}

      {/* ─── Tabs ─── */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => {
              setActiveTab(tab.key);
              if (tab.key === "write" && !editingId) {
                // keep form if editing
              }
              if (tab.key === "list") {
                setViewNote(null);
              }
            }}
            className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? "bg-white text-blue-700 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ════════════════════════════════════════════════ */}
      {/* TAB 1: 노트 목록 */}
      {/* ════════════════════════════════════════════════ */}
      {activeTab === "list" && (
        <div className="bg-white rounded-xl shadow-sm border">
          <div className="flex items-center justify-between p-4 border-b">
            <h2 className="text-base font-semibold text-gray-900">
              연구노트 목록
              <span className="ml-2 text-sm font-normal text-gray-400">
                ({notes.length}건)
              </span>
            </h2>
            <button
              onClick={() => {
                resetForm();
                setActiveTab("write");
              }}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              + 새 노트 작성
            </button>
          </div>

          {loading ? (
            <div className="p-12 text-center text-gray-400">
              <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-3" />
              불러오는 중...
            </div>
          ) : notes.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              <svg
                className="w-12 h-12 mx-auto mb-3 text-gray-300"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <p className="font-medium">등록된 연구노트가 없습니다.</p>
              <p className="text-sm mt-1">새 노트 작성 버튼을 눌러 시작하세요.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <th className="px-4 py-3 w-16">No.</th>
                    <th className="px-4 py-3">제목</th>
                    <th className="px-4 py-3 hidden md:table-cell">과제명</th>
                    <th className="px-4 py-3 w-28">작성일</th>
                    <th className="px-4 py-3 w-20">상태</th>
                    <th className="px-4 py-3 w-48 text-center">액션</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {notes.map((note) => (
                    <tr
                      key={note.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {note.noteNumber}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-gray-900 truncate max-w-[200px]">
                          {note.title}
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <div className="text-sm text-gray-600 truncate max-w-[180px]">
                          {note.projectName}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {formatDate(note.noteDate)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            STATUS_COLORS[note.status] || STATUS_COLORS.draft
                          }`}
                        >
                          {STATUS_LABELS[note.status] || note.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleView(note)}
                            className="px-2.5 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                          >
                            보기
                          </button>
                          <button
                            onClick={() => handleEdit(note)}
                            className="px-2.5 py-1 text-xs bg-blue-50 text-blue-700 rounded hover:bg-blue-100 transition-colors"
                          >
                            수정
                          </button>
                          <button
                            onClick={() => {
                              setViewNote(note);
                            }}
                            className="px-2.5 py-1 text-xs bg-green-50 text-green-700 rounded hover:bg-green-100 transition-colors"
                          >
                            인쇄
                          </button>
                          <button
                            onClick={() => handleDelete(note.id)}
                            className="px-2.5 py-1 text-xs bg-red-50 text-red-700 rounded hover:bg-red-100 transition-colors"
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
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════ */}
      {/* TAB 2: 노트 작성/수정 */}
      {/* ════════════════════════════════════════════════ */}
      {activeTab === "write" && (
        <div className="space-y-6">
          {/* 과제 정보 */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <svg
                className="w-5 h-5 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                />
              </svg>
              과제 정보
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  과제명 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.projectName}
                  onChange={(e) => handleFormChange("projectName", e.target.value)}
                  placeholder="연구과제명 입력"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  과제번호
                </label>
                <input
                  type="text"
                  value={form.projectCode}
                  onChange={(e) => handleFormChange("projectCode", e.target.value)}
                  placeholder="예: 2026-RD-001"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  연구기간
                </label>
                <input
                  type="text"
                  value={form.researchPeriod}
                  onChange={(e) => handleFormChange("researchPeriod", e.target.value)}
                  placeholder="예: 2026.01 ~ 2026.12"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
            </div>
          </div>

          {/* 노트 정보 */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <svg
                className="w-5 h-5 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              노트 정보
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  작성일 <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={form.noteDate}
                  onChange={(e) => handleFormChange("noteDate", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  노트번호
                </label>
                <input
                  type="number"
                  value={form.noteNumber}
                  onChange={(e) => handleFormChange("noteNumber", e.target.value)}
                  placeholder="자동 부여 (비워두면 자동)"
                  min={1}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  제목 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => handleFormChange("title", e.target.value)}
                  placeholder="연구노트 제목"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  상태
                </label>
                <select
                  value={form.status}
                  onChange={(e) => handleFormChange("status", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
                >
                  <option value="draft">수정중</option>
                  <option value="completed">작성완료</option>
                </select>
              </div>
            </div>
          </div>

          {/* 연구 내용 */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <svg
                className="w-5 h-5 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
              연구 내용
            </h3>

            {/* 연구목적 */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                1. 연구목적
              </label>
              <textarea
                value={form.purpose}
                onChange={(e) => handleFormChange("purpose", e.target.value)}
                placeholder="해당 실험/연구의 목적과 배경을 기술하세요."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-y"
              />
            </div>

            {/* 실험/연구내용 */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                2. 실험/연구 내용 <span className="text-red-500">*</span>
              </label>
              <textarea
                value={form.content}
                onChange={(e) => handleFormChange("content", e.target.value)}
                placeholder="구체적인 실험 방법, 절차, 조건 등을 상세히 기술하세요."
                rows={8}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-y"
              />
            </div>

            {/* 결과 */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                3. 결과
              </label>
              <textarea
                value={form.result}
                onChange={(e) => handleFormChange("result", e.target.value)}
                placeholder="실험 결과와 데이터를 정리하세요."
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-y"
              />
            </div>

            {/* 결론 및 고찰 */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                4. 결론 및 고찰
              </label>
              <textarea
                value={form.conclusion}
                onChange={(e) => handleFormChange("conclusion", e.target.value)}
                placeholder="결과에 대한 해석, 의미, 개선점을 기술하세요."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-y"
              />
            </div>

            {/* 향후 계획 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                5. 향후 계획
              </label>
              <textarea
                value={form.nextPlan}
                onChange={(e) => handleFormChange("nextPlan", e.target.value)}
                placeholder="다음 단계 연구/실험 계획을 기술하세요."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-y"
              />
            </div>
          </div>

          {/* 부가 정보 */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <svg
                className="w-5 h-5 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              부가 정보
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  사용재료/시약
                </label>
                <textarea
                  value={form.materials}
                  onChange={(e) => handleFormChange("materials", e.target.value)}
                  placeholder="사용한 재료, 시약, 소프트웨어 등"
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-y"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  사용장비
                </label>
                <textarea
                  value={form.equipment}
                  onChange={(e) => handleFormChange("equipment", e.target.value)}
                  placeholder="사용한 장비, 기기, 도구 등"
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-y"
                />
              </div>
            </div>
          </div>

          {/* 첨부파일 (사진/이미지) */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <svg
                className="w-5 h-5 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              첨부파일 (사진/도표)
              <span className="text-xs font-normal text-gray-400 ml-1">
                {attachments.length}/{MAX_ATTACHMENTS}
              </span>
            </h3>

            {/* 파일 선택 */}
            <div className="mb-4">
              <label className="relative inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg cursor-pointer hover:bg-blue-100 transition-colors text-sm font-medium">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                사진 추가
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileSelect}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
              </label>
              <span className="ml-3 text-xs text-gray-400">
                이미지 파일 (JPG, PNG 등), 개당 최대 5MB
              </span>
            </div>

            {/* 첨부 목록 */}
            {attachments.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {attachments.map((att, idx) => (
                  <div
                    key={idx}
                    className="relative border border-gray-200 rounded-lg overflow-hidden group"
                  >
                    {/* 이미지 미리보기 */}
                    <div className="aspect-[4/3] bg-gray-50 flex items-center justify-center overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={att.data}
                        alt={att.caption || att.name}
                        className="w-full h-full object-contain"
                      />
                    </div>
                    {/* 삭제 버튼 */}
                    <button
                      onClick={() => handleRemoveAttachment(idx)}
                      className="absolute top-2 right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                      title="삭제"
                    >
                      X
                    </button>
                    {/* 파일명 + 캡션 */}
                    <div className="p-2 border-t border-gray-100">
                      <p className="text-xs text-gray-500 truncate mb-1">{att.name}</p>
                      <input
                        type="text"
                        value={att.caption}
                        onChange={(e) => handleAttachmentCaption(idx, e.target.value)}
                        placeholder="사진 설명 (선택)"
                        className="w-full px-2 py-1 border border-gray-200 rounded text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {attachments.length === 0 && (
              <div className="text-center py-6 text-gray-400 text-sm">
                <svg className="w-10 h-10 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                실험 사진, 도표, 그래프 등을 첨부할 수 있습니다.
              </div>
            )}
          </div>

          {/* 서명 */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <svg
                className="w-5 h-5 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
              서명
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  연구원명
                </label>
                <input
                  type="text"
                  value={form.researcherName}
                  onChange={(e) => handleFormChange("researcherName", e.target.value)}
                  placeholder="연구원 성명"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  연구책임자명
                </label>
                <input
                  type="text"
                  value={form.supervisorName}
                  onChange={(e) => handleFormChange("supervisorName", e.target.value)}
                  placeholder="연구책임자 성명"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
            </div>
          </div>

          {/* 하단 버튼 */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {saving ? (
                <>
                  <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                  저장 중...
                </>
              ) : editingId ? (
                "수정 저장"
              ) : (
                "저장"
              )}
            </button>

            {(form.projectName && form.title && form.content) && (
              <button
                onClick={() => {
                  setViewNote({
                    id: "",
                    userId: "",
                    clientCompanyId: null,
                    projectName: form.projectName,
                    projectCode: form.projectCode || null,
                    researchPeriod: form.researchPeriod || null,
                    noteDate: form.noteDate || new Date().toISOString(),
                    noteNumber: form.noteNumber ? Number(form.noteNumber) : 1,
                    title: form.title,
                    purpose: form.purpose || null,
                    content: form.content,
                    result: form.result || null,
                    conclusion: form.conclusion || null,
                    nextPlan: form.nextPlan || null,
                    materials: form.materials || null,
                    equipment: form.equipment || null,
                    researcherName: form.researcherName || null,
                    supervisorName: form.supervisorName || null,
                    attachments: attachments.length > 0 ? JSON.stringify(attachments) : null,
                    status: form.status || "draft",
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                  });
                  setActiveTab("list");
                }}
                className="px-6 py-2.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
                  />
                </svg>
                미리보기 / 인쇄
              </button>
            )}

            <button
              onClick={() => setActiveTab("ai")}
              className="px-6 py-2.5 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
              AI 보강
            </button>

            {editingId && (
              <button
                onClick={() => {
                  resetForm();
                  showMessage("success", "작성 폼이 초기화되었습니다.");
                }}
                className="px-4 py-2.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
              >
                새 노트로 초기화
              </button>
            )}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════ */}
      {/* TAB 3: AI 보강 */}
      {/* ════════════════════════════════════════════════ */}
      {activeTab === "ai" && (
        <div className="space-y-6">
          {/* 입력 */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-2 flex items-center gap-2">
              <svg
                className="w-5 h-5 text-purple-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
              AI 연구노트 보강
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              간단한 메모나 키워드를 입력하면, AI가 KOITA 표준 연구노트 양식에 맞게 정리해줍니다.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  과제명 (선택)
                </label>
                <input
                  type="text"
                  value={aiProjectName}
                  onChange={(e) => setAiProjectName(e.target.value)}
                  placeholder="AI가 맥락 파악에 활용합니다"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  제목 (선택)
                </label>
                <input
                  type="text"
                  value={aiTitle}
                  onChange={(e) => setAiTitle(e.target.value)}
                  placeholder="연구노트 제목"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
                />
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                메모/키워드 <span className="text-red-500">*</span>
              </label>
              <textarea
                value={aiMemo}
                onChange={(e) => setAiMemo(e.target.value)}
                placeholder={`예시:\n- 오늘 딥러닝 모델 학습 진행\n- ResNet-50 기반, 배치사이즈 32, 에포크 100\n- validation accuracy 94.2% 달성\n- 과적합 징후 있어 드롭아웃 조정 필요`}
                rows={6}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none resize-y"
              />
            </div>

            <button
              onClick={handleAiGenerate}
              disabled={aiLoading || !aiMemo.trim()}
              className="px-6 py-2.5 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {aiLoading ? (
                <>
                  <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                  AI 정리 중...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 10V3L4 14h7v7l9-11h-7z"
                    />
                  </svg>
                  AI 정리
                </>
              )}
            </button>
          </div>

          {/* AI 결과 미리보기 */}
          {aiResult && (
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                  <svg
                    className="w-5 h-5 text-green-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  AI 보강 결과
                </h3>
                <button
                  onClick={handleApplyAiResult}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                  노트에 반영
                </button>
              </div>

              <div className="space-y-4">
                <div className="bg-blue-50 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-blue-800 mb-1">
                    1. 연구목적
                  </h4>
                  <p className="text-sm text-blue-900 whitespace-pre-wrap">
                    {aiResult.purpose}
                  </p>
                </div>
                <div className="bg-blue-50 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-blue-800 mb-1">
                    2. 실험/연구 내용
                  </h4>
                  <p className="text-sm text-blue-900 whitespace-pre-wrap">
                    {aiResult.content}
                  </p>
                </div>
                <div className="bg-blue-50 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-blue-800 mb-1">
                    3. 결과
                  </h4>
                  <p className="text-sm text-blue-900 whitespace-pre-wrap">
                    {aiResult.result}
                  </p>
                </div>
                <div className="bg-blue-50 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-blue-800 mb-1">
                    4. 결론 및 고찰
                  </h4>
                  <p className="text-sm text-blue-900 whitespace-pre-wrap">
                    {aiResult.conclusion}
                  </p>
                </div>
                <div className="bg-blue-50 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-blue-800 mb-1">
                    5. 향후 계획
                  </h4>
                  <p className="text-sm text-blue-900 whitespace-pre-wrap">
                    {aiResult.nextPlan}
                  </p>
                </div>
              </div>

              <div className="mt-4 flex justify-end">
                <button
                  onClick={handleApplyAiResult}
                  className="px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                  노트에 반영 (작성 탭으로 이동)
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
