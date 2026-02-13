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

  const { messages, isLoading, addMessage, setLoading, setUploadedFileData, rpaState, setRpaState, resetRpaState, doc24State, setDoc24State, resetDoc24State, pendingInput, setPendingInput } = useChatStore();
  const [showHumanModal, setShowHumanModal] = useState(false);
  const [showDelegateModal, setShowDelegateModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  // 문서24 관련 상태
  const [showDoc24Modal, setShowDoc24Modal] = useState(false);
  const [doc24Data, setDoc24Data] = useState({ recipient: '', recipientCode: '', title: '', content: '' });
  const [doc24Files, setDoc24Files] = useState<File[]>([]);
  const doc24FileRef = useRef<HTMLInputElement>(null);
  // 수신기관 선택 상태
  const [showOrgSearchModal, setShowOrgSearchModal] = useState(false);
  const [orgList, setOrgList] = useState<Array<{ name: string; code: string; category: string }>>([]);
  const [orgSearchKeyword, setOrgSearchKeyword] = useState('');
  const [orgListLoading, setOrgListLoading] = useState(false);
  const [orgListCrawling, setOrgListCrawling] = useState(false);
  const [orgSearching, setOrgSearching] = useState(false);
  const [orgSearchResults, setOrgSearchResults] = useState<Array<{ name: string; code: string; category?: string }>>([]);
  const orgSearchTimer = useRef<NodeJS.Timeout | null>(null);
  const [doc24AccountLinked, setDoc24AccountLinked] = useState<boolean | null>(null);
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
  const [serviceSearch, setServiceSearch] = useState('');
  const [serviceResults, setServiceResults] = useState<Array<{code: string; name: string; category: string; gov24Url: string | null; hasTemplate: boolean; fee: string}>>([]);
  const [showServiceDropdown, setShowServiceDropdown] = useState(false);
  const [serviceInputMode, setServiceInputMode] = useState<'list' | 'url'>('list');
  const [directUrl, setDirectUrl] = useState('');

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (initialQuestion && messages.length === 0) {
      handleSubmit(new Event("submit") as unknown as React.FormEvent);
    }
  }, [initialQuestion]);

  // 후속 질문 클릭 처리
  useEffect(() => {
    if (pendingInput && !isLoading) {
      setInput(pendingInput);
      setPendingInput(null);
      // 다음 틱에서 자동 제출
      setTimeout(() => {
        const form = document.querySelector('form[data-chat-form]') as HTMLFormElement;
        if (form) form.requestSubmit();
      }, 50);
    }
  }, [pendingInput]);

  // 수신기관 목록 로드 (캐시)
  const loadOrgList = async () => {
    setOrgListLoading(true);
    try {
      const res = await fetch('/api/doc24/org-list');
      const data = await res.json();
      if (data.success && data.orgList) {
        setOrgList(data.orgList);
      }
    } catch {}
    setOrgListLoading(false);
  };

  // 수신기관 실시간 검색 (debounce)
  const searchOrgs = async (keyword: string) => {
    if (keyword.length < 2) {
      setOrgSearchResults([]);
      return;
    }
    setOrgSearching(true);
    try {
      const res = await fetch('/api/doc24/org-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword }),
      });
      const data = await res.json();
      if (data.success && data.results) {
        setOrgSearchResults(data.results);
      } else if (data.error) {
        console.error('기관 검색 오류:', data.error);
        setOrgSearchResults([]);
      }
    } catch (e) {
      console.error('기관 검색 오류:', e);
    }
    setOrgSearching(false);
  };

  // 검색어 입력 핸들러 (debounce 적용)
  const handleOrgSearchChange = (value: string) => {
    setOrgSearchKeyword(value);
    // 캐시에서 먼저 필터링
    if (orgSearchTimer.current) {
      clearTimeout(orgSearchTimer.current);
    }
    // 500ms debounce 후 실시간 검색
    if (value.length >= 2) {
      orgSearchTimer.current = setTimeout(() => {
        searchOrgs(value);
      }, 500);
    } else {
      setOrgSearchResults([]);
    }
  };

  // 기관 검색 모달 열 때 목록 로드
  const openOrgSearchModal = () => {
    setShowOrgSearchModal(true);
    setOrgSearchKeyword('');
    setOrgSearchResults([]);
    if (orgList.length === 0) {
      loadOrgList();
    }
  };

  // 기관 선택
  const selectOrg = (org: { name: string; code: string }) => {
    setDoc24Data(prev => ({ ...prev, recipient: org.name, recipientCode: org.code }));
    setShowOrgSearchModal(false);
  };

  // 기관 목록 필터링
  const filteredOrgList = orgSearchKeyword
    ? orgList.filter(org =>
        org.name.includes(orgSearchKeyword) ||
        (org.category && org.category.includes(orgSearchKeyword))
      )
    : orgList;

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

  // 문서24 발송 핸들러
  const handleDoc24Submit = async () => {
    // 문서24 계정 연동 여부 확인
    if (doc24AccountLinked === null) {
      try {
        const res = await fetch('/api/user/doc24-account');
        const data = await res.json();
        setDoc24AccountLinked(data.isLinked);
        if (!data.isLinked) {
          alert('문서24 계정을 먼저 연동해주세요.\n마이페이지 > 문서24 계정에서 연동할 수 있습니다.');
          return;
        }
      } catch {
        alert('계정 정보를 확인할 수 없습니다.');
        return;
      }
    } else if (!doc24AccountLinked) {
      alert('문서24 계정을 먼저 연동해주세요.\n마이페이지 > 문서24 계정에서 연동할 수 있습니다.');
      return;
    }

    // 첨부파일명으로 제목 프리필
    const defaultTitle = uploadedFile
      ? `[민원신청] ${uploadedFile.originalName.replace(/\.(pdf|hwpx|jpg|png)$/i, '')}`
      : '';
    setDoc24Data(prev => ({ ...prev, title: prev.title || defaultTitle }));
    setShowDoc24Modal(true);
  };

  // 문서24 실제 발송 실행 (비동기 폴링)
  const executeDoc24Submit = async () => {
    setShowDoc24Modal(false);
    setDoc24State({ status: 'submitting', message: '문서접수봇 작업을 등록 중...' });

    try {
      // 첨부파일 준비
      const files: { fileName: string; fileBase64: string; mimeType: string }[] = [];
      // 채팅에서 업로드한 파일
      if (uploadedFile) {
        const { uploadedFileData: fileDataStore } = useChatStore.getState();
        const base64 = fileDataStore[uploadedFile.savedPath];
        if (base64) {
          files.push({
            fileName: uploadedFile.originalName,
            fileBase64: base64,
            mimeType: uploadedFile.fileType === 'pdf' ? 'application/pdf' : 'application/octet-stream',
          });
        }
      }
      // 모달에서 직접 업로드한 파일
      for (const file of doc24Files) {
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
          reader.readAsDataURL(file);
        });
        files.push({
          fileName: file.name,
          fileBase64: base64,
          mimeType: file.type || 'application/octet-stream',
        });
      }
      setDoc24Files([]);

      // 1단계: 작업 등록
      const res = await fetch('/api/rpa/doc24-submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient: doc24Data.recipient,
          recipientCode: doc24Data.recipientCode || '',
          title: doc24Data.title,
          content: doc24Data.content,
          files,
        }),
      });

      const result = await res.json();

      if (result.requiresAccountLink) {
        setDoc24State({ status: 'error', message: '문서24 계정을 먼저 연동해주세요.' });
        setDoc24AccountLinked(false);
        return;
      }

      if (!result.success || !result.jobId) {
        setDoc24State({ status: 'error', message: result.error || '작업 등록 실패' });
        return;
      }

      // 2단계: 폴링으로 진행상황 확인
      setDoc24State({ status: 'submitting', message: '🤖 문서접수봇이 문서24에 접속 중... (1~2분 소요)' });
      const { jobId, submissionId } = result;
      const progressMessages: Record<string, string> = {
        '10': '🔐 문서24 로그인 중...',
        '30': '📝 문서 작성 페이지 이동 중...',
        '40': '🏢 수신기관 검색 중...',
        '50': '✍️ 제목/내용 입력 중...',
        '60': '📎 첨부파일 업로드 중...',
        '70': '📤 발송 처리 중...',
        '80': '✅ 발송 확인 중...',
        '90': '📋 보낸문서함 확인 중...',
      };

      let pollCount = 0;
      let unknownCount = 0;
      const maxPolls = 200; // 최대 10분 (3초 간격)
      const pollInterval = setInterval(async () => {
        pollCount++;
        if (pollCount > maxPolls) {
          clearInterval(pollInterval);
          setDoc24State({ status: 'error', message: '작업 시간이 초과되었습니다. 문서24에서 직접 확인해주세요.' });
          return;
        }

        try {
          const pollRes = await fetch(`/api/rpa/doc24-submit?jobId=${jobId}&submissionId=${submissionId}`);
          const poll = await pollRes.json();

          if (poll.state === 'completed') {
            clearInterval(pollInterval);
            if (poll.success) {
              setDoc24State({
                status: 'sent',
                message: poll.message || '문서24를 통해 공문이 발송되었습니다.',
                submissionId,
                screenshot: poll.screenshot,
                receiptNumber: poll.receiptNumber,
                documentUrl: poll.documentUrl,
              });
              setTimeout(() => resetDoc24State(), 15000);
            } else {
              setDoc24State({
                status: 'error',
                message: poll.error || '발송에 실패했습니다.',
                screenshot: poll.screenshot,
              });
            }
          } else if (poll.state === 'failed') {
            clearInterval(pollInterval);
            setDoc24State({ status: 'error', message: poll.error || '작업이 실패했습니다.' });
          } else if (poll.state === 'unknown') {
            unknownCount++;
            if (unknownCount >= 3) {
              clearInterval(pollInterval);
              setDoc24State({ status: 'error', message: '작업이 유실되었습니다. Worker가 재시작되었을 수 있습니다. 다시 시도해주세요.' });
            }
          } else {
            unknownCount = 0;
            // 진행 중 - 프로그레스 메시지 업데이트
            const progress = poll.progress || 0;
            const closest = Object.keys(progressMessages)
              .map(Number).filter(p => p <= progress).sort((a, b) => b - a)[0];
            const msg = closest ? progressMessages[String(closest)] : '🤖 문서접수봇 작업 진행 중...';
            setDoc24State({ status: 'submitting', message: `${msg} (${progress}%)` });
          }
        } catch {
          // 폴링 실패는 무시하고 계속 시도
        }
      }, 3000);

    } catch (err: any) {
      setDoc24State({
        status: 'error',
        message: `오류: ${err.message || '알 수 없는 오류'}`,
      });
    }
  };

  // 실제 RPA 접수 실행 (인증 정보 포함)
  const executeRpaSubmit = async () => {
    if (!uploadedFile) return;

    // 필수 입력 검증
    if (!authData.serviceUrl) {
      alert("신청할 민원 서비스를 선택해주세요. 상단 검색란에서 민원을 검색하여 선택하세요.");
      return;
    }
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

    console.log('[RPA v3] 인증 요청 시작:', {
      serviceUrl: authData.serviceUrl,
      serviceName: authData.serviceName,
      fileName: uploadedFile.originalName,
      hasFileBase64: !!fileBase64,
      fileBase64Length: fileBase64?.length || 0,
      authMethod: authData.authMethod,
    });

    setShowAuthModal(false);
    setRpaState({ status: 'connecting', message: '🤖 로봇이 정부24에 접속 중입니다...\n약 30~40초 소요됩니다.' });

    try {
      // 10초 후 안내 메시지 업데이트
      const progressTimer = setTimeout(() => {
        const s = useChatStore.getState().rpaState.status;
        if (s === 'connecting' || s === 'logging_in') {
          setRpaState({ status: 'logging_in', message: '🔐 정부24 간편인증 폼 작성 중...\n거의 완료됩니다.' });
        }
      }, 10000);

      const bodyObj = {
        mode: 'upload',
        fileBase64: fileBase64 || undefined,
        fileName: uploadedFile.originalName,
        serviceUrl: authData.serviceUrl,
        serviceName: authData.serviceName || undefined,
        authData: {
          name: authData.name,
          rrn1: authData.rrn1,
          rrn2: authData.rrn2,
          phoneNumber: authData.phoneNumber,
          carrier: authData.carrier || undefined,
          authMethod: authData.authMethod,
        },
      };

      console.log('[RPA v3] fetch 시작, body size:', JSON.stringify(bodyObj).length);

      const res = await fetch('/api/rpa/submit-v2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyObj),
      });

      clearTimeout(progressTimer);
      console.log('[RPA v3] fetch 완료, status:', res.status);

      // 응답 파싱 (clone으로 안전하게)
      const resClone = res.clone();
      let data;
      try {
        data = await res.json();
      } catch (jsonErr) {
        const text = await resClone.text().catch(() => '');
        console.error('[RPA v3] JSON 파싱 실패:', res.status, jsonErr, text.slice(0, 200));
        setRpaState({ status: 'error', message: `서버 응답 오류 (HTTP ${res.status}): ${text.slice(0, 80) || '응답을 파싱할 수 없습니다'}` });
        setTimeout(() => resetRpaState(), 10000);
        return;
      }

      console.log('[RPA v3] 서버 응답:', JSON.stringify(data).slice(0, 300));

      if (data.success) {
        if (data.action === 'AUTHENTICATE') {
          setRpaState({
            status: 'auth_required',
            message: '✅ 휴대폰으로 인증 요청이 전송되었습니다!\n앱에서 인증을 완료한 후 아래 버튼을 눌러주세요.',
            submissionId: data.submissionId,
          });
        } else if (data.step === 'submitted') {
          setRpaState({ status: 'submitted', message: '접수 완료!', submissionId: data.submissionId });
          setTimeout(() => resetRpaState(), 5000);
        } else {
          setRpaState({ status: 'auth_required', message: data.message || '처리 중...', submissionId: data.submissionId });
        }
      } else {
        console.error('[RPA v3] API 에러:', data.error, data.details);
        setRpaState({ status: 'error', message: data.error || '접수 실패' });
        setTimeout(() => resetRpaState(), 10000);
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
      console.error('[RPA v3] fetch 예외:', err);
      setRpaState({ status: 'error', message: `서버 연결 오류 - ${errMsg}` });
      setTimeout(() => resetRpaState(), 10000);
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
      <form data-chat-form onSubmit={handleSubmit} className="flex gap-2 md:gap-3">
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
          {/* 스크린샷 표시 (성공/실패 시) - 클릭으로 확대 */}
          {rpaState.screenshot && (rpaState.status === 'submitted' || rpaState.status === 'error') && (
            <div className="mt-2">
              <p className="text-xs mb-1 opacity-70">{rpaState.status === 'submitted' ? '접수 완료 화면:' : '실패 시점 화면 (클릭하여 확대):'}</p>
              <img
                src={rpaState.screenshot}
                alt="정부24 결과 화면"
                className="w-full rounded border max-h-64 object-contain cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => {
                  if (rpaState.screenshot) {
                    window.open(rpaState.screenshot, '_blank', 'width=1200,height=800');
                  }
                }}
              />
            </div>
          )}
          {/* auth_required 상태: 인증 완료 버튼 표시 */}
          {rpaState.status === 'auth_required' && rpaState.submissionId && (
            <button
              onClick={async () => {
                const sid = rpaState.submissionId;
                try {
                  // Step 1: 인증 확인 (쿠키 획득)
                  setRpaState({ status: 'verifying', message: '🔐 인증 확인 중... 잠시 기다려주세요.', submissionId: sid });
                  console.log('[RPA v3] Step 1: 인증 확인 시작');
                  const confirmRes = await fetch('/api/rpa/submit-v2?action=confirm', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ submissionId: sid }),
                  });
                  const confirmClone = confirmRes.clone();
                  let confirmData;
                  try { confirmData = await confirmRes.json(); } catch {
                    const t = await confirmClone.text().catch(() => '');
                    setRpaState({ status: 'error', message: `인증 확인 응답 오류 (${confirmRes.status}): ${t.slice(0, 80)}` });
                    return;
                  }
                  console.log('[RPA v3] Step 1 응답:', confirmData);

                  if (!confirmData.success) {
                    setRpaState({ status: 'error', message: confirmData.error || '인증 확인 실패' });
                    return;
                  }

                  // Step 2: 민원 제출 (비동기 큐 등록)
                  setRpaState({ status: 'uploading', message: '📄 정부24에 서류 제출 요청 중...', submissionId: sid });
                  console.log('[RPA v3] Step 2: 민원 제출 큐 등록 시작');
                  const submitRes = await fetch('/api/rpa/submit-v2?action=submit', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ submissionId: sid }),
                  });
                  const submitClone = submitRes.clone();
                  let submitData;
                  try { submitData = await submitRes.json(); } catch {
                    const t = await submitClone.text().catch(() => '');
                    setRpaState({ status: 'error', message: `제출 응답 오류 (${submitRes.status}): ${t.slice(0, 80)}` });
                    return;
                  }
                  console.log('[RPA v3] Step 2 응답:', submitData);

                  if (!submitData.success) {
                    setRpaState({ status: 'error', message: submitData.error || '민원 제출 실패' });
                    return;
                  }

                  // Step 3: 폴링으로 제출 상태 확인 (5초 간격, 최대 5분)
                  console.log('[RPA v3] Step 3: 제출 상태 폴링 시작');
                  setRpaState({ status: 'uploading', message: '📄 정부24에 서류 제출 중...\n약 2~4분 소요됩니다.', submissionId: sid });

                  const progressMessages: Record<string, string> = {
                    '10': '📁 파일 준비 중...',
                    '20': '📁 파일 저장 완료',
                    '30': '🌐 브라우저 시작...',
                    '40': '🔗 정부24 페이지 이동 중...',
                    '50': '📋 신청 페이지 진입...',
                    '60': '📝 신청 폼 작성 중...',
                    '70': '📎 파일 업로드 중...',
                    '80': '📤 제출 버튼 클릭...',
                    '90': '🔍 접수번호 확인 중...',
                  };

                  const maxPolls = 60; // 5초 x 60 = 5분
                  for (let poll = 0; poll < maxPolls; poll++) {
                    await new Promise(r => setTimeout(r, 5000)); // 5초 대기

                    try {
                      const statusRes = await fetch('/api/rpa/submit-v2?action=submit-status', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ submissionId: sid }),
                      });
                      const statusData = await statusRes.json();
                      console.log(`[RPA v3] 폴링 #${poll + 1}:`, statusData);

                      if (statusData.status === 'submitted') {
                        setRpaState({ status: 'submitted', message: statusData.message || '접수 완료!', screenshot: statusData.screenshot || null });
                        return;
                      }
                      if (statusData.status === 'failed') {
                        // 에러코드별 안내 메시지 매핑
                        const errorGuidance: Record<string, string> = {
                          'PAGE_NOT_FOUND': '\n\n💡 해결 방법: 정부24에서 해당 서비스 페이지의 URL을 직접 확인하여 "URL 직접 입력" 모드로 다시 시도해주세요.',
                          'SEARCH_PAGE': '\n\n💡 해결 방법: 정부24(gov.kr)에서 원하는 민원을 검색한 후, 해당 페이지 URL을 복사하여 "URL 직접 입력"으로 접수해주세요.',
                          'INVALID_PAGE': '\n\n💡 해결 방법: 정부24에서 해당 민원의 정확한 신청 페이지를 찾아 URL을 직접 입력해주세요.',
                          'INVALID_URL': '\n\n💡 해결 방법: 유효한 정부24 URL이 필요합니다. 정부24에서 민원 페이지를 열고 URL을 복사하여 "URL 직접 입력"으로 재시도해주세요.',
                          'SERVICE_NOT_FOUND': '\n\n💡 해결 방법: 정부24에서 해당 민원을 자동으로 검색했으나 찾지 못했습니다. 정확한 민원명을 입력하거나 정부24에서 직접 URL을 복사해주세요.',
                          'SESSION_EXPIRED': '\n\n💡 해결 방법: 인증이 만료되었습니다. 다시 인증을 진행해주세요.',
                          'FORM_VALIDATION_FAILED': '\n\n💡 해결 방법: 민원 신청 폼에 필수 입력 항목이 있습니다. 스크린샷을 확인하고 필요한 정보를 준비한 후 다시 시도해주세요.',
                        };
                        const code = statusData.errorCode || '';
                        const guidance = errorGuidance[code] || '';
                        const errorMsg = (statusData.error || '민원 제출 실패') + guidance;
                        setRpaState({ status: 'error', message: errorMsg, screenshot: statusData.screenshot || null });
                        return;
                      }

                      // 진행 중 - 진행률 기반 메시지
                      const elapsed = (poll + 1) * 5;
                      const progress = statusData.progress || 0;
                      const progMsg = progressMessages[String(progress)] || '처리 중...';
                      setRpaState({ status: 'uploading', message: `📄 정부24 서류 제출 중 (${elapsed}초)\n${progMsg}`, submissionId: sid });
                    } catch (pollErr) {
                      console.warn('[RPA v3] 폴링 오류:', pollErr);
                    }
                  }

                  // 5분 초과 - 아직 진행 중일 수 있음
                  setRpaState({ status: 'error', message: '제출 처리가 아직 진행 중입니다.\n잠시 후 새로고침하여 결과를 확인하거나,\n정부24(gov.kr)에서 나의 신청내역을 확인해주세요.' });
                } catch (err: unknown) {
                  const msg = err instanceof Error ? err.message : String(err);
                  console.error('[RPA v3] 확인/제출 예외:', err);
                  setRpaState({ status: 'error', message: `연결 오류: ${msg}` });
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

      {/* 접수 방식 선택 (4-Way 하이브리드) + 보조 버튼 */}
      <div className="mt-1.5 sm:mt-2 md:mt-3 space-y-1.5 sm:space-y-2">
        {/* 메인 4분할 버튼 */}
        <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
          {/* 📝 정부24 */}
          <button
            onClick={() => {
              window.open('https://www.gov.kr/portal/main', '_blank', 'noopener,noreferrer');
            }}
            className="flex flex-col items-center justify-center gap-0.5 sm:gap-1 px-1.5 sm:px-2 py-2 sm:py-3 bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700 text-white text-[10px] sm:text-xs font-bold rounded-lg sm:rounded-xl transition-all shadow-sm sm:shadow-md"
          >
            <span className="text-base sm:text-xl">📝</span>
            <span>정부24</span>
          </button>
          {/* 📄 공문접수 */}
          <button
            onClick={handleDoc24Submit}
            disabled={doc24State.status === 'submitting'}
            className="flex flex-col items-center justify-center gap-0.5 sm:gap-1 px-1.5 sm:px-2 py-2 sm:py-3 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white text-[10px] sm:text-xs font-bold rounded-lg sm:rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm sm:shadow-md"
          >
            <span className="text-base sm:text-xl">📄</span>
            <span>공문접수</span>
          </button>
          {/* 👨‍💼 접수대행 → 민원접수 페이지 proxy 탭 */}
          <button
            onClick={() => router.push("/submission?tab=proxy")}
            className="flex flex-col items-center justify-center gap-0.5 sm:gap-1 px-1.5 sm:px-2 py-2 sm:py-3 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white text-[10px] sm:text-xs font-bold rounded-lg sm:rounded-xl transition-all shadow-sm sm:shadow-md"
          >
            <span className="text-base sm:text-xl">👨‍💼</span>
            <span>접수대행</span>
          </button>
          {/* 📋 대리인선임 → 민원접수 페이지 delegate 탭 */}
          <button
            onClick={() => router.push("/submission?tab=delegate")}
            className="flex flex-col items-center justify-center gap-0.5 sm:gap-1 px-1.5 sm:px-2 py-2 sm:py-3 bg-gradient-to-r from-purple-500 to-violet-600 hover:from-purple-600 hover:to-violet-700 text-white text-[10px] sm:text-xs font-bold rounded-lg sm:rounded-xl transition-all shadow-sm sm:shadow-md"
          >
            <span className="text-base sm:text-xl">📋</span>
            <span>대리인선임</span>
          </button>
        </div>
        {/* 보조 버튼 */}
        <div className="flex justify-center gap-1.5 sm:gap-2">
          <a
            href="tel:070-8657-1888"
            className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-[10px] sm:text-xs font-medium rounded-lg transition-colors"
          >
            <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
            상담전화
          </a>
          <a
            href="https://www.jungeui.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-[10px] sm:text-xs font-medium rounded-lg transition-colors"
          >
            <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
            </svg>
            공식홈페이지
          </a>
        </div>
      </div>

      {/* 문서24 상태 토스트 */}
      {doc24State.status !== 'idle' && (
        <div className={`mt-3 p-4 rounded-xl border shadow-sm ${
          doc24State.status === 'submitting' ? 'bg-blue-50 border-blue-200' :
          doc24State.status === 'sent' ? 'bg-green-50 border-green-200' :
          'bg-red-50 border-red-200'
        }`}>
          <div className="flex items-start gap-3">
            {doc24State.status === 'submitting' && (
              <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mt-0.5" />
            )}
            {doc24State.status === 'sent' && <span className="text-xl">✅</span>}
            {doc24State.status === 'error' && <span className="text-xl">❌</span>}
            <div className="flex-1">
              <p className={`text-sm font-medium ${
                doc24State.status === 'submitting' ? 'text-blue-800' :
                doc24State.status === 'sent' ? 'text-green-800' :
                'text-red-800'
              }`}>
                {doc24State.message}
              </p>
              {doc24State.receiptNumber && (
                <p className="text-sm text-green-700 mt-1 font-medium">
                  접수번호: {doc24State.receiptNumber}
                </p>
              )}
              {doc24State.documentUrl && (
                <a
                  href={doc24State.documentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline mt-1 inline-block"
                >
                  문서24에서 확인
                </a>
              )}
              {doc24State.screenshot && (
                <img
                  src={doc24State.screenshot}
                  alt="발송 결과"
                  className="mt-2 rounded-lg border max-h-48 cursor-pointer hover:opacity-90"
                  onClick={() => {
                    const w = window.open('', '_blank', 'width=1200,height=800');
                    if (w) {
                      w.document.write(`<img src="${doc24State.screenshot}" style="max-width:100%"/>`);
                    }
                  }}
                />
              )}
            </div>
            {(doc24State.status === 'sent' || doc24State.status === 'error') && (
              <button onClick={resetDoc24State} className="text-gray-400 hover:text-gray-600">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
      )}

      {/* 문서접수봇 모달 */}
      {showDoc24Modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowDoc24Modal(false)} />
          <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-gray-900 mb-1">🤖 문서접수봇</h3>
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg mb-4">
              <p className="text-xs text-blue-700">문서24(docu.gdoc.go.kr)를 통한 공문 자동접수 시스템입니다. 수신기관과 제목을 입력하고 첨부파일을 업로드하면 자동으로 발송됩니다.</p>
            </div>

            <div className="space-y-3">
              {/* 수신기관 선택 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">수신기관 *</label>
                {doc24Data.recipient ? (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800 font-medium">
                      {doc24Data.recipient}
                    </div>
                    <button
                      type="button"
                      onClick={() => setDoc24Data(prev => ({ ...prev, recipient: '', recipientCode: '' }))}
                      className="px-2 py-2 text-gray-400 hover:text-red-500"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={openOrgSearchModal}
                    className="w-full px-3 py-2.5 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-colors flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    수신기관 검색/선택
                  </button>
                )}
              </div>

              {/* 제목 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">문서 제목 *</label>
                <input
                  type="text"
                  placeholder="예: [민원신청] 통신판매업 신고"
                  value={doc24Data.title}
                  onChange={(e) => setDoc24Data(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* 내용 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">본문 (선택)</label>
                <textarea
                  placeholder="공문 내용을 입력하세요"
                  value={doc24Data.content}
                  onChange={(e) => setDoc24Data(prev => ({ ...prev, content: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              {/* 첨부파일 업로드 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">첨부파일</label>
                <input
                  ref={doc24FileRef}
                  type="file"
                  multiple
                  accept=".pdf,.hwp,.hwpx,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.zip"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files) {
                      setDoc24Files(prev => [...prev, ...Array.from(e.target.files!)]);
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => doc24FileRef.current?.click()}
                  className="w-full px-3 py-2.5 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  파일 선택 (PDF, HWP, 이미지 등)
                </button>

                {/* 채팅에서 업로드한 파일 */}
                {uploadedFile && (
                  <div className="mt-2 flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                    <svg className="w-4 h-4 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                    <span className="text-sm text-gray-700 truncate flex-1">{uploadedFile.originalName}</span>
                    <span className="text-xs text-gray-400 flex-shrink-0">({Math.round(uploadedFile.size / 1024)}KB)</span>
                    <span className="text-xs text-green-600 flex-shrink-0">채팅 첨부</span>
                  </div>
                )}

                {/* 모달에서 추가한 파일 목록 */}
                {doc24Files.map((file, idx) => (
                  <div key={idx} className="mt-2 flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                    <svg className="w-4 h-4 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                    <span className="text-sm text-gray-700 truncate flex-1">{file.name}</span>
                    <span className="text-xs text-gray-400 flex-shrink-0">({Math.round(file.size / 1024)}KB)</span>
                    <button
                      onClick={() => setDoc24Files(prev => prev.filter((_, i) => i !== idx))}
                      className="text-red-400 hover:text-red-600 flex-shrink-0"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* 버튼 */}
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => { setShowDoc24Modal(false); setDoc24Files([]); }}
                className="flex-1 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={executeDoc24Submit}
                disabled={!doc24Data.recipient || !doc24Data.title}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                발송하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 수신기관 검색/선택 모달 */}
      {showOrgSearchModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowOrgSearchModal(false)} />
          <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full mx-4 max-h-[80vh] flex flex-col">
            {/* 헤더 */}
            <div className="p-4 border-b flex-shrink-0">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-bold text-gray-900">🔍 수신기관 검색</h3>
                <button onClick={() => setShowOrgSearchModal(false)} className="text-gray-400 hover:text-gray-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <p className="text-sm text-gray-500">
                2자 이상 입력하면 문서24에서 실시간 검색합니다.
              </p>
            </div>

            {/* 검색 입력 영역 */}
            <div className="p-4 flex-shrink-0">
              <div className="relative">
                <input
                  type="text"
                  placeholder="예: 강남구청, 서초세무서, 경기도청"
                  value={orgSearchKeyword}
                  onChange={(e) => handleOrgSearchChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && orgSearchResults.length > 0) {
                      selectOrg(orgSearchResults[0]);
                    }
                  }}
                  autoFocus
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 pr-10"
                />
                {orgSearching && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </div>
            </div>

            {/* 검색 결과 목록 */}
            <div className="flex-1 overflow-y-auto border-t">
              {orgSearchResults.length > 0 ? (
                <div className="divide-y">
                  <div className="px-4 py-2 bg-amber-50 border-b border-amber-100">
                    <p className="text-xs text-amber-700 font-medium">아래 목록에서 정확한 기관을 선택하세요</p>
                  </div>
                  {orgSearchResults.map((org, idx) => (
                    <button
                      key={idx}
                      onClick={() => selectOrg(org)}
                      className="w-full px-4 py-3 text-left hover:bg-blue-50 transition-colors flex items-center justify-between"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900">{org.name}</p>
                        {org.category && (
                          <p className="text-xs text-gray-500">{org.category}</p>
                        )}
                        {org.code && (
                          <p className="text-xs text-gray-400">코드: {org.code}</p>
                        )}
                      </div>
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  ))}
                </div>
              ) : orgSearchKeyword.length >= 2 && !orgSearching ? (
                <div className="p-4 text-center text-gray-500">
                  <p className="text-sm">검색 결과가 없습니다.</p>
                  <p className="text-xs mt-1">다른 검색어를 시도해보세요. (예: 강남구청, 서초세무서)</p>
                </div>
              ) : (
                <div className="p-4 text-center text-gray-400">
                  <p className="text-sm">2자 이상 입력하면 기관을 검색합니다.</p>
                  <div className="mt-3 text-xs text-gray-400 space-y-1">
                    <p>• 예시: &quot;강남구&quot;, &quot;서초세무서&quot;, &quot;경기도청&quot;</p>
                    <p>• 정확한 기관명을 입력하세요</p>
                  </div>
                </div>
              )}
            </div>

            {/* 하단 버튼 */}
            <div className="p-4 border-t bg-gray-50 rounded-b-xl flex-shrink-0">
              <p className="text-xs text-gray-500 mb-3 text-center">
                정확한 수신을 위해 반드시 검색 결과에서 기관을 선택하세요.
              </p>
              <button
                onClick={() => setShowOrgSearchModal(false)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 접수대행 모달 */}
      {showHumanModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full max-h-[85vh] overflow-y-auto">
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900">👨‍💼 접수대행</h3>
                <button onClick={() => setShowHumanModal(false)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* 가격 안내 배너 */}
              <div className="mb-4 p-4 bg-gradient-to-r from-amber-500 to-orange-600 rounded-xl text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs opacity-80">대행 수수료</p>
                    <p className="text-2xl font-bold">50,000원</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs opacity-80">처리 시간</p>
                    <p className="text-sm font-medium">영업일 1~2일</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                {/* 서비스 설명 */}
                <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                  <p className="text-sm text-amber-800 font-medium mb-2">✅ 포함 서비스</p>
                  <ul className="text-xs text-amber-700 space-y-1">
                    <li>• 행정사가 접수를 대행합니다</li>
                    <li>• 관할 기관 제출 및 접수 확인</li>
                    <li>• 접수 완료 시 결과 안내</li>
                  </ul>
                  <p className="text-xs text-amber-600 mt-2 italic">※ 대리 서비스가 필요하시면 옆의 &quot;대리인선임&quot;으로 진행해주세요.</p>
                </div>

                {/* 필요 서류 안내 */}
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-sm text-blue-800 font-medium mb-2">📋 필요 서류</p>
                  <ul className="text-xs text-blue-700 space-y-1">
                    <li>• 위임장 (양식 제공)</li>
                    <li>• 신분증 사본</li>
                    <li>• 민원 관련 첨부서류</li>
                  </ul>
                </div>

                {/* 결제 안내 */}
                <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                  <p className="text-sm text-green-800 font-medium mb-2">💳 결제 방법</p>
                  <p className="text-xs text-green-700">
                    카카오톡 상담 후 계좌이체 또는 카드결제 가능합니다.
                    결제 확인 후 즉시 업무를 진행합니다.
                  </p>
                </div>

                {/* 행정사 정보 */}
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

      {/* 대리인선임 안내 모달 */}
      {showDelegateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full max-h-[85vh] overflow-y-auto">
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900">📋 대리인선임 안내</h3>
                <button onClick={() => setShowDelegateModal(false)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="mb-4 p-4 bg-gradient-to-r from-purple-500 to-violet-600 rounded-xl text-white">
                <p className="text-sm font-medium">행정사가 대리인으로 선임되어 민원을 처리합니다</p>
                <p className="text-xs opacity-80 mt-1">위임장 기반 대리인 선임 → 서류 검토/보완 → 관할 기관 제출 → 결과 안내</p>
              </div>

              <div className="space-y-3">
                <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                  <p className="text-sm text-purple-800 font-medium mb-2">📌 대리인선임 절차</p>
                  <ol className="text-xs text-purple-700 space-y-1 list-decimal list-inside">
                    <li>카카오톡/전화로 민원 내용 상담</li>
                    <li>위임장 작성 및 서명 (전자서명 가능)</li>
                    <li>필요 서류 전달 (카톡/이메일)</li>
                    <li>행정사가 대리인으로 민원 접수</li>
                    <li>서류 검토 및 보완 대응</li>
                    <li>처리 결과 안내 및 서류 전달</li>
                  </ol>
                </div>

                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-sm text-blue-800 font-medium mb-2">💡 이런 경우 이용하세요</p>
                  <ul className="text-xs text-blue-700 space-y-1">
                    <li>• 직접 방문이 어려운 경우</li>
                    <li>• 온라인 접수가 불가능한 민원</li>
                    <li>• 복잡한 서류 준비가 필요한 경우</li>
                    <li>• 보정/보완 요구에 대응이 필요한 경우</li>
                  </ul>
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
                      🌐 온라인 문의하기
                    </a>
                  </div>
                </div>
              </div>
              <button onClick={() => setShowDelegateModal(false)} className="mt-3 w-full py-2.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200">
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

              {/* 정부24 민원 서비스 선택 */}
              <div className="mb-4 relative">
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700">신청할 민원 서비스 *</label>
                  {!authData.serviceName && (
                    <div className="flex bg-gray-100 rounded-md p-0.5 text-xs">
                      <button
                        type="button"
                        onClick={() => setServiceInputMode('list')}
                        className={`px-2 py-1 rounded transition-colors ${serviceInputMode === 'list' ? 'bg-white shadow text-teal-700 font-medium' : 'text-gray-500'}`}
                      >목록 검색</button>
                      <button
                        type="button"
                        onClick={() => setServiceInputMode('url')}
                        className={`px-2 py-1 rounded transition-colors ${serviceInputMode === 'url' ? 'bg-white shadow text-teal-700 font-medium' : 'text-gray-500'}`}
                      >URL 직접 입력</button>
                    </div>
                  )}
                </div>
                {authData.serviceName ? (
                  <div className="flex items-center gap-2 px-3 py-2 bg-teal-50 border border-teal-300 rounded-lg">
                    <span className="text-sm font-medium text-teal-800 flex-1">
                      {authData.serviceName}
                      {authData.serviceUrl && !authData.serviceUrl.includes('/search?') && (
                        <span className="text-xs text-teal-600 ml-1">(직접 URL)</span>
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => { setAuthData({ ...authData, serviceUrl: '', serviceName: '' }); setServiceSearch(''); setDirectUrl(''); }}
                      className="text-teal-600 hover:text-teal-800 text-xs"
                    >변경</button>
                  </div>
                ) : serviceInputMode === 'url' ? (
                  /* URL 직접 입력 모드 */
                  <>
                    <input
                      type="url"
                      value={directUrl}
                      onChange={(e) => setDirectUrl(e.target.value)}
                      placeholder="https://www.gov.kr/mw/AA020InfoCappView.do?CappBizCD=..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent font-mono"
                    />
                    <input
                      type="text"
                      value={serviceSearch}
                      onChange={(e) => setServiceSearch(e.target.value)}
                      placeholder="민원 서비스명 (예: 통신판매업 신고)"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mt-2 focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    />
                    <button
                      type="button"
                      disabled={!directUrl.includes('gov.kr') || !serviceSearch.trim()}
                      onClick={() => {
                        const url = directUrl.trim();
                        if (!url.includes('gov.kr')) {
                          alert('정부24 URL (gov.kr)만 입력 가능합니다.');
                          return;
                        }
                        setAuthData({
                          ...authData,
                          serviceUrl: url,
                          serviceName: serviceSearch.trim(),
                        });
                      }}
                      className="mt-2 w-full py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      URL 확인 및 적용
                    </button>
                    <p className="mt-1 text-xs text-gray-500">
                      정부24에서 원하는 민원 서비스 페이지를 열고, 주소창의 URL을 복사하여 붙여넣으세요.
                    </p>
                  </>
                ) : (
                  /* 목록 검색 모드 */
                  <>
                    <input
                      type="text"
                      value={serviceSearch}
                      onChange={async (e) => {
                        const val = e.target.value;
                        setServiceSearch(val);
                        if (val.length >= 1) {
                          try {
                            const res = await fetch(`/api/services?keyword=${encodeURIComponent(val)}`);
                            const data = await res.json();
                            if (data.success) {
                              setServiceResults(data.services);
                              setShowServiceDropdown(true);
                            }
                          } catch {}
                        } else {
                          setShowServiceDropdown(false);
                        }
                      }}
                      onFocus={async () => {
                        if (!serviceSearch) {
                          try {
                            const res = await fetch('/api/services');
                            const data = await res.json();
                            if (data.success) { setServiceResults(data.services); setShowServiceDropdown(true); }
                          } catch {}
                        }
                      }}
                      placeholder="민원명 검색 (예: 통신판매업, 음식점, 사업자등록)"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    />
                    {showServiceDropdown && (serviceResults.length > 0 || serviceSearch.length >= 1) && (
                      <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
                        {serviceResults.map((svc) => (
                          <button
                            key={svc.code}
                            type="button"
                            onClick={() => {
                              setAuthData({
                                ...authData,
                                serviceUrl: svc.gov24Url || `https://www.gov.kr/search?svcType=&srhWrd=${encodeURIComponent(svc.name)}`,
                                serviceName: svc.name,
                              });
                              setShowServiceDropdown(false);
                              setServiceSearch('');
                            }}
                            className="w-full text-left px-3 py-2 border-b border-gray-100 hover:bg-teal-50"
                          >
                            <div className="text-sm font-medium text-gray-900">{svc.name}</div>
                            <div className="text-xs text-gray-500">{svc.category} | {svc.fee}</div>
                          </button>
                        ))}
                        {/* 항상 맨 아래에 정부24 검색 링크 */}
                        {serviceSearch && serviceSearch.length >= 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              const keyword = serviceSearch.trim();
                              setAuthData({
                                ...authData,
                                serviceUrl: `https://www.gov.kr/search?svcType=&srhWrd=${encodeURIComponent(keyword)}`,
                                serviceName: keyword,
                              });
                              setShowServiceDropdown(false);
                              setServiceSearch('');
                            }}
                            className="w-full text-left px-3 py-2 bg-blue-50 hover:bg-blue-100 border-t border-blue-200"
                          >
                            <div className="text-sm font-medium text-blue-700">
                              &quot;{serviceSearch}&quot; 정부24에서 검색하여 접수
                            </div>
                            <div className="text-xs text-blue-500">목록에 없는 민원도 정부24 검색으로 접수 가능</div>
                          </button>
                        )}
                      </div>
                    )}
                    {/* 드롭다운이 안 보일 때: 검색어가 있으면 URL 직접 입력 안내 */}
                    {serviceSearch && serviceSearch.length >= 2 && !showServiceDropdown && (
                      <button
                        type="button"
                        onClick={() => setServiceInputMode('url')}
                        className="mt-1 w-full text-left px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 text-sm"
                      >
                        <span className="text-amber-700">정부24 URL을 알고 있다면 직접 입력 &rarr;</span>
                      </button>
                    )}
                  </>
                )}
                <p className={`mt-1 text-xs ${authData.serviceUrl ? 'text-gray-500' : 'text-red-500 font-medium'}`}>
                  {authData.serviceUrl
                    ? authData.serviceUrl.includes('/search?')
                      ? '정부24에서 검색하여 해당 민원을 접수합니다.'
                      : '정부24에서 신청할 민원이 선택되었습니다.'
                    : '민원 서비스를 반드시 선택해야 자동접수가 가능합니다.'}
                </p>
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
                  disabled={!authData.serviceUrl || !authData.name || authData.rrn1.length !== 6 || authData.rrn2.length !== 7 || !authData.phoneNumber}
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
