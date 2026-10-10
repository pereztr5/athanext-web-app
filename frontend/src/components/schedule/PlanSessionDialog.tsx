/**
 * Add or edit one draft group session in the week planner (ATH-72, Working Copy 2 coach6.js
 * `pses`). A time that overlaps another session is still refused, so the coach is never booked
 * twice at once; overlapping a Google Calendar busy time saves with a heads-up.
 */
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Minus, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { scheduleAPI, type BusyBlock, type ScheduleRules, type ScheduleSession, type SessionPosition } from "@/api/schedule";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { DEFAULT_PILLARS } from "@/utils/pillarIcons";
import { getZonedISODate, zonedWallTimeToUtc } from "@/utils/dateHelpers";
import {
  ALL_START_MINUTES,
  formatDayISO,
  formatMinutes,
  minutesInZone,
  minutesToHHMM,
  sessionStart,
  viewerToEastern,
} from "@/utils/schedule";
import { sheetBody, sheetContent, sheetFooter, sheetHeader, sheetTitle } from "./create/classes";
import { dialogContent, iconButton, input, label, meta, primaryButton, secondaryButton, textButton } from "./styles";

const LENGTHS = [45, 60, 75, 90, 120];
const LEVELS = ["All levels", "Beginners welcome", "Club and up"];
const VIDEO = "Video call";
const stepButton = cn(iconButton, "size-[30px] bg-[#F7F7F0]");
const field = "flex min-w-0 flex-col gap-1.5";
/** `.fg2`: two columns, one on phone. */
const pair = "grid grid-cols-1 gap-4 md:grid-cols-2";

