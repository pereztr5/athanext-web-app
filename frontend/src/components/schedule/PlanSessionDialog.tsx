/**
 * Add or edit one draft group session in the week planner (ATH-72).
 */
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { MapPin, Minus, Plus, Video } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { scheduleAPI, type ScheduleRules, type ScheduleSession, type SessionPosition } from "@/api/schedule";
import { cn } from "@/lib/utils";
import { DEFAULT_PILLARS } from "@/utils/pillarIcons";
import { getZonedISODate } from "@/utils/dateHelpers";
import {
  ALL_START_MINUTES,
  formatDayISO,
  formatMinutes,
  minutesInZone,
  sessionStart,
  viewerToEastern,
} from "@/utils/schedule";
import { choice, dangerTextButton, dialogContent, iconButton, input, label, meta, primaryButton, secondaryButton, textButton } from "./styles";

const LENGTHS = [45, 60, 75, 90, 120];
const LEVELS = ["All levels", "Beginners welcome", "Club and up"];

export const PlanSessionDialog = ({
  open,
  onOpenChange,
  session,
  days,
  defaultDay,
  timeZone,
  rules,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The draft being edited, or null to add one. */
  session: ScheduleSession | null;
  /** Days in the plan that haven't passed, in the coach's zone. */
  days: string[];
  defaultDay: string;
  timeZone: string;
  rules: ScheduleRules;
}) => {
  const queryClient = useQueryClient();
  const places = useMemo(
    () => [...(rules.locations.length ? rules.locations : ["In person"]), "Video call"],
    [rules.locations]
  );

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
      setPlace(session.location === "online" ? "Video call" : session.place || places[0]);
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
    const online = place === "Video call";
    return { location: online ? ("online" as const) : ("in-person" as const), place: online || place === "In person" ? null : place };
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
      onOpenChange(false);
    },
    onError: (err: unknown) => setError(err instanceof Error ? err.message : "Couldn't save the session."),
  });

  const remove = useMutation({
    mutationFn: () => scheduleAPI.removeSession(session!.id),
    onSuccess: () => {
      refresh();
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={dialogContent}>
        <DialogHeader className="px-5 pb-3 pt-5 pr-14 text-left sm:px-[25px]">
          <DialogTitle className="text-[22px] font-semibold leading-[28px] tracking-[-0.05em]">
            {session ? "Edit session" : "Add session"}
          </DialogTitle>
          <DialogDescription className="sr-only">A draft group session. Families see it once you publish.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 px-5 pb-5 sm:px-[25px]">
          <label className="flex flex-col gap-1.5">
            <span className={label}>Title</span>
            <input className={input} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="For example, Finishing clinic" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className={label}>Day</span>
              <select className={input} value={day} onChange={(e) => setDay(e.target.value)} disabled={dayOptions.length < 2}>
                {dayOptions.map((d) => (
                  <option key={d} value={d}>
                    {formatDayISO(d, { weekday: "short", month: "short", day: "numeric" })}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
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
          <div className="grid grid-cols-3 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className={label}>Length</span>
              <select className={input} value={length} onChange={(e) => setLength(Number(e.target.value))}>
                {LENGTHS.map((l) => (
                  <option key={l} value={l}>
                    {l === 120 ? "2 hours" : `${l} min`}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={label}>Price per athlete</span>
              <span className="relative flex items-center">
                <span className="pointer-events-none absolute left-3 text-[14px] text-[#767980]">$</span>
                <input className={cn(input, "pl-6")} type="number" min={0} inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
              </span>
            </label>
            <div className="flex flex-col gap-1.5">
              <span className={label}>Spots</span>
              <span className="flex h-[38px] items-center justify-between gap-1">
                <button type="button" className={cn(iconButton, "size-[30px]")} aria-label="Fewer spots" onClick={() => setSpots((s) => Math.max(2, s - 1))}>
                  <Minus strokeWidth={1.5} />
                </button>
                <b className="text-[16px]">{spots}</b>
                <button type="button" className={cn(iconButton, "size-[30px]")} aria-label="More spots" onClick={() => setSpots((s) => Math.min(30, s + 1))}>
                  <Plus strokeWidth={1.5} />
                </button>
              </span>
            </div>
          </div>
          <span className={label}>Where</span>
          <div className="flex flex-wrap gap-2">
            {places.map((p) => (
              <button key={p} type="button" aria-pressed={place === p} className={choice(place === p)} onClick={() => setPlace(p)}>
                {p === "Video call" ? <Video strokeWidth={1.5} aria-hidden="true" /> : <MapPin strokeWidth={1.5} aria-hidden="true" />}
                {p}
              </button>
            ))}
          </div>

          {more ? (
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1.5">
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
                <label className="flex flex-col gap-1.5">
                  <span className={label}>Position</span>
                  <select className={input} value={position} onChange={(e) => setPosition(e.target.value as SessionPosition | "")}>
                    <option value="Field player">Field player</option>
                    <option value="Goalkeeper">Goalkeeper</option>
                    <option value="Both">Both</option>
                  </select>
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1.5">
                  <span className={label}>Ages (optional)</span>
                  <input className={input} value={ages} onChange={(e) => setAges(e.target.value)} placeholder="12 to 15" />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className={label}>Level</span>
                  <select className={input} value={level} onChange={(e) => setLevel(e.target.value)}>
                    {LEVELS.map((l) => (
                      <option key={l}>{l}</option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="flex flex-col gap-1.5">
                <span className={label}>What you'll work on (optional)</span>
                <textarea className={cn(input, "h-auto py-2")} rows={3} value={about} onChange={(e) => setAbout(e.target.value)} placeholder="One per line" />
                <span className={meta}>Families see this before they book.</span>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className={label}>Bring (optional)</span>
                <input className={input} value={bring} onChange={(e) => setBring(e.target.value)} />
              </label>
            </div>
          ) : (
            <button type="button" className={cn(textButton, "self-start")} onClick={() => setMore(true)}>
              <Plus strokeWidth={1.5} aria-hidden="true" />
              More details: pillar, position, ages, what to bring
            </button>
          )}

          {error ? (
            <p role="alert" className="rounded-[8px] bg-[#FCEFDA] px-3 py-2 text-[14px] text-[#906A29]">
              {error}
            </p>
          ) : null}

          <div className="flex items-center justify-between gap-2">
            {session ? (
              <button type="button" className={dangerTextButton} disabled={remove.isPending} onClick={() => remove.mutate()}>
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
