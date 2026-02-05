"use client";

/**
 * =============================================================================
 * Knowledge Base Manager (The Brain) v3.0 - Gemini File API
 * =============================================================================
 * NotebookLM과 동일한 Long Context 방식
 * - 임베딩/청킹 불필요 → 10초 이내 업로드 완료
 * - 50MB+ 대용량 파일 지원
 * - Google File API로 직접 업로드
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";

// RPA Worker URL (대용량 파일 처리용)
const RPA_WORKER_URL = process.env.NEXT_PUBLIC_RPA_WORKER_URL || 'https://admini-rpa-worker-production.up.railway.app';
// Vercel 파일 크기 제한 (4.5MB - 안전 마진)
const VERCEL_SIZE_LIMIT = 4.5 * 1024 * 1024;

// 문서 타입 (Gemini File API 방식)
interface KnowledgeDocument {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number | null;
  title: string | null;
  category: string | null;
  description: string | null;
  status: string;
  totalChunks: number;
  totalTokens: number | null;
  errorMessage: string | null;
  uploadedBy: string | null;
  createdAt: string;
  // Gemini File API 필드
  geminiFileUri: string | null;
  geminiMimeType: string | null;
  geminiExpiresAt: string | null;
  processingMode: string | null;
}

// 업로드 작업 상태
interface UploadTask {
  id: string;
  fileName: string;
  fileSize: number;
  status: "uploading" | "completed" | "failed";
  progress: number;
  error?: string;
  startTime: number;
  elapsedSeconds?: number;
}

// 카테고리 옵션
const CATEGORIES = [
  { value: "", label: "전체" },
  { value: "출입국", label: "출입국/비자" },
  { value: "관광숙박", label: "관광숙박업" },
  { value: "행정절차", label: "행정절차" },
  { value: "인허가", label: "인허가/등록" },
  { value: "부동산", label: "부동산" },
  { value: "정책자금", label: "정책자금" },
  { value: "기업행정", label: "기업행정" },
  { value: "민원편람", label: "민원편람" },
  { value: "기타", label: "기타" },
];

// 상태 한글 매핑
const STATUS_LABELS: Record<string, string> = {
  uploading: "업로드 중",
  processing: "처리 중",
  completed: "학습 완료",
  ready: "학습 완료",
  failed: "실패",
  expired: "갱신 대기",
  pending: "대기 중",
};

// 지원 파일 형식
const SUPPORTED_EXTENSIONS = [".pdf", ".docx", ".doc", ".txt", ".csv", ".xlsx", ".pptx", ".hwp"];

export default function KnowledgePage() {
  const { data: session, status } = useSession();

  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [stats, setStats] = useState<{
    total: number;
    completed: number;
    processing: number;
    failed: number;
    expired: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploadTasks, setUploadTasks] = useState<UploadTask[]>([]);

  // 폼 상태
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [filterCategory, setFilterCategory] = useState("");

  // 드래그 앤 드롭
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 문서 목록 조회
  const fetchDocuments = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filterCategory) params.set("category", filterCategory);

      const res = await fetch(`/api/knowledge/upload?${params.toString()}`);
      const data = await res.json();

      if (data.success) {
        setDocuments(data.documents);
        setStats(data.stats);
      }
    } catch (error) {
      console.error("Failed to fetch documents:", error);
    } finally {
      setLoading(false);
    }
  }, [filterCategory]);

  useEffect(() => {
    if (status === "authenticated") {
      fetchDocuments();
    }
  }, [status, fetchDocuments]);

  // 파일 업로드 (Gemini File API로 직접)
  // 4.5MB 이상 파일은 RPA Worker로 라우팅 (Vercel 제한 우회)
  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;

    for (const file of selectedFiles) {
      const taskId = `task-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const isLargeFile = file.size > VERCEL_SIZE_LIMIT;

      // 업로드 작업 추가
      setUploadTasks((prev) => [
        ...prev,
        {
          id: taskId,
          fileName: file.name,
          fileSize: file.size,
          status: "uploading",
          progress: 30,
          startTime: Date.now(),
        },
      ]);

      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("title", title || file.name.replace(/\.[^/.]+$/, ""));
        formData.append("category", category || "기타");

        let data;

        if (isLargeFile) {
          // 대용량 파일: RPA Worker로 직접 업로드 (CORS로 보호됨)
          console.log(`[Knowledge] Large file detected (${(file.size / 1024 / 1024).toFixed(2)} MB), routing to RPA Worker`);

          const res = await fetch(`${RPA_WORKER_URL}/rag/upload-gemini`, {
            method: "POST",
            body: formData,
          });
          data = await res.json();

          // RPA Worker 업로드 성공 시 DB에 저장 (영구 저장소 + Gemini 캐시)
          if (data.success && data.fileUri) {
            console.log(`[Knowledge] RPA Worker upload success, saving to DB...`);
            console.log(`[Knowledge] - Storage: ${data.storagePath}`);
            console.log(`[Knowledge] - Gemini: ${data.fileUri}`);

            const saveRes = await fetch("/api/knowledge/save-gemini", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                fileName: file.name,
                fileType: file.name.split('.').pop()?.toLowerCase(),
                fileSize: file.size,
                title: title || file.name.replace(/\.[^/.]+$/, ""),
                category: category || "기타",
                // 영구 저장소 정보 (The Vault)
                storagePath: data.storagePath,
                storageProvider: data.storageProvider || "local",
                // Gemini 캐시 정보
                fileUri: data.fileUri,
                mimeType: data.mimeType,
                geminiFileName: data.fileName,
                expiresAt: data.expiresAt,
              }),
            });
            const saveData = await saveRes.json();
            if (saveData.success) {
              data.documentId = saveData.documentId;
            }
          }

          // RPA Worker 응답 형식을 Vercel API 응답 형식으로 변환
          if (data.success && data.processingTime) {
            data.elapsedSeconds = Math.round(data.processingTime / 1000);
          }
        } else {
          // 소형 파일: Vercel API로 업로드
          const res = await fetch("/api/knowledge/upload", {
            method: "POST",
            body: formData,
          });
          data = await res.json();
        }

        if (data.success) {
          setUploadTasks((prev) =>
            prev.map((t) =>
              t.id === taskId
                ? {
                    ...t,
                    status: "completed",
                    progress: 100,
                    elapsedSeconds: data.elapsedSeconds,
                  }
                : t
            )
          );
          // 문서 목록 새로고침
          fetchDocuments();
        } else {
          setUploadTasks((prev) =>
            prev.map((t) =>
              t.id === taskId
                ? { ...t, status: "failed", error: data.error }
                : t
            )
          );
        }
      } catch (error) {
        console.error("[Knowledge] Upload error:", error);
        setUploadTasks((prev) =>
          prev.map((t) =>
            t.id === taskId
              ? { ...t, status: "failed", error: "업로드 실패" }
              : t
          )
        );
      }
    }

    // 폼 초기화
    setSelectedFiles([]);
    setTitle("");
    setCategory("");
  };

  // 드래그 앤 드롭 핸들러
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files).filter((f) =>
      SUPPORTED_EXTENSIONS.some((ext) => f.name.toLowerCase().endsWith(ext))
    );

    if (files.length > 0) {
      setSelectedFiles(files);
      if (!title && files.length === 1) {
        setTitle(files[0].name.replace(/\.[^/.]+$/, ""));
      }
    }
  };

  // 파일 선택
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      setSelectedFiles(files);
      if (!title && files.length === 1) {
        setTitle(files[0].name.replace(/\.[^/.]+$/, ""));
      }
    }
  };

  // 문서 삭제
  const handleDelete = async (documentId: string) => {
    if (!confirm("이 문서를 삭제하시겠습니까? Google에서도 파일이 삭제됩니다.")) return;

    try {
      const res = await fetch(`/api/knowledge/${documentId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        fetchDocuments();
      }
    } catch (error) {
      console.error("Delete error:", error);
    }
  };

  // 작업 제거
  const removeTask = (taskId: string) => {
    setUploadTasks((prev) => prev.filter((t) => t.id !== taskId));
  };

  // 파일 크기 포맷
  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "-";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  // 만료 시간 계산 — completed 문서는 항상 "활성 (영구 보존)"
  // Gemini 캐시(48h)는 cron job이 자동 갱신하므로 사용자에게 "만료됨"을 표시하지 않음
  const getExpiryStatus = (doc: KnowledgeDocument) => {
    // completed 문서는 항상 활성 — 자동 갱신으로 영구 유지
    if (doc.status === "completed") {
      return { text: "활성 (영구 보존)", color: "text-green-600" };
    }

    const expiresAt = doc.geminiExpiresAt;
    if (!expiresAt) return null;

    const expires = new Date(expiresAt);
    const now = new Date();
    const hoursLeft = Math.floor((expires.getTime() - now.getTime()) / (1000 * 60 * 60));

    if (hoursLeft < 0) {
      return { text: "갱신 대기", color: "text-blue-600" };
    }
    if (hoursLeft < 6) return { text: `${hoursLeft}시간 남음`, color: "text-orange-600" };
    if (hoursLeft < 24) return { text: `${hoursLeft}시간 남음`, color: "text-yellow-600" };
    return { text: `${Math.floor(hoursLeft / 24)}일 남음`, color: "text-green-600" };
  };

  // 상태 배지
  const getStatusBadge = (status: string, processingMode?: string | null) => {
    const colors: Record<string, string> = {
      pending: "bg-yellow-100 text-yellow-800",
      processing: "bg-blue-100 text-blue-800",
      uploading: "bg-blue-100 text-blue-800",
      completed: "bg-green-100 text-green-800",
      ready: "bg-green-100 text-green-800",
      failed: "bg-red-100 text-red-800",
      expired: "bg-blue-100 text-blue-800",
    };

    return (
      <div className="flex items-center gap-1">
        <span
          className={`px-2 py-1 rounded text-xs font-medium ${
            colors[status] || "bg-gray-100 text-gray-800"
          }`}
        >
          {STATUS_LABELS[status] || status}
        </span>
        {processingMode === "gemini_file" && (
          <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">
            Long Context
          </span>
        )}
      </div>
    );
  };

  if (status === "loading" || loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            🧠 The Brain - 지식 베이스
            <span className="text-sm font-normal bg-gradient-to-r from-purple-600 to-blue-600 text-white px-2 py-0.5 rounded">
              v3.0 Gemini Long Context
            </span>
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            NotebookLM과 동일한 방식으로 대용량 문서를 즉시 학습합니다. (임베딩 불필요)
          </p>
        </div>
        <button
          onClick={fetchDocuments}
          className="px-4 py-2 border rounded-lg hover:bg-gray-50 flex items-center gap-2"
        >
          🔄 새로고침
        </button>
      </div>

      {/* 통계 */}
      {stats && (
        <div className="grid grid-cols-5 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <div className="text-3xl font-bold text-gray-800">{stats.total}</div>
            <div className="text-sm text-gray-500">전체 문서</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <div className="text-3xl font-bold text-green-600">{stats.completed}</div>
            <div className="text-sm text-gray-500">학습 완료</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <div className="text-3xl font-bold text-blue-600">{stats.processing}</div>
            <div className="text-sm text-gray-500">처리 중</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <div className="text-3xl font-bold text-red-600">{stats.failed}</div>
            <div className="text-sm text-gray-500">실패</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <div className="text-3xl font-bold text-blue-400">{stats.expired}</div>
            <div className="text-sm text-gray-500">갱신 대기</div>
          </div>
        </div>
      )}

      {/* 업로드 섹션 */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          📤 문서 업로드
          <span className="text-sm font-normal text-gray-500">(최대 100MB, 10초 이내 완료)</span>
        </h2>

        {/* 드래그 앤 드롭 영역 */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all ${
            isDragging
              ? "border-purple-500 bg-purple-50"
              : "border-gray-300 hover:border-purple-400 hover:bg-gray-50"
          }`}
        >
          {selectedFiles.length > 0 ? (
            <div className="space-y-2">
              <div className="text-4xl mb-2">📄</div>
              {selectedFiles.map((file, idx) => (
                <div key={idx} className="text-lg font-medium">
                  {file.name}{" "}
                  <span className="text-gray-500 text-sm">
                    ({formatFileSize(file.size)})
                  </span>
                  {file.size > VERCEL_SIZE_LIMIT && (
                    <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded">
                      RPA Worker
                    </span>
                  )}
                </div>
              ))}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedFiles([]);
                }}
                className="text-red-500 text-sm hover:underline mt-2"
              >
                파일 제거
              </button>
            </div>
          ) : (
            <>
              <div className="text-5xl mb-4">📁</div>
              <div className="text-gray-600 mb-2">
                파일을 드래그하거나 클릭하여 선택하세요
              </div>
              <div className="text-sm text-gray-400">
                지원 형식: PDF, DOCX, TXT, CSV, XLSX, PPTX, HWP (최대 100MB)
              </div>
            </>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept={SUPPORTED_EXTENSIONS.join(",")}
            onChange={handleFileSelect}
            className="hidden"
            multiple
          />
        </div>

        {/* 메타데이터 입력 */}
        {selectedFiles.length > 0 && (
          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">제목</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  placeholder="하이코리아 사증 매뉴얼"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">카테고리</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                >
                  <option value="">선택하세요</option>
                  {CATEGORIES.slice(1).map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              onClick={handleUpload}
              className="w-full py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 font-medium flex items-center justify-center gap-2"
            >
              🚀 즉시 학습 시작
            </button>
          </div>
        )}
      </div>

      {/* 진행 중인 작업 */}
      {uploadTasks.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">⏳ 업로드 작업</h2>
          <div className="space-y-4">
            {uploadTasks.map((task) => (
              <div
                key={task.id}
                className={`p-4 rounded-lg border ${
                  task.status === "failed"
                    ? "bg-red-50 border-red-200"
                    : task.status === "completed"
                    ? "bg-green-50 border-green-200"
                    : "bg-purple-50 border-purple-200"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="font-medium">{task.fileName}</span>
                    <span className="text-gray-500 text-sm ml-2">
                      ({formatFileSize(task.fileSize)})
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {task.status === "completed" && task.elapsedSeconds && (
                      <span className="text-green-600 text-sm font-medium">
                        ✓ {task.elapsedSeconds}초 완료
                      </span>
                    )}
                    {task.status === "uploading" && (
                      <span className="text-purple-600 text-sm animate-pulse">
                        Google에 업로드 중...
                      </span>
                    )}
                    {["completed", "failed"].includes(task.status) && (
                      <button
                        onClick={() => removeTask(task.id)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>

                {/* 진행률 바 */}
                {task.status === "uploading" && (
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-gradient-to-r from-purple-500 to-blue-500 h-2 rounded-full transition-all duration-500 animate-pulse"
                      style={{ width: `${task.progress}%` }}
                    />
                  </div>
                )}

                {/* 에러 메시지 */}
                {task.error && (
                  <div className="text-sm text-red-600 mt-2">{task.error}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 문서 목록 */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="text-lg font-semibold">
            📚 학습된 문서 ({documents.length})
          </h2>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-3 py-1.5 border rounded-lg"
          >
            {CATEGORIES.map((cat) => (
              <option key={cat.value} value={cat.value}>
                {cat.label}
              </option>
            ))}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                  제목
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                  카테고리
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                  크기
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                  상태
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                  유효기간
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                  업로드
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                  작업
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {documents.map((doc) => {
                const expiry = getExpiryStatus(doc);
                return (
                  <tr key={doc.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium">{doc.title || doc.fileName}</div>
                      <div className="text-xs text-gray-400">{doc.fileName}</div>
                    </td>
                    <td className="px-4 py-3 text-sm">{doc.category || "-"}</td>
                    <td className="px-4 py-3 text-sm">
                      {formatFileSize(doc.fileSize)}
                    </td>
                    <td className="px-4 py-3">
                      {getStatusBadge(doc.status, doc.processingMode)}
                      {doc.errorMessage && (
                        <div className="text-xs text-red-500 mt-1 max-w-xs truncate">
                          {doc.errorMessage}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {expiry ? (
                        <span className={expiry.color}>{expiry.text}</span>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {new Date(doc.createdAt).toLocaleDateString("ko-KR")}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleDelete(doc.id)}
                        className="text-red-500 hover:text-red-700 text-sm"
                      >
                        삭제
                      </button>
                    </td>
                  </tr>
                );
              })}
              {documents.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                    <div className="text-4xl mb-2">📭</div>
                    학습된 문서가 없습니다. 매뉴얼을 업로드해보세요!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 사용 안내 */}
      <div className="mt-6 p-4 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg text-sm text-gray-600 border border-purple-100">
        <h3 className="font-semibold mb-2 text-purple-800">💡 Gemini Long Context 방식</h3>
        <ul className="list-disc list-inside space-y-1">
          <li><strong>초고속 처리:</strong> 임베딩/청킹 없이 파일을 Google에 직접 업로드합니다.</li>
          <li><strong>대용량 지원:</strong> 최대 100MB 파일까지 10초 이내에 학습 완료됩니다.</li>
          <li><strong>자동 라우팅:</strong> 4.5MB 이상 파일은 자동으로 RPA Worker를 통해 업로드됩니다.</li>
          <li><strong>전체 컨텍스트:</strong> 문서 전체가 AI에게 전달되어 정확한 답변이 가능합니다.</li>
          <li><strong>자동 영구 보존:</strong> Gemini 캐시(48시간)가 만료되면 자동으로 갱신됩니다. 재업로드 불필요.</li>
        </ul>
      </div>
    </div>
  );
}
