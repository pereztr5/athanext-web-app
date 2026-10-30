/**
 * Athlete Home (ATH-92): the athlete's dashboard and profile in one. Player card with Book a
 * session and Edit profile (photo included), a "Finish profile" checklist until it's complete, the next
 * session with what they're working on, their coaches, and About.
 */
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarPlus, ChevronRight, Lock, MoreHorizontal, Pencil, Plus, Video } from "@/components/icons";
import { BrandPill } from "@/components/brand";
import { athleteHomeAPI, type AthleteProfileEdit, type HomeData } from "@/api/athleteHome";
import { QuickBookDialog } from "@/components/home/QuickBookDialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ToastAction } from "@/components/ui/toast";
import { EditPhotoButton } from "@/components/home/EditPhotoButton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MyCampsCard } from "@/components/camps/MyCampsCard";
import { MyInvoicesCard } from "@/components/home/MyInvoicesCard";
import { card, dangerButton, dialogContent, iconButton, input, label, meta, pageTitle, primaryButton, secondaryButton, smallButton, textButton } from "@/components/schedule/styles";
import { PATHWAY_TAGS } from "@/constants/pathwayTags";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/contexts/ProfileContext";
import { useToast } from "@/hooks/use-toast";
import { useViewerTimeZone } from "@/hooks/useViewerTimeZone";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/routes";
import { ageOn, playerLine, profileItems, sportLabel, type HomeAthlete, type ProfileItemKey } from "@/utils/athleteHome";
import { coachProfilePath } from "@/utils/coachSlug";
import { REMOVE_COACH_NOTE, firstNameOf, removeCoachQuestion, withoutCoach } from "@/utils/myCoaches";
import { getZonedISODate } from "@/utils/dateHelpers";
import { formatDayISO, plural } from "@/utils/schedule";
import { formatDateInZone, formatSessionSpan, sessionDisplayZone } from "@/utils/viewerTime";

const h3 = "text-subtitle text-dark";
const splitName = (full: string) => {
  const parts = full.trim().split(/\s+/);
  return { first: parts[0] ?? "", last: parts.slice(1).join(" ") };
};

const initials = (name: string) =>
  name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || "A";

const Avatar = ({ name, photo, size, className }: { name: string; photo: string | null; size: number; className?: string }) => (
  <span
    className={cn("inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary-50 font-medium text-primary", className)}
    style={{ width: size, height: size, fontSize: size / 2.6 }}
  >
    {photo ? <img src={photo} alt="" className="size-full object-cover" /> : initials(name)}
  </span>
);

