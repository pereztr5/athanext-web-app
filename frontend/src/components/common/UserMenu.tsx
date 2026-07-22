import { ROUTES } from "@/routes";
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import strings from "@/config/strings";
import { colors } from "@/config/colors";
import { cn, getInitials } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useRole } from "@/hooks/useRole";
import { useProfile } from "@/contexts/ProfileContext";
import { useNavigate, useLocation } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { User as UserIcon, LogOut, Settings, CalendarClock, Search, MessageCircle, Sparkles, GraduationCap, Heart, UsersRound, BadgeCheck } from "lucide-react";
import { AvatarFallback } from "@radix-ui/react-avatar";
import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { chatAPI } from "@/api";
import { useIsMobile } from "@/hooks/use-mobile";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

type UserMenuProps = {
  name?: string | null;
  email?: string | null;
  img?: string | null;
  fallbackImg?: string | null;
  useFallbackDelay?: boolean;
  completionOverride?: number | null;
  avatarReady?: boolean;
};

export const UserMenu: React.FC<UserMenuProps> = ({
  name = null,
  email = null,
  img = null,
  fallbackImg = null,
  useFallbackDelay = false,
  completionOverride = null,
  avatarReady: avatarReadyProp,
}) => {
  const {
    signOut,
    userImg,
    userName,
    userProfile,
    user,
    hasNewMessage,
    setHasNewMessage,
    profileProgress,
    profileReady,
  } = useAuth();
  const { profile } = useProfile();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast, dismiss } = useToast();
  const queryClient = useQueryClient();
  const senderNameCache = useRef<Record<string, string>>({});
  const subscriptionsRef = useRef<Array<{ unsubscribe: () => void }>>([]);
  const subscribedConversationIds = useRef<Set<string>>(new Set());
  const isMobile = useIsMobile();
  const { role: personaType, isAthleteLike } = useRole();
  const loadedAvatarCacheRef = useRef<Set<string>>(new Set());

  const resolveSenderName = async (senderId: string) => {
    if (!senderId) return "Someone";
    const cached = senderNameCache.current[senderId];
    if (cached) return cached;

    const { data, error } = await chatAPI.getUserName(senderId);
    if (error) {
      console.error("Failed to fetch sender name", error);
      return "Someone";
    }

    const resolved = data || "Someone";
    senderNameCache.current[senderId] = resolved;
    return resolved;
  };

  const subscribeToConversation = useCallback((conversationId: string, currentUserId: string) => {
    if (!conversationId || subscribedConversationIds.current.has(conversationId)) {
      return;
    }

    const channel = chatAPI.subscribeToConversationMessages(
      conversationId,
      async (newMessage) => {
        if (newMessage.sender_id !== currentUserId) {
          // Don't show toast notification if user is already on the chat page
          const isOnChatPage = window.location.pathname === ROUTES.CHAT;
          if (isOnChatPage) {
            // Check actual unread state since ChatPage will mark messages as read when viewing
            const { data: hasUnread } = await chatAPI.hasUnreadMessages(currentUserId);
            setHasNewMessage(hasUnread || false);
            return;
          }
          
          // User is not on chat page, so show notification
          setHasNewMessage(true);
          const senderName = newMessage.sender?.name || await resolveSenderName(newMessage.sender_id);

          let dismissToast: (() => void) | null = null;

          const { dismiss } = toast({
            duration: 6000,
            className: "border border-blue-100 bg-blue-50/90 dark:bg-blue-950/70 shadow-[0_20px_45px_rgba(37,99,235,0.18)] rounded-2xl px-5 py-4",
            title: `New message from ${senderName}`,
            description: (
              <div className="mt-3 text-sm text-slate-700 dark:text-slate-200 space-y-3">
                <p className="line-clamp-3">
                  {newMessage.body || 'You have a new message waiting.'}
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="rounded-full px-4 bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                    onClick={async () => {
                      // Check actual unread state instead of blindly clearing
                      if (user?.id) {
                        const { data: hasUnread } = await chatAPI.hasUnreadMessages(user.id);
                        setHasNewMessage(hasUnread || false);
                      }
                      navigate(ROUTES.CHAT);
                      dismissToast?.();
                    }}
                  >
                    Open Chat
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="rounded-full px-4 text-blue-700 hover:text-blue-800"
                    onClick={async () => {
                      // Check actual unread state instead of blindly clearing
                      if (user?.id) {
                        const { data: hasUnread } = await chatAPI.hasUnreadMessages(user.id);
                        setHasNewMessage(hasUnread || false);
                      }
                      dismissToast?.();
                    }}
                  >
                    Dismiss
                  </Button>
                </div>
              </div>
            ),
          });

          dismissToast = dismiss;
        }
      }
    );

    subscribedConversationIds.current.add(conversationId);
    subscriptionsRef.current.push({
      unsubscribe: () => {
        subscribedConversationIds.current.delete(conversationId);
        channel.unsubscribe();
      },
    });
  }, [toast, setHasNewMessage, navigate, user]);

  // Subscribe to new messages in real-time using React Query for caching
  const { data: conversations } = useQuery({
    queryKey: ['user-conversations', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await chatAPI.getUserConversations(user.id);
      if (error || !data) return [];
      return data;
    },
    enabled: Boolean(user?.id),
    staleTime: 5 * 60 * 1000, // 5 minutes - don't refetch on tab switch
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  // Check for unread messages on login/mount
  useEffect(() => {
    if (!user?.id) return;

    const checkUnreadMessages = async () => {
      const { data: hasUnread, error } = await chatAPI.hasUnreadMessages(user.id);
      if (!error && hasUnread) {
        setHasNewMessage(true);
      }
    };

    void checkUnreadMessages();
  }, [user?.id, setHasNewMessage]);

  useEffect(() => {
    if (!user) {
      return;
    }

    const currentSubscriptions = subscriptionsRef.current;
    const currentSubscribedIds = subscribedConversationIds.current;

    // Subscribe to existing conversations
    if (conversations && conversations.length > 0) {
      const conversationIds = conversations
        .map((c) => c.id)
        .filter((id): id is string => Boolean(id));

      conversationIds.forEach((convId) => subscribeToConversation(convId, user.id));
    } else {
      // console.log('[UserMenu] No existing conversations, but will subscribe to new ones');
    }

    // ALWAYS subscribe to new conversations being created (even if user has no conversations yet)
    const participantChannel = chatAPI.subscribeToConversationParticipants(user.id, async (payload) => {
      
      // Immediately subscribe to the new conversation to catch any messages sent right away
      const newConversationId = (payload as any)?.conversation_id;
      if (newConversationId && !subscribedConversationIds.current.has(newConversationId)) {
        subscribeToConversation(newConversationId, user.id);
      }
      
      // Invalidate React Query cache to refetch conversations
      await queryClient.invalidateQueries({ queryKey: ['user-conversations', user.id] });
    });

    subscriptionsRef.current.push({
      unsubscribe: () => participantChannel.unsubscribe(),
    });

    return () => {
      currentSubscriptions.forEach((sub) => sub.unsubscribe());
      currentSubscriptions.length = 0;
      currentSubscribedIds.clear();
    };
  }, [user, conversations, subscribeToConversation, queryClient]);

  const profileName =
    profile?.type === "coach"
      ? (profile.data as any)?.name
      : profile?.type === "athlete"
        ? (profile.data as any)?.full_name || (profile.data as any)?.fullName
        : null;
  const displayName = profileName || userProfile?.name || userName || name || "";

  const displayEmail = email ?? userProfile?.email ?? user?.email ?? "";
  const authProvider = (user?.app_metadata as any)?.provider || user?.identities?.[0]?.provider || null;
  const canChangePassword = authProvider === "email" || authProvider === "password";
  // Only use image if it's a valid string (not null, undefined, or empty)
  const platformSrc = img && img.trim() !== '' ? img : (userImg && userImg.trim() !== '' ? userImg : null);
  const fallbackSrc = fallbackImg && fallbackImg.trim() !== '' ? fallbackImg : null;
  const initials = getInitials(displayName, displayEmail);
  const avatarReady = avatarReadyProp ?? profileReady;
  const [allowFallback, setAllowFallback] = useState(!useFallbackDelay);
  const effectiveSrc = platformSrc || (allowFallback ? fallbackSrc : null);
  const expectedAvatar = Boolean(platformSrc || fallbackSrc || userProfile?.image_url || user?.user_metadata?.avatar_url);
  const [displayAvatarUrl, setDisplayAvatarUrl] = useState<string | null>(effectiveSrc);
  const [isAvatarLoading, setIsAvatarLoading] = useState(false);
  const [noAvatarConfirmed, setNoAvatarConfirmed] = useState(false);
  const [holdAvatarFallback, setHoldAvatarFallback] = useState(false);
  const shouldShowSkeleton =
    !avatarReady ||
    isAvatarLoading ||
    (expectedAvatar && !displayAvatarUrl) ||
    (!expectedAvatar && !noAvatarConfirmed) ||
    holdAvatarFallback;

  useEffect(() => {
    if (!useFallbackDelay) {
      setAllowFallback(true);
      return;
    }
    if (!avatarReady) {
      setAllowFallback(false);
      return;
    }
    if (platformSrc) {
      setAllowFallback(false);
      return;
    }
    if (!fallbackSrc) {
      setAllowFallback(false);
      return;
    }
    const id = window.setTimeout(() => {
      setAllowFallback(true);
    }, 1200);
    return () => window.clearTimeout(id);
  }, [avatarReady, fallbackSrc, platformSrc, useFallbackDelay]);

  useEffect(() => {
    if (!avatarReady || expectedAvatar) {
      setNoAvatarConfirmed(false);
      return;
    }
    const id = window.setTimeout(() => {
      setNoAvatarConfirmed(true);
    }, 400);
    return () => window.clearTimeout(id);
  }, [avatarReady, expectedAvatar]);

  useEffect(() => {
    if (!avatarReady) {
      setHoldAvatarFallback(true);
      return;
    }
    if (displayAvatarUrl) {
      setHoldAvatarFallback(false);
      return;
    }
    // Hold skeleton briefly to avoid initials flash before avatar resolves.
    setHoldAvatarFallback(true);
    const id = window.setTimeout(() => {
      setHoldAvatarFallback(false);
    }, 1200);
    return () => window.clearTimeout(id);
  }, [avatarReady, displayAvatarUrl]);

  // Preload candidate avatar URL and only swap when it finishes loading.
  // Keep current avatar visible to avoid flicker during transitions.
  useEffect(() => {
    if (!avatarReady) {
      setDisplayAvatarUrl(null);
      setIsAvatarLoading(true);
      return;
    }
    const nextSrc = effectiveSrc;
    if (!nextSrc) {
      setIsAvatarLoading(false);
      return;
    }
    if (nextSrc === displayAvatarUrl) {
      setIsAvatarLoading(false);
      return;
    }
    setIsAvatarLoading(true);
    const img = new Image();
    img.onload = () => {
      setDisplayAvatarUrl(nextSrc);
      setIsAvatarLoading(false);
    };
    img.onerror = () => {
      setIsAvatarLoading(false);
    };
    img.src = nextSrc;
  }, [avatarReady, displayAvatarUrl, effectiveSrc]);

  const {
    profileCompletion,
    isProfileComplete,
    ringDegrees,
    avatarNode,
  } = useMemo(() => {
    const completionSource = completionOverride ?? profileProgress?.completion ?? 0;
    const clampedCompletion = Math.min(Math.max(completionSource, 0), 100);
    const isComplete = clampedCompletion >= 100;
    const degrees = clampedCompletion * 3.6;
    const node = (
      <Avatar className="h-full w-full bg-white rounded-full relative overflow-hidden">
        {shouldShowSkeleton ? (
          <div className="w-full h-full flex items-center justify-center">
            <Skeleton className="h-full w-full rounded-full" />
          </div>
        ) : displayAvatarUrl ? (
          <AvatarImage
            loading="eager"
            src={displayAvatarUrl}
            alt={displayName}
            className="object-cover"
          />
        ) : (
          <AvatarFallback className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 via-primary/15 to-primary/10 text-primary font-semibold text-sm">
            {initials}
          </AvatarFallback>
        )}
      </Avatar>
    );

    return {
      profileCompletion: clampedCompletion,
      isProfileComplete: isComplete,
      ringDegrees: degrees,
      avatarNode: node,
    };
  }, [shouldShowSkeleton, displayAvatarUrl, displayName, initials, profileProgress?.completion, completionOverride]);

  const handleProfileNavigation = () => {
    navigate(ROUTES.PROFILE);
  };

  const handleChatNavigation = async () => {
    // Check actual unread state instead of blindly clearing
    if (user?.id) {
      const { data: hasUnread } = await chatAPI.hasUnreadMessages(user.id);
      setHasNewMessage(hasUnread || false);
    }
    dismiss(); // close any open notification bars
    navigate(ROUTES.CHAT);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="relative h-10 w-10 p-0 rounded-full hover:bg-transparent"
        >
          {profileCompletion > 0 && profileCompletion < 100 ? (
            <div
              className={cn(
                "relative h-10 w-10 rounded-full p-[4px] transition-all duration-200",
                "shadow-[0_0_0_1px_rgba(0,0,0,0.04)]"
              )}
              style={{
                background: `conic-gradient(#22c55e ${ringDegrees}deg, #e5e7eb ${ringDegrees}deg)`,
              }}
              aria-label={`Profile completion ${profileCompletion}%`}
            >
              {avatarNode}
            </div>
          ) : (
            <div className="relative h-10 w-10 rounded-full">
              {avatarNode}
            </div>
          )}
          
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-semibold leading-none text-slate-900">
                {displayName}
              </p>
              <p className="text-xs leading-none text-muted-foreground">
                {displayEmail}
              </p>
            </div>
            {personaType && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex items-center justify-center p-1.5 bg-primary/10 text-primary rounded-md border border-primary/20">
                    {personaType === "athlete" && <Sparkles className="h-3.5 w-3.5" />}
                    {personaType === "coach" && <BadgeCheck className="h-3.5 w-3.5 fill-primary" />}
                    {personaType === "parent" && <UsersRound className="h-3.5 w-3.5" />}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="left">
                  {personaType.charAt(0).toUpperCase() + personaType.slice(1)}
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleProfileNavigation} className="!cursor-pointer">
          <UserIcon className="mr-2 h-4 w-4" />
          <span>Profile</span>
        </DropdownMenuItem>
        {isAthleteLike && (
          <DropdownMenuItem onClick={() => navigate(ROUTES.COACHES)} className="!cursor-pointer">
            <Search className="mr-2 h-4 w-4" />
            <span>Find a Coach</span>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={() => navigate(ROUTES.MY_SESSIONS)} className="!cursor-pointer">
          <CalendarClock className="mr-2 h-4 w-4" />
          <span>My Sessions</span>
        </DropdownMenuItem>
        {canChangePassword && (
          <DropdownMenuItem onClick={() => navigate(ROUTES.SETTINGS)} className="!cursor-pointer">
            <Settings className="mr-2 h-4 w-4" />
            <span>{strings.profile.changePassword}</span>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => signOut()} style={{ color: colors.status.error }} className="!cursor-pointer">
          <LogOut className="mr-2 h-4 w-4" />
          <span>Sign out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
