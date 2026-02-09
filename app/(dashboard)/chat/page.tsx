"use client";

import { useState, useRef, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useChatStore } from "@/lib/store";
import { Button, Textarea } from "@/components/ui";
import MessageRenderer from "@/components/chat/MessageRenderer";

interface UploadedFile {
  originalName: string;
  savedPath: string;
  fileType: string;
  size: number;
}

export default function ChatPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialQuestion = searchParams.get("q");
  const [input, setInput] = useState(initialQuestion || "");
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { messages, isLoading, addMessage, setLoading, setUploadedFileData, rpaState, setRpaState, resetRpaState } = useChatStore();
  const [showHumanModal, setShowHumanModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authData, setAuthData] = useState({
    name: '',
    rrn1: '', // 주민번호 앞자리 (6자리)
    rrn2: '', // 주민번호 뒷자리 (7자리)
    phoneNumber: '',
    carrier: '',
    authMethod: 'kakao' as 'kakao' | 'naver' | 'pass' | 'toss',
    serviceUrl: '', // 정부24 민원 서비스 URL
    serviceName: '', // 민원명
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (initialQuestion && messages.length === 0) {
      handleSubmit(new Event("submit") as unknown as React.FormEvent);
    }
  }, [initialQuestion]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/rpa/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (data.success && data.file) {
        setUploadedFile({
          originalName: data.file.originalName,
          savedPath: data.file.savedPath,
          fileType: data.file.fileType,
          size: data.file.savedSize,
        });
        // base64 데이터를 zustand에 저장 (RPA 제출 시 사용)
        if (data.base64) {
          setUploadedFileData(data.file.savedPath, data.base64);
        }
      } else {
        alert(data.error || "파일 업로드 실패");
      }
    } catch (err) {
      console.error("File upload error:", err);
      alert("파일 업로드 중 오류가 발생했습니다.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    const currentFile = uploadedFile;
    setInput("");
    setUploadedFile(null);

    addMessage({
      role: "user",
      content: userMessage,
      ...(currentFile ? { fileAttachment: currentFile } : {}),
    });
    setLoading(true);

    // 스트리밍 응답을 위한 임시 메시지 ID
    const tempId = `temp-${Date.now()}`;
    addMessage({ role: "assistant", content: "", id: tempId });

    const allMessages = [...messages, { role: "user", content: userMessage }].map(
      (m) => ({ role: m.role, content: m.content })
    );

    // fileContext 포함
    const requestBody: Record<string, unknown> = { messages: allMessages };
    if (currentFile) {
      requestBody.fileContext = {
        name: currentFile.originalName,
        path: currentFile.savedPath,
        type: currentFile.fileType,
        size: currentFile.size,
      };
    }

    try {
      // 먼저 스트리밍 시도
      const response = await fetch("/api/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error("스트리밍 응답 실패");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6);
              if (data === "[DONE]") continue;

              try {
                const parsed = JSON.parse(data);
                if (parsed.text) {
                  fullContent += parsed.text;
                  useChatStore.getState().updateMessage(tempId, fullContent);
                }
                if (parsed.error) {
                  throw new Error(parsed.error);
                }
              } catch (parseError) {
                if (parseError instanceof Error && parseError.message !== "Unexpected end of JSON input") {
                  throw parseError;
                }
              }
            }
          }
        }
      }

      // 스트리밍이 빈 응답이면 폴백
      if (!fullContent) {
        throw new Error("빈 응답");
      }
    } catch (streamError) {
      console.log("스트리밍 실패, 기존 API로 폴백:", streamError);

      // 기존 API로 폴백
      try {
        const fallbackResponse = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: allMessages }),
        });

        const data = await fallbackResponse.json();

        if (data.error) {
          useChatStore.getState().updateMessage(tempId, `오류가 발생했습니다: ${data.error}`);
        } else {
          useChatStore.getState().updateMessage(tempId, data.message);
        }
      } catch (fallbackError) {
        useChatStore.getState().updateMessage(
          tempId,
          "죄송합니다. 서버 연결에 문제가 발생했습니다. 잠시 후 다시 시도해주세요."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  // RPA 자동 접수 핸들러 (로봇 버튼) - 인증 수단 선택 모달 열기
  const handleRobotSubmit = () => {
    // 파일이 없으면 파일 선택 유도
    if (!uploadedFile) {
      fileInputRef.current?.click();
      return;
    }

    const { uploadedFileData } = useChatStore.getState();
    const fileBase64 = uploadedFileData[uploadedFile.savedPath];

    if (!fileBase64) {
      alert("파일 데이터를 찾을 수 없습니다. 파일을 다시 첨부해주세요.");
      return;
    }

    // 인증 수단 선택 모달 열기
    setShowAuthModal(true);
  };

  // 실제 RPA 접수 실행 (인증 정보 포함)
  const executeRpaSubmit = async () => {
    if (!uploadedFile) return;

    // 필수 입력 검증 (주민번호: rrn1 6자리, rrn2 7자리)
    if (!authData.name || !authData.rrn1 || !authData.rrn2 || !authData.phoneNumber) {
      alert("이름, 주민등록번호, 휴대폰번호를 모두 입력해주세요.");
      return;
    }
    if (authData.rrn1.length !== 6 || authData.rrn2.length !== 7) {
      alert("주민등록번호를 올바르게 입력해주세요. (앞 6자리, 뒤 7자리)");
      return;
    }

    const { uploadedFileData } = useChatStore.getState();
    const fileBase64 = uploadedFileData[uploadedFile.savedPath];

    setShowAuthModal(false);
    setRpaState({ status: 'connecting', message: '🤖 로봇이 정부24에 접속 중입니다... (화면은 뜨지 않습니다)' });

    try {
      // 1초 후 안내 메시지 업데이트
      setTimeout(() => {
        if (useChatStore.getState().rpaState.status === 'connecting') {
          setRpaState({ status: 'connecting', message: '🤖 로봇이 정부24에 접속 중입니다...\n잠시 후 휴대폰으로 인증 알림이 발송됩니다.' });
        }
      }, 1500);

      setRpaState({ status: 'logging_in', message: '🔐 간편인증 요청 중... 휴대폰 알림을 확인해주세요.' });

      const res = await fetch('/api/rpa/submit-v2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'upload',
          fileBase64,
          fileName: uploadedFile.originalName,
          serviceUrl: authData.serviceUrl || undefined,
          serviceName: authData.serviceName || undefined,
          authData: {
            name: authData.name,
            rrn1: authData.rrn1,      // 주민번호 앞자리
            rrn2: authData.rrn2,      // 주민번호 뒷자리
            phoneNumber: authData.phoneNumber,
            carrier: authData.carrier || undefined,
            authMethod: authData.authMethod,
          },
        }),
      });
      const data = await res.json();

      if (data.success) {
        if (data.action === 'AUTHENTICATE') {
          setRpaState({
            status: 'auth_required',
            message: '✅ 휴대폰으로 인증 요청이 전송되었습니다!\n앱에서 인증을 완료한 후 아래 버튼을 눌러주세요.',
            submissionId: data.submissionId,
          });
        } else if (data.step === 'submitted') {
          setRpaState({
            status: 'submitted',
            message: '접수 완료!',
            submissionId: data.submissionId,
          });
          setTimeout(() => resetRpaState(), 5000);
        } else {
          setRpaState({
            status: 'auth_required',
            message: data.message || '처리 중...',
            submissionId: data.submissionId,
          });
        }
      } else {
        setRpaState({ status: 'error', message: data.error || '접수 실패' });
        setTimeout(() => resetRpaState(), 5000);
      }
    } catch (err) {
      setRpaState({ status: 'error', message: '서버 연결 오류' });
      setTimeout(() => resetRpaState(), 5000);
    }
  };

  return (
    <div className="max-w-4xl mx-auto h-[calc(100vh-7rem)] md:h-[calc(100vh-8rem)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-2 md:mb-4">
        <div>
          <h1 className="text-lg md:text-xl font-bold text-gray-900">AI 상담</h1>
          <p className="text-xs md:text-sm text-gray-600 hidden sm:block">
            행정 절차, 인허가 요건 등 궁금한 사항을 질문하세요
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            useChatStore.getState().clearMessages();
          }}
        >
          새 대화
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto bg-white rounded-xl border border-gray-200 p-3 md:p-4 mb-2 md:mb-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-500">
            <div className="w-16 h-16 bg-primary-50 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <p className="text-lg font-medium mb-2">AI행정사에게 질문하세요</p>
            <p className="text-sm text-center max-w-md">
              행정 절차, 인허가 요건, 필요 서류, 법령 정보 등<br />
              다양한 행정 관련 질문에 답변해 드립니다
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${
                  message.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[90%] md:max-w-[80%] rounded-2xl px-3 md:px-4 py-2 md:py-3 ${
                    message.role === "user"
                      ? "bg-primary-600 text-white"
                      : "bg-gray-100 text-gray-900"
                  }`}
                >
                  <div className="whitespace-pre-wrap">
                    <MessageRenderer
                      content={message.content}
                      isUser={message.role === "user"}
                      fileAttachment={message.fileAttachment}
                    />
                  </div>
                  <div
                    className={`text-xs mt-2 ${
                      message.role === "user" ? "text-blue-200" : "text-gray-500"
                    }`}
                  >
                    {new Date(message.createdAt).toLocaleTimeString("ko-KR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-2xl px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0.1s" }} />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* File Preview */}
      {uploadedFile && (
        <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg mb-2">
          <svg className="w-4 h-4 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
          </svg>
          <span className="text-sm text-blue-700 truncate flex-1">{uploadedFile.originalName}</span>
          <span className="text-xs text-blue-500">{(uploadedFile.size / 1024).toFixed(0)}KB</span>
          <button
            type="button"
            onClick={() => setUploadedFile(null)}
            className="p-0.5 hover:bg-blue-100 rounded"
          >
            <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex gap-2 md:gap-3">
        {/* File Upload Button */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.hwpx"
          onChange={handleFileUpload}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading || isLoading}
          className="flex items-center justify-center w-10 h-10 md:w-11 md:h-11 rounded-lg border border-gray-300 hover:bg-gray-50 text-gray-500 hover:text-gray-700 transition-colors disabled:opacity-50 flex-shrink-0 self-end"
          title="파일 첨부 (PDF, JPG, PNG, HWPX)"
        >
          {isUploading ? (
            <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
          )}
        </button>

        <div className="flex-1 relative">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={uploadedFile ? "파일과 함께 보낼 메시지를 입력하세요..." : "질문을 입력하세요..."}
            className="min-h-[44px] md:min-h-[48px] max-h-[150px] md:max-h-[200px] pr-2 resize-none text-sm md:text-base"
            rows={1}
          />
        </div>
        <Button type="submit" disabled={!input.trim() || isLoading} className="px-3 md:px-4 self-end">
          {isLoading ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          )}
        </Button>
      </form>

      {/* RPA 실시간 상태 토스트 */}
      {rpaState.status !== 'idle' && (
        <div className={`mt-2 px-4 py-3 rounded-lg transition-all ${
          rpaState.status === 'error' ? 'bg-red-50 border border-red-200 text-red-700' :
          rpaState.status === 'submitted' ? 'bg-green-50 border border-green-200 text-green-700' :
          rpaState.status === 'auth_required' ? 'bg-amber-50 border border-amber-200 text-amber-800' :
          'bg-blue-50 border border-blue-200 text-blue-700'
        }`}>
          <div className="flex items-center gap-3 text-sm font-medium">
            {rpaState.status === 'connecting' && (
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
            )}
            {rpaState.status === 'logging_in' && (
              <span className="flex-shrink-0">🔑</span>
            )}
            {rpaState.status === 'auth_required' && (
              <span className="flex-shrink-0">📱</span>
            )}
            {rpaState.status === 'uploading' && (
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
            )}
            {rpaState.status === 'verifying' && (
              <span className="flex-shrink-0">👀</span>
            )}
            {rpaState.status === 'submitted' && (
              <span className="flex-shrink-0">✅</span>
            )}
            {rpaState.status === 'error' && (
              <span className="flex-shrink-0">❌</span>
            )}
            <span className="flex-1">{rpaState.message}</span>
            {(rpaState.status === 'error' || rpaState.status === 'submitted') && (
              <button
                onClick={() => resetRpaState()}
                className="p-1 hover:bg-black/5 rounded flex-shrink-0"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          {/* auth_required 상태: 인증 완료 버튼 표시 */}
          {rpaState.status === 'auth_required' && rpaState.submissionId && (
            <button
              onClick={async () => {
                setRpaState({ status: 'uploading', message: '서류 제출 중...' });
                try {
                  const res = await fetch('/api/rpa/submit-v2?action=confirm', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ submissionId: rpaState.submissionId }),
                  });
                  const data = await res.json();
                  if (data.success) {
                    setRpaState({ status: 'submitted', message: data.message || '접수 완료!' });
                    setTimeout(() => resetRpaState(), 5000);
                  } else {
                    setRpaState({ status: 'error', message: data.error || '접수 실패' });
                  }
                } catch (err) {
                  setRpaState({ status: 'error', message: '서버 연결 오류' });
                }
              }}
              className="mt-3 w-full py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white text-base font-bold rounded-lg transition-all shadow-md flex items-center justify-center gap-2 animate-pulse"
            >
              <span className="text-lg">✅</span>
              인증 완료 및 접수 계속하기
            </button>
          )}
        </div>
      )}

      {/* 접수 방식 선택 (3분할: 로봇 / 접수대행 / 대리인선임) + 보조 버튼 */}
      <div className="mt-2 md:mt-3 space-y-2">
        {/* 메인 3분할 버튼 */}
        <div className="grid grid-cols-3 gap-2">
          {/* 🚀 로봇 자동접수 */}
          <button
            onClick={handleRobotSubmit}
            disabled={rpaState.status !== 'idle' && rpaState.status !== 'error'}
            className="flex flex-col items-center justify-center gap-1 px-2 py-3 bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 text-white text-xs font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
          >
            <span className="text-xl">🚀</span>
            <span>로봇 자동접수</span>
          </button>
          {/* 📋 행정사 접수대행 */}
          <button
            onClick={() => setShowHumanModal(true)}
            className="flex flex-col items-center justify-center gap-1 px-2 py-3 bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-600 hover:to-blue-700 text-white text-xs font-bold rounded-xl transition-all shadow-md"
          >
            <span className="text-xl">📋</span>
            <span>접수대행</span>
          </button>
          {/* 🤝 행정사 대리인선임 */}
          <button
            onClick={() => router.push('/submission?type=delegate')}
            className="flex flex-col items-center justify-center gap-1 px-2 py-3 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white text-xs font-bold rounded-xl transition-all shadow-md"
          >
            <span className="text-xl">🤝</span>
            <span>대리인선임</span>
          </button>
        </div>
        {/* 보조 버튼 */}
        <div className="flex justify-center gap-2">
          <a
            href="tel:070-8657-1888"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium rounded-lg transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
            상담전화
          </a>
          <a
            href="https://www.jungeui.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium rounded-lg transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
            </svg>
            공식홈페이지
          </a>
        </div>
      </div>

      {/* 행정사 대행 의뢰 모달 */}
      {showHumanModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full max-h-[85vh] overflow-y-auto">
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900">👨‍💼 행정사 대행 의뢰</h3>
                <button onClick={() => setShowHumanModal(false)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="space-y-3">
                <div className="p-3 bg-indigo-50 rounded-lg border border-indigo-200">
                  <p className="text-sm text-indigo-800">
                    행정사가 대리인으로서 민원 접수부터 완료까지 모든 절차를 대행합니다.
                    복잡한 인허가, 수수료 납부, 방문 접수 등이 필요한 경우에 적합합니다.
                  </p>
                </div>
                <div className="p-3 bg-gradient-to-r from-blue-600 to-indigo-700 rounded-xl text-white">
                  <h4 className="font-bold mb-1 text-sm">행정사합동사무소 정의</h4>
                  <p className="text-xs text-blue-100 mb-2">염현수 대표 행정사</p>
                  <div className="grid grid-cols-2 gap-2">
                    <a href="tel:070-8657-1888" className="flex items-center justify-center gap-1 py-2 bg-white text-blue-700 rounded-lg text-xs font-medium hover:bg-blue-50">
                      📞 070-8657-1888
                    </a>
                    <a href="https://pf.kakao.com/_jWfwb" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-1 py-2 bg-yellow-400 text-yellow-900 rounded-lg text-xs font-medium hover:bg-yellow-300">
                      💬 카카오 상담
                    </a>
                    <a
                      href="https://www.jungeui.com/%EB%AC%B8%EC%9D%98%ED%95%98%EA%B8%B0"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-1 py-2 bg-blue-100 text-blue-700 rounded-lg text-xs font-medium hover:bg-blue-200 col-span-2"
                    >
                      📝 온라인 의뢰하기
                    </a>
                  </div>
                </div>
              </div>
              <button onClick={() => setShowHumanModal(false)} className="mt-3 w-full py-2.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200">
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 간편인증 수단 선택 모달 */}
      {showAuthModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900">🔐 정부24 간편인증</h3>
                <button onClick={() => setShowAuthModal(false)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* 정부24 민원 서비스 URL */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">정부24 민원 서비스 URL *</label>
                <input
                  type="url"
                  value={authData.serviceUrl}
                  onChange={(e) => setAuthData({ ...authData, serviceUrl: e.target.value })}
                  placeholder="https://www.gov.kr/mw/AA020InfoCappView.do?..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
                <p className="mt-1 text-xs text-gray-500">정부24에서 해당 민원 페이지 URL을 복사해서 붙여넣으세요.</p>
                <input
                  type="text"
                  value={authData.serviceName}
                  onChange={(e) => setAuthData({ ...authData, serviceName: e.target.value })}
                  placeholder="민원명 (예: 납세관리인 지정신고)"
                  className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>

              {/* 인증 수단 선택 */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">인증 수단 선택</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'kakao', label: '카카오톡', color: 'bg-yellow-400 hover:bg-yellow-500 text-yellow-900' },
                    { id: 'naver', label: '네이버', color: 'bg-green-500 hover:bg-green-600 text-white' },
                    { id: 'pass', label: 'PASS', color: 'bg-red-500 hover:bg-red-600 text-white' },
                    { id: 'toss', label: '토스', color: 'bg-blue-500 hover:bg-blue-600 text-white' },
                  ].map((method) => (
                    <button
                      key={method.id}
                      type="button"
                      onClick={() => setAuthData({ ...authData, authMethod: method.id as typeof authData.authMethod })}
                      className={`py-3 rounded-lg text-sm font-bold transition-all ${
                        authData.authMethod === method.id
                          ? `${method.color} ring-2 ring-offset-2 ring-gray-400`
                          : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                      }`}
                    >
                      {method.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 개인정보 입력 */}
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">이름 *</label>
                  <input
                    type="text"
                    value={authData.name}
                    onChange={(e) => setAuthData({ ...authData, name: e.target.value })}
                    placeholder="홍길동"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">주민등록번호 *</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={authData.rrn1}
                      onChange={(e) => setAuthData({ ...authData, rrn1: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                      placeholder="앞 6자리"
                      maxLength={6}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm text-center focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    />
                    <span className="text-gray-400 font-bold">-</span>
                    <input
                      type="password"
                      value={authData.rrn2}
                      onChange={(e) => setAuthData({ ...authData, rrn2: e.target.value.replace(/\D/g, '').slice(0, 7) })}
                      placeholder="뒤 7자리"
                      maxLength={7}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm text-center focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-500">정부24 비회원 인증에 필요합니다. 안전하게 암호화됩니다.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">휴대폰번호 *</label>
                  <input
                    type="tel"
                    value={authData.phoneNumber}
                    onChange={(e) => setAuthData({ ...authData, phoneNumber: e.target.value.replace(/\D/g, '') })}
                    placeholder="01012345678"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">통신사 (선택)</label>
                  <select
                    value={authData.carrier}
                    onChange={(e) => setAuthData({ ...authData, carrier: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  >
                    <option value="">선택 안함</option>
                    <option value="SKT">SKT</option>
                    <option value="KT">KT</option>
                    <option value="LGU">LG U+</option>
                    <option value="SKT_MVNO">SKT 알뜰폰</option>
                    <option value="KT_MVNO">KT 알뜰폰</option>
                    <option value="LGU_MVNO">LG U+ 알뜰폰</option>
                  </select>
                </div>
              </div>

              {/* 안내 문구 */}
              <div className="mt-4 p-3 bg-amber-50 rounded-lg border border-amber-200">
                <p className="text-xs text-amber-800">
                  <strong>📱 인증 진행 안내</strong><br/>
                  아래 버튼을 누르면 선택한 앱으로 인증 요청이 전송됩니다.
                  스마트폰에서 인증을 완료한 후, 화면의 [인증 완료] 버튼을 눌러주세요.
                </p>
              </div>

              {/* 버튼 */}
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => setShowAuthModal(false)}
                  className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200"
                >
                  취소
                </button>
                <button
                  onClick={executeRpaSubmit}
                  disabled={!authData.name || authData.rrn1.length !== 6 || authData.rrn2.length !== 7 || !authData.phoneNumber}
                  className="flex-1 py-3 bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 text-white rounded-lg text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  🚀 인증 요청 시작
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
