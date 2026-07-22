import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Activity, Calendar, ClipboardList, Clock, User, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { chatAPI, type ConversationWithParticipants } from "@/api/chat";
import { useAuth } from "@/contexts/AuthContext";
import { useRole } from "@/hooks/useRole";
import { useDashboardData, type DashboardActivity } from "@/hooks/useDashboardData";
import { ROUTES } from "@/routes";

const longDate = (iso: string) =>
  new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" }).format(
    new Date(iso)
  );

const shortDate = (iso: string) =>
  new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(iso));

const timeRange12h = (startIso: string, endIso: string) => {
  const fmt = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });
  return `${fmt.format(new Date(startIso))} – ${fmt.format(new Date(endIso))}`;
};

const relativeDay = (iso: string) => {
  const days = Math.round((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return longDate(iso);
  if (days === 1) return "1d";
  if (days < 30) return `${days}d`;
  return longDate(iso);
};

const initials = (name: string) =>
  (name || "?").split(" ").map((w) => w[0]).join("").slice(0, 2);

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

const TypeChip = ({ type }: { type: string }) => {
  const isGroup = type === "group";
  const Icon = isGroup ? Users : User;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
        isGroup ? "bg-cyan-100 text-cyan-700" : "bg-sidebar-primary/10 text-sidebar-primary"
      }`}
    >
      <Icon className="h-3 w-3" />
      {type}
    </span>
  );
};

const CoachChip = ({ name }: { name: string }) => (
  <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
    <ClipboardList className="h-3 w-3" />
    {name}
  </span>
);

const SessionRow = ({ dateIso, endIso, type, coachName }: {
  dateIso: string; endIso: string; type: string; coachName?: string | null;
}) => (
  <div className="rounded-lg bg-app-background px-4 py-3">
    <p className="font-semibold">{longDate(dateIso)}</p>
    <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
      <span>{timeRange12h(dateIso, endIso)}</span>
      <TypeChip type={type} />
      {coachName && <CoachChip name={coachName} />}
    </div>
  </div>
);

const StatTile = ({ icon: Icon, value, label, sub }: {
  icon: typeof Calendar; value: string | number; label: string; sub: string;
}) => (
  <Card className="rounded-xl border-sidebar-border shadow-none">
    <CardContent className="p-6">
      <span className="inline-flex rounded-lg bg-sidebar-primary/10 p-2.5">
        <Icon className="h-5 w-5 text-sidebar-primary" />
      </span>
      <p className="mt-4 text-3xl font-bold">{value}</p>
      <p className="font-medium">{label}</p>
      <p className="text-sm text-muted-foreground">{sub}</p>
    </CardContent>
  </Card>
);

const Dashboard = () => {
  const navigate = useNavigate();
  const { userName, userProfile, user } = useAuth();
  const { isCoach } = useRole();
  const { isLoading, nextSession, upcoming, stats, activities, coaches } = useDashboardData();

  const conversationsQuery = useQuery({
    queryKey: ["dashboard-conversations", user?.id],
    queryFn: () => chatAPI.getUserConversations(user!.id, { limit: 2 }),
    enabled: Boolean(user?.id),
  });
  const conversations = conversationsQuery.data?.data ?? [];
  const unreadCount = conversations.filter((c) => isConversationUnread(c, user?.id)).length;

  const firstName = (userName || "").split(" ")[0] || "there";
  const sport = userProfile?.sport ? `${String(userProfile.sport).toLowerCase()} ` : "";

  return (
    <div className="mx-auto max-w-6xl px-4 pt-8 pb-16 md:px-8">
      <h1 className="text-3xl font-bold">Welcome back, {firstName}</h1>
      <p className="mt-1 text-muted-foreground">
        {isCoach
          ? "Here's what's happening with your coaching."
          : `Here's what's happening with your ${sport}training.`}
      </p>

      <Card className="mt-6 rounded-xl border-sidebar-border shadow-none">
        <CardContent className="flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between">
          {nextSession ? (
            <>
              <div>
                <p className="text-sm text-muted-foreground">Your next session</p>
                <p className="mt-1 text-3xl font-bold">{longDate(nextSession.start)}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                  <span>{timeRange12h(nextSession.start, nextSession.end)}</span>
                  <TypeChip type={nextSession.type} />
                  {nextSession.coachName && <CoachChip name={nextSession.coachName} />}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Button onClick={() => navigate(ROUTES.MY_SESSIONS)}>View details</Button>
                <Button variant="outline" onClick={() => navigate(ROUTES.CHAT)}>
                  {isCoach ? "Messages" : "Message coach"}
                </Button>
              </div>
            </>
          ) : (
            <>
              <div>
                <p className="text-sm text-muted-foreground">Your next session</p>
                <p className="mt-1 text-xl font-semibold">
                  {isLoading ? "Loading…" : "No upcoming sessions"}
                </p>
              </div>
              {!isCoach && !isLoading && (
                <Button onClick={() => navigate(ROUTES.COACHES)}>Find a coach</Button>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <StatTile icon={Calendar} value={stats.completedCount}
          label={isCoach ? "Sessions taught" : "Sessions completed"} sub="All time" />
        <StatTile icon={Clock} value={stats.hoursTotal}
          label={isCoach ? "Hours coached" : "Hours trained"} sub="Total training time" />
        <StatTile icon={isCoach ? Calendar : User} value={stats.thirdStat}
          label={isCoach ? "Upcoming sessions" : "Coaches worked with"}
          sub={isCoach ? "On the calendar" : "All time"} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="rounded-xl border-sidebar-border shadow-none lg:col-span-2">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Upcoming sessions</h2>
              <Link to={ROUTES.MY_SESSIONS} className="text-sm font-medium text-sidebar-primary">
                View all
              </Link>
            </div>
            <div className="mt-4 space-y-3">
              {upcoming.length ? (
                upcoming.map((s) => (
                  <SessionRow key={s.id} dateIso={s.start} endIso={s.end} type={s.type}
                    coachName={isCoach ? null : s.coachName} />
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  {isLoading ? "Loading…" : "Nothing scheduled yet."}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl border-sidebar-border shadow-none">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold">Messages</h2>
                {unreadCount > 0 && (
                  <span className="rounded-full bg-sidebar-primary px-2 py-0.5 text-xs font-medium text-white">
                    {unreadCount} new
                  </span>
                )}
              </div>
              <Link to={ROUTES.CHAT} className="text-sm font-medium text-sidebar-primary">
                View all
              </Link>
            </div>
            <div className="mt-4 space-y-4">
              {conversations.length ? (
                conversations.map((conv) => {
                  const participants = Array.isArray(conv.conversation_participants)
                    ? conv.conversation_participants
                    : [];
                  const other = participants.find((p) => p.user_id !== user?.id);
                  const name = other?.user_profiles?.name || "Conversation";
                  const unread = isConversationUnread(conv, user?.id);
                  return (
                    <div key={conv.id} className="flex items-start gap-3">
                      <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-200 text-sm font-semibold text-gray-700">
                        {initials(name)}
                        {unread && (
                          <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-sidebar-primary" />
                        )}
                      </span>
                      <div className="flex min-w-0 flex-1 items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{name}</p>
                          <p className="truncate text-sm text-muted-foreground">
                            {conv.last_message_text || "No messages yet"}
                          </p>
                        </div>
                        {conv.last_message_at && (
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {relativeDay(conv.last_message_at)}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-muted-foreground">No conversations yet.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className={`rounded-xl border-sidebar-border shadow-none ${isCoach ? "lg:col-span-3" : "lg:col-span-2"}`}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Recent activities</h2>
              <Link to={ROUTES.MY_SESSIONS} className="text-sm font-medium text-sidebar-primary">
                View all
              </Link>
            </div>
            <div className="mt-4 space-y-3">
              {activities.length ? (
                activities.map((a) => (
                  <div key={`${a.label}-${a.when}`} className="flex items-center gap-3">
                    <span className="inline-flex shrink-0 rounded-md bg-sidebar-primary/10 p-1.5">
                      <Activity className="h-4 w-4 text-sidebar-primary" />
                    </span>
                    <p className="text-sm">{activityLabel(a)}</p>
                    <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                      {relativeDay(a.when)}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No activity yet.</p>
              )}
            </div>
          </CardContent>
        </Card>

        {!isCoach && (
          <Card className="rounded-xl border-sidebar-border shadow-none">
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold">Your coaches</h2>
              <div className="mt-4 space-y-3">
                {coaches.length ? (
                  coaches.map((c) => (
                    <div key={c.coachId} className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-sidebar-primary text-sm font-semibold text-white">
                        {initials(c.coachName || "?")}
                      </span>
                      <div>
                        <p className="font-medium">{c.coachName || "Coach"}</p>
                        <p className="text-xs text-muted-foreground capitalize">{c.type}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">
                    <Link to={ROUTES.COACHES} className="text-sidebar-primary">Browse coaches</Link> to get started.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
