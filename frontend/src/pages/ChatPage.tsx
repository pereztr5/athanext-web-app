import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type WheelEvent as ReactWheelEvent,
} from "react";
import { MessageCircle, Pencil, Search, Menu, ArrowLeft, Plus, Send } from "@/components/icons";
import { NewChannelDialog } from "@/components/chat/NewChannelDialog";
import { NewMessageDialog } from "@/components/chat/NewMessageDialog";
import { GroupOfferCard } from "@/components/schedule/GroupOfferCard";
import MessageBubble from "@/components/chat/MessageBubble";
import { offerBubbleText } from "@/utils/messageLinks";
import { CommunityMembersDialog } from "@/components/chat/CommunityMembersDialog";
import { SafeguardingStrip } from "@/components/chat/SafeguardingStrip";
import { ComposerShortcuts, ConversationHeaderActions, conversationSubline, useConversationContext } from "@/components/chat/ConversationTools";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { iconButton, input } from "@/components/schedule/styles";
import {
  chatAPI,
  type ConversationWithParticipants,
  type MessageWithSender,
} from "@/api";
import { useAuth } from "@/contexts/AuthContext";
import { useRole } from "@/hooks/useRole";
import { useBack } from "@/hooks/useBack";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { ROUTES } from "@/routes";
import { formatDisplayName, getInitials, sendConversationNotificationEmail } from "@/utils/chatHelpers";
import { formatDate } from "@/utils/dateHelpers";
import { useIsMobile } from "@/hooks/use-mobile";

type ChatConversation = ConversationWithParticipants & {
  otherUserId?: string | null;
  otherUserName?: string | null;
  otherCoachId?: string | null;
  otherUserImage?: string | null;
  otherUserHandle?: string | null;
};

type ChatMessage = MessageWithSender;

const MESSAGE_PAGE_SIZE = 7;
const CONVERSATION_PAGE_SIZE = 6;

const ChatPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const locationKey = useLocation().key;
  const { user, userProfile, userImg, userName, setHasNewMessage } = useAuth();
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
  const [isMembersOpen, setIsMembersOpen] = useState(false);
  const lastConversationMarkerRef = useRef<string | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const firstMessageNotifiedRef = useRef<Set<string>>(new Set());
  const firstReplyNotifiedRef = useRef<Set<string>>(new Set());
  // The navigation (location.key) whose ?conversationId= was last opened. Each new link or
  // New message opens its conversation once; after that a pick from the list is kept.
  const openedLinkKeyRef = useRef<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [newMessageOpen, setNewMessageOpen] = useState(false);
  const { role: personaType } = useRole();


  useEffect(() => {
    if (isMobile) {
      setIsSidebarOpen(false);
    } else {
      setIsSidebarOpen(true);
    }
  }, [isMobile]);

  // On phones a link to a conversation (e.g. New message, picked from the list drawer) shows
  // that thread, so close the drawer over it.
  const linkedConversationId = searchParams.get("conversationId");
  useEffect(() => {
    if (isMobile && linkedConversationId) setIsSidebarOpen(false);
  }, [isMobile, linkedConversationId, locationKey]);

  const mapConversationRows = useCallback(
    (rows: ConversationWithParticipants[]): ChatConversation[] =>
      rows.map((conv) => {
        const participants = Array.isArray(conv.conversation_participants)
          ? conv.conversation_participants
          : [];
        // Coach community channel (ATH-21): named by title, shown with the owner coach's photo.
        if (conv.is_group) {
          const owner = participants.find((p) => p.role === "owner");
          return {
            ...conv,
            otherUserId: null,
            otherUserName: conv.title || "Community",
            otherCoachId: owner && owner.user_id !== user?.id ? owner.user_profiles?.coach_id || null : null,
            otherUserImage: owner?.user_profiles?.image_url || null,
            otherUserHandle: null,
          };
        }
        const member = participants.find(
          (p) => p.role === "member" && p.user_id !== user?.id
        );
        const nonCurrent = participants.find((p) => p.user_id !== user?.id);
        const other = member || nonCurrent || null;

        return {
          ...conv,
          otherUserId: other?.user_id || null,
          otherUserName: other?.user_profiles?.name || other?.user_id || null,
          otherCoachId: other?.user_profiles?.coach_id || null,
          otherUserImage: other?.user_profiles?.image_url || null,
          otherUserHandle: other?.user_profiles?.instagram_handle || null,
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
    let mapped = hasMore ? mappedAll.slice(0, requestedLimit) : mappedAll;

    // A linked conversation (e.g. a quiet community channel) may sit outside the loaded page.
    if (requestedConversationId && !mapped.some((c) => c.id === requestedConversationId)) {
      const { data: linked } = await chatAPI.getConversationsByIds([requestedConversationId]);
      if (Array.isArray(linked) && linked.length) {
        mapped = [...mapConversationRows(linked), ...mapped];
      }
    }

    setConversationLimit(requestedLimit);
    setHasMoreConversations(hasMore);
    setConversations(mapped);
    const requestedIsListed = Boolean(
      requestedConversationId && mapped.some((c) => c.id === requestedConversationId)
    );
    const hasSelectedConversation = Boolean(
      selectedConversationId && mapped.some((c) => c.id === selectedConversationId)
    );
    if (requestedIsListed && openedLinkKeyRef.current !== locationKey) {
      // A new link to /chat?conversationId=X wins over whatever thread is open.
      openedLinkKeyRef.current = locationKey;
      setSelectedConversationId(requestedConversationId);
    } else if (!hasSelectedConversation) {
      if (requestedIsListed) {
        setSelectedConversationId(requestedConversationId);
      } else if (mapped.length > 0) {
        setSelectedConversationId(mapped[0].id);
      } else {
        setSelectedConversationId(null);
      }
    }
    if (!silent) {
      setIsConversationsLoading(false);
    }
  }, [user, conversationLimit, searchParams, locationKey, selectedConversationId, mapConversationRows]);

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

  useEffect(() => {
    setIsMembersOpen(false);
  }, [selectedConversationId]);

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
      if (conversation.is_group) return conversation.title || "Group chat";
      const other = getOtherParticipant(conversation);
      const rawNameOrId =
        other?.user_profiles?.name ??
        other?.user_id ??
        conversation.otherUserName ??
        conversation.otherUserId ??
        "Unknown user";
      const nameOrId =
        typeof rawNameOrId === "string" ? rawNameOrId : String(rawNameOrId ?? "Unknown user");
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

  // Coach opens a channel they just created (Working Copy "New channel").
  const [newChannelOpen, setNewChannelOpen] = useState(false);
  const handleOpenMyChannel = async (createdId?: string) => {
    try {
      const channelId = createdId ?? (await chatAPI.openMyCoachChannel());
      await fetchConversations({ silent: true });
      // Make sure the channel is in the list even if it's older than the loaded page.
      const { data: linked } = await chatAPI.getConversationsByIds([channelId]);
      if (Array.isArray(linked) && linked.length) {
        const [channel] = mapConversationRows(linked);
        setConversations((prev) => (prev.some((c) => c.id === channel.id) ? prev : [channel, ...prev]));
      }
      setSelectedConversationId(channelId);
      if (isMobile) setIsSidebarOpen(false);
    } catch (error) {
      console.error("Failed to open community channel", error);
    }
  };

  const handleLeaveChannel = async (conversationId: string) => {
    try {
      await chatAPI.leaveCoachChannel(conversationId);
      setSelectedConversationId(null);
      setConversations((prev) => prev.filter((conv) => conv.id !== conversationId));
      await fetchConversations({ silent: true });
    } catch (error) {
      console.error("Failed to leave community channel", error);
    }
  };

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
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
  };

  const conversationHandle = (conversation: ChatConversation | null) => {
    if (!conversation) return "";
    if (conversation.is_group) {
      const members = (conversation.conversation_participants || []).filter((p) => p.role !== "owner").length;
      return `Community · ${members} ${members === 1 ? "member" : "members"}`;
    }
    if (conversation.otherUserHandle) return conversation.otherUserHandle.replace(/^@/, "");
    const name = getConversationName(conversation);
    return name.toLowerCase().split(/\s+/).filter(Boolean).join(".");
  };

  const { back: handleBack } = useBack(ROUTES.HOME);

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

  const conversationContext = useConversationContext(selectedConversation?.id, Boolean(selectedConversation?.is_group)).data;

  const handleSend = async () => {
    const trimmed = messageInput.trim();
    if (!trimmed || !selectedConversation || !user) return;

    const messagesBeforeSend = [...messages];
    const lastMessageBeforeSend = messagesBeforeSend[messagesBeforeSend.length - 1];
    const isFirstMessageInConversation = messagesBeforeSend.length === 0;
    const isReplyToCoach =
      Boolean(lastMessageBeforeSend) && lastMessageBeforeSend.sender_id !== user.id;
    const conversationId = selectedConversation.id;

    // Decide which email this send triggers before any state changes: the effect that marks
    // conversations as already notified reacts to the optimistic last_message_at and appended
    // message below, and would otherwise win the race. Claim the email now; release it if the
    // send fails.
    let email: "firstMessage" | "firstReply" | null = null;
    if (selectedConversation.is_group) {
      // Community channels send no notifications (ATH-21).
    } else if (isFirstMessageInConversation && !firstMessageNotifiedRef.current.has(conversationId)) {
      email = "firstMessage";
    } else if (isReplyToCoach && !firstReplyNotifiedRef.current.has(conversationId)) {
      email = "firstReply";
    }
    const notifiedRef = email === "firstMessage" ? firstMessageNotifiedRef : email === "firstReply" ? firstReplyNotifiedRef : null;
    notifiedRef?.current.add(conversationId);

    setIsSending(true);
    const nowIso = new Date().toISOString();

    const { data: inserted, error } = await chatAPI.sendMessage(
      selectedConversation.id,
      user.id,
      trimmed
    );

    if (error) {
      console.error("Failed to send message", error);
      notifiedRef?.current.delete(conversationId);
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

      if (email) {
        void sendConversationNotificationEmail({
          conversationId,
          actorId: user.id,
          messageBody: trimmed,
          messageTimestamp: nowIso,
          [email]: true,
        });
      }
    }

    setIsSending(false);
  };

  // Phone only: open the list drawer, or leave Messages. Shown even with no conversations, so
  // New message (in the list) stays reachable.
  const mobileNav = isMobile ? (
    <>
      <button
        type="button"
        onClick={() => setIsSidebarOpen(true)}
        className={cn(iconButton, "shrink-0")}
        aria-label="Open conversations"
      >
        <Menu className="size-4" strokeWidth={1.5} />
      </button>
      <button
        type="button"
        onClick={handleBack}
        className={cn(iconButton, "shrink-0")}
        aria-label="Go back"
      >
        <ArrowLeft className="size-4" strokeWidth={1.5} />
      </button>
    </>
  ) : null;

  const canLeaveChannel = Boolean(
    selectedConversation?.is_group &&
      selectedConversation.conversation_participants?.some(
        (p) => p.user_id === user?.id && p.role !== "owner"
      )
  );
  const otherCoachId = selectedConversation?.otherCoachId ?? null;

  return (
    <div className="overflow-x-hidden px-4 pb-8 pt-1 md:px-5">
      <NewChannelDialog open={newChannelOpen} onClose={() => setNewChannelOpen(false)} onCreated={(id) => void handleOpenMyChannel(id)} />
      <NewMessageDialog open={newMessageOpen} onClose={() => setNewMessageOpen(false)} />
      <div className="relative mx-auto flex h-[min(930px,calc(100dvh-8.5rem))] w-full max-w-wrapper max-md:h-[calc(100dvh_-_9.5rem_-_env(safe-area-inset-bottom))] overflow-hidden rounded-card border border-light-525 bg-light-300">
        <aside
          className={cn(
            "flex h-full flex-col border-r border-light-525 bg-light-300 transition-transform duration-200",
            isMobile
              ? "absolute inset-y-0 left-0 z-20 w-[88vw] max-w-xs"
              : "relative w-[282px] shrink-0"
          )}
          style={{ transform: isMobile && !isSidebarOpen ? "translateX(-100%)" : "translateX(0)" }}
        >
          <div className="flex flex-col gap-5 border-b border-light-525 px-[25px] py-[30px]">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-card-title text-dark">Messages</h2>
              {userProfile?.coach_id ? (
                <button
                  type="button"
                  onClick={() => setNewChannelOpen(true)}
                  className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "shrink-0")}
                >
                  <Plus className="size-4" strokeWidth={1.5} aria-hidden="true" />
                  New channel
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setNewMessageOpen(true)}
                  className={cn(iconButton, "shrink-0")}
                  aria-label="New message"
                >
                  <Pencil className="size-4" strokeWidth={1.5} aria-hidden="true" />
                </button>
              )}
            </div>
            <label className="relative block">
              <span className="sr-only">Search messages</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-dark-300" strokeWidth={1.5} />
              <input
                type="text"
                placeholder="Search messages"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={cn(input, "pl-9")}
              />
            </label>
          </div>

          <div className="flex-1 overflow-y-auto">
            {showSidebarLoader ? (
              <div className="px-6 py-4 space-y-3">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div
                    key={index}
                    className="flex gap-3 rounded-control border border-light-525 bg-light-200 px-4 py-3 animate-pulse"
                  >
                    <div className="size-10 rounded-full bg-light-525" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 w-2/3 rounded-pill bg-light-525" />
                      <div className="h-3 w-1/2 rounded-pill bg-light" />
                    </div>
                  </div>
                ))}
              </div>
            ) : isFilteredEmpty ? (
              <div className="px-6 py-10">
                <div className="rounded-card border border-dashed border-light-600 bg-light-200 p-6 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-control border border-light-525 bg-light-300">
                    <MessageCircle className="size-5 text-dark-300" strokeWidth={1.5} />
                  </div>
                  <p className="mt-4 text-label-sm text-dark">
                    {hasConversations ? "No matching conversations" : "No conversations yet"}
                  </p>
                  <p className="mt-1 text-paragraph-sm text-dark-300">
                    {hasConversations
                      ? "Try a different search or clear filters."
                      : "Start a chat from any coach profile and your messages will appear here."}
                  </p>
                  {hasConversations && hasMoreConversations && !searchTerm.trim() && (
                    <button
                      type="button"
                      onClick={() => void loadMoreConversations()}
                      disabled={isLoadingMoreConversations}
                      className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "mt-4")}
                    >
                      {isLoadingMoreConversations ? "Loading…" : "Load more conversations"}
                    </button>
                  )}
                  {!hasConversations && (
                    <button
                      type="button"
                      onClick={() => navigate(ROUTES.COACHES)}
                      className={cn(buttonVariants({ variant: "default", size: "sm" }), "mt-4")}
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
                        "relative flex cursor-pointer items-center justify-between gap-[10px] border-b border-light-525 px-[25px] py-5 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary",
                        selectedConversationId === chat.id ? "bg-light-200" : "bg-light-300 hover:bg-light-200"
                      )}
                    >
                      {hasUnread ? (
                        <span className="absolute left-[10px] top-[38px] size-1.5 rounded-full bg-primary" aria-label="Unread messages" />
                      ) : null}
                      <div className="flex min-w-0 flex-1 items-center gap-[10px]">
                        <div className="size-10 shrink-0 overflow-hidden rounded-full border border-light-550 bg-light">
                          {chat.otherUserImage ? (
                            <img src={chat.otherUserImage} alt="" className="size-full object-cover" />
                          ) : (
                            <span className="flex size-full items-center justify-center text-label-xsm text-dark-300">
                              {getInitials(getConversationName(chat))}
                            </span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-body-l text-dark">
                            {getConversationName(chat)}
                          </p>
                          <p className="truncate text-caption text-dark-300">
                            {chat.last_message_text || "Start the conversation"}
                          </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col items-end text-caption">
                        <span className="text-dark-300">
                          {chat.last_message_at ? formatTime(chat.last_message_at) : ""}
                        </span>
                        <span className="text-dark-300">
                          {chat.last_message_at ? formatDate(chat.last_message_at) : ""}
                        </span>
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
                      className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "w-full")}
                    >
                      {isLoadingMoreConversations ? "Loading…" : "Load more conversations"}
                    </button>
                  </div>
                )}
                {isSearchingConversations && (
                  <div className="px-6 pb-4 text-center text-caption text-dark-300">
                    Searching all conversations…
                  </div>
                )}
              </>
            )}
          </div>
        </aside>

        {isMobile && isSidebarOpen && (
          <div
            className="absolute inset-0 z-10 bg-dark/20 sm:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* Conversation */}
        <section className={cn("relative flex min-w-0 flex-1 flex-col bg-light-200", isMobile && isSidebarOpen && "hidden")}>
          <div className="relative flex h-full flex-col">
            {isConversationsLoading && !hasConversations ? (
              <div className="flex-1 flex items-center justify-center px-10 py-12">
                <div className="flex flex-col items-center gap-3 text-center">
                  <div className="h-12 w-12 animate-spin rounded-full border-2 border-light-525 border-t-primary" />
                  <p className="text-label-sm text-dark">Loading your messages</p>
                  <p className="text-caption text-dark-300">This only takes a moment.</p>
                </div>
              </div>
            ) : !hasConversations ? (
              <>
              {mobileNav ? (
                <div className="flex items-center gap-[10px] px-[30px] pt-[30px]">{mobileNav}</div>
              ) : null}
              <div className="flex-1 flex items-center justify-center px-10 py-12">
                <div className="w-full max-w-xl rounded-card border border-light-525 bg-light-300 px-[25px] pb-[25px] pt-[30px] text-center sm:px-10 sm:pb-10">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-control border border-primary-300 bg-primary-50 text-primary">
                    <MessageCircle className="size-6" strokeWidth={1.5} />
                  </div>
                  <h3 className="mt-4 text-card-title text-dark">No conversations yet</h3>
                  <p className="mt-2 text-body-m text-dark-300">
                    Open a coach profile and send a message to start a private chat.
                  </p>
                  <div className="mt-6 flex items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => navigate(ROUTES.COACHES)}
                      className={buttonVariants({ variant: "default" })}
                    >
                      Browse coaches
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate(ROUTES.HOME)}
                      className={buttonVariants({ variant: "secondary" })}
                    >
                      Go home
                    </button>
                  </div>
                </div>
              </div>
              </>
            ) : (
              <>
                <div className="flex h-full flex-col gap-[10px] p-[30px]">
                {/* On phones the actions get their own row so the name and member count keep their width. */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex min-w-0 flex-1 items-center gap-[10px]">
                    {mobileNav}
                    <div className={cn("shrink-0 overflow-hidden rounded-full border border-light-550 bg-light", isMobile ? "size-10" : "size-[50px]")}>
                      {selectedConversation?.otherUserImage ? (
                        <img src={selectedConversation.otherUserImage} alt="" className="size-full object-cover" />
                      ) : (
                        <span className="flex size-full items-center justify-center text-label-sm text-dark-300">
                          {getInitials(getConversationName(selectedConversation))}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-body-l text-dark">
                        {getConversationName(selectedConversation)}
                      </p>
                      {selectedConversation?.is_group ? (
                        <button
                          type="button"
                          onClick={() => setIsMembersOpen(true)}
                          className="block max-w-full truncate text-left text-caption text-dark-300 underline-offset-2 hover:text-dark hover:underline"
                        >
                          {conversationHandle(selectedConversation)}
                        </button>
                      ) : (
                        <p className="truncate text-caption text-dark-300">
                          {conversationSubline(conversationContext) ?? conversationHandle(selectedConversation)}
                        </p>
                      )}
                    </div>
                  </div>
                  {!selectedConversation?.is_group ? <ConversationHeaderActions ctx={conversationContext} /> : null}
                  {selectedConversation && (canLeaveChannel || otherCoachId) ? (
                    <div className={cn("flex shrink-0 items-center gap-3", isMobile && "basis-full")}>
                      {canLeaveChannel ? (
                        <button
                          type="button"
                          className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "shrink-0")}
                          onClick={() => void handleLeaveChannel(selectedConversation.id)}
                        >
                          Leave
                        </button>
                      ) : null}
                      {otherCoachId ? (
                        <button
                          type="button"
                          className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "shrink-0")}
                          onClick={() => navigate(`/coach/${otherCoachId}`)}
                        >
                          View profile
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                {selectedConversation && !selectedConversation.is_group ? (
                  <SafeguardingStrip conversationId={selectedConversation.id} />
                ) : null}

                <div
                  className="flex flex-1 flex-col overflow-y-auto"
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
                          <div className="size-9 rounded-full bg-light-525" />
                          <div className="flex-1 space-y-2">
                            <div className="h-3 w-24 rounded-pill bg-light-525" />
                            <div className="h-3 w-4/5 rounded-pill bg-light" />
                            <div className="h-3 w-2/3 rounded-pill bg-light" />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {!isMessagesLoading && (
                    <div className="mt-auto flex flex-col gap-[14px]">
                    {messages.map((message) => {
                      const isUser = message.sender_id === user?.id;
                      const isGroup = Boolean(selectedConversation?.is_group);
                      const sender = isGroup
                        ? selectedConversation?.conversation_participants?.find((p) => p.user_id === message.sender_id)
                        : null;
                      const senderName =
                        (typeof message.sender?.name === "string" ? message.sender.name : "") ||
                        sender?.user_profiles?.name ||
                        "";
                      const initials = getInitials(
                        isUser ? userName || senderName || "You" : senderName || getConversationName(selectedConversation)
                      );
                      // Coach offers carry a card with the link; the bubble keeps only the words.
                      const bubbleText = message.offer_id ? offerBubbleText(message.body) : message.body;
                      const bubble = bubbleText ? (
                        <MessageBubble
                          key={message.id}
                          text={bubbleText}
                          time={formatTime(message.created_at)}
                          isUser={isUser}
                          initials={initials}
                          status={isGroup ? undefined : isUser ? "Sent" : "Read"}
                          avatarUrl={isUser ? userImg : isGroup ? sender?.user_profiles?.image_url : selectedConversation?.otherUserImage}
                          senderName={isGroup && !isUser ? formatDisplayName(senderName || "Member") : undefined}
                          variant="thread"
                        />
                      ) : null;
                      // A published week of group sessions (ATH-72) shows its pick-and-pay card.
                      if (!message.offer_id) return bubble;
                      return (
                        <div key={message.id} className={cn("flex flex-col gap-2", isUser ? "items-end" : "items-start")}>
                          {bubble}
                          <GroupOfferCard offerId={message.offer_id} className={isUser ? "mr-[35px]" : "ml-[35px]"} />
                        </div>
                      );
                    })}
                    </div>
                  )}
                  {!isMessagesLoading && messages.length === 0 && (
                    <div className="mt-auto text-body-m text-dark-300">No messages yet. Send the first one below.</div>
                  )}
                </div>

                {!selectedConversation?.is_group ? (
                  <ComposerShortcuts ctx={conversationContext} onFill={(text) => setMessageInput(text)} />
                ) : null}
                {selectedConversation?.is_group &&
                !selectedConversation.conversation_participants?.some((p) => p.user_id === user?.id) ? (
                  <div className="flex flex-col gap-3 rounded-card border border-light-525 bg-light-400 px-5 py-4">
                    <p className="text-body-m text-dark-300">Join to see this channel.</p>
                    <button
                      type="button"
                      className={cn(buttonVariants({ variant: "default" }), "self-start")}
                      onClick={() => void chatAPI.joinChannel(selectedConversation.id).then(() => fetchConversations({ silent: true }))}
                    >
                      Join channel
                    </button>
                  </div>
                ) : (
                <div className="flex items-center justify-between gap-3 rounded-card border border-light-525 bg-light-300 px-5 py-[15px] focus-within:border-primary">
                    <input
                      type="text"
                      placeholder={
                        selectedConversation && !selectedConversation.is_group
                          ? `Write to ${getConversationName(selectedConversation).split(" ")[0]}`
                          : "Write to the group"
                      }
                      autoCapitalize="sentences"
                      value={messageInput}
                      onChange={(e) => setMessageInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleSend();
                        }
                      }}
                      className="w-full bg-transparent text-body-l text-dark outline-none placeholder:text-dark-200"
                    />
                    <button
                      type="button"
                      onClick={handleSend}
                      disabled={!messageInput.trim() || isSending}
                      className={cn(buttonVariants({ variant: "default" }), "shrink-0 gap-1.5")}
                    >
                      <Send className="size-4" strokeWidth={1.5} aria-hidden="true" />
                      Send
                    </button>
                  </div>
                )}
                </div>
              </>
            )}
          </div>
        </section>
      </div>
      {selectedConversation?.is_group ? (
        <CommunityMembersDialog
          conversationId={selectedConversation.id}
          open={isMembersOpen}
          onOpenChange={setIsMembersOpen}
        />
      ) : null}
    </div>
  );
};

export default ChatPage;
