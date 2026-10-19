/**
 * Add a session on Plan next week: tap a usual session, or create a new Group / 1-on-1
 * open slot (real individual, not a one-spot group) and optionally save it as usual.
 */
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Minus, Plus } from "@/components/icons";
import { scheduleAPI, type ScheduleRules } from "@/api/schedule";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { money } from "@/utils/booking";
import { ALL_START_MINUTES, formatDayISO, formatMinutes, viewerToEastern } from "@/utils/schedule";
import { dialogContent, input, label, meta, primaryButton, secondaryButton, segButton, segGroup } from "../styles";
import { pickRow } from "./parts";
import { SessionTagField } from "./SessionTag";
import { saveUsual, type UsualSession } from "./usualSessions";

const PILLARS = [
  "On-field training",
  "Video analysis",
  "Mentorship",
  "Performance coaching",
  "Academic tutoring",
  "College recruiting",
];
const LENGTHS = [45, 60, 90] as const;
const VIDEO = "Video call";

type Type = "group" | "slot";

export const AddPlanSessionSheet = ({
  open,
  onOpenChange,
  date,
  timeZone,
  rules,
  coachId,
  usual,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: string;
  timeZone: string;
  rules: ScheduleRules;
  coachId: string;
  usual: UsualSession[];
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [view, setView] = useState<"list" | "form">("list");
  const [type, setType] = useState<Type>("group");
  const [name, setName] = useState("");
  const [pillar, setPillar] = useState(PILLARS[0]);
  const [start, setStart] = useState(17 * 60);
  const [length, setLength] = useState(60);
  const [loc, setLoc] = useState(rules.locations[0] ?? VIDEO);
  const [cap, setCap] = useState(8);
  const [price, setPrice] = useState("40");
  const [tag, setTag] = useState("");
  const [save, setSave] = useState(true);

  const places = useMemo(() => {
    const list = rules.locations.filter((l) => l && l !== VIDEO);
    return [...list, VIDEO].filter((x, i, a) => a.indexOf(x) === i);
  }, [rules.locations]);

  useEffect(() => {
    if (!open) return;
    setView("list");
    setType("group");
    setName("");
    setPillar(PILLARS[0]);
    setStart(17 * 60);
    setLength(60);
    setLoc(places[0] ?? VIDEO);
    setCap(8);
    setPrice(String(rules.hourlyRate && type === "slot" ? rules.hourlyRate : 40));
    setTag("");
    setSave(true);
  }, [open, places, rules.hourlyRate]);

  const ok = (type === "slot" || name.trim().length > 0) && tag.trim().length > 0 && Number(price) > 0;

  const createFromUsual = useMutation({
    mutationFn: async (u: UsualSession) => {
      const eastern = viewerToEastern(date, u.startMinutes, timeZone);
      const online = u.place === VIDEO;
      if (u.isOneOnOne) {
        return scheduleAPI.createSessions({
          sessionType: "individual",
          visibility: "open",
          times: [eastern],
          repeat: "none",
          durationMinutes: u.durationMinutes,
          sessionName: u.title,
          price: u.price,
          capacity: 1,
          location: online ? "online" : "in-person",
          place: online ? null : u.place === "In person" ? null : u.place,
          pillar: u.pillar,
          details: u.tag ? { tag: u.tag, ages: u.tag } : undefined,
          isDraft: true,
        });
      }
      return scheduleAPI.createSessions({
        sessionType: "group",
        visibility: "open",
        times: [eastern],
        repeat: "none",
        durationMinutes: u.durationMinutes,
        sessionName: u.title,
        price: u.price,
        capacity: u.capacity,
        location: online ? "online" : "in-person",
        place: online ? null : u.place === "In person" ? null : u.place,
        pillar: u.pillar,
        details: !u.isOneOnOne && u.tag ? { tag: u.tag, ages: u.tag } : undefined,
        isDraft: true,
      });
    },
    onSuccess: (_r, u) => {
      toast({ title: `${u.title} added to ${formatDayISO(date, { weekday: "short", month: "short", day: "numeric" })}` });
      void queryClient.invalidateQueries({ queryKey: ["coach-schedule"] });
      onOpenChange(false);
    },
    onError: (err: unknown) =>
      toast({
        title: "Couldn't add that session",
        description: err instanceof Error ? err.message : "Try another time.",
        variant: "destructive",
      }),
  });

  const createNew = useMutation({
    mutationFn: async () => {
      const eastern = viewerToEastern(date, start, timeZone);
      const online = loc === VIDEO;
      const isSlot = type === "slot";
      const title = isSlot ? `1-on-1 ${pillar.toLowerCase()}` : name.trim();
      const result = await scheduleAPI.createSessions({
        sessionType: isSlot ? "individual" : "group",
        visibility: "open",
        times: [eastern],
        repeat: "none",
        durationMinutes: length,
        sessionName: title,
        price: Number(price) || 40,
        capacity: isSlot ? 1 : cap,
        location: online ? "online" : "in-person",
        place: online || loc === "In person" ? null : loc,
        pillar,
        details: tag.trim() ? { tag: tag.trim(), ages: tag.trim() } : undefined,
        isDraft: true,
      });
      if (!result.created.length) throw new Error("That time overlaps another session. Pick another time.");
      if (save) {
        saveUsual(coachId, {
          title,
          startMinutes: start,
          durationMinutes: length,
          place: loc,
          price: Number(price) || 40,
          capacity: isSlot ? 1 : cap,
          pillar,
          isOneOnOne: isSlot,
          tag: tag.trim() || undefined,
        });
      }
      return title;
    },
    onSuccess: (title) => {
      toast({ title: `${title} added to ${formatDayISO(date, { weekday: "short", month: "short", day: "numeric" })}` });
      void queryClient.invalidateQueries({ queryKey: ["coach-schedule"] });
      onOpenChange(false);
    },
    onError: (err: unknown) =>
      toast({
        title: "Couldn't add that session",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "destructive",
      }),
  });

  const rangeLabel = (() => {
    const end = start + length;
    const a = formatMinutes(start);
    const b = formatMinutes(end >= 24 * 60 ? end - 24 * 60 : end);
    return `${a} – ${b}`;
  })();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(dialogContent, "w-[calc(100vw-16px)] max-w-[480px] gap-0 p-0 md:w-[calc(100vw-32px)]")}>
        <DialogHeader className="border-b border-light-525 px-4 py-5 pr-14 text-left md:px-[25px]">
          <DialogTitle className="text-card-title">
            {view === "form" ? "New session" : "Add a session"}
          </DialogTitle>
          <DialogDescription className="text-body-m text-dark-300">
            {formatDayISO(date, { weekday: "long", month: "short", day: "numeric" })}
          </DialogDescription>
        </DialogHeader>

        {view === "list" ? (
          <div className="flex max-h-[70vh] flex-col gap-2.5 overflow-y-auto px-4 py-5 md:px-[25px]">
            {usual.length ? (
              <>
                <span className={label}>Your usual sessions</span>
                {usual.map((u, i) => (
                  <button
                    key={`${u.title}-${i}`}
                    type="button"
                    className={pickRow}
                    disabled={createFromUsual.isPending}
                    onClick={() => createFromUsual.mutate(u)}
                  >
                    <span className="flex min-w-0 flex-1 flex-col gap-1 text-left">
                      <span className="text-label-sm">{u.title}</span>
                      <span className={meta}>
                        {formatMinutes(u.startMinutes)} · {u.durationMinutes} min · {u.place}
                      </span>
                    </span>
                    <span className="flex flex-none flex-col items-end gap-1">
                      <span className="text-label-sm">{money(u.price)}</span>
                      <span className={meta}>{u.isOneOnOne ? "1-on-1" : `${u.capacity} spots`}</span>
                    </span>
                  </button>
                ))}
              </>
            ) : (
              <p className="text-body-m text-dark-300">No usual sessions yet. Create one and save it for next time.</p>
            )}
            <button
              type="button"
              className="mt-1 flex h-11 w-full items-center justify-center gap-1.5 rounded-control border border-dashed border-light-600 text-label-sm text-primary hover:bg-light-400"
              onClick={() => {
                setView("form");
                setPrice(String(type === "slot" ? rules.hourlyRate || 90 : 40));
              }}
            >
              <Plus className="size-4" strokeWidth={1.5} aria-hidden="true" />
              Create a new session
            </button>
          </div>
        ) : (
          <>
            <div className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto px-4 py-5 md:px-[25px]">
              <div className="flex flex-col gap-1.5">
                <span className={label}>Type</span>
                <div className={segGroup} role="group" aria-label="Type">
                  <button
                    type="button"
                    className={segButton(type === "group")}
                    aria-pressed={type === "group"}
                    onClick={() => {
                      setType("group");
                      setPrice("40");
                    }}
                  >
                    Group
                  </button>
                  <button
                    type="button"
                    className={segButton(type === "slot")}
                    aria-pressed={type === "slot"}
                    onClick={() => {
                      setType("slot");
                      setPrice(String(rules.hourlyRate || 90));
                    }}
                  >
                    1-on-1 slot
                  </button>
                </div>
                <span className={meta}>
                  {type === "group" ? "Several athletes, each pays for a spot." : "One open slot any of your families can book."}
                </span>
              </div>

              {type === "group" ? (
                <label className="flex flex-col gap-1.5">
                  <span className={label}>Name</span>
                  <input
                    className={input}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="For example, U10 ball mastery"
                    autoComplete="off"
                  />
                </label>
              ) : null}

              <div className="flex flex-col gap-1.5">
                <span className={label}>Tag</span>
                <SessionTagField value={tag} onChange={setTag} />
              </div>

              <div className="flex flex-col gap-1.5">
                <span className={label}>Pillar</span>
                <div className="flex flex-wrap gap-1.5">
                  {PILLARS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      className={cn(
                        "h-8 rounded-control border px-3 text-label-sm transition-colors",
                        pillar === p ? "border-primary bg-primary-50 text-primary" : "border-light-525 bg-light-300 text-dark hover:bg-light-200",
                      )}
                      aria-pressed={pillar === p}
                      onClick={() => setPillar(p)}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1.5">
                  <span className={label}>Starts</span>
                  <select className={input} value={start} onChange={(e) => setStart(Number(e.target.value))}>
                    {ALL_START_MINUTES.filter((m) => m % 30 === 0 || m % 60 === 0).filter((m) => m >= 6 * 60 && m <= 21 * 60).map((m) => (
                      <option key={m} value={m}>
                        {formatMinutes(m)}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="flex flex-col gap-1.5">
                  <span className={label}>Length</span>
                  <div className={segGroup} role="group" aria-label="Length">
                    {LENGTHS.map((n) => (
                      <button key={n} type="button" className={segButton(length === n)} aria-pressed={length === n} onClick={() => setLength(n)}>
                        {n === 90 ? "90 min" : `${n} min`}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <span className={cn(meta, "-mt-2")}>{rangeLabel}</span>

              <div className="flex flex-col gap-1.5">
                <span className={label}>Where</span>
                <div className="flex flex-wrap gap-1.5">
                  {places.map((p) => (
                    <button
                      key={p}
                      type="button"
                      className={cn(
                        "h-8 rounded-control border px-3 text-label-sm transition-colors",
                        loc === p ? "border-primary bg-primary-50 text-primary" : "border-light-525 bg-light-300 text-dark hover:bg-light-200",
                      )}
                      aria-pressed={loc === p}
                      onClick={() => setLoc(p)}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <div className={cn("grid gap-3", type === "group" ? "grid-cols-2" : "grid-cols-1")}>
                {type === "group" ? (
                  <div className="flex flex-col gap-1.5">
                    <span className={label}>Spots</span>
                    <div className="flex h-10 items-center gap-3">
                      <button
                        type="button"
                        className={cn(secondaryButton, "size-[30px] p-0")}
                        aria-label="Fewer spots"
                        disabled={cap <= 2}
                        onClick={() => setCap((c) => Math.max(2, c - 1))}
                      >
                        <Minus className="size-4" />
                      </button>
                      <b className="min-w-[24px] text-center text-subtitle tabular-nums">{cap}</b>
                      <button
                        type="button"
                        className={cn(secondaryButton, "size-[30px] p-0")}
                        aria-label="More spots"
                        onClick={() => setCap((c) => Math.min(30, c + 1))}
                      >
                        <Plus className="size-4" />
                      </button>
                    </div>
                  </div>
                ) : null}
                <label className="flex flex-col gap-1.5">
                  <span className={label}>{type === "group" ? "Price per athlete" : "Price"}</span>
                  <span className="flex h-10 items-center rounded-control border border-dark-250 bg-light pl-3 focus-within:outline focus-within:outline-2 focus-within:-outline-offset-1 focus-within:outline-primary">
                    <span className="text-dark-300">$</span>
                    <input
                      className="h-full w-full bg-transparent px-2 focus:outline-none"
                      inputMode="numeric"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                    />
                  </span>
                </label>
              </div>

              <label className="flex cursor-pointer items-center gap-2.5">
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={save}
                  onChange={(e) => setSave(e.target.checked)}
                />
                <span className="text-body-m">Save to my usual sessions</span>
              </label>
            </div>
            <div className="flex gap-2 border-t border-light-525 px-4 py-4 md:px-[25px]">
              <button type="button" className={cn(secondaryButton, "h-11 flex-1")} onClick={() => setView("list")}>
                Back
              </button>
              <button
                type="button"
                className={cn(primaryButton, "h-11 flex-[2]")}
                disabled={!ok || createNew.isPending}
                onClick={() => createNew.mutate()}
              >
                {createNew.isPending ? "Adding…" : `Add to ${formatDayISO(date, { weekday: "short", month: "short", day: "numeric" })}`}
              </button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
