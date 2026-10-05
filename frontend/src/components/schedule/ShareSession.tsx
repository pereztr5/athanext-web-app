/**
 * "Who should book it?" (ATH-71): send a session to chosen athletes as a message, post it in
 * the coach's community channel, or share its booking link anywhere.
 */
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, MessageCircle, MessageSquare, Search, Users } from "lucide-react";
import { scheduleAPI, type ScheduleSession } from "@/api/schedule";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { formatClock, formatDayISO, sessionLink, sessionStart } from "@/utils/schedule";
import { getZonedISODate } from "@/utils/dateHelpers";
import { choice, input, label, meta, primaryButton } from "./styles";

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");

export const ShareSession = ({
  sessions,
  coachId,
  coachName,
  slug,
  timeZone,
  onDone,
}: {
  /** One session, or every date of a repeating one (the link points at the first). */
  sessions: ScheduleSession[];
  coachId: string;
  coachName: string;
  slug: string | null;
  timeZone: string;
  onDone: (sent: boolean) => void;
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const first = sessions[0];
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [toChannel, setToChannel] = useState(false);

  const athletesQuery = useQuery({ queryKey: ["schedule-athlete-options"], queryFn: () => scheduleAPI.athleteOptions() });
  const athletes = useMemo(() => athletesQuery.data ?? [], [athletesQuery.data]);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (q ? athletes.filter((a) => a.fullName.toLowerCase().includes(q)) : athletes).slice(0, 10);
  }, [athletes, query]);

  const start = sessionStart(first);
  const day = getZonedISODate(start, timeZone);
  const when = `${formatDayISO(day, { weekday: "short", month: "short", day: "numeric" })} at ${formatClock(start, timeZone)}`;
  const link = sessionLink(slug, coachId, first.id);
  const group = first.sessionType === "group";
  const what = group ? first.sessionName : "a 1-on-1 session";
  const message = `${coachName.split(" ")[0] || "Your coach"} offered ${what} on ${when}${
    sessions.length > 1 ? `, weekly for ${sessions.length} weeks` : ""
  }. Book it here: ${link}`;

  const send = useMutation({
    mutationFn: () => scheduleAPI.offerSession(sessions.map((s) => s.id), picked, toChannel, message),
    onSuccess: ({ sent, channel }) => {
      const parts = [sent ? `${sent} athlete${sent === 1 ? "" : "s"}` : null, channel ? "your group chat" : null].filter(Boolean);
      toast({ title: `Sent to ${parts.join(" and ")}` });
      queryClient.invalidateQueries({ queryKey: ["coach-schedule"] });
      onDone(true);
    },
    onError: (error: unknown) =>
      toast({
        title: "Couldn't send it",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      }),
  });

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      toast({ title: "Link copied" });
    } catch {
      toast({ title: "Couldn't copy", description: link });
    }
  };

  const names = athletes.filter((a) => picked.includes(a.athleteId)).map((a) => a.fullName.split(" ")[0]);
  const targets = [...names, ...(toChannel ? ["your group chat"] : [])];

  return (
    <div className="flex flex-col gap-4">
      <span className={label}>Send to athletes</span>
      <label className="relative flex items-center">
        <Search className="pointer-events-none absolute left-3 size-4 text-[#A3A6AB]" strokeWidth={1.5} aria-hidden="true" />
        <input
          className={cn(input, "pl-9")}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search your athletes"
          aria-label="Search your athletes"
          autoComplete="off"
        />
      </label>
      {athletesQuery.isLoading ? (
        <p className={meta}>Loading your athletes…</p>
      ) : shown.length ? (
        <div className="flex flex-wrap gap-2">
          {shown.map((athlete) => {
            const on = picked.includes(athlete.athleteId);
            return (
              <button
                key={athlete.athleteId}
                type="button"
                aria-pressed={on}
                className={choice(on)}
                onClick={() =>
                  setPicked((current) =>
                    on ? current.filter((id) => id !== athlete.athleteId) : [...current, athlete.athleteId]
                  )
                }
              >
                <span className="flex size-[22px] items-center justify-center rounded-full bg-[#D9D9CF] text-[10px] font-semibold text-[#484D56]">
                  {initials(athlete.fullName)}
                </span>
                {athlete.fullName.split(" ")[0]}
                {on ? <Check strokeWidth={1.5} aria-hidden="true" /> : null}
              </button>
            );
          })}
        </div>
      ) : (
        <p className={meta}>
          {query ? "No athletes match." : "Athletes who book with you or join from your invites show up here."}
        </p>
      )}
      {picked.length ? (
        <p className={meta}>
          {group ? "" : "First to book gets it. "}
          {names.join(" and ")} {names.length > 1 ? "get" : "gets"} a message with the booking link.
        </p>
      ) : null}

      <span className={label}>Or share anywhere</span>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <a
          className={choice(false)}
          href={`https://wa.me/?text=${encodeURIComponent(message)}`}
          target="_blank"
          rel="noreferrer"
        >
          <MessageCircle strokeWidth={1.5} aria-hidden="true" />
          WhatsApp
        </a>
        <a className={choice(false)} href={`sms:?&body=${encodeURIComponent(message)}`}>
          <MessageSquare strokeWidth={1.5} aria-hidden="true" />
          Text
        </a>
        <button type="button" className={choice(toChannel)} aria-pressed={toChannel} onClick={() => setToChannel((v) => !v)}>
          <Users strokeWidth={1.5} aria-hidden="true" />
          Group chat
        </button>
        <button type="button" className={choice(false)} onClick={copy}>
          <Copy strokeWidth={1.5} aria-hidden="true" />
          Copy link
        </button>
      </div>

      <button
        type="button"
        className={cn(primaryButton, "h-[40px] w-full")}
        disabled={send.isPending}
        onClick={() => (targets.length ? send.mutate() : onDone(false))}
      >
        {targets.length ? `Send to ${targets.join(", ").replace(/, ([^,]*)$/, " and $1")}` : "Done"}
      </button>
    </div>
  );
};
