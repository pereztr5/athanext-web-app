import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Send, X } from "lucide-react";

import type { Coach } from "@/types/coachProfile";
import MessageBubble from "@/components/chat/MessageBubble";
import { chatAPI, type MessageWithSender } from "@/api";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  buildId,
  getInitials,
  sendConversationNotificationEmail,
} from "@/utils/chatHelpers";

type CoachChatPanelProps = {
  coach: Coach;
  conversationId?: string | null;
  onClose: () => void;
};

const formatTime = (iso: string) => {
  const date = new Date(iso);
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
};

const sortMessages = (items: MessageWithSender[]) =>
  [...items].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));

const CoachChatPanel = ({ coach, conversationId, onClose }: CoachChatPanelProps) => {
  const { user, userProfile, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const coachFirstName = useMemo(() => coach.name.split(" ")[0] || coach.name, [coach.name]);
  const coachInitials = useMemo(() => getInitials(coach.name), [coach.name]);
  const userInitials = useMemo(
    () => getInitials(userProfile?.name || (user?.user_metadata as any)?.name || "You"),
    [userProfile?.name, user?.user_metadata]
  );

  const [activeConversationId, setActiveConversationId] = useState<string | null>(conversationId ?? null);
  const [messages, setMessages] = useState<MessageWithSender[]>([]);
  const [input, setInput] = useState("");
  const listRef = useRef<HTMLDivElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [messagesError, setMessagesError] = useState<string | null>(null);
  const personaType = (userProfile as any)?.persona_type || (user?.user_metadata as any)?.persona_type || null;
  const firstMessageNotifiedRef = useRef<Set<string>>(new Set());
  const firstReplyNotifiedRef = useRef<Set<string>>(new Set());
  const coachUserIdRef = useRef<string | null>(null);
  const [coachUserId, setCoachUserId] = useState<string | null>(null);

  // Keep internal id in sync if parent updates
  useEffect(() => {
    setActiveConversationId(conversationId ?? null);
  }, [conversationId]);

  useEffect(() => {
    const id = requestAnimationFrame(() => setIsVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    listRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const preloadCoachUserId = async () => {
      if (coachUserIdRef.current) return;
      const { data, error } = await chatAPI.getCoachUserProfile(coach.id);
      if (!error && data?.id) {
        coachUserIdRef.current = data.id;
        setCoachUserId(data.id);
      }
    };
    void preloadCoachUserId();
  }, [coach.id]);

  useEffect(() => {
    const attachExistingConversation = async () => {
      if (activeConversationId) return;
      if (!user || authLoading) return;
      const resolvedCoachUserId = coachUserIdRef.current || coachUserId;
      if (!resolvedCoachUserId) return;

      const { data, error } = await chatAPI.findConversationBetweenUsers(user.id, resolvedCoachUserId);
      if (!error && data?.id) {
        setActiveConversationId(data.id);
      }
    };

    void attachExistingConversation();
  }, [activeConversationId, authLoading, coachUserId, user]);

  const ensureConversation = useCallback(async () => {
    if (activeConversationId) return { id: activeConversationId, isNew: false };
    if (!user || authLoading) return { id: null, isNew: false };

    try {
      const { data: coachProfile, error: coachProfileError } = await chatAPI.getCoachUserProfile(coach.id);
      if (coachProfileError || !coachProfile?.id) {
        throw coachProfileError || new Error("Coach profile not found");
      }

      const coachUserId = coachProfile.id;
      coachUserIdRef.current = coachUserId;
      setCoachUserId(coachUserId);
      const { data: existingConversation, error: existingError } =
        await chatAPI.findConversationBetweenUsers(user.id, coachUserId);

      if (existingError) throw existingError;

      let newConversationId = existingConversation?.id || null;
      let isNew = false;

      if (!newConversationId) {
        const nowIso = new Date().toISOString();
        const createdId = buildId();
        const { error: conversationError } = await chatAPI.createConversation({
          id: createdId,
          created_by: user.id,
          last_message_at: nowIso,
          title: coach.name,
          is_group: false,
        });

        if (conversationError) {
          throw conversationError;
        }

        newConversationId = createdId;
        isNew = true;

        const { error: participantsError } = await chatAPI.addParticipants([
          { conversation_id: newConversationId, user_id: user.id, role: "owner" },
          { conversation_id: newConversationId, user_id: coachUserId, role: "member" },
        ]);

        if (participantsError) {
          throw participantsError;
        }
      }

      setActiveConversationId(newConversationId);
      return { id: newConversationId, isNew };
    } catch (error) {
      console.error("Failed to ensure conversation", error);
      toast({
        title: "Unable to start chat",
        description: "Please try again in a moment.",
        variant: "destructive",
      });
      return { id: null, isNew: false };
    }
  }, [activeConversationId, authLoading, coach.id, coach.name, toast, user]);

  const fetchMessages = useCallback(
    async (conversation: string, options?: { background?: boolean }) => {
      const background = options?.background ?? false;
      if (!background) {
        setLoadingMessages(true);
      }
      setMessagesError(null);
      const { data, error } = await chatAPI.getMessages(conversation, { limit: 30 });
      if (error) {
        console.error("Failed to load messages", error);
        setMessages([]);
        setMessagesError("Unable to load messages right now.");
      } else {
        setMessages(sortMessages(Array.isArray(data) ? data : []));
      }
      if (!background) {
        setLoadingMessages(false);
      }
    },
    []
  );

  // Load messages when we have a conversation id
  useEffect(() => {
    if (!activeConversationId) {
      setMessages([]);
      return;
    }
    void fetchMessages(activeConversationId);
  }, [activeConversationId, fetchMessages]);

  // Realtime subscription for new messages
  useEffect(() => {
    if (!activeConversationId) return;
    const channel = chatAPI.subscribeToConversationMessages(activeConversationId, (newMessage) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === newMessage.id)) return prev;
        return sortMessages([...prev, newMessage]);
      });
    });

    return () => {
      chatAPI.unsubscribe(channel);
    };
  }, [activeConversationId]);

  // Fallback: refresh when conversation metadata updates (covers missed realtime inserts)
  useEffect(() => {
    if (!activeConversationId) return;
    const channel = chatAPI.subscribeToConversationUpdates(
      [activeConversationId],
      (updated) => {
        if (!updated?.id || updated.id !== activeConversationId) return;
        void fetchMessages(activeConversationId, { background: true });
      }
    );

    return () => {
      chatAPI.unsubscribe(channel);
    };
  }, [activeConversationId, fetchMessages]);

  const handleSend = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;
    if (!user) {
      toast({
        title: "Please sign in",
        description: "You need to be signed in to send messages.",
        variant: "destructive",
      });
      return;
    }

    const { id: conversation, isNew } = await ensureConversation();
    if (!conversation) return;

    const messagesBeforeSend = [...messages];
    const lastMessageBeforeSend = messagesBeforeSend[messagesBeforeSend.length - 1];
    const isFirstMessageInConversation = messagesBeforeSend.length === 0;
    const isReplyToCoach =
      Boolean(lastMessageBeforeSend) && lastMessageBeforeSend.sender_id !== user.id;

    setIsSending(true);
    const nowIso = new Date().toISOString();

    const { data: inserted, error } = await chatAPI.sendMessage(conversation, user.id, trimmed);

    if (error) {
      console.error("Failed to send message", error);
      toast({
        title: "Message not sent",
        description: "Please try again.",
        variant: "destructive",
      });
    } else if (inserted) {
      setInput("");
      setMessages((prev) => sortMessages([...prev, inserted]));
      void chatAPI.updateConversationMetadata(conversation, {
        last_message_text: trimmed,
        last_message_at: nowIso,
      });

      if (
        (isNew || isFirstMessageInConversation) &&
        !firstMessageNotifiedRef.current.has(conversation)
      ) {
        firstMessageNotifiedRef.current.add(conversation);
        void sendConversationNotificationEmail({
          conversationId: conversation,
          actorId: user.id,
          messageBody: trimmed,
          messageTimestamp: nowIso,
          firstMessage: true,
        });
      } else if (
        isReplyToCoach &&
        !firstReplyNotifiedRef.current.has(conversation)
      ) {
        firstReplyNotifiedRef.current.add(conversation);
        void sendConversationNotificationEmail({
          conversationId: conversation,
          actorId: user.id,
          messageBody: trimmed,
          messageTimestamp: nowIso,
          firstReply: true,
        });
      }
    }

    setIsSending(false);
  };

  const handleClose = () => {
    setIsClosing(true);
    setIsVisible(false);
    setTimeout(onClose, 250);
  };

  return (
    <div
      className={cn(
        "fixed bottom-6 right-6 z-[100] w-[420px] max-w-[92dvw] h-[700px] sm:h-[70dvh] bg-white rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden transition-all duration-300 ease-out max-[430px]:left-0 max-[430px]:right-0 max-[430px]:top-[var(--vv-top,0px)] max-[430px]:w-screen max-[430px]:max-w-none max-[430px]:rounded-none max-[430px]:h-[var(--vvh,100svh)] max-[430px]:pt-[env(safe-area-inset-top)] max-[430px]:pb-[env(safe-area-inset-bottom)]",
        isVisible && !isClosing ? "translate-x-0 opacity-100" : "translate-x-full opacity-0"
      )}
      aria-label={`Chat with ${coach.name}${activeConversationId ? `, conversation ${activeConversationId}` : ""}`}
    >
      <div className="bg-[#0d7ff2] text-white px-5 py-4 flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xl font-semibold leading-tight">Hello {coachFirstName}</p>
          <p className="text-xs text-white/80">Reach out directly to your coach.</p>
        </div>
        <button
          type="button"
          onClick={handleClose}
          className="p-1.5 rounded-full hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          aria-label="Close chat"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="px-5 py-3 border-b border-slate-200 text-sm font-semibold text-[#0d7ff2]">AthaNext</div>

      <div className="flex-1 overflow-y-auto bg-slate-50 px-4 py-3 space-y-4">
        {loadingMessages ? (
          <p className="text-sm text-slate-500">Loading messages...</p>
        ) : messagesError ? (
          <p className="text-sm text-red-600">{messagesError}</p>
        ) : messages.length === 0 ? (
          <p className="text-sm text-slate-500">No messages yet. Say hello to start the conversation.</p>
        ) : (
          messages.map((message) => {
            const isUser = message.sender_id === user?.id;
            return (
              <MessageBubble
                key={message.id}
                text={message.body}
                time={formatTime(message.created_at)}
                isUser={isUser}
                initials={isUser ? userInitials : coachInitials}
                status={isUser ? message.status || undefined : undefined}
              />
            );
          })
        )}
        <div ref={listRef} />
      </div>

      <form onSubmit={handleSend} className="border-t border-slate-200 bg-white px-4 py-3 space-y-3">
        <label className="sr-only" htmlFor="coach-chat-input">
          Send a message to {coach.name}
        </label>
        <div className="rounded-xl border border-slate-200 bg-white">
          <textarea
            id="coach-chat-input"
            rows={2}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                if (input.trim() && !isSending && !loadingMessages) {
                  handleSend(event as any);
                }
              }
            }}
            placeholder={`Ask Coach ${coachFirstName} anything...`}
            className="w-full resize-none border-0 bg-transparent px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-0"
            maxLength={1000}
            disabled={isSending || loadingMessages}
          />
        </div>
        <button
          type="submit"
          className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-[#0d7ff2] text-white px-4 py-3 text-sm font-semibold shadow-sm hover:bg-[#0b6ed6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#0d7ff2] disabled:opacity-70"
          disabled={!input.trim() || isSending || loadingMessages}
        >
          <Send className="h-4 w-4" />
          {isSending ? "Sending..." : "Send"}
        </button>
      </form>
    </div>
  );
};

export default CoachChatPanel;
