/**
 * "Who should book it?" (ATH-71, Working Copy 2 coach7.js shareModal): send a session to chosen
 * athletes as a message, post it in any of the coach's group chats, share its booking link
 * anywhere, or (1-on-1) book it straight for an athlete.
 */
import { errorMessage } from "@/utils/errorMessage";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, CircleCheck, Copy, Search, UserCheck, Users } from "@/components/icons";
import { chatAPI } from "@/api";
import { rosterAPI } from "@/api/roster";
import { scheduleAPI, type ScheduleSession } from "@/api/schedule";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { money } from "@/utils/booking";
import { formatClock, formatDayISO, liveBookings, plural, sessionLink, sessionStart } from "@/utils/schedule";
import { getZonedISODate } from "@/utils/dateHelpers";
import { AssignStep } from "./create/AssignStep";
import { chip, sheetBody, sheetButton, sheetFooter, shareTile } from "./create/classes";
import { Avatar, ReadyCard } from "./create/parts";
import { input, label, meta, primaryButton, textButton } from "./styles";

/** "Ava, Ben and #U14 group" */
const joinNames = (names: string[]) => names.join(", ").replace(/, ([^,]*)$/, " and $1");

export const ShareSession = ({
  sessions,
  coachId,
  coachName,
  slug,
  timeZone,
  onDone,
  sheet = false,
  onStepChange,
}: {
  /** One session, or every date of a repeating one (the link points at the first). */
  sessions: ScheduleSession[];
  coachId: string;
  coachName: string;
  slug: string | null;
  timeZone: string;
  onDone: (sent: boolean) => void;
  /** Lay out as a sheet body plus a footer with the Send button (Create session). */
  sheet?: boolean;
  /** Tells the parent when "Book it for" opens, to change the title. */
  onStepChange?: (step: "share" | "assign") => void;
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const first = sessions[0];
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [chatsOpen, setChatsOpen] = useState(false);
  const [chosenChannels, setChosenChannels] = useState<string[]>([]);
  const [step, setStep] = useState<"share" | "assign">("share");

  const athletesQuery = useQuery({ queryKey: ["schedule-athlete-options"], queryFn: () => scheduleAPI.athleteOptions() });
  // Same query as My athletes, for photos.
  const rosterQuery = useQuery({ queryKey: ["coach-roster"], queryFn: () => rosterAPI.roster() });
  const channelsQuery = useQuery({
    queryKey: ["coach-channels", coachId, "owner"],
    queryFn: () => chatAPI.getCoachChannels(coachId),
    staleTime: 60_000,
  });
  const athletes = useMemo(() => athletesQuery.data ?? [], [athletesQuery.data]);
  const photos = useMemo(() => new Map((rosterQuery.data ?? []).map((a) => [a.id, a.imageUrl])), [rosterQuery.data]);
  const channels = useMemo(() => channelsQuery.data ?? [], [channelsQuery.data]);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (q ? athletes.filter((a) => a.fullName.toLowerCase().includes(q)) : athletes).slice(0, 10);
  }, [athletes, query]);

  const start = sessionStart(first);
  const day = getZonedISODate(start, timeZone);
  const clock = formatClock(start, timeZone);
  const shortDay = formatDayISO(day, { weekday: "short", month: "short", day: "numeric" });
  const link = sessionLink(slug, coachId, first.id);
  const group = first.sessionType === "group";
  const where = first.location === "online" ? "Video call" : first.place || "In person";
  const what = group ? first.sessionName : "a 1-on-1 session";
  const message = `${coachName.split(" ")[0] || "Your coach"} offered ${what} on ${shortDay} at ${clock}${
    sessions.length > 1 ? `, weekly for ${sessions.length} weeks` : ""
  }. Book it here: ${link}`;

  const chosen = channels.filter((c) => chosenChannels.includes(c.conversationId));
  const names = athletes.filter((a) => picked.includes(a.athleteId)).map((a) => a.fullName.split(" ")[0]);
  const targets = [...names, ...chosen.map((c) => `#${c.title || "group chat"}`)];

  const send = useMutation({
    mutationFn: async () => {
      const ids = sessions.map((s) => s.id);
      if (!chosen.length) {
        const { sent } = await scheduleAPI.offerSession(ids, picked, false, message);
        return { sent, channels: 0 };
      }
      // The main channel alone still works through the older RPC.
      if (chosen.length === 1 && chosen[0].isMain) {
        const { sent, channel } = await scheduleAPI.offerSession(ids, picked, true, message);
        return { sent, channels: channel ? 1 : 0 };
      }
      return scheduleAPI.shareSession(ids, picked, chosen.map((c) => c.conversationId), message);
    },
    onSuccess: () => {
      toast({ title: `Sent to ${joinNames(targets)}` });
      queryClient.invalidateQueries({ queryKey: ["coach-schedule"] });
      onDone(true);
    },
    onError: (error: unknown) =>
      toast({
        title: "Couldn't send it",
        description: errorMessage(error, "Try again."),
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

  const goTo = (next: "share" | "assign") => {
    setStep(next);
    setQuery("");
    onStepChange?.(next);
  };

  if (step === "assign") {
    return (
      <AssignStep
        session={first}
        coachId={coachId}
        coachName={coachName}
        slug={slug}
        timeZone={timeZone}
        sheet={sheet}
        onBack={() => goTo("share")}
        onDone={() => onDone(true)}
      />
    );
  }

  const ready = `${shortDay} · ${clock}${sessions.length > 1 ? ` · weekly, ${plural(sessions.length, "date")}` : ""}`;
  const readyCaption = group
    ? `${first.sessionName} · ${plural(first.capacity, "spot")} · ${money(first.price)} per athlete · ${where}`
    : `1-on-1 · ${first.durationMinutes} min · ${money(first.price)} · ${where}`;

  const body = (
    <>
      <ReadyCard icon={<CircleCheck strokeWidth={1.5} aria-hidden="true" />} title={ready} caption={readyCaption} />

      <span className={label}>Send to athletes</span>
      <label className="relative flex items-center">
        <Search className="pointer-events-none absolute left-3 size-4 text-dark-300" strokeWidth={1.5} aria-hidden="true" />
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
        <div className="flex flex-wrap gap-1.5">
          {shown.map((athlete) => {
            const on = picked.includes(athlete.athleteId);
            return (
              <button
                key={athlete.athleteId}
                type="button"
                aria-pressed={on}
                className={cn(chip(on), "pl-1")}
                onClick={() =>
                  setPicked((current) =>
                    on ? current.filter((id) => id !== athlete.athleteId) : [...current, athlete.athleteId]
                  )
                }
              >
                <Avatar name={athlete.fullName} imageUrl={photos.get(athlete.athleteId)} />
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
          {joinNames(names)} {names.length > 1 || group ? "get" : "gets"} a message with the booking link.
        </p>
      ) : null}

      <span className={label}>Or share anywhere</span>
      <div className="grid grid-cols-2 gap-1.5">
        <button type="button" className={shareTile(chatsOpen)} aria-pressed={chatsOpen} aria-expanded={chatsOpen} onClick={() => setChatsOpen((v) => !v)}>
          <Users strokeWidth={1.5} aria-hidden="true" />
          Group chat
        </button>
        <button type="button" className={shareTile()} onClick={copy}>
          <Copy strokeWidth={1.5} aria-hidden="true" />
          Copy link
        </button>
      </div>
      {chatsOpen ? (
        channelsQuery.isLoading ? (
          <p className={meta}>Loading your group chats…</p>
        ) : channels.length ? (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Group chats">
            {channels.map((c) => {
              const on = chosenChannels.includes(c.conversationId);
              return (
                <button
                  key={c.conversationId}
                  type="button"
                  aria-pressed={on}
                  className={chip(on)}
                  onClick={() =>
                    setChosenChannels((current) =>
                      on ? current.filter((id) => id !== c.conversationId) : [...current, c.conversationId]
                    )
                  }
                >
                  #{c.title || "group chat"}
                  {on ? <Check strokeWidth={1.5} aria-hidden="true" /> : null}
                </button>
              );
            })}
          </div>
        ) : (
          <p className={meta}>You don't have a group chat yet. Start one from Messages.</p>
        )
      ) : null}

      {!group && !liveBookings(first).length ? (
        <button type="button" className={cn(textButton, "self-start")} onClick={() => goTo("assign")}>
          <UserCheck strokeWidth={1.5} aria-hidden="true" />
          Already agreed? Book it for an athlete now
        </button>
      ) : null}
    </>
  );

  const button = (
    <button
      type="button"
      className={cn(primaryButton, sheet ? sheetButton : "h-[40px] w-full")}
      disabled={send.isPending}
      onClick={() => (targets.length ? send.mutate() : onDone(false))}
    >
      {send.isPending ? "Sending…" : targets.length ? `Send to ${joinNames(targets)}` : "Done"}
    </button>
  );

  return sheet ? (
    <>
      <div className={sheetBody}>{body}</div>
      <div className={sheetFooter}>{button}</div>
    </>
  ) : (
    <div className="flex flex-col gap-4">
      {body}
      {button}
    </div>
  );
};