export const PlanSessionDialog = ({
  open,
  onOpenChange,
  session,
  days,
  defaultDay,
  dayMode = false,
  timeZone,
  rules,
  busy = [],
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The draft being edited, or null to add one. */
  session: ScheduleSession | null;
  /** Days in the plan that haven't passed, in the coach's zone. */
  days: string[];
  defaultDay: string;
  /** Planning a single day: the day is fixed. */
  dayMode?: boolean;
  timeZone: string;
  rules: ScheduleRules;
  /** Google Calendar busy times, to warn about after saving. */
  busy?: BusyBlock[];
}) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const places = useMemo(() => [...(rules.locations.length ? rules.locations : ["In person"]), VIDEO], [rules.locations]);

  const [title, setTitle] = useState("");
  const [day, setDay] = useState(defaultDay);
  const [start, setStart] = useState(17 * 60);
  const [length, setLength] = useState(60);
  const [place, setPlace] = useState(places[0]);
  const [price, setPrice] = useState("35");
  const [spots, setSpots] = useState(8);
  const [more, setMore] = useState(false);
  const [pillar, setPillar] = useState("");
  const [position, setPosition] = useState<SessionPosition | "">("Field player");
  const [ages, setAges] = useState("");
  const [level, setLevel] = useState(LEVELS[0]);
  const [about, setAbout] = useState("");
  const [bring, setBring] = useState("Ball, water, shin guards");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (session) {
      const startAt = sessionStart(session);
      setTitle(session.sessionName);
      setDay(getZonedISODate(startAt, timeZone));
      setStart(minutesInZone(startAt, timeZone));
      setLength(session.durationMinutes);
      setPlace(session.location === "online" ? VIDEO : session.place || places[0]);
      setPrice(String(session.price));
      setSpots(session.capacity);
      setPillar(session.pillar ?? "");
      setPosition(session.position ?? "");
      setAges(session.details.ages ?? "");
      setLevel(session.details.level ?? LEVELS[0]);
      setAbout((session.details.about ?? []).join("\n"));
      setBring(session.details.bring ?? "");
      setMore(Boolean(session.pillar || session.details.about?.length || session.details.ages));
    } else {
      setTitle("");
      setDay(defaultDay);
      setStart(17 * 60);
      setLength(60);
      setPlace(places[0]);
      setPrice("35");
      setSpots(8);
      setPillar("");
      setPosition("Field player");
      setAges("");
      setLevel(LEVELS[0]);
      setAbout("");
      setBring("Ball, water, shin guards");
      setMore(false);
    }
  }, [open, session, defaultDay, timeZone, places]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["coach-schedule"] });
  const details = () => ({
    level,
    ...(ages.trim() ? { ages: ages.trim() } : {}),
    ...(about.trim() ? { about: about.split("\n").map((x) => x.trim()).filter(Boolean) } : {}),
    ...(bring.trim() ? { bring: bring.trim() } : {}),
  });
  const where = () => {
    const online = place === VIDEO;
    return { location: online ? ("online" as const) : ("in-person" as const), place: online || place === "In person" ? null : place };
  };

  const overlapsBusy = () => {
    const from = zonedWallTimeToUtc(day, `${minutesToHHMM(start)}:00`, timeZone)?.getTime() ?? 0;
    const to = from + length * 60_000;
    return busy.some((b) => new Date(b.startsAt).getTime() < to && from < new Date(b.endsAt).getTime());
  };

  const save = useMutation({
    mutationFn: async () => {
      const at = viewerToEastern(day, start, timeZone);
      if (session) {
        await scheduleAPI.updateDraft(session.id, {
          date: at.date,
          start: at.start,
          durationMinutes: length,
          sessionName: title.trim(),
          price: Number(price),
          capacity: spots,
          ...where(),
          pillar: pillar || null,
          position: position || null,
          details: details(),
        });
        return;
      }
      const result = await scheduleAPI.createSessions({
        sessionType: "group",
        visibility: "open",
        times: [at],
        repeat: "none",
        durationMinutes: length,
        sessionName: title.trim(),
        price: Number(price),
        capacity: spots,
        ...where(),
        pillar: pillar || null,
        position: position || null,
        details: details(),
        isDraft: true,
      });
      if (!result.created.length) throw new Error("That time overlaps another session. Pick another time.");
    },
    onSuccess: () => {
      refresh();
      toast({
        title: overlapsBusy()
          ? `Saved. Heads up: ${formatDayISO(day, { weekday: "short", month: "short", day: "numeric" })} at ${formatMinutes(start)} overlaps a busy time`
          : session
            ? "Session saved"
            : "Session added to the draft",
      });
      onOpenChange(false);
    },
    onError: (err: unknown) => setError(err instanceof Error ? err.message : "Couldn't save the session."),
  });

  const remove = useMutation({
    mutationFn: () => scheduleAPI.removeSession(session!.id),
    onSuccess: () => {
      refresh();
      toast({ title: "Session removed" });
      onOpenChange(false);
    },
    onError: (err: unknown) => setError(err instanceof Error ? err.message : "Couldn't remove the session."),
  });

  const submit = () => {
    setError(null);
    if (!title.trim()) return setError("Give it a title.");
    if (price.trim() === "" || !(Number(price) >= 0)) return setError("Add a price.");
    save.mutate();
  };

  const dayOptions = days.includes(day) ? days : [day, ...days];
  const placeOptions = places.includes(place) ? places : [place, ...places];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(dialogContent, sheetContent)} aria-describedby={undefined}>
        <DialogHeader className={sheetHeader}>
          <DialogTitle className={sheetTitle}>{session ? "Edit session" : "Add session"}</DialogTitle>
        </DialogHeader>
        <div className={sheetBody}>
          <label className={field}>
            <span className={label}>Title</span>
            <input className={input} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="For example, Finishing clinic" />
          </label>
          <div className={pair}>
            {dayMode ? (
              <div className={field}>
                <span className={label}>Day</span>
                <span className={cn(input, "flex items-center text-[#484D56]")}>
                  {formatDayISO(day, { weekday: "short", month: "short", day: "numeric" })}
                </span>
              </div>
            ) : (
              <label className={field}>
                <span className={label}>Day</span>
                <select className={input} value={day} onChange={(e) => setDay(e.target.value)}>
                  {dayOptions.map((d) => (
                    <option key={d} value={d}>
                      {formatDayISO(d, { weekday: "short", month: "short", day: "numeric" })}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className={field}>
              <span className={label}>Start</span>
              <select className={input} value={start} onChange={(e) => setStart(Number(e.target.value))}>
                {ALL_START_MINUTES.map((m) => (
                  <option key={m} value={m}>
                    {formatMinutes(m)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className={pair}>
            <label className={field}>
              <span className={label}>Length</span>
              <select className={input} value={length} onChange={(e) => setLength(Number(e.target.value))}>
                {LENGTHS.map((l) => (
                  <option key={l} value={l}>
                    {l === 120 ? "2 hours" : `${l} min`}
                  </option>
                ))}
              </select>
            </label>
            <label className={field}>
              <span className={label}>Location</span>
              <select className={input} value={place} onChange={(e) => setPlace(e.target.value)}>
                {placeOptions.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className={pair}>
            <label className={field}>
              <span className={label}>Price per athlete</span>
              <span className="flex h-[38px] items-center rounded-[8px] bg-[#F1F1E6] focus-within:ring-2 focus-within:ring-[#6698D2]">
                <span className="pl-3 text-[14px] text-[#767980]" aria-hidden="true">$</span>
                <input
                  className="h-full w-full min-w-0 bg-transparent pl-1 pr-3 text-[14px] text-[#1A202C] focus:outline-none"
                  type="number"
                  min={0}
                  inputMode="decimal"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                />
              </span>
            </label>
            <div className={field}>
              <span className={label}>Spots</span>
              <span className="flex h-[38px] items-center gap-3.5">
                <button type="button" className={stepButton} aria-label="Fewer spots" onClick={() => setSpots((s) => Math.max(2, s - 1))}>
                  <Minus strokeWidth={1.5} />
                </button>
                <b className="min-w-5 text-center text-[16px]">{spots}</b>
                <button type="button" className={stepButton} aria-label="More spots" onClick={() => setSpots((s) => Math.min(30, s + 1))}>
                  <Plus strokeWidth={1.5} />
                </button>
              </span>
            </div>
          </div>

          {more ? (
            <>
              <div className={pair}>
                <label className={field}>
                  <span className={label}>Pillar</span>
                  <select className={input} value={pillar} onChange={(e) => setPillar(e.target.value)}>
                    <option value="">Not set</option>
                    {DEFAULT_PILLARS.soccer.map((p) => (
                      <option key={p.title} value={p.title}>
                        {p.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={field}>
                  <span className={label}>Position</span>
                  <select className={input} value={position} onChange={(e) => setPosition(e.target.value as SessionPosition | "")}>
                    <option value="Field player">Field player</option>
                    <option value="Goalkeeper">Goalkeeper</option>
                    <option value="Both">Both</option>
                  </select>
                </label>
              </div>
              <div className={pair}>
                <label className={field}>
                  <span className={label}>Ages (optional)</span>
                  <input className={input} value={ages} onChange={(e) => setAges(e.target.value)} placeholder="12 to 15" />
                </label>
                <label className={field}>
                  <span className={label}>Level</span>
                  <select className={input} value={level} onChange={(e) => setLevel(e.target.value)}>
                    {LEVELS.map((l) => (
                      <option key={l}>{l}</option>
                    ))}
                  </select>
                </label>
              </div>
              <label className={field}>
                <span className={label}>What you'll work on (optional)</span>
                <textarea className={cn(input, "h-auto py-2.5 leading-[18px]")} rows={3} value={about} onChange={(e) => setAbout(e.target.value)} placeholder="One per line" />
                <span className={meta}>Families see this before they book</span>
              </label>
              <label className={field}>
                <span className={label}>Bring (optional)</span>
                <input className={input} value={bring} onChange={(e) => setBring(e.target.value)} />
              </label>
            </>
          ) : (
            <button type="button" className={cn(textButton, "self-start")} onClick={() => setMore(true)}>
              <Plus strokeWidth={1.5} aria-hidden="true" />
              More details: pillar, position, ages, what to bring
            </button>
          )}

          {error ? (
            <p role="alert" className="rounded-[8px] bg-[#FCEFDA] px-3.5 py-3 text-[12px] leading-[14px] text-[#906A29]">
              {error}
            </p>
          ) : null}
        </div>
        <div className={sheetFooter}>
          <div className="grid w-full grid-cols-2 gap-2">
            {session ? (
              <button type="button" className={secondaryButton} disabled={remove.isPending} onClick={() => remove.mutate()}>
                Delete
              </button>
            ) : (
              <button type="button" className={secondaryButton} onClick={() => onOpenChange(false)}>
                Cancel
              </button>
            )}
            <button type="button" className={primaryButton} disabled={save.isPending} onClick={submit}>
              {session ? "Save" : "Add session"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
