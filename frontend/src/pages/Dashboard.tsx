import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Activity, Calendar, CircleDollarSign, Clock, UserRound, Users } from "lucide-react";
import { useMemo, type ReactNode } from "react";
import { chatAPI, type ConversationWithParticipants } from "@/api/chat";
import { useAuth } from "@/contexts/AuthContext";
import { useAthleteAvatarsByNames } from "@/hooks/useAthleteAvatars";
import { useCoachAvatarsByIds } from "@/hooks/useCoachAvatars";
import { useRole } from "@/hooks/useRole";
import { useDashboardData, type DashboardActivity } from "@/hooks/useDashboardData";
import { ROUTES } from "@/routes";
import { cn } from "@/lib/utils";
import { formatTimeSpan } from "@/utils/sessionFormatting";

const longDate = (iso: string) =>
  new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" }).format(
    new Date(iso)
  );

const shortDate = (iso: string) =>
  new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(iso));

const timeRange12h = (startIso: string, endIso: string) => formatTimeSpan(startIso, endIso);

const relativeDay = (iso: string) => {
  const diffMs = Date.now() - new Date(iso).getTime();
  if (diffMs < 0) {
    return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(
      new Date(iso)
    );
  }
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 60) return `${Math.max(minutes, 1)}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(
    new Date(iso)
  );
};

const initials = (name: string) =>
  (name || "?")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2);

const activityLabel = (a: DashboardActivity) =>
  a.label === "Booked session" ? `Booked session for ${shortDate(a.when)}` : a.label;

const isConversationUnread = (conv: ConversationWithParticipants, userId?: string | null) => {
  if (!conv.last_message_at) return false;
  const participants = Array.isArray(conv.conversation_participants)
    ? conv.conversation_participants
    : [];
  const mine = participants.find((p) => p.user_id === userId);
  if (!mine) return false;
  if (!mine.last_read_at) return true;
  return new Date(mine.last_read_at) < new Date(conv.last_message_at);
};

/** Figma card: #F7F7F0 on page #F1F1E6, 1px #EAEADF, 10px radius, 30×25 padding */
const DashCard = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => (
  <div
    className={cn(
      "flex w-full min-w-0 flex-col gap-5 rounded-[10px] border border-[#EAEADF] bg-[#F7F7F0] px-[25px] pb-[25px] pt-[30px]",
      className
    )}
  >
    {children}
  </div>
);

const TypeChip = ({ type }: { type: string }) => {
  const isGroup = type === "group";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[4px] border px-2 py-1 text-[14px] font-medium capitalize leading-[18px] tracking-[-0.42px]",
        isGroup
          ? "border-[#D0EBF2] bg-[#E7F4F8] text-[#1599BC]"
          : "border-[#CCDDF0] bg-[#E5EDF7] text-[#0054B4]"
      )}
    >
      {type}
    </span>
  );
};

const PhotoMark = ({
  name,
  photo,
  className,
}: {
  name: string;
  photo?: string | null;
  className?: string;
}) => (
  <span
    className={cn(
      "inline-flex items-center justify-center overflow-hidden bg-[#C1C1B8] font-medium leading-none text-[#484D56]",
      className
    )}
  >
    {photo ? <img src={photo} alt="" className="size-full object-cover" /> : initials(name)}
  </span>
);

const AttendingChip = ({
  names,
  photos,
  count,
}: {
  names: string[];
  photos?: Record<string, string | null>;
  count: number;
}) => (
  <span className="inline-flex items-center gap-[5px] rounded-[4px] border border-[#EAEADF] bg-[#F1F1E6] py-[3px] pl-[3px] pr-2">
    {names.length > 0 ? (
      <span className="flex items-center">
        {names.slice(0, 3).map((name, index) => (
          <PhotoMark
            key={`${name}-${index}`}
            name={name}
            photo={photos?.[name]}
            className={cn(
              "size-[22px] rounded-[3px] border border-[#F1F1E6] text-[8px]",
              index > 0 && "-ml-3"
            )}
          />
        ))}
      </span>
    ) : null}
    <span className="text-[14px] font-medium leading-[18px] tracking-[-0.42px] text-[#484D56]">
      +{count} attending
    </span>
  </span>
);

const PersonChip = ({ name, photo }: { name: string; photo?: string | null }) => (
  <span className="inline-flex items-center gap-[5px] rounded-[4px] border border-[#EAEADF] bg-[#F1F1E6] py-[3px] pl-[3px] pr-2">
    <PhotoMark name={name} photo={photo} className="size-[22px] rounded-[3px] text-[9px]" />
    <span className="text-[14px] font-medium leading-[18px] tracking-[-0.42px] text-[#484D56]">
      {name}
    </span>
  </span>
);

const StatTile = ({
  icon,
  value,
  label,
  sub,
}: {
  icon: ReactNode;
  value: string | number;
  label: string;
  sub: string;
}) => (
  <DashCard>
    <span className="inline-flex size-8 items-center justify-center rounded-[8px] bg-[#E5EDF7] text-[#0054B4]">
      {icon}
    </span>
    <div className="flex flex-col gap-[3px]">
      <p className="text-[32px] font-bold leading-[30px] tracking-[-0.96px] text-[#1A202C]">{value}</p>
      <p className="text-[16px] font-normal leading-[18px] tracking-[-0.48px] text-[#1A202C]">{label}</p>
      <p className="text-[12px] font-normal leading-[14px] tracking-[-0.36px] text-[#A3A6AB]">{sub}</p>
    </div>
  </DashCard>
);

const SessionRow = ({
  dateIso,
  endIso,
  type,
  personName,
  personPhoto,
  attendingNames = [],
  attendingCount = 0,
  namePhotos,
}: {
  dateIso: string;
  endIso: string;
  type: string;
  personName?: string | null;
  personPhoto?: string | null;
  attendingNames?: string[];
  attendingCount?: number;
  namePhotos?: Record<string, string | null>;
}) => (
  <div className="flex items-end justify-between gap-3 rounded-[10px] bg-[#F1F1E6] px-[15px] py-3">
    <div className="flex min-w-0 flex-col gap-[5px]">
      <p className="text-[16px] font-medium leading-[18px] tracking-[-0.8px] text-[#1A202C]">
        {longDate(dateIso)}
      </p>
      <p className="text-[16px] font-normal leading-[18px] tracking-[-0.48px] text-[#767980]">
        {timeRange12h(dateIso, endIso)}
      </p>
    </div>
    <div className="flex shrink-0 items-center gap-[5px]">
      {attendingCount > 1 ? (
        <AttendingChip names={attendingNames} photos={namePhotos} count={attendingCount} />
      ) : personName ? (
        <PersonChip name={personName} photo={personPhoto} />
      ) : null}
      <TypeChip type={type} />
    </div>
  </div>
);

const ViewAllLink = ({ to }: { to: string }) => (
  <Link
    to={to}
    className="text-[16px] font-medium leading-[18px] tracking-[-0.48px] text-[#0054B4]"
  >
    View all
  </Link>
);

const cardTitleClass =
  "text-[20px] font-medium leading-[18px] tracking-[-1px] text-[#1A202C]";

const primaryButtonClass =
  "inline-flex h-[34px] items-center justify-center whitespace-nowrap rounded-[8px] border border-[#6698D2] bg-[#0054B4] px-4 text-[16px] font-medium leading-[18px] tracking-[-0.48px] text-[#F1F1E6] transition-colors hover:bg-[#0054B4]/90";

const secondaryButtonClass =
  "inline-flex h-[34px] items-center justify-center whitespace-nowrap rounded-[8px] border border-[#EAEADF] bg-[#F4F4EB] px-4 text-[16px] font-medium leading-[18px] tracking-[-0.48px] text-[#1A202C] transition-colors hover:bg-[#EAEADF]";

const captionClass =
  "text-[12px] font-normal leading-[14px] tracking-[-0.36px] text-[#A3A6AB]";

const Dashboard = () => {
  const navigate = useNavigate();
  const { userName, user } = useAuth();
  const { isCoach } = useRole();
  const { isLoading, error, nextSession, upcoming, stats, activities, coaches, athletes } =
    useDashboardData();

  const conversationsQuery = useQuery({
    queryKey: ["dashboard-conversations", user?.id],
    queryFn: () => chatAPI.getUserConversations(user!.id, { limit: 2 }),
    enabled: Boolean(user?.id),
  });
  const conversations = conversationsQuery.data?.data ?? [];
  const unreadCount = conversations.filter((c) => isConversationUnread(c, user?.id)).length;

  const firstName = (userName || "").split(" ")[0] || "there";
  const attendingCount =
    nextSession && Array.isArray(nextSession.athleteNames)
      ? nextSession.athleteNames.length
      : 0;

  const athleteNames = useMemo(() => {
    const names = new Set<string>();
    const add = (list?: string[] | null) => list?.forEach((name) => name && names.add(name));
    add(nextSession?.athleteNames);
    upcoming.forEach((session) => add(session.athleteNames));
    athletes.forEach((athlete) => names.add(athlete.name));
    return Array.from(names).sort();
  }, [nextSession, upcoming, athletes]);

  const coachIds = useMemo(() => {
    const ids = new Set<string>();
    if (nextSession?.coachId) ids.add(nextSession.coachId);
    upcoming.forEach((session) => session.coachId && ids.add(session.coachId));
    coaches.forEach((coach) => coach.coachId && ids.add(coach.coachId));
    return Array.from(ids).sort();
  }, [nextSession, upcoming, coaches]);

  const { data: athletePhotos = {} } = useAthleteAvatarsByNames(
    isCoach && athleteNames.length ? athleteNames : undefined
  );
  const { data: coachPhotos = {} } = useCoachAvatarsByIds(
    !isCoach && coachIds.length ? coachIds : undefined
  );

  return (
    <div className="overflow-x-hidden px-4 md:px-10">
      <div className="mx-auto flex w-full max-w-[1000px] flex-col gap-6 pb-10">
      <header className="flex flex-col gap-[10px]">
        <h1 className="text-[32px] font-bold leading-[28px] tracking-[-1.6px] text-[#1A202C]">
          Welcome back, {firstName}
        </h1>
        <p className="text-[16px] font-normal leading-[18px] tracking-[-0.48px] text-[#767980]">
          {isCoach ? "Keep growing your coaching business." : "Keep building on your game."}
        </p>
      </header>

      <DashCard className="md:flex-row md:items-end md:justify-between">
        <div className="flex min-w-0 flex-col gap-5">
          <p className="text-[16px] font-medium leading-[18px] tracking-[-0.48px] text-[#767980]">
            Your next session
          </p>
          {nextSession ? (
            <div className="flex flex-col gap-[15px]">
              <div className="flex flex-col gap-[10px]">
                <p className="text-[28px] font-bold leading-[30px] tracking-[-1.4px] text-[#1A202C]">
                  {longDate(nextSession.start)}
                </p>
                <p className="text-[16px] font-normal leading-[18px] tracking-[-0.48px] text-[#767980]">
                  {timeRange12h(nextSession.start, nextSession.end)}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-[5px]">
                {isCoach && attendingCount > 1 ? (
                  <AttendingChip
                    names={nextSession.athleteNames || []}
                    photos={athletePhotos}
                    count={attendingCount}
                  />
                ) : null}
                {isCoach && attendingCount === 1 && nextSession.athleteNames?.[0] ? (
                  <PersonChip
                    name={nextSession.athleteNames[0]}
                    photo={athletePhotos[nextSession.athleteNames[0]]}
                  />
                ) : null}
                {!isCoach && nextSession.coachName ? (
                  <PersonChip
                    name={nextSession.coachName}
                    photo={coachPhotos[nextSession.coachId]}
                  />
                ) : null}
                <TypeChip type={nextSession.type} />
              </div>
            </div>
          ) : (
            <p className="text-[20px] font-medium leading-[18px] tracking-[-1px] text-[#1A202C]">
              {isLoading
                ? "Loading…"
                : error
                  ? "Couldn't load your sessions"
                  : "No upcoming sessions"}
            </p>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-[10px]">
          {nextSession ? (
            <>
              <button
                type="button"
                onClick={() => navigate(ROUTES.MY_SESSIONS)}
                className={primaryButtonClass}
              >
                View details
              </button>
              <button
                type="button"
                onClick={() => navigate(ROUTES.CHAT)}
                className={secondaryButtonClass}
              >
                {isCoach ? "Message athletes" : "Message coach"}
              </button>
            </>
          ) : !isCoach && !isLoading && !error ? (
            <button
              type="button"
              onClick={() => navigate(ROUTES.COACHES)}
              className={primaryButtonClass}
            >
              Find a coach
            </button>
          ) : null}
        </div>
      </DashCard>

      {/* Stats row */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        {isCoach ? (
          <>
            <StatTile
              icon={<Calendar className="size-4" strokeWidth={1.5} />}
              value={error ? "—" : stats.sessionsThisMonth}
              label="Sessions this month"
              sub="Completed"
            />
            <StatTile
              icon={<CircleDollarSign className="size-4" strokeWidth={1.5} />}
              value={
                error
                  ? "—"
                  : stats.revenueThisMonth == null
                    ? "—"
                    : `$${stats.revenueThisMonth.toLocaleString()}`
              }
              label="Revenue this month"
              sub={stats.revenueThisMonth == null ? "Not connected yet" : "Gross earnings"}
            />
            <StatTile
              icon={<Users className="size-4" strokeWidth={1.5} />}
              value={error ? "—" : stats.activeAthletes}
              label="Active athletes"
              sub="On your roster"
            />
          </>
        ) : (
          <>
            <StatTile
              icon={<Calendar className="size-4" strokeWidth={1.5} />}
              value={error ? "—" : stats.completedCount}
              label="Sessions completed"
              sub="All time"
            />
            <StatTile
              icon={<Clock className="size-4" strokeWidth={1.5} />}
              value={error ? "—" : stats.hoursTotal}
              label="Hours trained"
              sub="Total training time"
            />
            <StatTile
              icon={<UserRound className="size-4" strokeWidth={1.5} />}
              value={error ? "—" : stats.thirdStat}
              label="Coaches worked with"
              sub="All time"
            />
          </>
        )}
      </div>

      {/* Upcoming + Messages */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,573fr)_minmax(0,403fr)]">
        <DashCard className="h-full">
          <div className="flex items-end justify-between gap-3">
            <h2 className={cardTitleClass}>Upcoming sessions</h2>
            <ViewAllLink to={ROUTES.MY_SESSIONS} />
          </div>
          <div className="flex flex-col gap-[10px]">
            {upcoming.length ? (
              upcoming.map((s) => (
                <SessionRow
                  key={s.id}
                  dateIso={s.start}
                  endIso={s.end}
                  type={s.type}
                  personName={
                    isCoach
                      ? s.athleteNames?.length === 1
                        ? s.athleteNames[0]
                        : null
                      : s.coachName
                  }
                  personPhoto={
                    isCoach
                      ? s.athleteNames?.length === 1
                        ? athletePhotos[s.athleteNames[0]]
                        : null
                      : coachPhotos[s.coachId]
                  }
                  attendingNames={isCoach ? s.athleteNames || [] : []}
                  attendingCount={isCoach ? s.athleteNames?.length || 0 : 0}
                  namePhotos={athletePhotos}
                />
              ))
            ) : (
              <p className="text-[16px] font-normal leading-[18px] tracking-[-0.48px] text-[#767980]">
                {isLoading ? "Loading…" : error ? "Couldn't load sessions." : "Nothing scheduled yet."}
              </p>
            )}
          </div>
        </DashCard>

        <DashCard className="h-full gap-[30px]">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-[10px]">
              <h2 className={cardTitleClass}>Messages</h2>
              {unreadCount > 0 && (
                <span className="rounded-[4px] bg-[#0054B4] px-2 py-[3px] text-[12px] font-medium leading-[13px] tracking-[-0.36px] text-[#F1F1E6]">
                  {unreadCount} new
                </span>
              )}
            </div>
            <ViewAllLink to={ROUTES.CHAT} />
          </div>
          <div className="flex w-full flex-col gap-[10px]">
            {conversations.length ? (
              conversations.map((conv, index) => {
                const participants = Array.isArray(conv.conversation_participants)
                  ? conv.conversation_participants
                  : [];
                const other = participants.find((p) => p.user_id !== user?.id);
                const name = other?.user_profiles?.name || "Conversation";
                const unread = isConversationUnread(conv, user?.id);
                return (
                  <div key={conv.id} className="contents">
                    {index > 0 && <div className="h-px w-full bg-[#EAEADF]" />}
                    <button
                      type="button"
                      onClick={() => navigate(ROUTES.CHAT)}
                      className="flex w-full items-center justify-between gap-[10px] text-left"
                    >
                      <span className="flex min-w-0 items-center gap-[10px]">
                        <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-[8px] bg-[#C1C1B8] text-[14px] font-medium text-[#484D56]">
                          {other?.user_profiles?.image_url ? (
                            <img src={other.user_profiles.image_url} alt="" className="size-full object-cover" />
                          ) : (
                            initials(name)
                          )}
                        </span>
                        <span className="min-w-0">
                          <span className="flex items-center gap-[6px]">
                            <span className="truncate text-[16px] font-normal leading-[18px] tracking-[-0.48px] text-[#1A202C]">
                              {name}
                            </span>
                            {unread && (
                              <span className="size-[7.5px] shrink-0 rounded-full bg-[#0054B4]" />
                            )}
                          </span>
                          <span className={cn("block truncate", captionClass)}>
                            {conv.last_message_text || "No messages yet"}
                          </span>
                        </span>
                      </span>
                      {conv.last_message_at && (
                        <span className={cn("shrink-0", captionClass)}>
                          {relativeDay(conv.last_message_at)}
                        </span>
                      )}
                    </button>
                  </div>
                );
              })
            ) : (
              <p className="text-[16px] font-normal leading-[18px] tracking-[-0.48px] text-[#767980]">
                No conversations yet.
              </p>
            )}
          </div>
        </DashCard>
      </div>

      {/* Activities + coaches/athletes */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,659fr)_minmax(0,317fr)]">
        <DashCard className="h-full">
          <div className="flex items-end justify-between gap-3">
            <h2 className={cardTitleClass}>Recent activities</h2>
            <ViewAllLink to={ROUTES.MY_SESSIONS} />
          </div>
          <div className="flex flex-col gap-[10px]">
            {activities.length ? (
              activities.map((a) => (
                <div key={`${a.label}-${a.when}`} className="flex items-center justify-between gap-[10px]">
                  <span className="flex min-w-0 items-center gap-[10px]">
                    <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-[8px] bg-[#EAEADF] text-[#767980]">
                      <Activity className="size-4" strokeWidth={1.5} />
                    </span>
                    <p className="truncate text-[12px] font-normal leading-[14px] tracking-[-0.36px] text-[#767980]">
                      {activityLabel(a)}
                    </p>
                  </span>
                  <span className={cn("shrink-0", captionClass)}>{relativeDay(a.when)}</span>
                </div>
              ))
            ) : (
              <p className="text-[16px] font-normal leading-[18px] tracking-[-0.48px] text-[#767980]">
                {error ? "Couldn't load activity." : "No activity yet."}
              </p>
            )}
          </div>
        </DashCard>

        {isCoach ? (
          <DashCard className="h-full">
            <h2 className={cardTitleClass}>My athletes</h2>
            <div className="flex flex-col gap-3">
              {athletes.length ? (
                athletes.map((a) => (
                  <div key={a.name} className="flex items-center gap-[10px]">
                    <PhotoMark
                      name={a.name}
                      photo={athletePhotos[a.name]}
                      className="size-10 rounded-[8px] text-[14px]"
                    />
                    <div>
                      <p className="text-[14px] font-normal leading-[18px] tracking-[-0.7px] text-[#1A202C]">
                        {a.name}
                      </p>
                      <p className={cn("capitalize", captionClass)}>{a.type || "Athlete"}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-[16px] font-normal leading-[18px] tracking-[-0.48px] text-[#767980]">
                  Athletes appear here after they book you.
                </p>
              )}
            </div>
          </DashCard>
        ) : (
          <DashCard className="h-full">
            <div className="flex items-center justify-between">
              <h2 className={cardTitleClass}>Your coaches</h2>
              <Link to={ROUTES.MY_COACHES} className="text-[14px] leading-[18px] tracking-[-0.03em] text-[#0054B4]">
                View all
              </Link>
            </div>
            <div className="flex flex-col gap-3">
              {coaches.length ? (
                coaches.map((c) => (
                  <div key={c.coachId} className="flex items-center gap-[10px]">
                    <PhotoMark
                      name={c.coachName || "?"}
                      photo={coachPhotos[c.coachId]}
                      className="size-10 rounded-[8px] text-[14px]"
                    />
                    <div>
                      <p className="text-[14px] font-normal leading-[18px] tracking-[-0.7px] text-[#1A202C]">
                        {c.coachName || "Coach"}
                      </p>
                      <p className={cn("capitalize", captionClass)}>{c.type || "Coach"}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-[16px] font-normal leading-[18px] tracking-[-0.48px] text-[#767980]">
                  <Link to={ROUTES.COACHES} className="text-[#0054B4]">
                    Browse coaches
                  </Link>{" "}
                  to get started.
                </p>
              )}
            </div>
          </DashCard>
        )}
      </div>
      </div>
    </div>
  );
};

export default Dashboard;
