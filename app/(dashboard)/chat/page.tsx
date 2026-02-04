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

  const { messages, isLoading, addMessage, setLoading, setUploadedFileData } = useChatStore();

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

      {/* 고정 바로가기 버튼 */}
      <div className="mt-2 md:mt-3 flex flex-wrap justify-center gap-2">
        <button
          onClick={() => router.push("/submission?type=proxy")}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-medium rounded-lg transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          접수대행
        </button>
        <button
          onClick={() => router.push("/submission?type=delegate")}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-lg transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          대리의뢰
        </button>
        <a
          href="tel:070-8657-1888"
          className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-600 hover:bg-gray-700 text-white text-xs font-medium rounded-lg transition-colors"
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
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
          </svg>
          공식홈페이지
        </a>
      </div>
    </div>
  );
}
