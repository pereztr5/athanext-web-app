import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { packagesAPI, type Camp, type CampCoach, type CampInput } from "@/api/packages";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { choice } from "@/components/schedule/styles";
import { cn } from "@/lib/utils";
import { campInitials, inclusiveDays, minutesBetween, todayUtc, validityThrough } from "./format";
import { useCampTeammates } from "./useCamps";

const fieldLabel = "text-label-xsm text-dark-300";

const dollarsToCents = (value: string): number | null => {
  const trimmed = value.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  return Math.round(Number(trimmed) * 100);
};

const centsToDollars = (cents: number) => (cents / 100).toFixed(2);

const parseOptionalInt = (value: string): number | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^\d+$/.test(trimmed)) return Number.NaN;
  return Number(trimmed);
};

const timeForInput = (value: string | null) => (value ? value.slice(0, 5) : "");

export const CampEditorDialog = ({
  open,
  camp,
  coachId,
  onOpenChange,
}: {
  open: boolean;
  /** Null creates a camp. */
  camp: Camp | null;
  coachId: string;
  onOpenChange: (open: boolean) => void;
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const teammates = useCampTeammates(open);
  const isNew = !camp;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [startsOn, setStartsOn] = useState("");
  const [endsOn, setEndsOn] = useState("");
  const [dailyStart, setDailyStart] = useState("");
  const [dailyEnd, setDailyEnd] = useState("");
  const [location, setLocation] = useState("");
  const [price, setPrice] = useState("");
  const [capacity, setCapacity] = useState("");
  const [ageMin, setAgeMin] = useState("");
  const [ageMax, setAgeMax] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(camp?.name ?? "");
    setDescription(camp?.description ?? "");
    setStartsOn(camp?.startsOn ?? "");
    setEndsOn(camp?.endsOn ?? "");
    setDailyStart(timeForInput(camp?.dailyStart ?? null));
    setDailyEnd(timeForInput(camp?.dailyEnd ?? null));
    setLocation(camp?.location ?? "");
    setPrice(camp ? centsToDollars(camp.totalPriceCents) : "");
    setCapacity(camp?.capacity != null ? String(camp.capacity) : "");
    setAgeMin(camp?.ageMin != null ? String(camp.ageMin) : "");
    setAgeMax(camp?.ageMax != null ? String(camp.ageMax) : "");
    setSelected(camp?.coCoachIds ?? []);
    setError(null);
    setSaving(false);
  }, [open, camp]);

  const options = useMemo(() => {
    const byId = new Map<string, CampCoach>();
    for (const coach of camp?.coCoaches ?? []) byId.set(coach.id, coach);
    for (const coach of teammates.data?.coaches ?? []) byId.set(coach.id, coach);
    for (const id of selected) {
      if (!byId.has(id)) byId.set(id, { id, name: "Co-coach", photoUrl: null });
    }
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [camp, teammates.data, selected]);

  const toggle = (id: string) => {
    setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  };

  const save = async () => {
    const trimmedName = name.trim();
    const trimmedDescription = description.trim();
    const trimmedLocation = location.trim();
    const cents = dollarsToCents(price);
    const cap = parseOptionalInt(capacity);
    const young = parseOptionalInt(ageMin);
    const old = parseOptionalInt(ageMax);
    const today = todayUtc();

    let message = "";
    if (!trimmedName) message = "Name the camp.";
    else if (trimmedName.length > 100) message = "Keep the name under 100 characters.";
    else if (isNew && !trimmedDescription) message = "Add a description.";
    else if (trimmedDescription.length > 500) message = "Keep the description under 500 characters.";
    else if (isNew && (!startsOn || !endsOn)) message = "Add the start and end dates.";
    else if ((startsOn && !endsOn) || (!startsOn && endsOn)) message = "Add both the start and end dates.";
    else if (startsOn && endsOn && endsOn < startsOn) message = "The end date is before the start date.";
    else if (startsOn && endsOn && endsOn < today) message = "The camp has already ended. Pick an end date that is still ahead.";
    else if (isNew && (!dailyStart || !dailyEnd)) message = "Add the daily start and end times.";
    else if ((dailyStart && !dailyEnd) || (!dailyStart && dailyEnd)) message = "Add both daily times.";
    else if (dailyStart && dailyEnd && minutesBetween(dailyStart, dailyEnd) <= 0) message = "Daily end time must be after the start time.";
    else if (isNew && !trimmedLocation) message = "Add a location.";
    else if (trimmedLocation.length > 200) message = "Keep the location under 200 characters.";
    else if (cents == null) message = "Enter a price in dollars.";
    else if (cents < 50) message = "Price must be at least $0.50.";
    else if (isNew && cap == null) message = "Add a capacity.";
    else if (cap != null && (Number.isNaN(cap) || cap < 1)) message = "Capacity must be at least 1.";
    else if (isNew && (young == null || old == null)) message = "Add the youngest and oldest ages.";
    else if ((young != null && Number.isNaN(young)) || (old != null && Number.isNaN(old))) message = "Ages must be whole numbers.";
    else if (young != null && (young < 1 || young > 99)) message = "Youngest age must be between 1 and 99.";
    else if (old != null && (old < 1 || old > 99)) message = "Oldest age must be between 1 and 99.";
    else if (young != null && old != null && old < young) message = "Oldest age is below the youngest age.";

    if (message || cents == null) {
      setError(message || "Enter a price in dollars.");
      return;
    }

    const sessionCount = startsOn && endsOn ? inclusiveDays(startsOn, endsOn) : Math.max(1, camp?.sessionCount ?? 1);
    const durationMinutes = dailyStart && dailyEnd ? minutesBetween(dailyStart, dailyEnd) : Math.max(1, camp?.durationMinutes ?? 60);
    const validityDays = endsOn ? validityThrough(endsOn, today) : Math.max(1, camp?.validityDays ?? 1);
    const input: CampInput = {
      name: trimmedName,
      description: trimmedDescription || null,
      totalPriceCents: cents,
      isActive: camp?.isActive ?? true,
      startsOn: startsOn || null,
      endsOn: endsOn || null,
      dailyStart: dailyStart || null,
      dailyEnd: dailyEnd || null,
      location: trimmedLocation || null,
      capacity: cap,
      ageMin: young,
      ageMax: old,
      coCoachIds: selected,
      sessionCount,
      durationMinutes,
      validityDays,
    };

    setSaving(true);
    setError(null);
    const result = await packagesAPI.saveCamp(coachId, input, camp?.id);
    setSaving(false);
    if (result.error || !result.data) {
      setError(result.error?.message || "That didn't save. Try again.");
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["coach-camps", coachId] });
    await queryClient.invalidateQueries({ queryKey: ["coach-packages", coachId] });
    toast({ title: isNew ? "Camp created" : "Camp saved" });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!saving) onOpenChange(next); }}>
      <DialogContent className="max-h-[90dvh] max-w-lg gap-0 overflow-hidden p-0 font-sans tracking-[-0.03em] text-dark [&>button]:right-[17px] [&>button]:top-[19px]">
        <DialogHeader className="space-y-1.5 px-[25px] py-5 pr-14 text-left">
          <DialogTitle className="text-section text-dark">{isNew ? "Add camp" : "Edit camp"}</DialogTitle>
          <DialogDescription className="text-body-m text-dark-300">
            Families pay once to register. A camp does not add session credits.
          </DialogDescription>
        </DialogHeader>
        <div className="h-px bg-light-525" />
        <div className="flex max-h-[60dvh] flex-col gap-4 overflow-y-auto px-[25px] py-5">
          <div className="flex flex-col gap-1.5">
            <Label className={fieldLabel}>Name</Label>
            <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Thanksgiving high performance camp" maxLength={100} />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label className={fieldLabel}>Starts</Label>
              <Input type="date" value={startsOn} onChange={(event) => setStartsOn(event.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className={fieldLabel}>Ends</Label>
              <Input type="date" value={endsOn} onChange={(event) => setEndsOn(event.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className={fieldLabel}>Daily start</Label>
              <Input type="time" value={dailyStart} onChange={(event) => setDailyStart(event.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className={fieldLabel}>Daily end</Label>
              <Input type="time" value={dailyEnd} onChange={(event) => setDailyEnd(event.target.value)} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className={fieldLabel}>Location</Label>
            <Input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Field or address" maxLength={200} />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label className={fieldLabel}>Price</Label>
              <Input inputMode="decimal" value={price} onChange={(event) => setPrice(event.target.value)} placeholder="260.00" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className={fieldLabel}>Capacity</Label>
              <Input inputMode="numeric" value={capacity} onChange={(event) => setCapacity(event.target.value)} placeholder="20" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1.5">
                <Label className={fieldLabel}>Youngest</Label>
                <Input inputMode="numeric" value={ageMin} onChange={(event) => setAgeMin(event.target.value)} placeholder="10" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className={fieldLabel}>Oldest</Label>
                <Input inputMode="numeric" value={ageMax} onChange={(event) => setAgeMax(event.target.value)} placeholder="14" />
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className={fieldLabel}>Description</Label>
            <Textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} maxLength={500} placeholder="Who the camp is for and what the days look like" />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className={fieldLabel}>Co-coaches</span>
            {teammates.isLoading ? <span className="text-caption text-dark-300">Loading coaches…</span> : null}
            {teammates.isError ? <span className="text-caption text-error-700">Could not load coaches in your organization.</span> : null}
            {teammates.data?.unavailable ? (
              <span className="text-caption text-dark-300">Co-coaches cannot be loaded until the database update is applied.</span>
            ) : null}
            {!teammates.isLoading && !teammates.isError && !teammates.data?.unavailable && options.length === 0 ? (
              <span className="text-caption text-dark-300">No other coaches in your organization.</span>
            ) : null}
            {options.length ? (
              <div className="flex flex-wrap gap-2">
                {options.map((coach) => {
                  const on = selected.includes(coach.id);
                  return (
                    <button
                      key={coach.id}
                      type="button"
                      aria-pressed={on}
                      className={cn(choice(on), "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary")}
                      onClick={() => toggle(coach.id)}
                    >
                      <span className="inline-flex size-5 items-center justify-center overflow-hidden rounded-full border border-light-550 bg-light-400 text-label-xsm">
                        {coach.photoUrl ? <img src={coach.photoUrl} alt="" className="size-full object-cover" /> : campInitials(coach.name)}
                      </span>
                      {coach.name}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
          {error ? (
            <p role="alert" className="text-body-m text-error-700">
              {error}
            </p>
          ) : null}
        </div>
        <div className="h-px bg-light-525" />
        <DialogFooter className="px-[25px] py-4">
          <Button variant="outline" type="button" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void save()} disabled={saving}>
            {saving ? "Saving…" : isNew ? "Create camp" : "Save camp"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
