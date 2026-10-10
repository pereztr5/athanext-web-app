/**
 * Create session (ATH-71, Working Copy 2 coach7.js): 1-on-1 or group, day, time, where, and an
 * optional weekly repeat. Open 1-on-1 slots repeat every week with no end; offered and group
 * sessions can repeat for 4, 8 or 12 weeks. Offered and group sessions then go to the share step.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Globe, MapPin, Minus, Plus, Repeat, TriangleAlert, User, Users, Video, X } from "lucide-react";
import { coachesAPI } from "@/api";
import { ToastAction } from "@/components/ui/toast";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { scheduleAPI, type CreateSessionsInput, type ScheduleRules, type ScheduleSession } from "@/api/schedule";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { money } from "@/utils/booking";
import { zonedWallTimeToUtc } from "@/utils/dateHelpers";
import {
  ALL_START_MINUTES,
  addDaysISO,
  formatDayISO,
  formatMinutes,
  isoWeekday,
  itemAt,
  layoutDays,
  minutesInZone,
  minutesToHHMM,
  monthRangeLabel,
  plural,
  suggestedStartMinutes,
  timeZonePillLabel,
  viewerToEastern,
  WEEKDAY_NAMES,
} from "@/utils/schedule";
import { ShareSession } from "./ShareSession";
import {
  addChip,
  chip,
  groupBox,
  sheetBody,
  sheetButton,
  sheetContent,
  sheetFooter,
  sheetHeader,
  sheetTitle,
  timeZonePill,
  warmInfo,
  whiteInput,
} from "./create/classes";
import {
  dayTile,
  dayTileNumber,
  dayTileWeekday,
  dialogContent,
  iconButton,
  input,
  label,
  meta,
  primaryButton,
  secondaryButton,
  segButton,
  segGroup,
  smallButton,
  timeTile,
  timeTileNote,
} from "./styles";

type Kind = "individual" | "group";
type Who = "open" | "offered";
type Place = { key: string; label: string; location: "online" | "in-person"; place: string | null };

const LENGTHS = [45, 60, 75, 90, 120];
const GROUP_PRICE = "35";
/** Time tiles shown before "Other" (Working Copy shows 11). */
const TILES = 11;
const arrowButton = cn(iconButton, "size-[30px] bg-[#F7F7F0]");

/** `.affix`: "$" and the input read as one box. */
const PriceField = ({ label: text, value, onChange, white }: { label: string; value: string; onChange: (v: string) => void; white?: boolean }) => (
  <label className="flex min-w-0 flex-col gap-1.5">
    <span className={label}>{text}</span>
    <span className={cn("flex h-[38px] items-center rounded-[8px] bg-[#F1F1E6] focus-within:ring-2 focus-within:ring-[#6698D2]", white && whiteInput)}>
      <span className="pl-3 text-[14px] text-[#767980]" aria-hidden="true">$</span>
      <input
        className="h-full w-full min-w-0 bg-transparent pl-1 pr-3 text-[14px] text-[#1A202C] focus:outline-none"
        type="number"
        min={0}
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </span>
  </label>
);

const LengthField = ({ value, onChange, white }: { value: number; onChange: (v: number) => void; white?: boolean }) => (
  <label className="flex min-w-0 flex-col gap-1.5">
    <span className={label}>Length</span>
    <select className={cn(input, white && whiteInput)} value={value} onChange={(e) => onChange(Number(e.target.value))}>
      {LENGTHS.map((l) => (
        <option key={l} value={l}>
          {l === 120 ? "2 hours" : `${l} min`}
        </option>
      ))}
    </select>
  </label>
);

