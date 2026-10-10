/**
 * Create session (ATH-71): 1-on-1 or group, day, time, where, and an optional weekly repeat.
 * Open 1-on-1 slots repeat every week with no end; offered and group sessions can repeat for
 * 4, 8 or 12 weeks. Offered and group sessions then go to the share step.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, MapPin, Minus, Plus, Repeat, TriangleAlert, User, Users, Video, X } from "lucide-react";
import { coachesAPI } from "@/api";
import { ToastAction } from "@/components/ui/toast";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  scheduleAPI,
  type CreateSessionsInput,
  type ScheduleRules,
  type ScheduleSession,
  type SessionPosition,
} from "@/api/schedule";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { zonedWallTimeToUtc } from "@/utils/dateHelpers";
import { DEFAULT_PILLARS } from "@/utils/pillarIcons";
import {
  ALL_START_MINUTES,
  addDaysISO,
  formatDayISO,
  formatMinutes,
  itemAt,
  layoutDays,
  minutesToHHMM,
  monthRangeLabel,
  plural,
  suggestedStartMinutes,
  timeZonePillLabel,
  viewerToEastern,
  WEEKDAY_NAMES,
  isoWeekday,
} from "@/utils/schedule";
import { ShareSession } from "./ShareSession";
import {
  choice,
  dayTile,
  dayTileNumber,
  dayTileWeekday,
  dialogContent,
  input,
  label,
  meta,
  primaryButton,
  iconButton,
  segButton,
  segGroup,
  textButton,
  timeTile,
} from "./styles";

type Kind = "individual" | "group";
type Who = "open" | "offered";
type Place = { key: string; label: string; location: "online" | "in-person"; place: string | null };

const LENGTHS = [45, 60, 75, 90, 120];
const LEVELS = ["All levels", "Beginners welcome", "Club and up"];
const GROUP_PRICE = "35";

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
  const [more, setMore] = useState(false);
  const [pillar, setPillar] = useState("");
  const [position, setPosition] = useState<SessionPosition | "">("");
  const [ages, setAges] = useState("");
  const [level, setLevel] = useState(LEVELS[0]);
  const [about, setAbout] = useState("");
  const [bring, setBring] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<ScheduleSession[] | null>(null);

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
    setMore(false);
    setPillar("");
    setPosition("");
    setAges("");
    setLevel(LEVELS[0]);
    setAbout("");
    setBring("");
    setError(null);
    setCreated(null);
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
        title: `${location} removed`,
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
    if (!location) return;
    const existing = savedLocations.find((l) => l.toLowerCase() === location.toLowerCase());
    try {
      if (!existing) await saveLocations([...savedLocations, location]);
      setPlaceKey(existing ?? location);
      setAddingPlace(false);
      setNewPlace("");
    } catch (err) {
      toast({ title: "Couldn't save it", description: err instanceof Error ? err.message : undefined, variant: "destructive" });
    }
  };

  const stripDates = useMemo(() => Array.from({ length: 7 }, (_, i) => addDaysISO(stripStart, i)), [stripStart]);

  // The strip's week, to grey out taken times. Stored dates are Eastern, so fetch a day either side.
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

  const group = kind === "group";
  const openSlots = !group && who === "open";
  const multi = openSlots;
  const picked = other ? [otherMinutes] : [...times].sort((a, b) => a - b);
  const now = Date.now();
  const candidates = suggestedStartMinutes(day);

  const takenBy = (minutes: number) => {
    const item = itemAt(dayData, minutes, length, timeZone, openSlots);
    if (!item) return null;
    if (item.kind === "busy") return "Busy";
    if (item.kind === "open") return "Open";
    if (item.kind === "group") return item.session?.sessionName ?? "Group";
    if (item.kind === "offered") return "Offered";
    const booking = item.session?.bookings[0];
    return booking ? booking.athleteName.split(" ")[0] : "Taken";
  };
  const isPast = (minutes: number) =>
    (zonedWallTimeToUtc(day, `${minutesToHHMM(minutes)}:00`, timeZone)?.getTime() ?? 0) <= now;

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
  const repeatText = repeat
    ? `Every ${weekday}${openSlots ? ", ongoing" : ` · ${weeks} weeks`}`
    : "One time";
  const summary = `${repeatText} · ${length} min${price ? ` · $${price}${group ? " per athlete" : ""}` : ""}`;

  const create = useMutation({
    mutationFn: async () => {
      const place = places.find((p) => p.key === placeKey) ?? places[0];
      const details = {
        ...(ages.trim() ? { ages: ages.trim() } : {}),
        ...(group ? { level } : {}),
        ...(about.trim() ? { about: about.split("\n").map((x) => x.trim()).filter(Boolean) } : {}),
        ...(bring.trim() ? { bring: bring.trim() } : {}),
      };
      const payload: CreateSessionsInput = {
        sessionType: kind,
        visibility: group ? "open" : who,
        times: picked.map((m) => viewerToEastern(day, m, timeZone)),
        repeat: repeat ? (openSlots ? "weekly" : "weeks") : "none",
        weeks: repeat && !openSlots ? weeks : 1,
        durationMinutes: length,
        sessionName: group ? name.trim() : undefined,
        price: priceNumber,
        capacity: group ? spots : 1,
        location: place.location,
        place: place.place,
        pillar: pillar || null,
        position: position || null,
        details,
      };
      const result = await scheduleAPI.createSessions(payload);
      return result;
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
          title: `${plural(picked.length, "open slot")} added${repeat ? ` every ${weekday}` : ""}`,
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
      : repeat
        ? `Create ${plural(weeks, group ? "group session" : "session")}`
        : `Create ${formatDayISO(day, { weekday: "short" })} ${formatMinutes(picked[0])} ${group ? "group" : "1-on-1"}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={dialogContent}>
        <DialogHeader className="px-5 pb-3 pt-5 pr-14 text-left sm:px-[25px]">
          <DialogTitle className="text-[22px] font-semibold leading-[28px] tracking-[-0.05em]">
            {created ? "Who should book it?" : "Create session"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {created ? "Send the new session to athletes or share its link." : "Create a 1-on-1 or group session."}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 px-5 pb-5 sm:px-[25px]">
          {created ? (
            created.length ? (
              <ShareSession
                sessions={created}
                coachId={coachId}
                coachName={coachName}
                slug={rules.slug}
                timeZone={timeZone}
                onDone={(sent) => {
                  if (!sent) toast({ title: group ? "Group session created" : "Session created. It stays open until someone books it" });
                  onOpenChange(false);
                }}
              />
            ) : (
              <p className={meta}>Created. Find it on your schedule.</p>
            )
          ) : (
            <>
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
                <div className="flex flex-col gap-1.5">
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
                <span className={label}>
                  Day <span className="ml-1 text-[#1A202C]">{monthRangeLabel(stripDates)}</span>
                </span>
                <span className="flex gap-1.5">
                  <button
                    type="button"
                    className={cn(iconButton, "size-[28px]")}
                    aria-label="Earlier days"
                    disabled={stripStart <= todayISO}
                    onClick={() => {
                      const next = addDaysISO(stripStart, -7) < todayISO ? todayISO : addDaysISO(stripStart, -7);
                      setStripStart(next);
                      setDay(next);
                      setTimes([]);
                    }}
                  >
                    <ChevronLeft strokeWidth={1.5} />
                  </button>
                  <button
                    type="button"
                    className={cn(iconButton, "size-[28px]")}
                    aria-label="Later days"
                    onClick={() => {
                      const next = addDaysISO(stripStart, 7);
                      setStripStart(next);
                      setDay(next);
                      setTimes([]);
                    }}
                  >
                    <ChevronRight strokeWidth={1.5} />
                  </button>
                </span>
              </div>
              <div className="grid grid-cols-7 gap-1.5" role="group" aria-label="Days">
                {stripDates.map((d) => (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={d === day}
                    aria-label={formatDayISO(d, { weekday: "long", month: "long", day: "numeric" })}
                    onClick={() => {
                      setDay(d);
                      setTimes([]);
                      setOther(false);
                    }}
                    className={cn(dayTile(d === day), d !== day && "bg-[#F7F7F0]")}
                  >
                    <small className={dayTileWeekday(d === day)}>{formatDayISO(d, { weekday: "short" })}</small>
                    <b className={dayTileNumber}>{formatDayISO(d, { day: "numeric" })}</b>
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className={label}>
                  {multi ? "Times · tap one or more" : "Time"} · {formatDayISO(day, { weekday: "long", month: "long", day: "numeric" })}
                </span>
                <span className="rounded-full border border-[#EAEADF] bg-[#F4F4EB] px-2 py-0.5 text-[11px] font-medium leading-[14px] text-[#767980]">
                  {timeZonePillLabel(timeZone)}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {candidates.map((minutes) => {
                  const taken = takenBy(minutes);
                  const past = isPast(minutes);
                  const on = !other && times.includes(minutes);
                  return (
                    <button
                      key={minutes}
                      type="button"
                      aria-pressed={on}
                      disabled={Boolean(taken) || past}
                      className={cn(timeTile(on), "h-[50px] text-[15px]")}
                      onClick={() => toggleTime(minutes)}
                    >
                      <span>{formatMinutes(minutes)}</span>
                      {taken ? <small className="text-[10px] font-medium">{taken}</small> : null}
                    </button>
                  );
                })}
                <button type="button" className={cn(timeTile(other), "h-[50px] text-[15px]", !other && "border-dashed text-[#0054B4]")} aria-pressed={other} onClick={() => setOther((v) => !v)}>
                  Other
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
              <div className="flex flex-wrap gap-2">
                {places.map((p) => {
                  const removable = p.location === "in-person" && savedLocations.includes(p.key);
                  return (
                    <span key={p.key} className="relative inline-flex">
                      <button
                        type="button"
                        aria-pressed={placeKey === p.key}
                        className={cn(choice(placeKey === p.key), removable && "pr-7")}
                        onClick={() => setPlaceKey(p.key)}
                      >
                        {p.location === "online" ? <Video strokeWidth={1.5} aria-hidden="true" /> : <MapPin strokeWidth={1.5} aria-hidden="true" />}
                        {p.label}
                      </button>
                      {removable ? (
                        <button
                          type="button"
                          aria-label={`Remove ${p.label} from your locations`}
                          className="absolute right-1.5 top-1/2 inline-flex size-5 -translate-y-1/2 items-center justify-center rounded-full text-[#767980] hover:bg-[#EAEADF] hover:text-[#1A202C]"
                          onClick={() => removeLocation(p.key)}
                        >
                          <X className="size-3" strokeWidth={1.75} />
                        </button>
                      ) : null}
                    </span>
                  );
                })}
                {!addingPlace ? (
                  <button type="button" className={textButton} onClick={() => setAddingPlace(true)}>
                    <Plus strokeWidth={1.5} aria-hidden="true" />
                    Other location
                  </button>
                ) : null}
              </div>
              {addingPlace ? (
                <div className="flex gap-2">
                  <input
                    className={input}
                    value={newPlace}
                    onChange={(e) => setNewPlace(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void addLocation();
                      }
                    }}
                    placeholder="For example, Riverside Park field 2"
                    aria-label="New location"
                    maxLength={120}
                    autoFocus
                  />
                  <button type="button" className={primaryButton} disabled={!newPlace.trim()} onClick={() => void addLocation()}>
                    Add
                  </button>
                  <button type="button" className={textButton} onClick={() => { setAddingPlace(false); setNewPlace(""); }}>
                    Cancel
                  </button>
                </div>
              ) : null}

              {group ? (
                <label className="flex flex-col gap-1.5">
                  <span className={label}>Name</span>
                  <input className={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="For example, Finishing small group" />
                </label>
              ) : null}
              <div className={cn("grid gap-3", group ? "grid-cols-3" : "grid-cols-2")}>
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
                {group ? (
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
                ) : null}
                <label className="flex flex-col gap-1.5">
                  <span className={label}>{group ? "Price per athlete" : "Price"}</span>
                  <span className="flex h-[38px] items-center gap-1 rounded-[8px] border border-[#EAEADF] bg-[#F9F9F5] px-3 focus-within:ring-2 focus-within:ring-[#6698D2]">
                    <span className="text-[14px] text-[#767980]" aria-hidden="true">$</span>
                    <input
                      className="h-full w-full min-w-0 bg-transparent text-[14px] text-[#1A202C] focus:outline-none"
                      type="number"
                      min={0}
                      inputMode="decimal"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                    />
                  </span>
                </label>
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
                        <option value="">Any</option>
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
                    {group ? (
                      <label className="flex flex-col gap-1.5">
                        <span className={label}>Level</span>
                        <select className={input} value={level} onChange={(e) => setLevel(e.target.value)}>
                          {LEVELS.map((l) => (
                            <option key={l}>{l}</option>
                          ))}
                        </select>
                      </label>
                    ) : null}
                  </div>
                  <label className="flex flex-col gap-1.5">
                    <span className={label}>What you'll work on (optional)</span>
                    <textarea
                      className={cn(input, "h-auto py-2")}
                      rows={3}
                      value={about}
                      onChange={(e) => setAbout(e.target.value)}
                      placeholder="One per line"
                    />
                    <span className={meta}>Families see this before they book.</span>
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className={label}>Bring (optional)</span>
                    <input className={input} value={bring} onChange={(e) => setBring(e.target.value)} placeholder="Ball, water, shin guards" />
                  </label>
                </div>
              ) : (
                <button type="button" className={cn(textButton, "self-start")} onClick={() => setMore(true)}>
                  <Plus strokeWidth={1.5} aria-hidden="true" />
                  More details: pillar, position, ages, what to bring
                </button>
              )}

              <span className={label}>Repeats</span>
              <div className={segGroup} role="group" aria-label="Repeats">
                <button type="button" className={segButton(!repeat)} aria-pressed={!repeat} onClick={() => setRepeat(false)}>
                  One time
                </button>
                <button type="button" className={segButton(repeat)} aria-pressed={repeat} onClick={() => setRepeat(true)}>
                  Every {weekday}
                </button>
              </div>
              <div className="flex items-center gap-2 rounded-[8px] bg-[#F1F1E6] px-3 py-2.5">
                <Repeat className="size-4 flex-none text-[#767980]" strokeWidth={1.5} aria-hidden="true" />
                <span className="grow text-[14px] leading-[18px] text-[#1A202C]">{summary}</span>
              </div>
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
                <span className={meta}>
                  Keeps going every week, {rules.bookingWindowWeeks} weeks ahead, until you change it. Clear a day when you're away.
                </span>
              ) : null}

              {error ? (
                <p role="alert" className="flex items-center gap-2 rounded-[8px] bg-[#FCEFDA] px-3 py-2 text-[14px] text-[#906A29]">
                  <TriangleAlert className="size-4 flex-none" strokeWidth={1.5} aria-hidden="true" />
                  {error}
                </p>
              ) : null}

              <button
                type="button"
                className={cn(primaryButton, "h-[42px] w-full")}
                disabled={!picked.length || create.isPending}
                onClick={submit}
              >
                {create.isPending ? "Creating…" : createLabel}
              </button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
