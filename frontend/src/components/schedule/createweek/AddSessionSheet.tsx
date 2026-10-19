/**
 * Short Add a session form for the Create session week page (Working Copy 4).
 * Group or 1-on-1 (open slot / book an athlete), start and end in 15-minute steps.
 */
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MapPin, Minus, Plus, Video } from "@/components/icons";
import { coachesAPI } from "@/api";
import { scheduleAPI, type ScheduleRules } from "@/api/schedule";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  ALL_START_MINUTES,
  formatDayISO,
  formatDuration,
  formatMinutes,
  itemAt,
  minutesInZone,
  viewerToEastern,
  type ScheduleDay,
} from "@/utils/schedule";
import { dialogContent, input, label, meta, primaryButton, secondaryButton, segButton, segGroup, smallButton } from "../styles";

type Type = "group" | "one";
type OneMode = "open" | "ath";

const ENDS_FROM = (start: number) => ALL_START_MINUTES.filter((t) => t > start && t <= start + 4 * 60);

export const AddSessionSheet = ({
  open,
  onOpenChange,
  date,
  todayISO,
  timeZone,
  rules,
  day,
  coachId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: string;
  todayISO: string;
  timeZone: string;
  rules: ScheduleRules;
  day: ScheduleDay | undefined;
  coachId: string;
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [type, setType] = useState<Type>("group");
  const [one, setOne] = useState<OneMode>("open");
  const [name, setName] = useState("");
  const [athleteId, setAthleteId] = useState("");
  const [start, setStart] = useState(17 * 60);
  const [end, setEnd] = useState(18 * 60);
  const [loc, setLoc] = useState(rules.locations[0] ?? "Video call");
  const [cap, setCap] = useState(8);
  const [price, setPrice] = useState("40");
  const [oprice, setOprice] = useState(String(rules.hourlyRate || 90));
  const [rep, setRep] = useState(false);
  const [newLoc, setNewLoc] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingLocs, setEditingLocs] = useState(false);

  const athletes = useQuery({
    queryKey: ["schedule-athlete-options"],
    queryFn: () => scheduleAPI.athleteOptions(),
    enabled: open,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!open) return;
    setType("group");
    setOne("open");
    setName("");
    setAthleteId(athletes.data?.[0]?.athleteId ?? "");
    const free =
      [16, 16.5, 17, 17.5, 18, 18.5, 19].map((h) => h * 60).find((m) => !itemAt(day, m, 60, timeZone, true)) ?? 17 * 60;
    setStart(free);
    setEnd(free + 60);
    setLoc(rules.locations[0] ?? "Video call");
    setCap(8);
    setPrice("40");
    setOprice(String(rules.hourlyRate || 90));
    setRep(false);
    setNewLoc(false);
    setNewName("");
    setEditingLocs(false);
  }, [open, date, day, timeZone, rules.locations, rules.hourlyRate, athletes.data]);

  const duration = Math.max(15, end - start);
  const clash = itemAt(day, start, duration, timeZone, type === "one" && one === "open");
  const places = useMemo(() => {
    const list = rules.locations.filter((l) => l !== "Video call");
    return [...list, "Video call"];
  }, [rules.locations]);

  const saveLoc = async (next: string[]) => {
    const { error } = await coachesAPI.updateCoach(coachId, { locations: next });
    if (error) throw new Error(error.message || "Couldn't save locations");
    await queryClient.invalidateQueries({ queryKey: ["coach-schedule"] });
  };

  const create = useMutation({
    mutationFn: async () => {
      const eastern = viewerToEastern(date, start, timeZone);
      const online = loc === "Video call";
      if (type === "group") {
        if (!name.trim()) throw new Error("Name the group");
        return scheduleAPI.createSessions({
          sessionType: "group",
          visibility: "open",
          times: [eastern],
          repeat: "none",
          weeks: 1,
          durationMinutes: duration,
          sessionName: name.trim(),
          price: Number(price) || 40,
          capacity: cap,
          location: online ? "online" : "in-person",
          place: online ? null : loc,
        });
      }
      const rate = Number(oprice) || rules.hourlyRate || 90;
      if (one === "open") {
        return scheduleAPI.createSessions({
          sessionType: "individual",
          visibility: "open",
          times: [eastern],
          repeat: rep ? "weekly" : "none",
          weeks: 1,
          durationMinutes: duration,
          price: rate,
          capacity: 1,
          location: online ? "online" : "in-person",
          place: online ? null : loc,
        });
      }
      if (!athleteId) throw new Error("Pick an athlete");
      return scheduleAPI.createSessions({
        sessionType: "individual",
        visibility: "offered",
        times: [eastern],
        repeat: "none",
        weeks: 1,
        durationMinutes: duration,
        price: rate,
        capacity: 1,
        location: online ? "online" : "in-person",
        place: online ? null : loc,
        offeredTo: [athleteId],
      });
    },
    onSuccess: () => {
      const wd = formatDayISO(date, { weekday: "long" });
      toast({
        title:
          type === "group"
            ? `${name.trim() || "Group"} added on ${formatDayISO(date, { weekday: "short", month: "short", day: "numeric" })}`
            : one === "open"
              ? rep
                ? `Open slot added every ${wd}`
                : `Open slot added on ${formatDayISO(date, { weekday: "short", month: "short", day: "numeric" })}`
              : "Session offered. They confirm and pay",
      });
      void queryClient.invalidateQueries({ queryKey: ["coach-schedule"] });
      onOpenChange(false);
    },
    onError: (err: unknown) =>
      toast({
        title: "Couldn't create the session",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "destructive",
      }),
  });

  const weekday = formatDayISO(date, { weekday: "long" });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(dialogContent, "w-[calc(100vw-16px)] max-w-[480px] gap-0 p-0 md:w-[calc(100vw-32px)]")}>
        <DialogHeader className="border-b border-light-525 px-4 py-5 pr-14 text-left md:px-[25px]">
          <DialogTitle className="text-card-title">Add a session</DialogTitle>
          <DialogDescription className="text-body-m text-dark-300">{formatDayISO(date, { weekday: "long", month: "short", day: "numeric" })}</DialogDescription>
        </DialogHeader>
        <div className="flex max-h-[70vh] flex-col gap-3 overflow-y-auto px-4 py-5 md:px-[25px]">
          <div className={segGroup} role="group" aria-label="Type">
            <button type="button" className={segButton(type === "group")} aria-pressed={type === "group"} onClick={() => setType("group")}>
              Group
            </button>
            <button type="button" className={segButton(type === "one")} aria-pressed={type === "one"} onClick={() => setType("one")}>
              1-on-1
            </button>
          </div>

          {type === "group" ? (
            <label className="flex flex-col gap-1.5">
              <span className={label}>Name</span>
              <input className={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="For example, U10 ball mastery" />
            </label>
          ) : (
            <>
              <div className="flex flex-col gap-2">
                {(
                  [
                    ["open", "Open slot", "Any family can book it"],
                    ["ath", "Book an athlete", "Pick who it's for"],
                  ] as const
                ).map(([k, t, d]) => (
                  <button
                    key={k}
                    type="button"
                    className={cn(
                      "flex items-start gap-3 rounded-card border px-3 py-3 text-left",
                      one === k ? "border-primary bg-primary-50" : "border-light-525 bg-light-300 hover:bg-light-200",
                    )}
                    aria-pressed={one === k}
                    onClick={() => setOne(k)}
                  >
                    <span className={cn("mt-1 size-3.5 rounded-full border-2", one === k ? "border-primary bg-primary" : "border-light-600")} />
                    <span className="flex flex-col gap-0.5">
                      <span className="text-label-sm">{t}</span>
                      <span className={meta}>{d}</span>
                    </span>
                  </button>
                ))}
              </div>
              {one === "ath" ? (
                <label className="flex flex-col gap-1.5">
                  <span className={label}>Athlete</span>
                  <select className={input} value={athleteId} onChange={(e) => setAthleteId(e.target.value)}>
                    {(athletes.data ?? []).map((a) => (
                      <option key={a.athleteId} value={a.athleteId}>
                        {a.fullName}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </>
          )}

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className={label}>Start time</span>
              <select className={input} value={start} onChange={(e) => { const v = Number(e.target.value); setStart(v); if (end <= v) setEnd(v + 60); }}>
                {ALL_START_MINUTES.map((m) => (
                  <option key={m} value={m}>{formatMinutes(m)}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={label}>Ends</span>
              <select className={input} value={end} onChange={(e) => setEnd(Number(e.target.value))}>
                {ENDS_FROM(start).map((m) => (
                  <option key={m} value={m}>{formatMinutes(m)}</option>
                ))}
              </select>
            </label>
          </div>
          <span className={cn(meta, clash && "text-error-700")}>
            {clash
              ? `Overlaps ${clash.kind === "busy" ? "a busy time" : clash.session?.sessionName || "a session"} at ${formatMinutes(minutesInZone(clash.start, timeZone))}`
              : formatDuration(duration)}
          </span>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className={label}>Where</span>
              <button type="button" className={cn(secondaryButton, smallButton)} onClick={() => setEditingLocs((v) => !v)}>
                {editingLocs ? "Done" : "Edit"}
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {places.map((p) =>
                editingLocs && p !== "Video call" ? (
                  <span key={p} className="inline-flex items-center gap-1 rounded-control border border-light-525 bg-light-400 px-3 py-1.5 text-body-m">
                    {p}
                    <button
                      type="button"
                      className="text-error-700"
                      aria-label={`Remove ${p}`}
                      onClick={() => {
                        const next = rules.locations.filter((l) => l !== p);
                        void saveLoc(next).then(() => {
                          if (loc === p) setLoc(next[0] ?? "Video call");
                          toast({ title: `${p} removed from your locations` });
                        });
                      }}
                    >
                      ×
                    </button>
                  </span>
                ) : (
                  <button
                    key={p}
                    type="button"
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-control border px-3 py-1.5 text-label-sm",
                      loc === p ? "border-primary bg-primary-50 text-primary" : "border-light-525 bg-light-300 text-dark hover:bg-light-200",
                    )}
                    onClick={() => setLoc(p)}
                  >
                    {p === "Video call" ? <Video className="size-3.5" strokeWidth={1.5} /> : <MapPin className="size-3.5" strokeWidth={1.5} />}
                    {p}
                  </button>
                ),
              )}
              {!editingLocs ? (
                <button type="button" className="rounded-control border border-dashed border-light-600 px-3 py-1.5 text-label-sm text-primary hover:bg-light-200" onClick={() => setNewLoc(true)}>
                  + New location
                </button>
              ) : null}
            </div>
            {newLoc ? (
              <div className="flex flex-col gap-2 rounded-card border border-light-525 bg-light-400 p-3">
                <input className={input} value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Location name" />
                <div className="flex justify-end gap-2">
                  <button type="button" className={cn(secondaryButton, smallButton)} onClick={() => setNewLoc(false)}>Cancel</button>
                  <button
                    type="button"
                    className={cn(primaryButton, smallButton)}
                    onClick={() => {
                      const n = newName.trim();
                      if (!n) return;
                      void saveLoc([...rules.locations.filter((l) => l !== "Video call"), n]).then(() => {
                        setLoc(n);
                        setNewLoc(false);
                        setNewName("");
                      });
                    }}
                  >
                    Use this location
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          {type === "group" ? (
            <>
              <div className="flex items-center justify-between border-b border-light-525 py-3">
                <span className="text-label-sm">Spots</span>
                <div className="flex items-center gap-3">
                  <button type="button" className={cn(secondaryButton, "size-9 p-0")} disabled={cap <= 2} onClick={() => setCap((c) => Math.max(2, c - 1))} aria-label="Fewer spots">
                    <Minus className="size-4" />
                  </button>
                  <b className="min-w-[24px] text-center text-subtitle tabular-nums">{cap}</b>
                  <button type="button" className={cn(secondaryButton, "size-9 p-0")} onClick={() => setCap((c) => Math.min(40, c + 1))} aria-label="More spots">
                    <Plus className="size-4" />
                  </button>
                </div>
              </div>
              <label className="flex items-center justify-between gap-3 border-b border-light-525 py-3">
                <span className="text-label-sm">Price per athlete</span>
                <span className="flex h-[38px] w-[120px] items-center rounded-control border border-dark-250 bg-light pl-3 focus-within:outline focus-within:outline-2 focus-within:-outline-offset-1 focus-within:outline-primary">
                  <span className="text-dark-300">$</span>
                  <input className="h-full w-full bg-transparent px-1 text-right focus:outline-none" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} />
                </span>
              </label>
            </>
          ) : (
            <>
              <label className="flex items-center justify-between gap-3 border-b border-light-525 py-3">
                <span className="flex flex-col gap-0.5">
                  <span className="text-label-sm">Price</span>
                  <span className={meta}>Your usual 1-on-1 rate</span>
                </span>
                <span className="flex h-[38px] w-[120px] items-center rounded-control border border-dark-250 bg-light pl-3 focus-within:outline focus-within:outline-2 focus-within:-outline-offset-1 focus-within:outline-primary">
                  <span className="text-dark-300">$</span>
                  <input className="h-full w-full bg-transparent px-1 text-right focus:outline-none" inputMode="numeric" value={oprice} onChange={(e) => setOprice(e.target.value)} />
                </span>
              </label>
              {one === "open" ? (
                <div className="flex items-center justify-between py-2">
                  <span className="flex flex-col gap-0.5">
                    <span className="text-label-sm">Repeat every {weekday}</span>
                    <span className={meta}>{rep ? "Open every week until you turn it off" : "Just this once"}</span>
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={rep}
                    className={cn("h-5 w-9 rounded-full p-0.5 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary", rep ? "bg-primary" : "bg-light-600")}
                    onClick={() => setRep((v) => !v)}
                  >
                    <span className={cn("block size-4 rounded-full bg-light-50 transition-transform", rep && "translate-x-4")} />
                  </button>
                </div>
              ) : null}
            </>
          )}
        </div>
        <div className="border-t border-light-525 px-4 py-4 md:px-[25px]">
          <button
            type="button"
            className={cn(primaryButton, "h-[44px] w-full")}
            disabled={Boolean(clash) || create.isPending || date < todayISO}
            onClick={() => create.mutate()}
          >
            {create.isPending ? "Adding…" : type === "group" ? "Add group session" : one === "open" ? "Add open slot" : "Book session"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

/** Re-export so callers that already have layoutDays stay typed. */
export type { ScheduleDay };