export const CreateSessionDialog = ({
  open,
  onOpenChange,
  startDate,
  todayISO,
  timeZone,
  rules,
  coachId,
  coachName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Day to start on, in the coach's zone. */
  startDate: string;
  todayISO: string;
  timeZone: string;
  rules: ScheduleRules;
  coachId: string;
  coachName: string;
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // The coach's saved locations (coaches.locations). Removing or adding one saves straight away.
  const [savedLocations, setSavedLocations] = useState<string[]>(rules.locations);
  const places: Place[] = useMemo(
    () => [
      ...(savedLocations.length ? savedLocations : ["In person"]).map((l) => ({
        key: l,
        label: l,
        location: "in-person" as const,
        place: l === "In person" ? null : l,
      })),
      { key: "online", label: "Video call", location: "online" as const, place: null },
    ],
    [savedLocations]
  );

  const [kind, setKind] = useState<Kind>("individual");
  const [who, setWho] = useState<Who>("open");
  const [stripStart, setStripStart] = useState(startDate);
  const [day, setDay] = useState(startDate);
  const [times, setTimes] = useState<number[]>([]);
  const [other, setOther] = useState(false);
  const [otherMinutes, setOtherMinutes] = useState(17 * 60);
  const [placeKey, setPlaceKey] = useState(places[0].key);
  const [addingPlace, setAddingPlace] = useState(false);
  const [newPlace, setNewPlace] = useState("");
  const [name, setName] = useState("");
  const [length, setLength] = useState(60);
  const [spots, setSpots] = useState(6);
  const [price, setPrice] = useState("");
  const [repeat, setRepeat] = useState(true);
  const [weeks, setWeeks] = useState(8);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<ScheduleSession[] | null>(null);
  const [assigning, setAssigning] = useState(false);

  // Fresh form every time the sheet opens, not when the schedule refetches while it's open.
  const wasOpen = useRef(false);
  useEffect(() => {
    const opening = open && !wasOpen.current;
    wasOpen.current = open;
    if (!opening) return;
    const start = startDate < todayISO ? todayISO : startDate;
    setKind("individual");
    setWho("open");
    setStripStart(start);
    setDay(start);
    setTimes([]);
    setOther(false);
    setSavedLocations(rules.locations);
    setPlaceKey(rules.locations[0] ?? "In person");
    setAddingPlace(false);
    setNewPlace("");
    setName("");
    setLength(60);
    setSpots(6);
    setPrice(rules.hourlyRate ? String(rules.hourlyRate) : "");
    setRepeat(true);
    setWeeks(8);
    setError(null);
    setCreated(null);
    setAssigning(false);
  }, [open, startDate, todayISO, rules.locations, rules.hourlyRate]);

  const saveLocations = async (next: string[]) => {
    const { error } = await coachesAPI.updateCoach(coachId, { locations: next });
    if (error) throw new Error(error.message);
    setSavedLocations(next);
    queryClient.invalidateQueries({ queryKey: ["coach-schedule"] });
  };

  const removeLocation = async (location: string) => {
    const before = savedLocations;
    try {
      await saveLocations(before.filter((l) => l !== location));
      if (placeKey === location) setPlaceKey(before.find((l) => l !== location) ?? "In person");
      toast({
        title: `${location} removed from your locations`,
        description: "Sessions already there stay as they are.",
        duration: 10000,
        action: (
          <ToastAction altText={`Undo remove ${location}`} onClick={() => saveLocations(before).catch(() => undefined)}>
            Undo
          </ToastAction>
        ),
      });
    } catch (err) {
      toast({ title: "Couldn't remove it", description: err instanceof Error ? err.message : undefined, variant: "destructive" });
    }
  };

  const addLocation = async () => {
    const location = newPlace.trim();
    if (!location) {
      toast({ title: "Type a location first" });
      return;
    }
    const existing = savedLocations.find((l) => l.toLowerCase() === location.toLowerCase());
    try {
      if (!existing) await saveLocations([...savedLocations, location]);
      setPlaceKey(existing ?? location);
      setAddingPlace(false);
      setNewPlace("");
      if (!existing) toast({ title: `${location} added to your locations` });
    } catch (err) {
      toast({ title: "Couldn't save it", description: err instanceof Error ? err.message : undefined, variant: "destructive" });
    }
  };

  const stripDates = useMemo(() => Array.from({ length: 7 }, (_, i) => addDaysISO(stripStart, i)), [stripStart]);

  // The strip's week, for taken times and the availability dots. Stored dates are Eastern, so fetch a day either side.
  const weekQuery = useQuery({
    queryKey: ["coach-schedule", "create", stripStart],
    enabled: open,
    queryFn: () => scheduleAPI.get(addDaysISO(stripStart, -1), addDaysISO(stripStart, 8)),
  });
  const days = useMemo(
    () =>
      layoutDays({
        dates: stripDates,
        sessions: weekQuery.data?.sessions ?? [],
        busy: weekQuery.data?.busy ?? [],
        timeOff: weekQuery.data?.timeOff ?? [],
        timeZone,
      }),
    [stripDates, weekQuery.data, timeZone]
  );
  const dayData = days.find((d) => d.date === day);
  const openDays = useMemo(() => new Set(days.filter((d) => d.items.some((i) => i.kind === "open")).map((d) => d.date)), [days]);

  const group = kind === "group";
  const openSlots = !group && who === "open";
  const multi = openSlots;
  const picked = useMemo(() => (other ? [otherMinutes] : [...times].sort((a, b) => a - b)), [other, otherMinutes, times]);

  const openStarts = useMemo(
    () => new Set((dayData?.items ?? []).filter((i) => i.kind === "open").map((i) => minutesInZone(i.start, timeZone))),
    [dayData, timeZone]
  );
  const takenBy = (minutes: number) => {
    const item = itemAt(dayData, minutes, length, timeZone, openSlots);
    if (!item) return null;
    if (item.kind === "busy") return "Busy";
    if (item.kind === "open") return "Open now";
    if (item.kind === "group") return item.session?.sessionName ?? "Group";
    if (item.kind === "offered") return "Offered";
    const booking = item.session?.bookings[0];
    return booking ? booking.athleteName.split(" ")[0] : "Taken";
  };
  const isPast = (minutes: number) =>
    (zonedWallTimeToUtc(day, `${minutesToHHMM(minutes)}:00`, timeZone)?.getTime() ?? 0) <= Date.now();

  // Future times only: the usual afternoon (or weekend morning) starts plus the day's open slots,
  // eleven of them starting near the first free one.
  const tiles = (() => {
    const all = [...new Set([...suggestedStartMinutes(day), ...openStarts, ...times])]
      .filter((m) => m + length <= 24 * 60 && !isPast(m))
      .sort((a, b) => a - b)
      .map((m) => ({ minutes: m, taken: takenBy(m) }));
    const firstFree = Math.max(0, all.findIndex((t) => !t.taken));
    const from = Math.max(0, Math.min(firstFree, all.length - TILES));
    return all.slice(from, from + TILES);
  })();

  const toggleTime = (minutes: number) => {
    setOther(false);
    setTimes((current) =>
      current.includes(minutes) ? current.filter((m) => m !== minutes) : multi ? [...current, minutes] : [minutes]
    );
  };

  const switchKind = (next: Kind) => {
    setKind(next);
    // Groups start at the usual per-athlete price, 1-on-1s at the coach's rate.
    setPrice(next === "group" ? GROUP_PRICE : rules.hourlyRate ? String(rules.hourlyRate) : "");
    if (next === "group") setLength(60);
    setTimes((current) => current.slice(0, 1));
    setRepeat(next === "individual" && who === "open");
  };
  const switchWho = (next: Who) => {
    setWho(next);
    setRepeat(next === "open");
    if (next === "offered") setTimes((current) => current.slice(0, 1));
  };

  const priceNumber = Number(price);
  const weekday = WEEKDAY_NAMES[isoWeekday(day) - 1];
  const shortWeekday = formatDayISO(day, { weekday: "short" });
  const tail = ` · ${length} min${price ? ` · ${money(priceNumber)}${group ? " per athlete" : ""}` : ""}`;

  const repeatMode: CreateSessionsInput["repeat"] = repeat ? (openSlots ? "weekly" : "weeks") : "none";
  const eastern = useMemo(() => picked.map((m) => viewerToEastern(day, m, timeZone)), [picked, day, timeZone]);

  // Dates that would be skipped, checked before submitting.
  const clashQuery = useQuery({
    queryKey: ["schedule-clashes", group ? "open" : who, repeatMode, repeatMode === "weeks" ? weeks : 1, length, eastern],
    enabled: open && !created && eastern.length > 0,
    retry: false,
    staleTime: 15_000,
    queryFn: () =>
      scheduleAPI.checkClashes({
        visibility: group ? "open" : who,
        times: eastern,
        repeat: repeatMode,
        weeks: repeatMode === "weeks" ? weeks : 1,
        durationMinutes: length,
      }),
  });
  const clashes = clashQuery.data?.length ?? 0;
  const planned = repeatMode === "weeks" ? picked.length * weeks : repeatMode === "none" ? picked.length : null;
  const okCount = planned === null ? null : Math.max(0, planned - clashes);
  const allClash = okCount === 0 && picked.length > 0;

  const create = useMutation({
    mutationFn: async () => {
      const place = places.find((p) => p.key === placeKey) ?? places[0];
      const payload: CreateSessionsInput = {
        sessionType: kind,
        visibility: group ? "open" : who,
        times: eastern,
        repeat: repeatMode,
        weeks: repeatMode === "weeks" ? weeks : 1,
        durationMinutes: length,
        sessionName: group ? name.trim() : undefined,
        price: priceNumber,
        capacity: group ? spots : 1,
        location: place.location,
        place: place.place,
        details: group ? { level: "All levels", bring: "Ball, water, shin guards" } : {},
      };
      return scheduleAPI.createSessions(payload);
    },
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["coach-schedule"] });
      const skipped = result.skipped.length;
      if (!result.created.length) {
        setError("Those times clash with other sessions. Pick another time.");
        return;
      }
      if (openSlots) {
        toast({
          title: `${plural(picked.length, "open slot")} added${repeat ? ` every ${weekday}` : ` on ${formatDayISO(day, { weekday: "short", month: "short", day: "numeric" })}`}`,
          description: `Families can book ${picked.length === 1 ? "it" : "them"} now.${skipped ? ` ${plural(skipped, "date")} clashed and ${skipped === 1 ? "was" : "were"} skipped.` : ""}`,
        });
        onOpenChange(false);
        return;
      }
      if (skipped) {
        toast({ title: `${plural(skipped, "date")} skipped`, description: "They clash with another session." });
      }
      const fresh = await scheduleAPI.get(addDaysISO(day, -1), addDaysISO(day, repeat ? weeks * 7 + 1 : 2));
      setCreated(fresh.sessions.filter((s) => result.created.includes(s.id)));
    },
    onError: (err: unknown) => setError(err instanceof Error ? err.message : "Couldn't create the session."),
  });

  const submit = () => {
    setError(null);
    if (!picked.length) return setError("Pick a time.");
    if (group && !name.trim()) return setError("Name the group session.");
    if (price.trim() === "" || !(priceNumber >= 0)) return setError("Add a price.");
    create.mutate();
  };

  const createLabel = !picked.length
    ? "Pick a time"
    : openSlots
      ? `Create ${plural(picked.length, "open slot")}${repeat ? `, every ${weekday}` : ""}`
      : (okCount ?? 1) > 1
        ? `Create ${plural(okCount ?? 1, group ? "group session" : "session")}`
        : `Create ${shortWeekday} ${formatMinutes(picked[0])} ${group ? "group" : "1-on-1"}`;

  const title = created ? (assigning ? "Book it for" : "Who should book it?") : "Create session";
  const moveStrip = (next: string) => {
    setStripStart(next);
    setDay(next);
    setTimes([]);
    setOther(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(dialogContent, sheetContent)}>
        <DialogHeader className={sheetHeader}>
          <DialogTitle className={sheetTitle}>{title}</DialogTitle>
          <DialogDescription className="sr-only">
            {created ? "Send the new session to athletes or share its link." : "Create a 1-on-1 or group session."}
          </DialogDescription>
        </DialogHeader>
        {created ? (
          created.length ? (
            <ShareSession
              sessions={created}
              coachId={coachId}
              coachName={coachName}
              slug={rules.slug}
              timeZone={timeZone}
              sheet
              onStepChange={(step) => setAssigning(step === "assign")}
              onDone={(sent) => {
                if (!sent) toast({ title: group ? "Group session created" : "Session created. It stays open until someone books it" });
                onOpenChange(false);
              }}
            />
          ) : (
            <div className={sheetBody}>
              <p className={meta}>Created. Find it on your schedule.</p>
            </div>
          )
        ) : (
          <>
            <div className={sheetBody}>
              <div className={segGroup} role="group" aria-label="Session type">
                <button type="button" className={segButton(!group)} aria-pressed={!group} onClick={() => switchKind("individual")}>
                  <User strokeWidth={1.5} aria-hidden="true" />
                  1-on-1
                </button>
                <button type="button" className={segButton(group)} aria-pressed={group} onClick={() => switchKind("group")}>
                  <Users strokeWidth={1.5} aria-hidden="true" />
                  Group
                </button>
              </div>

              {!group ? (
                <div className="flex flex-col gap-2.5">
                  <div className={segGroup} role="group" aria-label="Who can book">
                    <button type="button" className={segButton(who === "open")} aria-pressed={who === "open"} onClick={() => switchWho("open")}>
                      Open to book
                    </button>
                    <button type="button" className={segButton(who === "offered")} aria-pressed={who === "offered"} onClick={() => switchWho("offered")}>
                      For specific athletes
                    </button>
                  </div>
                  <span className={meta}>
                    {who === "open" ? "Any of your families can book these times." : "You pick who gets it next. First to book gets it."}
                  </span>
                </div>
              ) : null}

              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className={label}>Day</span>
                  <span className="text-[14px] font-semibold leading-[18px] tracking-[-0.02em] text-[#1A202C]">{monthRangeLabel(stripDates)}</span>
                </span>
                <span className="flex gap-1.5">
                  <button
                    type="button"
                    className={arrowButton}
                    aria-label="Earlier days"
                    disabled={stripStart <= todayISO}
                    onClick={() => moveStrip(addDaysISO(stripStart, -7) < todayISO ? todayISO : addDaysISO(stripStart, -7))}
                  >
                    <ChevronLeft strokeWidth={1.5} />
                  </button>
                  <button type="button" className={arrowButton} aria-label="Later days" onClick={() => moveStrip(addDaysISO(stripStart, 7))}>
                    <ChevronRight strokeWidth={1.5} />
                  </button>
                </span>
              </div>
              <div className="grid grid-cols-7 gap-1.5" role="group" aria-label="Days">
                {stripDates.map((d) => {
                  const on = d === day;
                  return (
                    <button
                      key={d}
                      type="button"
                      aria-pressed={on}
                      aria-label={`${formatDayISO(d, { weekday: "long", month: "long", day: "numeric" })}${openDays.has(d) ? ", has open slots" : ""}`}
                      onClick={() => {
                        setDay(d);
                        setTimes([]);
                        setOther(false);
                      }}
                      className={cn(dayTile(on), !on && "bg-[#F7F7F0]")}
                    >
                      <small className={dayTileWeekday(on)}>{formatDayISO(d, { weekday: "short" })}</small>
                      <b className={dayTileNumber}>{formatDayISO(d, { day: "numeric" })}</b>
                      <span className="flex h-[5px] gap-[3px]" aria-hidden="true">
                        {openDays.has(d) ? <i className={cn("size-[5px] rounded-full", on ? "bg-[#F1F1E6]" : "bg-[#0054B4]")} /> : null}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className={label}>
                  {multi ? "Times · tap one or more" : "Time"} · {formatDayISO(day, { weekday: "long", month: "long", day: "numeric" })}
                </span>
                <span className={timeZonePill}>
                  <Globe strokeWidth={1.5} aria-hidden="true" />
                  {timeZonePillLabel(timeZone)}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 md:grid-cols-4">
                {tiles.map(({ minutes, taken }) => {
                  const on = !other && times.includes(minutes);
                  const openNow = !taken && openStarts.has(minutes);
                  return (
                    <button
                      key={minutes}
                      type="button"
                      aria-pressed={on}
                      disabled={Boolean(taken)}
                      className={cn(timeTile(on), "h-[50px] disabled:text-[#A3A6AB]")}
                      onClick={() => toggleTime(minutes)}
                    >
                      <span className="text-[15px]">{formatMinutes(minutes)}</span>
                      {taken ? (
                        <small className="max-w-full truncate px-1 text-[10px] font-medium text-[#A3A6AB]">{taken}</small>
                      ) : openNow ? (
                        <small className={timeTileNote(on)}>Open now</small>
                      ) : null}
                    </button>
                  );
                })}
                <button
                  type="button"
                  className={cn(timeTile(other), "h-[50px]", !other && "border-dashed text-[#0054B4]")}
                  aria-pressed={other}
                  onClick={() => {
                    if (!other && times[0] !== undefined) setOtherMinutes(times[0]);
                    setOther((v) => !v);
                  }}
                >
                  <span className="text-[15px]">Other</span>
                </button>
              </div>
              {other ? (
                <label className="flex flex-col gap-1.5">
                  <span className={label}>Start time</span>
                  <select className={input} value={otherMinutes} onChange={(e) => setOtherMinutes(Number(e.target.value))}>
                    {ALL_START_MINUTES.map((m) => (
                      <option key={m} value={m}>
                        {formatMinutes(m)}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              <span className={label}>Where</span>
              <div className="flex flex-wrap gap-1.5">
                {places.map((p) => {
                  const on = placeKey === p.key;
                  const removable = p.location === "in-person" && savedLocations.includes(p.key);
                  const icon = p.location === "online" ? <Video strokeWidth={1.5} aria-hidden="true" /> : <MapPin strokeWidth={1.5} aria-hidden="true" />;
                  if (!removable) {
                    return (
                      <button key={p.key} type="button" aria-pressed={on} className={chip(on)} onClick={() => setPlaceKey(p.key)}>
                        {icon}
                        {p.label}
                      </button>
                    );
                  }
                  return (
                    <span key={p.key} className={cn(chip(on), "gap-0 px-0 pr-1")}>
                      <button
                        type="button"
                        aria-pressed={on}
                        className="inline-flex h-[34px] items-center gap-1.5 rounded-l-[18px] pl-3 pr-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6698D2] [&>svg]:size-3.5"
                        onClick={() => setPlaceKey(p.key)}
                      >
                        {icon}
                        {p.label}
                      </button>
                      <button
                        type="button"
                        aria-label={`Remove ${p.label} from your locations`}
                        className="inline-flex size-6 items-center justify-center rounded-full text-[#767980] hover:bg-[#F4F4EB] hover:text-[#1A202C]"
                        onClick={() => removeLocation(p.key)}
                      >
                        <X className="size-[13px]" strokeWidth={1.5} />
                      </button>
                    </span>
                  );
                })}
                {!addingPlace ? (
                  <button type="button" className={addChip} onClick={() => setAddingPlace(true)}>
                    <Plus strokeWidth={1.5} aria-hidden="true" />
                    Other location
                  </button>
                ) : null}
              </div>
              {addingPlace ? (
                <div className="flex flex-col gap-2.5">
                  <div className="flex items-center gap-2">
                    <input
                      className={cn(input, "min-w-0 flex-1")}
                      value={newPlace}
                      onChange={(e) => setNewPlace(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          void addLocation();
                        }
                      }}
                      placeholder="For example, Mueller Park, field 3"
                      aria-label="New location"
                      maxLength={120}
                      autoComplete="off"
                      autoFocus
                    />
                    <button type="button" className={cn(secondaryButton, smallButton)} onClick={() => { setAddingPlace(false); setNewPlace(""); }}>
                      Cancel
                    </button>
                    <button type="button" className={cn(primaryButton, smallButton)} onClick={() => void addLocation()}>
                      Add
                    </button>
                  </div>
                  <span className={meta}>Saved to your locations for next time.</span>
                </div>
              ) : null}

              {group ? (
                <div className={groupBox}>
                  <label className="flex flex-col gap-1.5">
                    <span className={label}>Name</span>
                    <input
                      className={cn(input, whiteInput)}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="For example, Finishing small group"
                    />
                  </label>
                  <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3">
                    <LengthField value={length} onChange={setLength} white />
                    <div className="flex min-w-0 flex-col gap-1.5">
                      <span className={label}>Spots</span>
                      <span className="flex h-[38px] items-center gap-3.5">
                        <button type="button" className={arrowButton} aria-label="Fewer spots" onClick={() => setSpots((s) => Math.max(2, s - 1))}>
                          <Minus strokeWidth={1.5} />
                        </button>
                        <b className="min-w-5 text-center text-[16px]">{spots}</b>
                        <button type="button" className={arrowButton} aria-label="More spots" onClick={() => setSpots((s) => Math.min(30, s + 1))}>
                          <Plus strokeWidth={1.5} />
                        </button>
                      </span>
                    </div>
                    <PriceField label="Price" value={price} onChange={setPrice} white />
                  </div>
                </div>
              ) : (
                // The app has no per-service length and price yet, so 1-on-1s keep these two fields.
                <div className="grid grid-cols-2 gap-2.5">
                  <LengthField value={length} onChange={setLength} />
                  <PriceField label="Price" value={price} onChange={setPrice} />
                </div>
              )}

              <span className={label}>Repeats</span>
              <div className={segGroup} role="group" aria-label="Repeats">
                <button type="button" className={segButton(!repeat)} aria-pressed={!repeat} onClick={() => setRepeat(false)}>
                  One time
                </button>
                <button type="button" className={segButton(repeat)} aria-pressed={repeat} onClick={() => setRepeat(true)}>
                  <Repeat strokeWidth={1.5} aria-hidden="true" />
                  Every {weekday}
                </button>
              </div>
              <p className="-mt-1.5 text-[13px] leading-[17px] text-[#484D56]">
                {repeat ? (
                  <>
                    <b className="font-semibold">Every {weekday}</b>
                    {openSlots ? ", ongoing" : ` · ${weeks} weeks`}
                  </>
                ) : (
                  "One time"
                )}
                {tail}
              </p>
              {repeat && !openSlots ? (
                <div className={segGroup} role="group" aria-label="How many weeks">
                  {[4, 8, 12].map((w) => (
                    <button key={w} type="button" className={segButton(weeks === w)} aria-pressed={weeks === w} onClick={() => setWeeks(w)}>
                      {w} weeks
                    </button>
                  ))}
                </div>
              ) : null}
              {repeat && openSlots ? (
                <span className={cn(meta, "-mt-1.5")}>Keeps going every week until you change it. Clear a day when you're away.</span>
              ) : null}

              {clashes > 0 && !allClash ? (
                <div className={warmInfo}>
                  <TriangleAlert strokeWidth={1.5} aria-hidden="true" />
                  <span>{plural(clashes, "date")} clash with another session and will be skipped.</span>
                </div>
              ) : null}
              {allClash ? (
                <div className={warmInfo}>
                  <TriangleAlert strokeWidth={1.5} aria-hidden="true" />
                  <span>{picked.length > 1 || (planned ?? 0) > 1 ? "Every date clashes" : "That time clashes"} with another session. Pick another time.</span>
                </div>
              ) : null}
              {error ? (
                <p role="alert" className={warmInfo}>
                  <TriangleAlert strokeWidth={1.5} aria-hidden="true" />
                  <span>{error}</span>
                </p>
              ) : null}
            </div>

            <div className={sheetFooter}>
              <button
                type="button"
                className={cn(primaryButton, sheetButton)}
                disabled={!picked.length || allClash || create.isPending}
                onClick={submit}
              >
                {create.isPending ? "Creating…" : createLabel}
              </button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
