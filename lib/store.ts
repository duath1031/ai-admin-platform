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

interface ChatState {
  messages: Message[];
  isLoading: boolean;
  currentChatId: string | null;
  /** 업로드된 파일의 base64 데이터 (path → base64) */
  uploadedFileData: Record<string, string>;
  addMessage: (message: Omit<Message, "createdAt" | "id"> & { id?: string }) => void;
  updateMessage: (id: string, content: string) => void;
  setMessages: (messages: Message[]) => void;
  setLoading: (loading: boolean) => void;
  setCurrentChatId: (id: string | null) => void;
  clearMessages: () => void;
  setUploadedFileData: (path: string, base64: string) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  isLoading: false,
  currentChatId: null,
  uploadedFileData: {},
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
  clearMessages: () => set({ messages: [], uploadedFileData: {} }),
  setUploadedFileData: (path, base64) =>
    set((state) => ({
      uploadedFileData: { ...state.uploadedFileData, [path]: base64 },
    })),
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
