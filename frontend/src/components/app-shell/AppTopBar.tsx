import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CalendarPlus, MessageCircle, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { UserMenu } from "@/components/common/UserMenu";
import { useAuth } from "@/contexts/AuthContext";
import { useRole } from "@/hooks/useRole";
import { primaryButton, smallButton } from "@/components/schedule/styles";
import { AthaNextLogo } from "@/assets";
import { ROUTES } from "@/routes";
import { chatAPI } from "@/api/chat";
import { notificationsAPI, type AppNotification } from "@/api/notifications";
import { useViewerTimeZone } from "@/hooks/useViewerTimeZone";
import { formatDateInZone, lowerPeriod } from "@/utils/viewerTime";

const notificationWhen = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (sameDay) {
    return lowerPeriod(new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(date));
  }
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date);
};

// Pages that already have their own main action, so the top bar doesn't repeat it.
const COACH_ACTION_HIDDEN = [ROUTES.DASHBOARD, ROUTES.SCHEDULE, ROUTES.MY_SESSIONS, ROUTES.ATHLETES, ROUTES.MY_ORGANIZATION, "/organizations/", "/sessions/", "/coach-session-feedback"];
const ATHLETE_ACTION_HIDDEN = [ROUTES.BOOK, ROUTES.MY_SESSIONS, ROUTES.BOOKING_CONFIRMATION];

