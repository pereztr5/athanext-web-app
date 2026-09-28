import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { getInitials } from "@/lib/utils";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { UserMenu } from "@/components/common/UserMenu";
import { useAuth } from "@/contexts/AuthContext";
import { ROUTES } from "@/routes";
import { chatAPI } from "@/api/chat";
import { getMySessions } from "@/api/sessions";
import { useAthleteAvatarsByNames } from "@/hooks/useAthleteAvatars";
import { useCoachAvatarsByIds } from "@/hooks/useCoachAvatars";
import { useRole } from "@/hooks/useRole";

const notificationWhen = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (sameDay) {
    return `${date.getHours()}.${String(date.getMinutes()).padStart(2, "0")}`;
  }
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date);
};

export const AppTopBar = () => {
  const navigate = useNavigate();
  const { hasNewMessage, user, userProfile, profileReady, setHasNewMessage } = useAuth();
  const { isCoach } = useRole();
  const [open, setOpen] = useState(false);
  const personaId = isCoach
    ? userProfile?.coach_id ?? null
    : userProfile?.athlete_id ?? userProfile?.id ?? null;

  const conversationsQuery = useQuery({
    queryKey: ["topbar-notifications", user?.id],
    queryFn: () => chatAPI.getUserConversations(user!.id, { limit: 5 }),
    enabled: Boolean(user?.id) && open,
  });

  const sessionsQuery = useQuery({
    queryKey: ["topbar-next-session", personaId, isCoach],
    queryFn: () => getMySessions(personaId as string, isCoach ? "coach" : "athlete"),
    enabled: Boolean(personaId) && open,
  });

  const nextSession = useMemo(() => {
    return (sessionsQuery.data?.data ?? [])
      .filter((session) => session.computedStatus === "upcoming" || session.computedStatus === "in-progress")
      .sort((a, b) => a.start.localeCompare(b.start))[0];
  }, [sessionsQuery.data]);

  const { data: athletePhotos = {} } = useAthleteAvatarsByNames(
    isCoach && nextSession?.athleteNames?.[0] ? [nextSession.athleteNames[0]] : undefined
  );
  const { data: coachPhotos = {} } = useCoachAvatarsByIds(
    !isCoach && nextSession?.coachId ? [nextSession.coachId] : undefined
  );

  const notifications = useMemo(() => {
    const list = conversationsQuery.data?.data ?? [];
    const messages = list
      .filter((c) => c.last_message_at)
      .map((c) => {
        const participants = Array.isArray(c.conversation_participants)
          ? c.conversation_participants
          : [];
        const other = participants.find((p) => p.user_id !== user?.id);
        const mine = participants.find((p) => p.user_id === user?.id);
        const name = other?.user_profiles?.name || "Someone";
        const unread = mine?.last_read_at
          ? new Date(c.last_message_at as string).getTime() > new Date(mine.last_read_at).getTime()
          : true;
        return {
          id: c.id,
          kind: "message" as const,
          name,
          image: other?.user_profiles?.image_url || null,
          unread,
          when: c.last_message_at as string,
          to: ROUTES.CHAT,
        };
      });

    const sessionName = isCoach
      ? nextSession?.athleteNames?.[0] || "your athletes"
      : nextSession?.coachName || "your coach";
    const sessionImage = isCoach
      ? (nextSession?.athleteNames?.[0] && athletePhotos[nextSession.athleteNames[0]]) || null
      : (nextSession?.coachId && coachPhotos[nextSession.coachId]) || null;
    const sessionNote = nextSession
      ? [
          {
            id: `session-${nextSession.id}`,
            kind: "session" as const,
            name: sessionName,
            image: sessionImage,
            unread: true,
            when: nextSession.start,
            to: ROUTES.MY_SESSIONS,
          },
        ]
      : [];

    return [...messages, ...sessionNote].slice(0, 6);
  }, [conversationsQuery.data, nextSession, user?.id, isCoach, athletePhotos, coachPhotos]);

  return (
    <header
      className="sticky z-40 bg-[#F1F1E6] px-4 pt-5 md:px-10"
      style={{ top: "var(--network-banner-height, 0px)" }}
    >
      <div className="mx-auto flex w-full max-w-[1000px] items-center justify-end pb-[30px]">
        <SidebarTrigger className="mr-auto md:hidden" />
        <div className="sm:hidden">
          <UserMenu useFallbackDelay avatarReady={profileReady} />
        </div>
        <Popover
          open={open}
          onOpenChange={(next) => {
            setOpen(next);
            if (next) setHasNewMessage(false);
          }}
        >
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label="Notifications"
              className="relative inline-flex size-5 items-center justify-center text-[#1A202C]"
            >
              <Bell className="size-5" strokeWidth={1.5} />
              {hasNewMessage && (
                <span className="absolute -right-0.5 -top-0.5 size-[6.6px] rounded-full bg-[#0054B4]" />
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            sideOffset={14}
            className="w-[277px] rounded-[10px] border-[#EAEADF] bg-[#F4F4EB] p-0 shadow-[0px_0px_15px_0px_rgba(0,0,0,0.05)]"
          >
            <div className="flex max-h-80 flex-col gap-[10px] overflow-y-auto px-[10px] py-[15px]">
              {notifications.length ? (
                notifications.map((n, index) => (
                  <div key={n.id} className="flex flex-col gap-[10px]">
                    {index > 0 ? <div className="h-px w-full bg-[#EAEADF]" /> : null}
                    <button
                      type="button"
                      className="flex w-full items-center gap-[10px] rounded-[5px] p-[5px] text-left hover:bg-[#F9F9F5]"
                      onClick={() => {
                        setOpen(false);
                        navigate(n.to);
                      }}
                    >
                      <span
                        className={
                          n.unread
                            ? "size-[5px] shrink-0 rounded-full bg-[#0054B4]"
                            : "size-[5px] shrink-0 rounded-full bg-transparent"
                        }
                        aria-hidden={!n.unread}
                      />
                      <div className="flex min-w-0 flex-1 items-start gap-2">
                        <div className="size-[30px] shrink-0 overflow-hidden rounded-[4px] bg-[#C1C1B8]">
                          {n.image ? (
                            <img src={n.image} alt="" className="size-full object-cover" />
                          ) : (
                            <span className="flex size-full items-center justify-center text-[10px] font-medium text-[#484D56]">
                              {getInitials(n.name)}
                            </span>
                          )}
                        </div>
                        <p className="min-w-0 flex-1 text-[12px] font-normal leading-[14px] tracking-[-0.36px]">
                          {n.kind === "message" ? (
                            <>
                              <span className="text-[#1A202C]">{n.name} </span>
                              <span className="text-[#767980]">sent you a message</span>
                            </>
                          ) : (
                            <>
                              <span className="text-[#767980]">You have an upcoming session with </span>
                              <span className="text-[#1A202C]">{n.name}</span>
                            </>
                          )}
                        </p>
                        <span className="shrink-0 text-[12px] font-normal leading-[14px] tracking-[-0.36px] text-[#A3A6AB]">
                          {notificationWhen(n.when)}
                        </span>
                      </div>
                    </button>
                  </div>
                ))
              ) : (
                <p className="px-[5px] py-2 text-[12px] leading-[14px] tracking-[-0.36px] text-[#A3A6AB]">
                  {conversationsQuery.isLoading ? "Loading…" : "No notifications yet"}
                </p>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </header>
  );
};
