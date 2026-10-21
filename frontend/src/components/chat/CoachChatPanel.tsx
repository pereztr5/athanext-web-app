import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Loader2, Send, X } from "@/components/icons";

import type { Coach } from "@/types/coachProfile";
import MessageBubble from "@/components/chat/MessageBubble";
import { chatAPI, type MessageWithSender } from "@/api";
import { useAuth } from "@/contexts/AuthContext";
import { useRole } from "@/hooks/useRole";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import {
  buildId,
  getInitials,
  sendConversationNotificationEmail,
} from "@/utils/chatHelpers";
import { lowerPeriod } from "@/utils/viewerTime";

type CoachChatPanelProps = {
  coach: Coach;
  conversationId?: string | null;
  onClose: () => void;
};

const formatTime = (iso: string) => {
  const date = new Date(iso);
  return lowerPeriod(date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }));
};

const getDayKey = (iso: string) => {
  const date = new Date(iso);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
};

const formatDayLabel = (iso: string) => {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (getDayKey(iso) === getDayKey(today.toISOString())) return "Today";
  if (getDayKey(iso) === getDayKey(yesterday.toISOString())) return "Yesterday";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(date.getFullYear() !== today.getFullYear() ? { year: "numeric" } : {}),
  });
};

const toSentenceCase = (value: string) => {
  const trimmed = value.trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase() : trimmed;
};

// Composer grows with its content up to ~4 lines (4 x 18px line height + 20px padding).
const COMPOSER_MAX_HEIGHT = 92;

const sortMessages = (items: MessageWithSender[]) =>
  [...items].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));

const CoachChatPanel = ({ coach, conversationId, onClose }: CoachChatPanelProps) => {
  const { user, userProfile, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const coachFirstName = useMemo(() => coach.name.split(" ")[0] || coach.name, [coach.name]);
  const coachInitials = useMemo(() => getInitials(coach.name), [coach.name]);
  const coachPhotoUrl = coach.profile_image_url || coach.image_url || null;
  const coachSubline = coach.sport?.trim() ? `${toSentenceCase(coach.sport)} coach` : null;
  const userInitials = useMemo(
    () => getInitials(userProfile?.name || (user?.user_metadata as any)?.name || "You"),
    [userProfile?.name, user?.user_metadata]
  );

  const [activeConversationId, setActiveConversationId] = useState<string | null>(conversationId ?? null);
  const [messages, setMessages] = useState<MessageWithSender[]>([]);
  const [input, setInput] = useState("");
  const listRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [messagesError, setMessagesError] = useState<string | null>(null);
  const { role: personaType } = useRole();
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

  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, COMPOSER_MAX_HEIGHT)}px`;
    el.style.overflowY = el.scrollHeight > COMPOSER_MAX_HEIGHT ? "auto" : "hidden";
  }, [input]);

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
        "fixed bottom-6 right-6 z-[100] w-[380px] max-w-[92dvw] h-[min(700px,calc(100dvh-3rem))] sm:h-[70dvh] bg-light-300 text-dark rounded-card shadow-overlay border border-light-525 flex flex-col overflow-hidden transition-all duration-300 ease-out max-[430px]:left-0 max-[430px]:right-0 max-[430px]:top-[var(--vv-top,0px)] max-[430px]:w-screen max-[430px]:max-w-none max-[430px]:rounded-none max-[430px]:h-[var(--vvh,100svh)] max-[430px]:pt-[env(safe-area-inset-top)] max-[430px]:pb-[env(safe-area-inset-bottom)]",
        isVisible && !isClosing ? "translate-x-0 opacity-100" : "translate-x-full opacity-0"
      )}
      aria-label={`Chat with ${coach.name}${activeConversationId ? `, conversation ${activeConversationId}` : ""}`}
    >
      <div className="flex items-center gap-2.5 border-b border-light-525 px-5 py-4">
        <span className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full border border-primary-300 bg-primary-50 text-label-xsm text-primary">
          {coachPhotoUrl ? (
            <img src={coachPhotoUrl} alt="" className="size-full object-cover" />
          ) : (
            coachInitials
          )}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="truncate text-subtitle">{coach.name}</p>
          {coachSubline ? (
            <p className="truncate text-caption text-dark-300">{coachSubline}</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={handleClose}
          className="-mr-1.5 inline-flex size-7 shrink-0 items-center justify-center rounded-control text-dark-300 transition-colors hover:bg-light-400 hover:text-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          aria-label="Close chat"
        >
          <X className="size-4" strokeWidth={1.5} />
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto bg-light p-4">
        {loadingMessages ? (
          <div className="m-auto flex items-center gap-2 text-body-m text-dark-300" role="status">
            <Loader2 className="size-4 animate-spin" strokeWidth={1.5} aria-hidden="true" />
            Loading messages
          </div>
        ) : messagesError ? (
          <p className="m-auto max-w-[260px] text-center text-body-m text-error-700" role="alert">
            {messagesError}
          </p>
        ) : messages.length === 0 ? (
          <div className="m-auto flex max-w-[260px] flex-col gap-1 text-center">
            <p className="text-label-sm text-dark">No messages yet</p>
            <p className="text-paragraph-sm text-dark-300">
              Say hello to {coachFirstName} to start the conversation.
            </p>
          </div>
        ) : (
          messages.map((message, index) => {
            const isUser = message.sender_id === user?.id;
            const dayKey = getDayKey(message.created_at);
            const showDay = index === 0 || getDayKey(messages[index - 1].created_at) !== dayKey;
            return (
              <Fragment key={message.id}>
                {showDay ? (
                  <span className="self-center text-caption text-dark-300">
                    {formatDayLabel(message.created_at)}
                  </span>
                ) : null}
                <MessageBubble
                  text={message.body}
                  time={formatTime(message.created_at)}
                  isUser={isUser}
                  initials={isUser ? userInitials : coachInitials}
                  status={isUser && message.status ? toSentenceCase(message.status) : undefined}
                />
              </Fragment>
            );
          })
        )}
        <div ref={listRef} />
      </div>

      <form onSubmit={handleSend} className="flex items-end gap-2 border-t border-light-525 px-4 py-3">
        <label className="sr-only" htmlFor="coach-chat-input">
          Send a message to {coach.name}
        </label>
        <textarea
          ref={inputRef}
          id="coach-chat-input"
          rows={1}
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
          placeholder={`Message ${coachFirstName}`}
          className="block h-[38px] max-h-[92px] min-w-0 flex-1 resize-none rounded-control border border-dark-250 bg-light px-3 py-[9px] text-body-m text-dark placeholder:text-dark-200 focus:border-primary focus:outline focus:outline-2 focus:-outline-offset-1 focus:outline-primary disabled:border-light-525 disabled:bg-light-400 disabled:text-dark-200"
          maxLength={1000}
          disabled={isSending || loadingMessages}
        />
        <button
          type="submit"
          aria-label={isSending ? "Sending message" : "Send message"}
          className={cn(buttonVariants({ variant: "default", size: "icon" }), "size-[38px] shrink-0")}
          disabled={!input.trim() || isSending || loadingMessages}
        >
          {isSending ? (
            <Loader2 className="size-4 animate-spin" strokeWidth={1.5} aria-hidden="true" />
          ) : (
            <Send className="size-4" strokeWidth={1.5} aria-hidden="true" />
          )}
        </button>
      </form>
    </div>
  );
};

export default CoachChatPanel;
