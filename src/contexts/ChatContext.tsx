import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  ReactNode,
} from 'react';
import { chatService, ConversationRow, ChatMessageRow } from '../services/chatService';
import type { RealtimeChannel } from '@supabase/supabase-js';

export type { ConversationRow as Conversation, ChatMessageRow as ChatMessage };

interface ChatContextType {
  conversations: ConversationRow[];
  activeConversationId: string | null;
  messages: ChatMessageRow[];
  loadingConversations: boolean;
  loadingMessages: boolean;
  isChatOpen: boolean;
  unreadCount: number;
  currentUserId: string;
  openChat: () => void;
  closeChat: () => void;
  toggleChat: () => void;
  /**
   * Find-or-create a conversation with the given title and participant company IDs,
   * then open the chat panel to that conversation.
   * Only accessible to managers (companyId must be provided).
   */
  openConversation: (
    title: string,
    participantCompanyIds: string[]
  ) => Promise<void>;
  setActiveConversationId: (id: string | null) => void;
  sendMessage: (content: string) => Promise<void>;
  refreshConversations: () => Promise<void>;
}

const ChatContext = createContext<ChatContextType | null>(null);

interface ChatProviderProps {
  children: ReactNode;
  /** Current user's company ID and role, injected from Redux via App.tsx */
  companyId: string;
  userId: string;
  userFullName: string;
  role: 'admin' | 'manager';
}

export function ChatProvider({
  children,
  companyId,
  userId,
  userFullName,
  role,
}: ChatProviderProps) {
  const isManager = role === 'manager';

  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [activeConversationId, setActiveConversationIdState] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessageRow[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [seenMessageIds, setSeenMessageIds] = useState<Set<string>>(new Set());
  const [totalMessageCount, setTotalMessageCount] = useState(0);

  const channelRef = useRef<RealtimeChannel | null>(null);

  // Load conversations whenever the panel opens (for managers only)
  const loadConversations = useCallback(async () => {
    if (!isManager || !companyId) return;
    setLoadingConversations(true);
    const rows = await chatService.getConversationsForCompany(companyId);
    setConversations(rows);
    setLoadingConversations(false);
  }, [isManager, companyId]);

  useEffect(() => {
    if (isChatOpen) {
      loadConversations();
    }
  }, [isChatOpen, loadConversations]);

  // Load messages + subscribe when active conversation changes
  const setActiveConversationId = useCallback((id: string | null) => {
    setActiveConversationIdState(id);
    setMessages([]);

    // Unsubscribe old channel
    if (channelRef.current) {
      channelRef.current.unsubscribe();
      channelRef.current = null;
    }

    if (!id) return;

    // Load existing messages
    setLoadingMessages(true);
    chatService.getMessages(id).then((rows) => {
      setMessages(rows);
      setSeenMessageIds((prev) => {
        const updated = new Set(prev);
        rows.forEach((m) => updated.add(m.id));
        return updated;
      });
      setLoadingMessages(false);
    });

    // Subscribe to new messages via realtime
    const channel = chatService.subscribeToMessages(id, (msg) => {
      setMessages((prev) => {
        // Deduplicate: skip if already present (optimistic insert from sendMessage)
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      setTotalMessageCount((n) => n + 1);
    });
    channelRef.current = channel;
  }, []);

  // Cleanup subscription on unmount
  useEffect(() => {
    return () => {
      channelRef.current?.unsubscribe();
    };
  }, []);

  const openChat = useCallback(() => setIsChatOpen(true), []);
  const closeChat = useCallback(() => {
    setIsChatOpen(false);
    setActiveConversationIdState(null);
    setMessages([]);
    if (channelRef.current) {
      channelRef.current.unsubscribe();
      channelRef.current = null;
    }
  }, []);
  const toggleChat = useCallback(() => {
    setIsChatOpen((prev) => !prev);
    if (isChatOpen) {
      setActiveConversationIdState(null);
      setMessages([]);
      channelRef.current?.unsubscribe();
      channelRef.current = null;
    }
  }, [isChatOpen]);

  const openConversation = useCallback(
    async (title: string, participantCompanyIds: string[]) => {
      if (!isManager) return;
      const conv = await chatService.findOrCreateConversation(title, participantCompanyIds);
      if (!conv) return;
      // Refresh conversation list to include the new one
      setConversations((prev) => {
        if (prev.find((c) => c.id === conv.id)) return prev;
        return [conv, ...prev];
      });
      setIsChatOpen(true);
      setActiveConversationId(conv.id);
    },
    [isManager, setActiveConversationId]
  );

  const sendMessage = useCallback(
    async (content: string) => {
      const text = content.trim();
      if (!text || !activeConversationId || !userId) return;

      // Optimistic insert
      const tempMsg: ChatMessageRow = {
        id: `temp_${Date.now()}`,
        conversation_id: activeConversationId,
        sender_id: userId,
        sender_name: userFullName,
        content: text,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, tempMsg]);

      const saved = await chatService.sendMessage(
        activeConversationId,
        userId,
        userFullName,
        text
      );

      if (saved) {
        // Replace temp with real record (same content, real id)
        setMessages((prev) =>
          prev.map((m) => (m.id === tempMsg.id ? saved : m))
        );
        setSeenMessageIds((prev) => new Set([...prev, saved.id]));
      }
    },
    [activeConversationId, userId, userFullName]
  );

  // Unread = total messages received via realtime that we haven't "seen"
  // (tracked by the seenMessageIds set which is populated on conversation open)
  const unreadCount = Math.max(0, totalMessageCount - seenMessageIds.size);

  const value: ChatContextType = {
    conversations,
    activeConversationId,
    messages,
    loadingConversations,
    loadingMessages,
    isChatOpen,
    unreadCount,
    currentUserId: userId,
    openChat,
    closeChat,
    toggleChat,
    openConversation,
    setActiveConversationId,
    sendMessage,
    refreshConversations: loadConversations,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat must be used within ChatProvider');
  return ctx;
}