export const AthleteHome = () => {
  const timeZone = useViewerTimeZone();
  const today = getZonedISODate(new Date(), timeZone);
  const { profile } = useProfile();
  const [params, setParams] = useSearchParams();
  const home = useQuery({ queryKey: ["athlete-home"], queryFn: () => athleteHomeAPI.get() });
  const [editing, setEditing] = useState<ProfileItemKey | "open" | null>(params.get("edit") ? "open" : null);

  const a = home.data?.athlete ?? null;
  const isParent = profile?.userProfile?.persona_type === "parent";
  const first = (a?.fullName || "").split(" ")[0] || "your athlete";
  const whose = isParent ? `${first}'s` : "your";
  const items = useMemo(() => (a ? profileItems(a) : []), [a]);
  const done = items.filter((i) => i.done).length;
  const [booking, setBooking] = useState<{ id: string; name: string } | null>(null);
  const [removing, setRemoving] = useState<{ id: string; name: string } | null>(null);
  const remove = useRemoveCoach(() => setRemoving(null));

  if (home.isLoading) {
    return <div className="px-4 py-10 md:px-5"><p className={meta}>Loading…</p></div>;
  }
  if (!a) {
    return (
      <div className="mx-auto flex max-w-wrapper-focused flex-col items-center gap-3 px-4 py-16 text-center">
        <h1 className="text-section">Set up your athlete profile</h1>
        <p className={meta}>Add the athlete's details so coaches can plan sessions.</p>
        <Link to={ROUTES.CREATE_ATHLETE_PROFILE} className={primaryButton}>Create profile</Link>
      </div>
    );
  }

  const next = home.data?.next ?? null;
  const focus = home.data?.focus ?? null;
  const coaches = home.data?.coaches ?? [];
  const line = playerLine(a, today);
  const age = ageOn(a.dateOfBirth, today);
  const details: [string, string][] = [
    ["Age", a.dateOfBirth && age != null ? `${age} · born ${formatDayISO(a.dateOfBirth, { month: "short", day: "numeric", year: "numeric" })}` : ""],
    ["Sport", sportLabel(a.sport)],
    ["Position", a.position ?? ""],
    ["Club or team", a.team ?? ""],
    ["Pathway level", a.pathway ?? ""],
    ["Graduation year", a.graduationYear ?? ""],
  ];

  return (
    <div className="overflow-x-hidden px-4 pb-8 pt-1 md:px-5 md:pb-12">
      <div className="mx-auto flex w-full max-w-wrapper flex-col gap-5">
        <section className={cn(card, "flex-row flex-wrap items-center gap-5 max-[820px]:gap-3.5")}>
          <Avatar name={a.fullName} photo={a.photo} size={80} className="max-[820px]:!size-14 max-[820px]:!text-subtitle" />
          <div className="flex min-w-0 flex-1 flex-col gap-2 max-[820px]:basis-[calc(100%-80px)]">
            <h1 className={pageTitle}>{a.fullName || "Your athlete"}</h1>
            {line ? <span className="text-body-m text-dark-300">{line}</span> : null}
            <div className="flex flex-wrap gap-1.5">
              {a.sport ? <BrandPill tone="teal">{sportLabel(a.sport)}</BrandPill> : null}
              {a.pathway ? <BrandPill tone="neutral">{a.pathway}</BrandPill> : null}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 max-[820px]:w-full">
            <Link to={ROUTES.BOOK} className={cn(primaryButton, "max-[820px]:flex-1")}>
              <CalendarPlus strokeWidth={1.5} aria-hidden="true" />
              Book a session
            </Link>
            <button type="button" className={secondaryButton} onClick={() => setEditing("open")}>
              <Pencil strokeWidth={1.5} aria-hidden="true" />
              Edit profile
            </button>
          </div>
        </section>

        {done < items.length ? (
          <section className={cn(card, "border-primary-200")}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-1">
                <span className={h3}>Finish {whose} profile</span>
                <span className={meta}>Coaches use this to plan {whose} sessions</span>
              </div>
              <span className="text-label-sm">{done} of {items.length}</span>
            </div>
            <div className="h-[5px] overflow-hidden rounded-full bg-light-550" aria-hidden="true">
              <div className="h-full rounded-full bg-primary" style={{ width: `${Math.round((done / items.length) * 100)}%` }} />
            </div>
            <div className="flex flex-wrap gap-2">
              {items.filter((i) => !i.done).map((i) => (
                <button key={i.key} type="button" className={cn(secondaryButton, smallButton)} onClick={() => setEditing(i.key)}>
                  <Plus strokeWidth={1.5} aria-hidden="true" />
                  {i.label}
                </button>
              ))}
            </div>
          </section>
        ) : null}

        <MyCampsCard />
        <MyInvoicesCard />

        <div className="grid grid-cols-1 items-start gap-5 md:grid-cols-2">
          <section className={card}>
            <div className="flex items-center justify-between">
              <span className={h3}>Next session</span>
              <Link to={ROUTES.MY_SESSIONS} className={cn(textButton, smallButton)}>All sessions</Link>
            </div>
            {next ? (
              <Link to={`/sessions/${next.id}`} className="flex items-center gap-3 text-left hover:opacity-90">
                <span className="flex size-11 shrink-0 flex-col items-center justify-center rounded-control border border-light-525 bg-light-400">
                  <small className="text-label-xsm text-dark-300">{formatDateInZone(new Date(next.start), sessionDisplayZone(timeZone, next.isCamp), { weekday: "short" })}</small>
                  <b className="text-subtitle">{formatDateInZone(new Date(next.start), sessionDisplayZone(timeZone, next.isCamp), { day: "numeric" })}</b>
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <b className="truncate text-label-sm">{next.title} with {next.coachName}</b>
                  <span className={meta}>
                    {formatSessionSpan(new Date(next.start), new Date(next.end), timeZone, next.isCamp)}
                    {next.place ? ` · ${next.place === "online" ? "Video call" : next.place === "in-person" ? "In person" : next.place}` : ""}
                  </span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-dark-300" strokeWidth={1.5} aria-hidden="true" />
              </Link>
            ) : (
              <>
                <p className={meta}>Nothing booked yet.</p>
                <Link to={ROUTES.BOOK} className={cn(primaryButton, smallButton, "self-start")}>
                  <CalendarPlus strokeWidth={1.5} aria-hidden="true" />
                  Book a session
                </Link>
              </>
            )}
            {focus ? (
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 rounded-control bg-light-400 px-3 py-2.5">
                <span className={label}>Working on</span>
                <span className="text-label-sm text-dark">{focus.text}</span>
                <span className={meta}>
                  From {focus.coachName.split(" ")[0]}'s feedback, {formatDayISO(focus.date, { month: "short", day: "numeric" })}
                </span>
              </div>
            ) : null}
          </section>

          <section className={card}>
            <div className="flex items-center justify-between">
              <span className={h3}>Coaches</span>
              <Link to={ROUTES.COACHES} className={textButton}>Find a new coach</Link>
            </div>
            {coaches.length ? (
              <ul className="flex flex-col divide-y divide-light-525">
                {coaches.map((c) => (
                  <li key={c.id} className="flex items-center gap-2 py-2.5">
                    <Link to={coachProfilePath(c.slug || c.id)} className="flex min-w-0 flex-1 items-center gap-3 hover:opacity-90">
                      <Avatar name={c.name} photo={c.photo} size={36} />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <b className="truncate text-label-sm">{c.name}</b>
                        <span className={meta}>
                          {c.nextDate ? `Next: ${formatDayISO(c.nextDate, { weekday: "short", month: "short", day: "numeric" })}` : "No session booked"}
                          {c.creditsLeft ? ` · ${plural(c.creditsLeft, "session")} left` : ""}
                        </span>
                      </span>
                    </Link>
                    <button type="button" className={cn(secondaryButton, smallButton)} onClick={() => setBooking({ id: c.id, name: c.name })}>
                      Book
                    </button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button type="button" className={cn(iconButton, "size-control-sm")} aria-label={`More for ${c.name}`}>
                          <MoreHorizontal strokeWidth={1.5} aria-hidden="true" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => setRemoving({ id: c.id, name: c.name })}>
                          Remove from my coaches
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={meta}>No coaches yet. Find a coach near you and book a first session.</p>
            )}
          </section>
        </div>

        <section className={card}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className={h3}>About {isParent ? first : "you"}</span>
            <span className={cn(meta, "inline-flex items-center gap-1.5")}>
              <Lock className="size-3" strokeWidth={1.5} aria-hidden="true" />
              Only coaches {isParent ? first : "you"} {isParent ? "has" : "have"} booked with see this
            </span>
          </div>
          <div className="grid grid-cols-1 gap-x-6 gap-y-3.5 sm:grid-cols-2">
            {details.map(([l, v]) => (
              <div key={l} className="flex flex-col gap-1">
                <span className={label}>{l}</span>
                {v ? (
                  <span className="text-body-m text-dark">{v}</span>
                ) : (
                  <button type="button" className={cn(textButton, "self-start")} onClick={() => setEditing("open")}>Add</button>
                )}
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-1 rounded-control bg-light-400 px-3 py-2.5">
            <span className={label}>Season goal</span>
            {a.seasonGoal ? (
              <span className="text-label-sm text-dark">{a.seasonGoal}</span>
            ) : (
              <button type="button" className={cn(textButton, "self-start text-left")} onClick={() => setEditing("goal")}>
                Add a goal so coaches know what {isParent ? `${first} is` : "you're"} working toward
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Video className="size-4 text-dark-300" strokeWidth={1.5} aria-hidden="true" />
            {a.highlightVideoUrl ? (
              <a className={textButton} href={toUrl(a.highlightVideoUrl)} target="_blank" rel="noopener noreferrer">Highlight video</a>
            ) : (
              <button type="button" className={textButton} onClick={() => setEditing("video")}>Add a highlight video link</button>
            )}
          </div>
        </section>
      </div>

      <QuickBookDialog
        coach={booking}
        athleteId={a.id}
        athleteFirst={isParent ? first : null}
        timeZone={timeZone}
        onClose={() => setBooking(null)}
      />

      <Dialog open={Boolean(removing)} onOpenChange={(o) => !o && !remove.isPending && setRemoving(null)}>
        <DialogContent className={dialogContent}>
          <DialogHeader className="px-5 pb-3 pt-5 pr-14 text-left sm:px-[25px]">
            <DialogTitle className="text-section">{removing ? removeCoachQuestion(removing.name) : ""}</DialogTitle>
            <DialogDescription className="text-body-m text-dark-300">{REMOVE_COACH_NOTE}</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 px-5 pb-5 sm:px-[25px]">
            <button type="button" className={secondaryButton} onClick={() => setRemoving(null)} disabled={remove.isPending}>
              Keep
            </button>
            <button type="button" className={dangerButton} disabled={remove.isPending} onClick={() => removing && remove.mutate(removing)}>
              {remove.isPending ? "Removing…" : "Remove"}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <EditProfileDialog
        athlete={a}
        focus={editing}
        onClose={() => {
          setEditing(null);
          if (params.has("edit")) {
            params.delete("edit");
            setParams(params, { replace: true });
          }
        }}
        isParent={isParent}
      />
    </div>
  );
};

/** Remove a coach from Home, with Undo in the toast. */
const useRemoveCoach = (onDone: () => void) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["athlete-home"] });
    queryClient.invalidateQueries({ queryKey: ["my-coaches"] });
  };
  return useMutation({
    mutationFn: (coach: { id: string; name: string }) => athleteHomeAPI.hideCoach(coach.id),
    onSuccess: (_, coach) => {
      queryClient.setQueryData<HomeData>(["athlete-home"], (cur) => (cur ? { ...cur, coaches: withoutCoach(cur.coaches, coach.id) } : cur));
      refresh();
      onDone();
      toast({
        title: `${firstNameOf(coach.name)} removed from your coaches`,
        action: (
          <ToastAction
            altText={`Bring back ${coach.name}`}
            onClick={() =>
              void athleteHomeAPI
                .unhideCoach(coach.id)
                .then(refresh)
                .catch(() => toast({ title: "Couldn't undo. Try again", variant: "destructive" }))
            }
          >
            Undo
          </ToastAction>
        ),
      });
    },
    onError: (err: unknown) =>
      toast({ title: "Couldn't remove the coach", description: err instanceof Error ? err.message : undefined, variant: "destructive" }),
  });
};

const toUrl = (value: string) => (/^https?:\/\//i.test(value) ? value : `https://${value}`);
const isUrlish = (value: string) => {
  try {
    const url = new URL(toUrl(value.trim()));
    return /\.[a-z]{2,}$/i.test(url.hostname);
  } catch {
    return false;
  }
};

const FOCUS_FIELD: Partial<Record<ProfileItemKey, string>> = {
  basics: "ep-name",
  position: "ep-position",
  team: "ep-team",
  pathway: "ep-pathway",
  grad: "ep-grad",
  goal: "ep-goal",
  video: "ep-video",
};

const EditProfileDialog = ({ athlete, focus, onClose, isParent }: {
  athlete: HomeAthlete;
  focus: ProfileItemKey | "open" | null;
  onClose: () => void;
  isParent: boolean;
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { refreshUserProfile } = useAuth();
  const open = focus !== null;
  const [form, setForm] = useState<AthleteProfileEdit>(() => fromAthlete(athlete));
  const [errors, setErrors] = useState<Partial<Record<keyof AthleteProfileEdit, string>>>({});
  const thisYear = new Date().getFullYear();
  const years = Array.from({ length: 10 }, (_, i) => String(thisYear + i));

  useEffect(() => {
    if (!open) return;
    setForm(fromAthlete(athlete));
    setErrors({});
    const id = focus && focus !== "open" ? FOCUS_FIELD[focus] : null;
    if (id) setTimeout(() => document.getElementById(id)?.focus(), 50);
    // Reset only when the dialog opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const set = (key: keyof AthleteProfileEdit) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setErrors((x) => ({ ...x, [key]: undefined }));
  };

  const save = useMutation({
    mutationFn: () => athleteHomeAPI.save(athlete.id, form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["athlete-home"] });
      void refreshUserProfile();
      toast({ title: "Profile saved" });
      onClose();
    },
    onError: (err: unknown) =>
      toast({
        title: "Couldn't save the profile",
        description: err && typeof err === "object" && "message" in err ? String(err.message) : undefined,
        variant: "destructive",
      }),
  });

  const submit = () => {
    const next: typeof errors = {};
    if (!form.fullName.trim()) next.fullName = "Required";
    if (!form.dateOfBirth || form.dateOfBirth >= new Date().toISOString().slice(0, 10)) next.dateOfBirth = "Enter a date of birth";
    if (form.highlightVideoUrl.trim() && !isUrlish(form.highlightVideoUrl)) next.highlightVideoUrl = "Paste the full link";
    setErrors(next);
    if (!Object.keys(next).length) save.mutate();
  };

  const field = (key: keyof AthleteProfileEdit, text: string, control: React.ReactNode) => (
    <label className="flex flex-col gap-1.5">
      <span className={label}>{text}</span>
      {control}
      {errors[key] ? <span className="text-caption text-error-700">{errors[key]}</span> : null}
    </label>
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={dialogContent}>
        <DialogHeader className="px-5 pb-3 pt-5 pr-14 text-left sm:px-[25px]">
          <DialogTitle className="text-section">Edit profile</DialogTitle>
          <DialogDescription className={meta}>
            Only coaches {isParent ? "your athlete has" : "you have"} booked with see this.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 px-5 pb-5 sm:px-[25px]">
          <div className="flex items-center gap-3">
            <Avatar name={athlete.fullName} photo={athlete.photo} size={56} />
            <EditPhotoButton
              athleteId={athlete.id}
              photo={athlete.photo}
              isParent={isParent}
              className={cn(secondaryButton, smallButton)}
            >
              {athlete.photo ? "Change photo" : "Add a photo"}
            </EditPhotoButton>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {field("fullName", "First name", (
              <input
                id="ep-name"
                className={input}
                value={splitName(form.fullName).first}
                onChange={(e) => setForm((f) => ({ ...f, fullName: [e.target.value, splitName(f.fullName).last].filter(Boolean).join(" ") }))}
              />
            ))}
            {field("fullName", "Last name", (
              <input
                className={input}
                value={splitName(form.fullName).last}
                onChange={(e) => setForm((f) => ({ ...f, fullName: [splitName(f.fullName).first, e.target.value].filter(Boolean).join(" ") }))}
              />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {field("dateOfBirth", "Date of birth", <input className={input} type="date" value={form.dateOfBirth} onChange={set("dateOfBirth")} />)}
            {field("sport", "Sport", (
              <select className={input} value={form.sport} onChange={set("sport")}>
                <option value="soccer">Soccer</option>
                <option value="rowing">Rowing</option>
              </select>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {field("position", "Position", (
              <input id="ep-position" className={input} value={form.position} onChange={set("position")} placeholder="For example, central midfielder" />
            ))}
            {field("team", "Club or team (optional)", <input id="ep-team" className={input} value={form.team} onChange={set("team")} placeholder="Riverside FC" />)}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {field("pathway", "Pathway level", (
              <select id="ep-pathway" className={input} value={form.pathway} onChange={set("pathway")}>
                <option value="">Choose one</option>
                {PATHWAY_TAGS.map((p) => <option key={p}>{p}</option>)}
              </select>
            ))}
            {field("graduationYear", "Graduation year", (
              <select id="ep-grad" className={input} value={form.graduationYear} onChange={set("graduationYear")}>
                <option value="">Choose one</option>
                {[...years, ...(form.graduationYear && !years.includes(form.graduationYear) ? [form.graduationYear] : [])].map((y) => (
                  <option key={y}>{y}</option>
                ))}
              </select>
            ))}
          </div>
          {field("seasonGoal", "Season goal (optional)", (
            <textarea
              id="ep-goal"
              className={cn(input, "h-auto py-2")}
              rows={2}
              maxLength={300}
              value={form.seasonGoal}
              onChange={set("seasonGoal")}
              placeholder="For example, earn a starting spot this season"
            />
          ))}
          {field("highlightVideoUrl", "Highlight video link (optional)", (
            <input id="ep-video" className={input} value={form.highlightVideoUrl} onChange={set("highlightVideoUrl")} placeholder="youtube.com/…" inputMode="url" />
          ))}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className={secondaryButton} onClick={onClose}>Cancel</button>
            <button type="button" className={primaryButton} disabled={save.isPending} onClick={submit}>
              {save.isPending ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const fromAthlete = (a: HomeAthlete): AthleteProfileEdit => ({
  fullName: a.fullName,
  dateOfBirth: a.dateOfBirth ?? "",
  sport: (a.sport ?? "soccer").toLowerCase(),
  position: a.position ?? "",
  team: a.team ?? "",
  pathway: a.pathway ?? "",
  graduationYear: a.graduationYear ?? "",
  seasonGoal: a.seasonGoal ?? "",
  highlightVideoUrl: a.highlightVideoUrl ?? "",
});
