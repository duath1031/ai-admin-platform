"use client";

/**
 * =============================================================================
 * Knowledge Base Manager (The Brain)
 * =============================================================================
 * 대용량 문서 업로드 및 RAG 파이프라인 관리
 * - RPA Worker로 직접 업로드 (Vercel 10초 타임아웃 우회)
 * - 비동기 처리 + 실시간 상태 폴링
 * - 500MB 파일 지원
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";

// RPA Worker URL
const RPA_URL = process.env.NEXT_PUBLIC_RPA_URL || "https://admini-rpa-worker-production.up.railway.app";

// 문서 타입
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
  progress?: number;
}

// 업로드 작업 상태
interface UploadTask {
  documentId: string;
  fileName: string;
  status: "uploading" | "extracting" | "chunking" | "embedding" | "saving" | "completed" | "failed";
  progress: number;
  error?: string;
  startTime: number;
}

// 카테고리 옵션
const CATEGORIES = [
  { value: "", label: "전체" },
  { value: "행정절차", label: "행정절차" },
  { value: "출입국", label: "출입국/비자" },
  { value: "인허가", label: "인허가/등록" },
  { value: "부동산", label: "부동산" },
  { value: "세무", label: "세무/회계" },
  { value: "정책자금", label: "정책자금" },
  { value: "민원편람", label: "민원편람" },
  { value: "기타", label: "기타" },
];

// 상태 한글 매핑
const STATUS_LABELS: Record<string, string> = {
  uploading: "업로드 중",
  extracting: "텍스트 추출 중",
  chunking: "청크 분할 중",
  embedding: "임베딩 생성 중",
  saving: "저장 중",
  processing: "처리 중",
  completed: "완료",
  ready: "완료",
  failed: "실패",
  pending: "대기 중",
  pending_embedding: "임베딩 대기",
};

export default function KnowledgePage() {
  const { data: session, status } = useSession();

  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
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

  // 상태 폴링 인터벌
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // RPA Worker 헬스체크
  const [rpaStatus, setRpaStatus] = useState<"checking" | "online" | "offline">("checking");

  // RPA Worker 상태 확인
  useEffect(() => {
    const checkRpaHealth = async () => {
      try {
        const res = await fetch(`${RPA_URL}/rag/health`, {
          headers: { "X-API-Key": "admini-rpa-worker-2024-secure-key" },
        });
        if (res.ok) {
          setRpaStatus("online");
        } else {
          setRpaStatus("offline");
        }
      } catch {
        setRpaStatus("offline");
      }
    };
    checkRpaHealth();
  }, []);

  // 문서 목록 조회
  const fetchDocuments = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filterCategory) params.set("category", filterCategory);

      const res = await fetch(`/api/knowledge/upload?${params.toString()}`);
      const data = await res.json();

      if (data.success) {
        setDocuments(data.documents);
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

  // 업로드 작업 상태 폴링
  useEffect(() => {
    const activeTasks = uploadTasks.filter(
      (t) => !["completed", "failed"].includes(t.status)
    );

    if (activeTasks.length > 0) {
      pollingRef.current = setInterval(async () => {
        for (const task of activeTasks) {
          try {
            const res = await fetch(`${RPA_URL}/rag/status/${task.documentId}`, {
              headers: { "X-API-Key": "admini-rpa-worker-2024-secure-key" },
            });
            const data = await res.json();

            setUploadTasks((prev) =>
              prev.map((t) =>
                t.documentId === task.documentId
                  ? {
                      ...t,
                      status: data.status,
                      progress: data.progress || t.progress,
                      error: data.taskInfo?.error,
                    }
                  : t
              )
            );

            // 완료되면 문서 목록 새로고침
            if (data.status === "completed" || data.status === "ready") {
              fetchDocuments();
            }
          } catch (error) {
            console.error("Status polling error:", error);
          }
        }
      }, 2000);

      return () => {
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
        }
      };
    }
  }, [uploadTasks, fetchDocuments]);

  // 파일 업로드 (RPA Worker로 직접)
  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;

    for (const file of selectedFiles) {
      const taskId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;

      // 업로드 작업 추가
      setUploadTasks((prev) => [
        ...prev,
        {
          documentId: taskId,
          fileName: file.name,
          status: "uploading",
          progress: 0,
          startTime: Date.now(),
        },
      ]);

      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("title", title || file.name.replace(/\.[^/.]+$/, ""));
        formData.append("category", category || "기타");

        // RPA Worker로 직접 업로드
        const res = await fetch(`${RPA_URL}/rag/upload`, {
          method: "POST",
          headers: {
            "X-API-Key": "admini-rpa-worker-2024-secure-key",
          },
          body: formData,
        });

        const data = await res.json();

        if (data.success) {
          // 실제 문서 ID로 업데이트
          setUploadTasks((prev) =>
            prev.map((t) =>
              t.documentId === taskId
                ? { ...t, documentId: data.documentId, status: "extracting", progress: 10 }
                : t
            )
          );
        } else {
          setUploadTasks((prev) =>
            prev.map((t) =>
              t.documentId === taskId
                ? { ...t, status: "failed", error: data.error }
                : t
            )
          );
        }
      } catch (error) {
        setUploadTasks((prev) =>
          prev.map((t) =>
            t.documentId === taskId
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
      [".pdf", ".docx", ".doc", ".txt"].some((ext) =>
        f.name.toLowerCase().endsWith(ext)
      )
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
    if (!confirm("이 문서를 삭제하시겠습니까?")) return;

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
  const removeTask = (documentId: string) => {
    setUploadTasks((prev) => prev.filter((t) => t.documentId !== documentId));
  };

  // 파일 크기 포맷
  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "-";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  // 소요 시간 포맷
  const formatDuration = (startTime: number) => {
    const seconds = Math.floor((Date.now() - startTime) / 1000);
    if (seconds < 60) return `${seconds}초`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes}분 ${seconds % 60}초`;
  };

  // 상태 배지
  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      pending: "bg-yellow-100 text-yellow-800",
      pending_embedding: "bg-orange-100 text-orange-800",
      processing: "bg-blue-100 text-blue-800",
      extracting: "bg-blue-100 text-blue-800",
      chunking: "bg-indigo-100 text-indigo-800",
      embedding: "bg-purple-100 text-purple-800",
      saving: "bg-cyan-100 text-cyan-800",
      completed: "bg-green-100 text-green-800",
      ready: "bg-green-100 text-green-800",
      failed: "bg-red-100 text-red-800",
    };

    return (
      <span
        className={`px-2 py-1 rounded text-xs font-medium ${
          colors[status] || "bg-gray-100 text-gray-800"
        }`}
      >
        {STATUS_LABELS[status] || status}
      </span>
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
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            대용량 문서를 업로드하면 AI가 학습하여 상담에 활용합니다.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* RPA Worker 상태 */}
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${
              rpaStatus === "online"
                ? "bg-green-100 text-green-700"
                : rpaStatus === "offline"
                ? "bg-red-100 text-red-700"
                : "bg-gray-100 text-gray-700"
            }`}
          >
            <div
              className={`w-2 h-2 rounded-full ${
                rpaStatus === "online"
                  ? "bg-green-500"
                  : rpaStatus === "offline"
                  ? "bg-red-500"
                  : "bg-gray-400 animate-pulse"
              }`}
            />
            {rpaStatus === "online"
              ? "RPA 서버 정상"
              : rpaStatus === "offline"
              ? "RPA 서버 오프라인"
              : "확인 중..."}
          </div>
          <button
            onClick={fetchDocuments}
            className="px-4 py-2 border rounded-lg hover:bg-gray-50 flex items-center gap-2"
          >
            🔄 새로고침
          </button>
        </div>
      </div>

      {/* RPA 오프라인 경고 */}
      {rpaStatus === "offline" && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <h3 className="font-semibold text-red-800">RPA Worker 서버에 연결할 수 없습니다</h3>
              <p className="text-red-700 text-sm mt-1">
                대용량 파일 업로드가 불가능합니다. Railway 배포 상태를 확인해주세요.
              </p>
              <code className="text-xs bg-red-100 px-2 py-1 rounded mt-2 block">
                {RPA_URL}
              </code>
            </div>
          </div>
        </div>
      )}

      {/* 업로드 섹션 */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          📤 문서 업로드
          <span className="text-sm font-normal text-gray-500">(최대 500MB)</span>
        </h2>

        {/* 드래그 앤 드롭 영역 */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all ${
            isDragging
              ? "border-blue-500 bg-blue-50"
              : "border-gray-300 hover:border-blue-400 hover:bg-gray-50"
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
                지원 형식: PDF, DOCX, TXT (최대 500MB)
              </div>
            </>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.doc,.txt"
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
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="2026년 민원 편람"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">카테고리</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
              disabled={rpaStatus !== "online"}
              className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2"
            >
              🚀 업로드 시작
            </button>
          </div>
        )}
      </div>

      {/* 진행 중인 작업 */}
      {uploadTasks.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">⏳ 처리 중인 작업</h2>
          <div className="space-y-4">
            {uploadTasks.map((task) => (
              <div
                key={task.documentId}
                className={`p-4 rounded-lg border ${
                  task.status === "failed"
                    ? "bg-red-50 border-red-200"
                    : task.status === "completed"
                    ? "bg-green-50 border-green-200"
                    : "bg-blue-50 border-blue-200"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="font-medium">{task.fileName}</div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500">
                      {formatDuration(task.startTime)}
                    </span>
                    {getStatusBadge(task.status)}
                    {["completed", "failed"].includes(task.status) && (
                      <button
                        onClick={() => removeTask(task.documentId)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>

                {/* 진행률 바 */}
                {!["completed", "failed"].includes(task.status) && (
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-500"
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
            📚 업로드된 문서 ({documents.length})
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
                  청크
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                  상태
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
              {documents.map((doc) => (
                <tr key={doc.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium">{doc.title || doc.fileName}</div>
                    {doc.description && (
                      <div className="text-xs text-gray-500 truncate max-w-xs">
                        {doc.description}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm">{doc.category || "-"}</td>
                  <td className="px-4 py-3 text-sm">
                    {formatFileSize(doc.fileSize)}
                  </td>
                  <td className="px-4 py-3 text-sm">{doc.totalChunks}</td>
                  <td className="px-4 py-3">
                    {getStatusBadge(doc.status)}
                    {doc.errorMessage && (
                      <div className="text-xs text-red-500 mt-1">
                        {doc.errorMessage}
                      </div>
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
              ))}
              {documents.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                    <div className="text-4xl mb-2">📭</div>
                    업로드된 문서가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 사용 안내 */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg text-sm text-gray-600">
        <h3 className="font-semibold mb-2">💡 사용 안내</h3>
        <ul className="list-disc list-inside space-y-1">
          <li>PDF, DOCX, TXT 파일을 최대 500MB까지 업로드할 수 있습니다.</li>
          <li>업로드된 문서는 자동으로 텍스트 추출 → 청크 분할 → 임베딩 생성 과정을 거칩니다.</li>
          <li>처리가 완료되면 AI 상담 시 해당 문서의 내용을 참조하여 답변합니다.</li>
          <li>대용량 파일(100MB 이상)은 처리에 수 분이 소요될 수 있습니다.</li>
        </ul>
      </div>
    </div>
  );
}
