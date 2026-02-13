import { create } from "zustand";

interface FileAttachment {
  originalName: string;
  savedPath: string;
  fileType: string;
  size: number;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: Date;
  fileAttachment?: FileAttachment;
}

/** RPA 실시간 상태 */
type RpaStatus = 'idle' | 'connecting' | 'logging_in' | 'auth_required' | 'uploading' | 'verifying' | 'submitted' | 'error';

interface RpaState {
  status: RpaStatus;
  message: string;
  submissionId: string | null;
  screenshot?: string | null;
}

/** 문서24 발송 상태 */
type Doc24Status = 'idle' | 'submitting' | 'sent' | 'error';

interface Doc24State {
  status: Doc24Status;
  message: string;
  submissionId: string | null;
  screenshot?: string | null;
  receiptNumber?: string | null;
  documentUrl?: string | null;
}

interface ChatState {
  messages: Message[];
  isLoading: boolean;
  currentChatId: string | null;
  /** 업로드된 파일의 base64 데이터 (path → base64) */
  uploadedFileData: Record<string, string>;
  /** RPA 실시간 상태 */
  rpaState: RpaState;
  /** 문서24 발송 상태 */
  doc24State: Doc24State;
  /** 후속 질문 클릭 시 전달할 입력값 */
  pendingInput: string | null;
  addMessage: (message: Omit<Message, "createdAt" | "id"> & { id?: string }) => void;
  updateMessage: (id: string, content: string) => void;
  setMessages: (messages: Message[]) => void;
  setLoading: (loading: boolean) => void;
  setCurrentChatId: (id: string | null) => void;
  clearMessages: () => void;
  setUploadedFileData: (path: string, base64: string) => void;
  setRpaState: (state: Partial<RpaState>) => void;
  resetRpaState: () => void;
  setDoc24State: (state: Partial<Doc24State>) => void;
  resetDoc24State: () => void;
  setPendingInput: (input: string | null) => void;
}

const DEFAULT_RPA_STATE: RpaState = { status: 'idle', message: '', submissionId: null };
const DEFAULT_DOC24_STATE: Doc24State = { status: 'idle', message: '', submissionId: null };

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  isLoading: false,
  currentChatId: null,
  uploadedFileData: {},
  rpaState: { ...DEFAULT_RPA_STATE },
  doc24State: { ...DEFAULT_DOC24_STATE },
  pendingInput: null,
  addMessage: (message) =>
    set((state) => ({
      messages: [
        ...state.messages,
        {
          ...message,
          id: message.id || crypto.randomUUID(),
          createdAt: new Date(),
        },
      ],
    })),
  updateMessage: (id, content) =>
    set((state) => ({
      messages: state.messages.map((msg) =>
        msg.id === id ? { ...msg, content } : msg
      ),
    })),
  setMessages: (messages) => set({ messages }),
  setLoading: (isLoading) => set({ isLoading }),
  setCurrentChatId: (currentChatId) => set({ currentChatId }),
  clearMessages: () => set({ messages: [], uploadedFileData: {}, rpaState: { ...DEFAULT_RPA_STATE }, doc24State: { ...DEFAULT_DOC24_STATE } }),
  setUploadedFileData: (path, base64) =>
    set((state) => ({
      uploadedFileData: { ...state.uploadedFileData, [path]: base64 },
    })),
  setRpaState: (partial) =>
    set((state) => ({
      rpaState: { ...state.rpaState, ...partial },
    })),
  resetRpaState: () => set({ rpaState: { ...DEFAULT_RPA_STATE } }),
  setDoc24State: (partial) =>
    set((state) => ({
      doc24State: { ...state.doc24State, ...partial },
    })),
  resetDoc24State: () => set({ doc24State: { ...DEFAULT_DOC24_STATE } }),
  setPendingInput: (pendingInput) => set({ pendingInput }),
}));

interface Document {
  id: string;
  title: string;
  type: string;
  content: string;
  status: string;
  createdAt: Date;
}

interface DocumentState {
  documents: Document[];
  currentDocument: Document | null;
  isGenerating: boolean;
  setDocuments: (documents: Document[]) => void;
  setCurrentDocument: (document: Document | null) => void;
  setGenerating: (generating: boolean) => void;
  addDocument: (document: Document) => void;
}

export const useDocumentStore = create<DocumentState>((set) => ({
  documents: [],
  currentDocument: null,
  isGenerating: false,
  setDocuments: (documents) => set({ documents }),
  setCurrentDocument: (currentDocument) => set({ currentDocument }),
  setGenerating: (isGenerating) => set({ isGenerating }),
  addDocument: (document) =>
    set((state) => ({
      documents: [document, ...state.documents],
    })),
}));

interface UIState {
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
}));
