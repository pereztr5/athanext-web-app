/**
 * Athlete Home (ATH-92): the athlete's dashboard and profile in one. Player card with Book a
 * session and Edit profile, a "Finish profile" checklist until it's complete, the next
 * session with what they're working on, their coaches, and About.
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarPlus, ChevronRight, Lock, Pencil, Plus, Video } from "lucide-react";
import { athleteHomeAPI, type AthleteProfileEdit } from "@/api/athleteHome";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { card, dialogContent, input, label, meta, primaryButton, secondaryButton, textButton } from "@/components/schedule/styles";
import { PATHWAY_TAGS } from "@/constants/pathwayTags";
import { useProfile } from "@/contexts/ProfileContext";
import { useToast } from "@/hooks/use-toast";
import { useViewerTimeZone } from "@/hooks/useViewerTimeZone";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/routes";
import { ageOn, playerLine, profileItems, sportLabel, type HomeAthlete, type ProfileItemKey } from "@/utils/athleteHome";
import { coachProfilePath } from "@/utils/coachSlug";
import { getZonedISODate } from "@/utils/dateHelpers";
import { formatDayISO, plural } from "@/utils/schedule";
import { formatDateInZone, formatInstantSpan } from "@/utils/viewerTime";

const h3 = "text-[18px] font-medium leading-[22px] tracking-[-0.6px] text-[#1A202C]";
const POSITIONS = ["Goalkeeper", "Field player"];

const initials = (name: string) =>
  name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || "A";

const Avatar = ({ name, photo, size }: { name: string; photo: string | null; size: number }) => (
  <span
    className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#E5EDF7] font-medium text-[#0054B4]"
    style={{ width: size, height: size, fontSize: size / 2.6 }}
  >
    {photo ? <img src={photo} alt="" className="size-full object-cover" /> : initials(name)}
  </span>
);

const Pill = ({ children }: { children: string }) => (
  <span className="rounded-full border border-[#EAEADF] bg-[#F4F4EB] px-2.5 py-0.5 text-[12px] font-medium text-[#484D56]">{children}</span>
);

export const AthleteHome = () => {
  const timeZone = useViewerTimeZone();
  const today = getZonedISODate(new Date(), timeZone);
  const { profile } = useProfile();
  const home = useQuery({ queryKey: ["athlete-home"], queryFn: () => athleteHomeAPI.get() });
  const [editing, setEditing] = useState<ProfileItemKey | "open" | null>(null);

  const a = home.data?.athlete ?? null;
  const isParent = profile?.userProfile?.persona_type === "parent";
  const first = (a?.fullName || "").split(" ")[0] || "your athlete";
  const whose = isParent ? `${first}'s` : "your";
  const items = useMemo(() => (a ? profileItems(a) : []), [a]);
  const done = items.filter((i) => i.done).length;

  if (home.isLoading) {
    return <div className="px-4 py-10 md:px-5"><p className={meta}>Loading…</p></div>;
  }
  if (!a) {
    return (
      <div className="mx-auto flex max-w-[640px] flex-col items-center gap-3 px-4 py-16 text-center">
        <h1 className="text-[24px] font-semibold">Set up your athlete profile</h1>
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
      <div className="mx-auto flex w-full max-w-[1000px] flex-col gap-6">
        <section className={cn(card, "flex-col gap-4 sm:flex-row sm:items-center")}>
          <Avatar name={a.fullName} photo={a.photo} size={80} />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <h1 className="text-[24px] md:text-[28px] font-bold leading-[28px] md:leading-[30px] tracking-[-1.2px] text-[#1A202C]">{a.fullName || "Your athlete"}</h1>
            {line ? <span className="text-[14px] text-[#767980]">{line}</span> : null}
            <div className="flex flex-wrap gap-1.5">
              {a.sport ? <Pill>{sportLabel(a.sport)}</Pill> : null}
              {a.pathway ? <Pill>{a.pathway}</Pill> : null}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 sm:flex-col">
            <Link to={ROUTES.BOOK} className={primaryButton}>
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
          <section className={card}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-1">
                <span className={h3}>Finish {whose} profile</span>
                <span className={meta}>Coaches use this to plan {whose} sessions</span>
              </div>
              <span className="text-[14px] font-medium">{done} of {items.length}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-[#EAEADF]" aria-hidden="true">
              <div className="h-full rounded-full bg-[#0054B4]" style={{ width: `${Math.round((done / items.length) * 100)}%` }} />
            </div>
            <div className="flex flex-wrap gap-2">
              {items.filter((i) => !i.done).map((i) => (
                <button key={i.key} type="button" className={secondaryButton} onClick={() => setEditing(i.key)}>
                  <Plus strokeWidth={1.5} aria-hidden="true" />
                  {i.label}
                </button>
              ))}
            </div>
          </section>
        ) : null}

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <section className={card}>
            <div className="flex items-center justify-between">
              <span className={h3}>Next session</span>
              <Link to={ROUTES.MY_SESSIONS} className={textButton}>All sessions</Link>
            </div>
            {next ? (
              <Link to={ROUTES.MY_SESSIONS} className="flex items-center gap-3 rounded-[8px] border border-[#EAEADF] bg-[#F9F9F5] p-3 hover:border-[#CCDDF0]">
                <span className="flex w-12 shrink-0 flex-col items-center rounded-[8px] bg-[#E5EDF7] py-1.5 text-[#0054B4]">
                  <small className="text-[11px] font-medium uppercase">{formatDateInZone(new Date(next.start), timeZone, { weekday: "short" })}</small>
                  <b className="text-[18px] font-semibold leading-[20px]">{formatDateInZone(new Date(next.start), timeZone, { day: "numeric" })}</b>
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <b className="truncate text-[14px] font-medium">{next.title} with {next.coachName}</b>
                  <span className={meta}>
                    {formatInstantSpan(new Date(next.start), new Date(next.end), timeZone)}
                    {next.place ? ` · ${next.place === "online" ? "Video call" : next.place === "in-person" ? "In person" : next.place}` : ""}
                    {next.status === "requested" ? " · waiting for the coach" : next.status === "pending_payment" ? " · payment due" : ""}
                  </span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-[#767980]" strokeWidth={1.5} aria-hidden="true" />
              </Link>
            ) : (
              <>
                <p className={meta}>Nothing booked yet.</p>
                <Link to={ROUTES.BOOK} className={cn(primaryButton, "self-start")}>
                  <CalendarPlus strokeWidth={1.5} aria-hidden="true" />
                  Book a session
                </Link>
              </>
            )}
            {focus ? (
              <div className="flex flex-col gap-1 rounded-[8px] bg-[#F1F1E6] px-3 py-2.5">
                <span className={label}>Working on</span>
                <span className="text-[14px] leading-[18px] text-[#1A202C]">{focus.text}</span>
                <span className={meta}>
                  From {focus.coachName.split(" ")[0]}'s feedback, {formatDayISO(focus.date, { month: "short", day: "numeric" })}
                </span>
              </div>
            ) : null}
          </section>

          <section className={card}>
            <div className="flex items-center justify-between">
              <span className={h3}>Coaches</span>
              <Link to={ROUTES.COACHES} className={textButton}>Find a coach</Link>
            </div>
            {coaches.length ? (
              <ul className="flex flex-col divide-y divide-[#EAEADF]">
                {coaches.map((c) => (
                  <li key={c.id}>
                    <Link to={coachProfilePath(c.slug || c.id)} className="flex items-center gap-3 py-2.5 hover:opacity-90">
                      <Avatar name={c.name} photo={c.photo} size={36} />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <b className="truncate text-[14px] font-medium">{c.name}</b>
                        <span className={meta}>
                          {c.nextDate ? `Next: ${formatDayISO(c.nextDate, { weekday: "short", month: "short", day: "numeric" })}` : "No session booked"}
                        </span>
                      </span>
                      {c.creditsLeft ? <span className={meta}>{plural(c.creditsLeft, "session")} left</span> : null}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={meta}>No coaches yet. Browse coaches near you and book a first session.</p>
            )}
          </section>
        </div>

        <section className={card}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className={h3}>About {isParent ? first : "you"}</span>
            <span className={cn(meta, "inline-flex items-center gap-1.5")}>
              <Lock className="size-3" strokeWidth={1.5} aria-hidden="true" />
              Coaches see this once {isParent ? `${first} has` : "you've"} booked with them
            </span>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {details.map(([l, v]) => (
              <div key={l} className="flex flex-col gap-1">
                <span className={label}>{l}</span>
                {v ? (
                  <span className="text-[14px] text-[#1A202C]">{v}</span>
                ) : (
                  <button type="button" className={cn(textButton, "self-start")} onClick={() => setEditing("open")}>Add</button>
                )}
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-1 rounded-[8px] bg-[#F1F1E6] px-3 py-2.5">
            <span className={label}>Season goal</span>
            {a.seasonGoal ? (
              <span className="text-[14px] font-medium text-[#1A202C]">{a.seasonGoal}</span>
            ) : (
              <button type="button" className={cn(textButton, "self-start text-left")} onClick={() => setEditing("goal")}>
                Add a goal so coaches know what {isParent ? `${first} is` : "you're"} working toward
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Video className="size-4 text-[#767980]" strokeWidth={1.5} aria-hidden="true" />
            {a.highlightVideoUrl ? (
              <a className={textButton} href={toUrl(a.highlightVideoUrl)} target="_blank" rel="noopener noreferrer">Highlight video</a>
            ) : (
              <button type="button" className={textButton} onClick={() => setEditing("video")}>Add a highlight video link</button>
            )}
          </div>
        </section>
      </div>

      <EditProfileDialog athlete={a} focus={editing} onClose={() => setEditing(null)} isParent={isParent} />
    </div>
  );
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
      {errors[key] ? <span className="text-[12px] text-[#972B2B]">{errors[key]}</span> : null}
    </label>
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={dialogContent}>
        <DialogHeader className="px-5 pb-3 pt-5 pr-14 text-left sm:px-[25px]">
          <DialogTitle className="text-[22px] font-semibold leading-[28px] tracking-[-0.05em]">Edit profile</DialogTitle>
          <DialogDescription className={meta}>
            Coaches see this once {isParent ? "your athlete has" : "you've"} booked with them.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 px-5 pb-5 sm:px-[25px]">
          {field("fullName", "Full name", <input id="ep-name" className={input} value={form.fullName} onChange={set("fullName")} />)}
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
              <select id="ep-position" className={input} value={form.position} onChange={set("position")}>
                <option value="">Choose one</option>
                {[...POSITIONS, ...(form.position && !POSITIONS.includes(form.position) ? [form.position] : [])].map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
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
              className={cn(input, "h-auto py-2 leading-[18px]")}
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