export const AppTopBar = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { isCoach, isAthleteLike } = useRole();
  const hides = (list: string[]) => list.some((p) => (p.endsWith("/") ? pathname.startsWith(p) : pathname === p || pathname.startsWith(`${p}/`)));
  const action = isCoach
    ? hides(COACH_ACTION_HIDDEN) ? null : { label: "Create session", to: `${ROUTES.SCHEDULE}?create=1`, Icon: Plus }
    : isAthleteLike && !hides(ATHLETE_ACTION_HIDDEN) ? { label: "Book", to: ROUTES.BOOK, Icon: CalendarPlus } : null;
  const { hasNewMessage, user, profileReady, setHasNewMessage } = useAuth();
  const queryClient = useQueryClient();
  const timeZone = useViewerTimeZone();
  const [open, setOpen] = useState(false);

  // Built on the server so every item links to its own screen (ATH-98).
  const notificationsQuery = useQuery({
    queryKey: ["notifications", user?.id, hasNewMessage],
    queryFn: () => notificationsAPI.list(),
    enabled: Boolean(user?.id),
    refetchInterval: 60_000,
  });
  const notifications = notificationsQuery.data ?? [];
  const hasUnread = notifications.some((n) => n.unread);

  const describe = (n: AppNotification) =>
    n.kind === "upcoming" && n.startsAt
      ? `starts ${formatDateInZone(new Date(n.startsAt), timeZone, { weekday: "short", hour: "numeric", minute: "2-digit" })}.`
      : n.kind === "message"
        ? n.body || "sent you a message"
        : n.body;

  // Unread conversations for the Messages button (ATH-75); refreshed when a new message arrives.
  const unreadQuery = useQuery({
    queryKey: ["unread-conversations", user?.id, hasNewMessage],
    queryFn: () => chatAPI.countUnreadConversations(user!.id).then((r) => r.data ?? 0),
    enabled: Boolean(user?.id),
    refetchInterval: 60_000,
  });
  const unread = unreadQuery.data ?? 0;

  return (
    <header
      className="sticky z-40 bg-[#F1F1E6] px-4 pb-1.5 pt-3 md:px-6 md:pt-3.5"
      style={{ top: "var(--network-banner-height, 0px)" }}
    >
      <div className="flex w-full items-center justify-end gap-1.5">
        <Link to={ROUTES.DASHBOARD} aria-label="AthaNext home" className="mr-auto inline-flex md:hidden">
          <img src={AthaNextLogo} alt="AthaNext" className="h-5 w-[88px] object-contain object-left" />
        </Link>
        {action ? (
          <Link to={action.to} className={cn(primaryButton, smallButton, "hidden md:inline-flex")}>
            <action.Icon strokeWidth={1.5} aria-hidden="true" />
            {action.label}
          </Link>
        ) : null}
        <Link
          to={ROUTES.CHAT}
          aria-label={unread ? `Messages, ${unread} unread` : "Messages"}
          className="relative inline-flex size-[34px] items-center justify-center rounded-[8px] border border-[#EAEADF] bg-[#F4F4EB] text-[#1A202C] transition-colors hover:border-[#C1C1B8]"
        >
          <MessageCircle className="size-5" strokeWidth={1.5} />
          {unread ? (
            <span className="absolute -right-1.5 -top-1.5 rounded-[4px] bg-[#0054B4] px-[5px] py-px text-[12px] font-medium leading-[13px] text-[#F1F1E6]">
              {unread > 9 ? "9+" : unread}
            </span>
          ) : null}
        </Link>
        <Popover
          open={open}
          onOpenChange={(next) => {
            setOpen(next);
            if (next) setHasNewMessage(false);
            else queryClient.invalidateQueries({ queryKey: ["notifications"] });
          }}
        >
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={hasUnread ? "Notifications, new items" : "Notifications"}
              className="relative inline-flex size-[34px] items-center justify-center rounded-[8px] text-[#1A202C] transition-colors hover:bg-[#F4F4EB]"
            >
              <Bell className="size-5" strokeWidth={1.5} />
              {hasUnread || hasNewMessage ? (
                <span className="absolute right-[7px] top-1.5 size-[7px] rounded-full bg-[#0054B4] shadow-[0_0_0_1.5px_#F1F1E6]" />
              ) : null}
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            sideOffset={8}
            collisionPadding={8}
            className="w-[calc(100vw-16px)] rounded-[10px] border-[#EAEADF] bg-[#F7F7F0] p-2 shadow-[0_0_15px_rgba(0,0,0,0.05),0_12px_30px_-12px_rgba(16,19,26,0.18)] sm:w-[330px]"
          >
            <div className="flex items-center justify-between px-[10px] pb-2 pt-1.5">
              <p className="text-[14px] font-medium leading-[18px] text-[#1A202C]">Notifications</p>
              {hasUnread ? (
                <button
                  type="button"
                  className="text-[12px] font-medium text-[#0054B4] hover:text-[#004390]"
                  onClick={() => {
                    void notificationsAPI
                      .markSeen()
                      .catch(() => undefined)
                      .then(() => queryClient.invalidateQueries({ queryKey: ["notifications"] }));
                  }}
                >
                  Mark all read
                </button>
              ) : null}
            </div>
            <div className="flex max-h-[420px] flex-col overflow-y-auto">
              {notifications.length ? (
                notifications.slice(0, 8).map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    className="flex w-full items-start gap-[10px] rounded-[8px] p-[10px] text-left hover:bg-[#F9F9F5]"
                    onClick={() => {
                      setOpen(false);
                      navigate(n.link);
                    }}
                  >
                    <span
                      className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", n.unread ? "bg-[#0054B4]" : "bg-transparent")}
                      aria-hidden="true"
                    />
                    <p className="min-w-0 flex-1 text-[13px] leading-[17px] text-[#767980]">
                      <b className="font-medium text-[#1A202C]">{n.title}</b> {describe(n)}
                    </p>
                    <time className="ml-auto shrink-0 whitespace-nowrap text-[12px] text-[#A3A6AB]">
                      {n.kind === "upcoming" ? "" : notificationWhen(n.at)}
                    </time>
                  </button>
                ))
              ) : (
                <p className="p-[10px] text-[12px] leading-[14px] text-[#767980]">
                  {notificationsQuery.isLoading ? "Loading…" : "You're all caught up."}
                </p>
              )}
            </div>
          </PopoverContent>
        </Popover>
        <UserMenu useFallbackDelay avatarReady={profileReady} />
      </div>
    </header>
  );
};
