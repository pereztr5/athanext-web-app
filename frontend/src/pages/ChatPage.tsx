import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type WheelEvent as ReactWheelEvent,
} from "react";
import { Home, MessageCircle, Search, Send, Menu, ArrowLeft } from "lucide-react";
import MessageBubble from "@/components/chat/MessageBubble";
import { cn } from "@/lib/utils";
import {
  chatAPI,
  type ConversationWithParticipants,
  type MessageWithSender,
} from "@/api";
import { useAuth } from "@/contexts/AuthContext";
import { useRole } from "@/hooks/useRole";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ROUTES } from "@/routes";
import { formatDisplayName, sendConversationNotificationEmail } from "@/utils/chatHelpers";
import { formatDate } from "@/utils/dateHelpers";
import { useIsMobile } from "@/hooks/use-mobile";

type ChatConversation = ConversationWithParticipants & {
  otherUserId?: string | null;
  otherUserName?: string | null;
};

type ChatMessage = MessageWithSender;

const MESSAGE_PAGE_SIZE = 7;
const CONVERSATION_PAGE_SIZE = 6;

const ChatPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading, setHasNewMessage } = useAuth();
  const isMobile = useIsMobile();

  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [isConversationsLoading, setIsConversationsLoading] = useState(true);
  const [isLoadingMoreConversations, setIsLoadingMoreConversations] = useState(false);
  const [hasMoreConversations, setHasMoreConversations] = useState(false);
  const [conversationLimit, setConversationLimit] = useState(CONVERSATION_PAGE_SIZE);
  const [searchConversations, setSearchConversations] = useState<ChatConversation[] | null>(null);
  const [isSearchingConversations, setIsSearchingConversations] = useState(false);
  const [isMessagesLoading, setIsMessagesLoading] = useState(false);
  const [isLoadingMoreMessages, setIsLoadingMoreMessages] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [oldestMessageCursor, setOldestMessageCursor] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const lastConversationMarkerRef = useRef<string | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const firstMessageNotifiedRef = useRef<Set<string>>(new Set());
  const firstReplyNotifiedRef = useRef<Set<string>>(new Set());
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { role: personaType } = useRole();

  // Redirect unauthenticated users after auth state is known
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/auth?mode=signin");
    }
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (isMobile) {
      setIsSidebarOpen(false);
    } else {
      setIsSidebarOpen(true);
    }
  }, [isMobile]);

  const mapConversationRows = useCallback(
    (rows: ConversationWithParticipants[]): ChatConversation[] =>
      rows.map((conv) => {
        const participants = Array.isArray(conv.conversation_participants)
          ? conv.conversation_participants
          : [];
        const member = participants.find(
          (p) => p.role === "member" && p.user_id !== user?.id
        );
        const nonCurrent = participants.find((p) => p.user_id !== user?.id);
        const other = member || nonCurrent || null;

        return {
          ...conv,
          otherUserId: other?.user_id || null,
          otherUserName: other?.user_profiles?.name || other?.user_id || null,
        };
      }),
    [user?.id]
  );

  const fetchConversations = useCallback(async (options?: { silent?: boolean; limitOverride?: number }) => {
    if (!user) return;
    const silent = options?.silent ?? false;
    const requestedLimit = Math.max(
      options?.limitOverride ?? conversationLimit,
      CONVERSATION_PAGE_SIZE
    );
    // Fetch one extra row so we can infer whether more conversations remain.
    const fetchLimit = requestedLimit + 1;
    if (!silent) {
      setIsConversationsLoading(true);
    }
    const requestedConversationId = searchParams.get("conversationId");

    const { data, error } = await chatAPI.getUserConversations(user.id, {
      limit: fetchLimit,
      offset: 0,
    });

    if (error) {
      console.error("Failed to load conversations", error);
      setConversations([]);
      setHasMoreConversations(false);
      if (!silent) {
        setIsConversationsLoading(false);
      }
      return;
    }

    const mappedAll = mapConversationRows(Array.isArray(data) ? data : []);

    const hasMore = mappedAll.length > requestedLimit;
    const mapped = hasMore ? mappedAll.slice(0, requestedLimit) : mappedAll;

    setConversationLimit(requestedLimit);
    setHasMoreConversations(hasMore);
    setConversations(mapped);
    const hasSelectedConversation = Boolean(
      selectedConversationId && mapped.some((c) => c.id === selectedConversationId)
    );
    if (!hasSelectedConversation) {
      if (requestedConversationId && mapped?.some((c) => c.id === requestedConversationId)) {
        setSelectedConversationId(requestedConversationId);
      } else if (mapped && mapped.length > 0) {
        setSelectedConversationId(mapped[0].id);
      } else {
        setSelectedConversationId(null);
      }
    }
    if (!silent) {
      setIsConversationsLoading(false);
    }
  }, [user, conversationLimit, searchParams, selectedConversationId, mapConversationRows]);

  useEffect(() => {
    if (!user?.id) return;

    const query = searchTerm.trim();
    if (!query) {
      setSearchConversations(null);
      setIsSearchingConversations(false);
      return;
    }

    if (searchConversations) return;

    let canceled = false;
    const loadAllForSearch = async () => {
      setIsSearchingConversations(true);
      const { data, error } = await chatAPI.getAllUserConversations(user.id);
      if (canceled) return;

      if (error) {
        console.error("Failed to load all conversations for search", error);
        setSearchConversations([]);
        setIsSearchingConversations(false);
        return;
      }

      setSearchConversations(mapConversationRows(Array.isArray(data) ? data : []));
      setIsSearchingConversations(false);
    };

    void loadAllForSearch();
    return () => {
      canceled = true;
    };
  }, [user?.id, searchTerm, searchConversations, mapConversationRows]);

  const loadMoreConversations = useCallback(async () => {
    if (isConversationsLoading || isLoadingMoreConversations || !hasMoreConversations) return;
    setIsLoadingMoreConversations(true);
    try {
      await fetchConversations({
        silent: true,
        limitOverride: conversationLimit + CONVERSATION_PAGE_SIZE,
      });
    } finally {
      setIsLoadingMoreConversations(false);
    }
  }, [
    isConversationsLoading,
    isLoadingMoreConversations,
    hasMoreConversations,
    fetchConversations,
    conversationLimit,
  ]);

  const fetchMessages = useCallback(
    async (conversationId: string, options?: { background?: boolean }) => {
      const background = options?.background ?? false;
      if (!background) {
        setIsMessagesLoading(true);
      }

      const { data, error } = await chatAPI.getMessages(conversationId, {
        limit: MESSAGE_PAGE_SIZE,
      });

      if (error) {
        console.error("Failed to load messages", error);
        setMessages([]);
        if (!background) {
          setIsMessagesLoading(false);
        }
        return;
      }

      const latestChunk = Array.isArray(data) ? data : [];

      if (background) {
        setMessages((prev) => {
          const map = new Map<string, ChatMessage>();
          prev.forEach((m) => map.set(m.id, m));
          latestChunk.forEach((m) => map.set(m.id, m));
          return Array.from(map.values()).sort(
            (a, b) => Date.parse(a.created_at) - Date.parse(b.created_at)
          );
        });
      } else {
        setMessages(latestChunk);
        setHasMoreMessages((latestChunk?.length ?? 0) >= MESSAGE_PAGE_SIZE);
        setOldestMessageCursor(latestChunk[0]?.created_at ?? null);
      }

      if (!background) {
        setIsMessagesLoading(false);
      }
    },
    []
  );

  const loadOlderMessages = useCallback(async () => {
    if (!selectedConversationId || !oldestMessageCursor || isLoadingMoreMessages) return;
    const container = messagesContainerRef.current;
    const prevHeight = container?.scrollHeight ?? 0;

    setIsLoadingMoreMessages(true);
    const { data, error } = await chatAPI.getMessages(selectedConversationId, {
      limit: MESSAGE_PAGE_SIZE,
      before: oldestMessageCursor,
    });

    if (error) {
      console.error("Failed to load older messages", error);
      setIsLoadingMoreMessages(false);
      return;
    }

    const olderChunk = Array.isArray(data) ? data : [];
    setMessages((prev) => [...olderChunk, ...prev]);
    if (olderChunk.length > 0) {
      setOldestMessageCursor(olderChunk[0].created_at);
    }
    setHasMoreMessages((olderChunk?.length ?? 0) >= MESSAGE_PAGE_SIZE);
    setIsLoadingMoreMessages(false);

    // Preserve scroll position after prepending
    if (container) {
      const newHeight = container.scrollHeight;
      container.scrollTop = newHeight - prevHeight;
    }
  }, [selectedConversationId, oldestMessageCursor, isLoadingMoreMessages]);

  const scrollMessagesToBottom = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
    setIsAtBottom(true);
  }, []);

  // Initial conversation load
  useEffect(() => {
    void fetchConversations();
  }, [fetchConversations]);

  useEffect(() => {
    if (!user) return;
    const channel = chatAPI.subscribeToConversationParticipants(user.id, () => {
      void fetchConversations({ silent: true });
    });

    return () => {
      chatAPI.unsubscribe(channel);
    };
  }, [user, fetchConversations]);

  // Load messages for current conversation
  useEffect(() => {
    if (selectedConversationId) {
      setMessages([]);
      setOldestMessageCursor(null);
      setHasMoreMessages(false);
      setIsMessagesLoading(true);
      setIsAtBottom(true);
      void fetchMessages(selectedConversationId, { background: false });
    } else {
      setMessages([]);
      setOldestMessageCursor(null);
      setHasMoreMessages(false);
    }
  }, [selectedConversationId, fetchMessages]);

  useEffect(() => {
    if (!selectedConversationId || !messages.length) return;
    
    const selectedConv = conversations.find(c => c.id === selectedConversationId);
    if (!selectedConv) return;

    // If conversation has last_message_at, it means first message was already sent
    if (selectedConv.last_message_at) {
      firstMessageNotifiedRef.current.add(selectedConversationId);
    }

    // If there are messages and at least one reply pattern exists, mark first reply as sent
    // A reply pattern means: message 1 from user A, message 2 from user B
    if (messages.length >= 2) {
      const hasReplyPattern = messages[0].sender_id !== messages[1].sender_id;
      if (hasReplyPattern) {
        firstReplyNotifiedRef.current.add(selectedConversationId);
      }
    }
  }, [selectedConversationId, messages, conversations]);

  // Mark messages as read when viewing a conversation
  useEffect(() => {
    if (!selectedConversationId) return;
    if (isMessagesLoading) return;
    if (!user?.id) return;
    
    // Mark conversation as read in database and check if any unread remain
    const markAsReadAndCheck = async () => {
      const nowIso = new Date().toISOString();
      await chatAPI.markConversationAsRead(selectedConversationId, user.id);
      setConversations((prev) =>
        prev.map((conv) => {
          if (conv.id !== selectedConversationId) return conv;
          const participants = Array.isArray(conv.conversation_participants)
            ? conv.conversation_participants
            : [];
          const updatedParticipants = participants.map((participant) =>
            participant.user_id === user.id
              ? { ...participant, last_read_at: nowIso }
              : participant
          );
          return { ...conv, conversation_participants: updatedParticipants };
        })
      );

      // Check if there are still any unread messages in other conversations
      const { data: hasUnread } = await chatAPI.hasUnreadMessages(user.id);
      setHasNewMessage(hasUnread || false);
    };
    
    void markAsReadAndCheck();
  }, [selectedConversationId, isMessagesLoading, setHasNewMessage, user?.id]);

  // Keep viewport pinned to latest messages on initial load / new messages
  useEffect(() => {
    if (isLoadingMoreMessages) return; // don't auto-jump when prepending older
    if (isMessagesLoading) return;
    if (!isAtBottom) return;
    scrollMessagesToBottom();
  }, [messages, isMessagesLoading, isLoadingMoreMessages, isAtBottom, scrollMessagesToBottom]);

  // Realtime subscription for new messages
  useEffect(() => {
    if (!selectedConversationId) return;
    const channel = chatAPI.subscribeToConversationMessages(
      selectedConversationId,
      async (newMessage) => {
        setMessages((prev) => {
          if (prev.some((m) => m.id === newMessage.id)) {
            return prev;
          }
          return [...prev, newMessage];
        });
        
        const nowIso = new Date().toISOString();
        setConversations((prev) =>
          prev.map((c) =>
            c.id === selectedConversationId
              ? {
                  ...c,
                  last_message_text: newMessage.body,
                  last_message_at: newMessage.created_at,
                  conversation_participants: Array.isArray(c.conversation_participants)
                    ? c.conversation_participants.map((participant) =>
                        participant.user_id === user?.id
                          ? { ...participant, last_read_at: nowIso }
                          : participant
                      )
                    : c.conversation_participants,
                }
              : c
          )
        );
        // Mark as read in database since user is actively viewing this conversation
        if (user?.id) {
          await chatAPI.markConversationAsRead(selectedConversationId, user.id);
          
          // Check if there are still any unread messages in other conversations
          const { data: hasUnread } = await chatAPI.hasUnreadMessages(user.id);
          setHasNewMessage(hasUnread || false);
        }
      }
    );

    return () => {
      chatAPI.unsubscribe(channel);
    };
  }, [selectedConversationId, user?.id, setHasNewMessage]);

  const conversationIds = useMemo(
    () =>
      Array.isArray(conversations)
        ? conversations.map((c) => c?.id).filter(Boolean) as string[]
        : [],
    [conversations]
  );

  // Fallback: refresh messages when conversation metadata changes
  useEffect(() => {
    if (!user || !conversationIds.length) return;
    const channel = chatAPI.subscribeToConversationUpdates(
      conversationIds,
      (updated) => {
        if (!updated?.id) return;
        setConversations((prev) =>
          prev.map((c) =>
            c.id === updated.id
              ? {
                  ...c,
                  last_message_text: updated.last_message_text,
                  last_message_at: updated.last_message_at,
                }
              : c
          )
        );
      }
    );

    return () => {
      chatAPI.unsubscribe(channel);
    };
  }, [user, conversationIds]);

  const selectedConversation = useMemo(() => {
    if (!Array.isArray(conversations)) return null;
    return conversations.find((chat) => chat.id === selectedConversationId) || null;
  }, [conversations, selectedConversationId]);

  // Keep open conversation in sync when its sidebar preview changes
  useEffect(() => {
    if (!selectedConversationId) {
      lastConversationMarkerRef.current = null;
      return;
    }

    const lastMessageAt = messages[messages.length - 1]?.created_at;
    const conversationLastAt = selectedConversation?.last_message_at || null;
    const conversationLastText = selectedConversation?.last_message_text || "";
    const marker = `${conversationLastAt ?? ""}|${conversationLastText}`;

    if (!conversationLastAt) {
      lastConversationMarkerRef.current = marker;
      return;
    }

    const isBehind =
      !lastMessageAt || Date.parse(conversationLastAt) > Date.parse(lastMessageAt);

    if (!isBehind || lastConversationMarkerRef.current === marker) {
      lastConversationMarkerRef.current = marker;
      return;
    }

    lastConversationMarkerRef.current = marker;
    void fetchMessages(selectedConversationId, { background: true });
  }, [
    selectedConversationId,
    selectedConversation?.last_message_at,
    selectedConversation?.last_message_text,
    messages,
    fetchMessages,
  ]);

  const getOtherParticipant = useCallback(
    (conv?: ChatConversation | null) => {
      if (conv?.is_group) return null;
      if (!conv) return null;
      const participants = Array.isArray(conv.conversation_participants)
        ? conv.conversation_participants
        : [];
      // Prefer participant with role 'member' that is NOT the current user; otherwise non-current user
      const member = participants.find(
        (p) => p.role === "member" && p.user_id !== user?.id
      );
      const nonCurrent = user
        ? participants.find((p) => p.user_id !== user.id)
        : null;
      return member || nonCurrent || null;
    },
    [user]
  );

  // Resolve missing recipient names by fetching user_profiles
  useEffect(() => {
    const resolveMissingName = async () => {
      if (!selectedConversation) return;
      if (selectedConversation.is_group) return;
      if (selectedConversation.otherUserName) return;
      if (!selectedConversation.otherUserId) return;

      const { data: name, error } = await chatAPI.getUserName(
        selectedConversation.otherUserId
      );

      if (!error && name) {
        setConversations((prev) =>
          prev.map((c) =>
            c.id === selectedConversation.id ? { ...c, otherUserName: name } : c
          )
        );
      } else {
        // Even if no name, ensure we at least have the user id as label
        setConversations((prev) =>
          prev.map((c) =>
            c.id === selectedConversation.id && selectedConversation.otherUserId
              ? { ...c, otherUserName: selectedConversation.otherUserId }
              : c
          )
        );
      }
    };
    void resolveMissingName();
  }, [selectedConversation]);

  const filteredConversations = useMemo(() => {
    const source = searchTerm.trim()
      ? (searchConversations ?? conversations)
      : conversations;
    const base = Array.isArray(source) ? source : [];
    if (!searchTerm.trim()) return base;
    const query = searchTerm.toLowerCase();
    return base.filter((chat) => {
      const participants = Array.isArray(chat.conversation_participants)
        ? chat.conversation_participants
        : [];
      const participantNames = participants
        .map((p) => (typeof p?.user_profiles?.name === "string" ? p.user_profiles.name : ""))
        .join(" ")
        .toLowerCase();
      const otherId = chat.otherUserId?.toLowerCase() || "";
      return (
        (chat.title || "").toLowerCase().includes(query) ||
        (chat.last_message_text || "").toLowerCase().includes(query) ||
        participantNames.includes(query) ||
        otherId.includes(query)
      );
    });
  }, [conversations, searchConversations, searchTerm]);

  const hasConversations = Array.isArray(conversations) && conversations.length > 0;
  const isFilteredEmpty = filteredConversations.length === 0;
  const showSidebarLoader = isConversationsLoading && !hasConversations;

  const getConversationName = useCallback(
    (conversation: ChatConversation | null) => {
      if (!conversation) return "Conversation";
      if (conversation.is_group) return conversation.title || "Group Chat";
      const other = getOtherParticipant(conversation);
      const rawNameOrId =
        other?.user_profiles?.name ??
        other?.user_id ??
        conversation.otherUserName ??
        conversation.otherUserId ??
        "Unknown User";
      const nameOrId =
        typeof rawNameOrId === "string" ? rawNameOrId : String(rawNameOrId ?? "Unknown User");
      return formatDisplayName(nameOrId);
    },
    [getOtherParticipant]
  );

  const isConversationUnread = useCallback(
    (conversation: ChatConversation) => {
      if (!user?.id) return false;
      if (!conversation?.last_message_at) return false;
      const participants = Array.isArray(conversation.conversation_participants)
        ? conversation.conversation_participants
        : [];
      const currentUserParticipant = participants.find((p) => p.user_id === user.id);
      if (!currentUserParticipant?.last_read_at) return true;
      return (
        Date.parse(conversation.last_message_at) >
        Date.parse(currentUserParticipant.last_read_at)
      );
    },
    [user?.id]
  );

  const handleChatSelect = (chatId: string) => {
    if (!conversations.some((chat) => chat.id === chatId)) {
      const fromSearch = searchConversations?.find((chat) => chat.id === chatId);
      if (fromSearch) {
        setConversations((prev) => [fromSearch, ...prev]);
      }
    }
    setSelectedConversationId(chatId);
    setMessageInput("");
    setIsAtBottom(true);
    if (isMobile) {
      setIsSidebarOpen(false);
    }
  };

  const formatTime = (iso: string) => {
    const date = new Date(iso);
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  };

  const handleBack = () => {
    if (window.history.length > 2) {
      navigate(-1);
    } else {
      navigate(ROUTES.HOME);
    }
  };

  const handleMessageScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const nearBottom =
      Math.ceil(container.scrollTop + container.clientHeight) >= container.scrollHeight - 8;
    setIsAtBottom(nearBottom);
    if (container.scrollTop < 60 && hasMoreMessages && !isLoadingMoreMessages && !isMessagesLoading) {
      void loadOlderMessages();
    }
  }, [hasMoreMessages, isLoadingMoreMessages, isMessagesLoading, loadOlderMessages]);

  const handleMessageWheel = useCallback(
    (event: ReactWheelEvent<HTMLDivElement>) => {
      const container = messagesContainerRef.current;
      if (!container) return;

      const delta = event.deltaY;
      const atTop = container.scrollTop <= 0;
      const atBottom =
        Math.ceil(container.scrollTop + container.clientHeight) >= container.scrollHeight;

      // Prevent body scroll when inside the chat pane
      if ((delta < 0 && atTop) || (delta > 0 && atBottom)) {
        event.preventDefault();
        if (delta < 0 && atTop && hasMoreMessages && !isLoadingMoreMessages && !isMessagesLoading) {
          void loadOlderMessages();
        }
        return;
      }

      event.preventDefault();
      container.scrollTop += delta;
      const nearBottom =
        Math.ceil(container.scrollTop + container.clientHeight) >= container.scrollHeight - 8;
      setIsAtBottom(nearBottom);
    },
    [hasMoreMessages, isLoadingMoreMessages, isMessagesLoading, loadOlderMessages]
  );

  const handleSend = async () => {
    const trimmed = messageInput.trim();
    if (!trimmed || !selectedConversation || !user) return;

    const messagesBeforeSend = [...messages];
    const lastMessageBeforeSend = messagesBeforeSend[messagesBeforeSend.length - 1];
    const isFirstMessageInConversation =
      messagesBeforeSend.length === 0 && !selectedConversation?.last_message_at;
    const isReplyToCoach =
      Boolean(lastMessageBeforeSend) && lastMessageBeforeSend.sender_id !== user.id;

    setIsSending(true);
    const nowIso = new Date().toISOString();

    const { data: inserted, error } = await chatAPI.sendMessage(
      selectedConversation.id,
      user.id,
      trimmed
    );

    if (error) {
      console.error("Failed to send message", error);
    } else {
      setMessageInput("");
      // Optimistically update preview
      setConversations((prev) =>
        prev.map((c) =>
          c.id === selectedConversation.id
            ? { ...c, last_message_text: trimmed, last_message_at: nowIso }
            : c
        )
      );
      // Optimistically append to message list
      if (inserted) {
        setMessages((prev) => [...prev, inserted as ChatMessage]);
      }
      const { error: updateError } = await chatAPI.updateConversationMetadata(
        selectedConversation.id,
        { last_message_text: trimmed, last_message_at: nowIso }
      );

      if (updateError) {
        console.error("Failed to update conversation metadata", updateError);
      }

      await chatAPI.markConversationAsRead(selectedConversation.id, user.id);
      setConversations((prev) =>
        prev.map((conv) => {
          if (conv.id !== selectedConversation.id) return conv;
          const participants = Array.isArray(conv.conversation_participants)
            ? conv.conversation_participants
            : [];
          const updatedParticipants = participants.map((participant) =>
            participant.user_id === user.id
              ? { ...participant, last_read_at: nowIso }
              : participant
          );
          return { ...conv, conversation_participants: updatedParticipants };
        })
      );

      if (
        isFirstMessageInConversation &&
        !firstMessageNotifiedRef.current.has(selectedConversation.id)
      ) {
        firstMessageNotifiedRef.current.add(selectedConversation.id);
        void sendConversationNotificationEmail({
          conversationId: selectedConversation.id,
          actorId: user.id,
          messageBody: trimmed,
          messageTimestamp: nowIso,
          firstMessage: true,
        });
      } else if (
        isReplyToCoach &&
        !firstReplyNotifiedRef.current.has(selectedConversation.id)
      ) {
        firstReplyNotifiedRef.current.add(selectedConversation.id);
        void sendConversationNotificationEmail({
          conversationId: selectedConversation.id,
          actorId: user.id,
          messageBody: trimmed,
          messageTimestamp: nowIso,
          firstReply: true,
        });
      }
    }

    setIsSending(false);
  };

  return (
    <div className="min-h-screen bg-[#f4f7fb] pt-16">
      <div className="mx-auto max-w-[1400px] h-[calc(100vh-6rem)] bg-white border border-slate-200 rounded-2xl shadow-soft overflow-hidden flex relative">
        {/* Sidebar */}
        <aside
          className={cn(
            "border-r border-slate-200 bg-white flex flex-col transition-transform duration-200",
            isMobile
              ? "absolute inset-y-0 left-0 z-20 w-[88vw] max-w-xs shadow-xl"
              : "relative w-full max-w-[320px]"
          )}
          style={{ transform: isMobile && !isSidebarOpen ? "translateX(-100%)" : "translateX(0)" }}
        >
          <div className="px-6 pt-6 pb-4">
            <h2 className="text-lg font-semibold text-slate-800">Messages</h2>
            <div className="mt-3 relative">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search conversations..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-full border border-slate-200 bg-slate-50 px-10 py-2 text-sm text-slate-600 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {showSidebarLoader ? (
              <div className="px-6 py-4 space-y-3">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div
                    key={index}
                    className="flex gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 animate-pulse"
                  >
                    <div className="h-10 w-10 rounded-full bg-slate-200" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 w-2/3 rounded-full bg-slate-200" />
                      <div className="h-3 w-1/2 rounded-full bg-slate-100" />
                    </div>
                  </div>
                ))}
              </div>
            ) : isFilteredEmpty ? (
              <div className="px-6 py-10">
                <div className="rounded-2xl border border-dashed border-slate-200 bg-gradient-to-br from-slate-50 via-white to-slate-100 p-6 text-center shadow-sm">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white border border-slate-200 shadow-soft">
                    <MessageCircle className="h-5 w-5 text-[#1a73e8]" />
                  </div>
                  <p className="mt-4 text-sm font-semibold text-slate-800">
                    {hasConversations ? "No matching conversations" : "No conversations yet"}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {hasConversations
                      ? "Try a different search or clear filters."
                      : "Start a chat from any coach profile and your messages will appear here."}
                  </p>
                  {hasConversations && hasMoreConversations && !searchTerm.trim() && (
                    <button
                      type="button"
                      onClick={() => void loadMoreConversations()}
                      disabled={isLoadingMoreConversations}
                      className="mt-4 inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-soft transition-colors hover:bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {isLoadingMoreConversations ? "Loading..." : "Load more conversations"}
                    </button>
                  )}
                  {!hasConversations && (
                    <button
                      type="button"
                      onClick={() => navigate(ROUTES.COACHES)}
                      className="mt-4 inline-flex items-center justify-center rounded-full bg-[#1a73e8] px-4 py-2 text-xs font-semibold text-white shadow-soft transition-colors hover:bg-[#155ecc]"
                    >
                      Browse coaches
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <>
                {filteredConversations.map((chat) => {
                  const hasUnread = isConversationUnread(chat);
                  return (
                    <div
                      key={chat.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => handleChatSelect(chat.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") handleChatSelect(chat.id);
                      }}
                      className={cn(
                        "relative flex gap-3 px-6 py-4 border-t border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer focus:outline-none focus:bg-slate-50",
                        selectedConversationId === chat.id && "bg-slate-50"
                      )}
                    >
                      {selectedConversationId === chat.id && (
                        <div className="absolute left-0 top-3 bottom-3 w-1 rounded-full bg-[#1a73e8]" />
                      )}
                      <div className="h-10 w-10 rounded-full bg-[#1c77ff] text-white font-semibold flex items-center justify-center">
                        {getConversationName(chat).charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-slate-800 truncate flex items-center gap-2">
                            <span className="truncate">{getConversationName(chat)}</span>
                            {hasUnread && (
                              <span
                                className="h-2 w-2 rounded-full bg-red-500"
                                aria-label="Unread messages"
                              />
                            )}
                          </p>
                          <div className="flex flex-col items-end leading-tight whitespace-nowrap">
                            <span className="text-[11px] text-slate-400">
                              {chat.last_message_at ? formatTime(chat.last_message_at) : ""}
                            </span>
                            <span className="text-[10px] text-slate-300">
                              {chat.last_message_at ? formatDate(chat.last_message_at) : ""}
                            </span>
                          </div>
                        </div>
                        <p className="text-sm text-slate-500 truncate">
                          {chat.last_message_text || "Start the conversation"}
                        </p>
                      </div>
                    </div>
                  );
                })}
                {hasMoreConversations && !searchTerm.trim() && (
                  <div className="px-6 py-4">
                    <button
                      type="button"
                      onClick={() => void loadMoreConversations()}
                      disabled={isLoadingMoreConversations}
                      className="w-full inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-soft transition-colors hover:bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {isLoadingMoreConversations ? "Loading..." : "Load more conversations"}
                    </button>
                  </div>
                )}
                {isSearchingConversations && (
                  <div className="px-6 pb-4 text-center text-xs text-slate-500">
                    Searching all conversations...
                  </div>
                )}
              </>
            )}
          </div>
        </aside>

        {isMobile && isSidebarOpen && (
          <div
            className="absolute inset-0 bg-black/20 z-10 sm:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* Conversation */}
        <section className={cn("relative flex-1", isMobile && isSidebarOpen && "hidden")}>
          <div className="absolute inset-0 bg-blue-50" />
          <div className="relative flex h-full flex-col">
            {isConversationsLoading && !hasConversations ? (
              <div className="flex-1 flex items-center justify-center px-10 py-12">
                <div className="flex flex-col items-center gap-3 text-center">
                  <div className="h-12 w-12 rounded-full border-2 border-slate-200 border-t-[#1a73e8] animate-spin" />
                  <p className="text-sm font-semibold text-slate-800">Loading your chat</p>
                  <p className="text-xs text-slate-500">Hold on while we pull your conversations.</p>
                </div>
              </div>
            ) : !hasConversations ? (
              <div className="flex-1 flex items-center justify-center px-10 py-12">
                <div className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white/80 p-10 shadow-soft backdrop-blur text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#1a73e8]/10 text-[#1a73e8]">
                    <MessageCircle className="h-6 w-6" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-slate-800">No conversations yet</h3>
                  <p className="mt-2 text-sm text-slate-500">
                    Open a coach profile and send a message to kick off a private 1:1 chat.
                  </p>
                  <div className="mt-6 flex items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => navigate(ROUTES.COACHES)}
                      className="rounded-full bg-[#1a73e8] px-5 py-2.5 text-xs font-semibold text-white shadow-soft transition-colors hover:bg-[#155ecc]"
                    >
                      Browse coaches
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate(ROUTES.HOME)}
                      className="rounded-full border border-slate-200 bg-white px-5 py-2.5 text-xs font-semibold text-slate-700 shadow-soft transition-colors hover:bg-slate-50"
                    >
                      Go home
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 px-4 sm:px-10 py-5 border-b border-slate-200 bg-white/80 backdrop-blur justify-between">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <button
                      type="button"
                      onClick={handleBack}
                      className="hidden sm:inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 sm:px-4 py-2 text-xs font-semibold text-slate-700 shadow-soft transition-colors hover:bg-slate-50"
                      aria-label="Go back"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      <span>Back</span>
                    </button>
                    {isMobile && (
                      <>
                        <button
                          type="button"
                          onClick={() => setIsSidebarOpen(true)}
                          className="h-8 w-8 rounded-full border border-slate-200 flex items-center justify-center text-slate-500 bg-white shadow-sm"
                          aria-label="Open conversations"
                        >
                          <Menu className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={handleBack}
                          className="h-8 w-8 rounded-full border border-slate-200 flex items-center justify-center text-slate-600 bg-white shadow-sm"
                          aria-label="Go back"
                        >
                          <ArrowLeft className="h-4 w-4" />
                        </button>
                      </>
                    )}
                    {!isMobile && (
                      <button
                        type="button"
                        onClick={() => navigate(ROUTES.HOME)}
                        className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 sm:px-4 py-2 text-xs font-semibold text-slate-700 shadow-soft transition-colors hover:bg-slate-50"
                        aria-label="Back to home"
                      >
                        <Home className="h-4 w-4" />
                        <span className="hidden sm:inline">Home</span>
                        <span className="sm:hidden"></span>
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-9 w-9 rounded-full bg-[#1c77ff] text-white font-semibold flex items-center justify-center shadow-soft">
                      {selectedConversation ? getConversationName(selectedConversation).charAt(0).toUpperCase() : "?"}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">
                        {getConversationName(selectedConversation)}
                      </p>
                      <p className="text-xs text-slate-500">
                        {selectedConversation?.last_message_at
                          ? `Last active ${formatTime(selectedConversation.last_message_at)}`
                          : "Active now"}
                      </p>
                    </div>
                  </div>
                </div>

                <div
                  className="flex-1 overflow-y-auto px-10 py-8 space-y-8"
                  ref={messagesContainerRef}
                  onWheel={handleMessageWheel}
                  onScroll={handleMessageScroll}
                >
                  {(isMessagesLoading || isLoadingMoreMessages) && (
                    <div className="space-y-4 animate-pulse">
                      {Array.from({ length: 4 }).map((_, idx) => (
                        <div
                          key={idx}
                          className="flex items-start gap-3"
                        >
                          <div className="h-9 w-9 rounded-full bg-slate-200" />
                          <div className="flex-1 space-y-2">
                            <div className="h-3 w-24 rounded-full bg-slate-200" />
                            <div className="h-3 w-4/5 rounded-full bg-slate-100" />
                            <div className="h-3 w-2/3 rounded-full bg-slate-100" />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {!isMessagesLoading &&
                    messages.map((message) => {
                      const isUser = message.sender_id === user?.id;
                      const senderName =
                        typeof message.sender?.name === "string" ? message.sender.name : "";
                      const initials =
                        senderName
                          ? senderName
                              .split(" ")
                              .map((n) => n[0])
                              .join("")
                              .slice(0, 2)
                              .toUpperCase()
                          : isUser
                            ? "You"
                            : "U";
                      return (
                        <MessageBubble
                          key={message.id}
                          text={message.body}
                          time={formatTime(message.created_at)}
                          isUser={isUser}
                          initials={initials}
                          status={isUser ? "Sent" : undefined}
                        />
                      );
                    })}
                  {!isMessagesLoading && messages.length === 0 && (
                    <div className="text-sm text-slate-500">No messages yet. Say hello!</div>
                  )}
                </div>

                <div className="px-8 pb-8">
                  <div className="flex items-center gap-3 rounded-full border border-slate-200 bg-white/90 px-6 py-3 shadow-soft">
                    <input
                      type="text"
                      placeholder="Type something to send..."
                      autoCapitalize="sentences"
                      value={messageInput}
                      onChange={(e) => setMessageInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleSend();
                        }
                      }}
                      className="flex-1 bg-transparent text-sm text-slate-600 placeholder:text-slate-400 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleSend}
                      disabled={!messageInput.trim() || isSending}
                      className={cn(
                        "h-11 w-11 rounded-full bg-primary text-white flex items-center justify-center shadow-medium transition-colors",
                        !messageInput.trim() || isSending
                          ? "opacity-50 cursor-not-allowed"
                          : "hover:bg-primary/90"
                      )}
                    >
                      <Send className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default ChatPage;
