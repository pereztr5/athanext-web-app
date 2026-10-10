/**
 * Session feedback (ATH-82), the simplest version: one screen with who came (everyone starts
 * as here), a 0 to 10 score only the coach sees, and one summary for every family who came.
 * Nobody came: a no-show with an optional message, still charged. After a group session the
 * coach can add a note for any athlete who came; only that family sees it.
 * Open with ?slotId=<session>; add &notes=1 to go straight to the notes.
 */
import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarX, Check, Plus, Send, UserPlus, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { feedbackAPI, type FeedbackAthlete } from "@/api/feedback";
import { scoreWord } from "@/utils/feedback";
import { AddWalkInAthleteDialog } from "@/components/coach/AddWalkInAthleteDialog";
import { card, dialogContent, iconButton, input, meta, primaryButton, secondaryButton } from "@/components/schedule/styles";
import { useRole } from "@/hooks/useRole";
import { useToast } from "@/hooks/use-toast";
import { useViewerTimeZone } from "@/hooks/useViewerTimeZone";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/routes";
import { formatClock, formatDayISO, plural, sessionStart } from "@/utils/schedule";
import { getZonedISODate } from "@/utils/dateHelpers";

const shortName = (name: string) => {
  const parts = name.split(" ").filter(Boolean);
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : name;
};
const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");

const Avatar = ({ athlete }: { athlete: FeedbackAthlete }) => (
  <span className="flex size-[36px] flex-none items-center justify-center overflow-hidden rounded-full bg-[#E5EDF7] text-[12px] font-semibold text-[#0054B4]" aria-hidden="true">
    {athlete.imageUrl ? <img src={athlete.imageUrl} alt="" className="size-full object-cover" /> : initials(athlete.name)}
  </span>
);

const SessionFeedbackPage = () => {
  const { isCoach, ready } = useRole();
  const [searchParams] = useSearchParams();
  const slotId = searchParams.get("slotId");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const timeZone = useViewerTimeZone();

  const screenQuery = useQuery({
    queryKey: ["feedback-screen", slotId],
    enabled: Boolean(slotId) && isCoach,
    queryFn: () => feedbackAPI.screen(slotId!),
  });
  const screen = screenQuery.data;

  const [absent, setAbsent] = useState<Set<string>>(new Set());
  const [score, setScore] = useState(0);
  const [summary, setSummary] = useState("");
  const [stage, setStage] = useState<"form" | "notes">(searchParams.get("notes") ? "notes" : "form");
  const [noteFor, setNoteFor] = useState<FeedbackAthlete | null>(null);
  const [noteText, setNoteText] = useState("");
  const [walkInOpen, setWalkInOpen] = useState(false);

  useEffect(() => {
    if (!screen) return;
    setAbsent(new Set(screen.athletes.filter((a) => a.attendance && a.attendance !== "present").map((a) => a.athleteId)));
    setScore(screen.score ?? 0);
    setSummary(screen.summary ?? "");
  }, [screen]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["feedback-screen", slotId] });
    queryClient.invalidateQueries({ queryKey: ["feedback-due"] });
    queryClient.invalidateQueries({ queryKey: ["sessions"] });
  };

  const group = screen?.sessionType === "group";
  const athletes = useMemo(() => screen?.athletes ?? [], [screen]);
  const came = athletes.filter((a) => !absent.has(a.athleteId));
  const first = athletes[0]?.name.split(" ")[0] ?? "";
  const noShow = athletes.length > 0 && came.length === 0;
  const locked = Boolean(screen?.submitted && screen.editCount >= 1);
  const canSend = !locked && (noShow || score > 0);

  const send = useMutation({
    mutationFn: () => feedbackAPI.submit(slotId!, [...absent], noShow ? null : score, summary),
    onSuccess: (result) => {
      refresh();
      const wasEdit = screen?.submitted;
      if (result.noShow) {
        toast({ title: "Marked as no-show", description: summary.trim() ? "Your message was sent." : "The session stays charged." });
        navigate(-1);
        return;
      }
      if (wasEdit) {
        toast({ title: "Feedback updated" });
        navigate(-1);
        return;
      }
      if (!group) {
        toast({ title: "Session completed", description: `Feedback sent to ${first}'s family.` });
        navigate(-1);
        return;
      }
      setStage("notes");
    },
    onError: (error: unknown) =>
      toast({ title: "Couldn't send feedback", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" }),
  });

  const saveNote = useMutation({
    mutationFn: () => feedbackAPI.setNote(noteFor!.bookingId, noteText),
    onSuccess: () => {
      toast({ title: `Note sent to ${noteFor!.name.split(" ")[0]}'s family` });
      setNoteFor(null);
      refresh();
    },
    onError: (error: unknown) =>
      toast({ title: "Couldn't save the note", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" }),
  });

  if (!ready) return null;
  if (!isCoach) return <Navigate to={ROUTES.DASHBOARD} replace />;
  if (!slotId) return <Navigate to={ROUTES.MY_SESSIONS} replace />;

  if (screenQuery.isError) {
    return (
      <div className="mx-auto max-w-[640px] px-4 py-10">
        <p className="text-[14px] text-[#972B2B]">Couldn't open this session. It may not be yours, or it was removed.</p>
      </div>
    );
  }
  if (!screen) return <p className={cn(meta, "px-4 py-10 text-center")}>Loading…</p>;

  const start = sessionStart({ date: screen.date, startTime: screen.startTime });
  const subtitle = `${group ? screen.sessionName : "1-on-1"} · ${formatDayISO(getZonedISODate(start, timeZone), { weekday: "short", month: "short", day: "numeric" })} · ${formatClock(start, timeZone)}`;
  const header = (title: string) => (
    <div className="flex items-start gap-3">
      <button type="button" className={iconButton} aria-label="Close" onClick={() => navigate(-1)}>
        <X strokeWidth={1.5} />
      </button>
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="text-[24px] font-semibold leading-[28px] tracking-[-0.05em] text-[#1A202C]">{title}</h1>
        <span className={meta}>{subtitle}</span>
      </div>
    </div>
  );

  const noteDialog = (
    <Dialog open={Boolean(noteFor)} onOpenChange={(open) => !open && setNoteFor(null)}>
      <DialogContent className={dialogContent}>
        <DialogHeader className="px-5 pb-3 pt-5 pr-14 text-left sm:px-[25px]">
          <DialogTitle className="text-[22px] font-semibold tracking-[-0.05em]">Note for {noteFor?.name.split(" ")[0]}</DialogTitle>
          <DialogDescription className={meta}>Only {noteFor?.name.split(" ")[0]}'s family sees this.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 px-5 pb-5 sm:px-[25px]">
          <textarea
            className={cn(input, "h-auto py-2")}
            rows={4}
            maxLength={2000}
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="What they did well and one thing to work on"
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <button type="button" className={secondaryButton} onClick={() => setNoteFor(null)}>
              Cancel
            </button>
            <button type="button" className={primaryButton} disabled={!noteText.trim() || saveNote.isPending} onClick={() => saveNote.mutate()}>
              Send note
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );

  if (stage === "notes") {
    const present = athletes.filter((a) => a.attendance === "present" || (!a.attendance && !absent.has(a.athleteId)));
    return (
      <div className="px-4 pb-8 pt-1 md:px-5 md:pb-12">
        <div className="mx-auto flex w-full max-w-[640px] flex-col gap-6">
          {searchParams.get("notes") ? (
            header("Notes for athletes")
          ) : (
            <div className="flex flex-col items-center gap-2 py-4 text-center">
              <span className="flex size-[48px] items-center justify-center rounded-full bg-[#CBE7D1] text-[#1E7431]">
                <Check className="size-6" strokeWidth={2} aria-hidden="true" />
              </span>
              <h1 className="text-[24px] font-semibold tracking-[-0.05em]">Session completed</h1>
              <p className={meta}>Feedback sent to {plural(present.length, "family", "families")}.</p>
            </div>
          )}
          <div className="flex flex-col gap-1">
            <h2 className="text-[18px] font-medium">Add a note for anyone?</h2>
            <p className={meta}>Optional. Only that athlete's family sees it.</p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {present.length ? (
              present.map((a) => (
                <button
                  key={a.bookingId}
                  type="button"
                  onClick={() => {
                    setNoteText(a.note ?? "");
                    setNoteFor(a);
                  }}
                  className={cn(
                    "flex items-center gap-2 rounded-[10px] border p-2.5 text-left",
                    a.note ? "border-[#B9DDE7] bg-[#E7F4F8]" : "border-[#EAEADF] bg-[#F9F9F5] hover:bg-[#F1F1E6]"
                  )}
                >
                  <Avatar athlete={a} />
                  <span className="flex min-w-0 flex-col">
                    <b className="truncate text-[14px] font-medium">{shortName(a.name)}</b>
                    {a.note ? (
                      <span className="flex items-center gap-1 text-[12px] text-[#117A96]">
                        <Check className="size-3" strokeWidth={2} aria-hidden="true" />
                        Note sent
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[12px] text-[#0054B4]">
                        <Plus className="size-3" strokeWidth={2} aria-hidden="true" />
                        Note
                      </span>
                    )}
                  </span>
                </button>
              ))
            ) : (
              <p className={meta}>Nobody came to this session.</p>
            )}
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-[#EAEADF] pt-4">
            <span className={meta}>You can add notes later from the session.</span>
            <button type="button" className={secondaryButton} onClick={() => navigate(-1)}>
              Done
            </button>
          </div>
        </div>
        {noteDialog}
      </div>
    );
  }

  return (
    <div className="px-4 pb-8 pt-1 md:px-5 md:pb-12">
      <div className="mx-auto flex w-full max-w-[640px] flex-col gap-6">
        {header(group ? "Feedback" : `Feedback for ${first}`)}

        {!screen.started ? (
          <p className={cn(card, "text-[14px] text-[#484D56]")}>Feedback opens once the session starts.</p>
        ) : (
          <>
            {group ? (
              <section className="flex flex-col gap-3">
                <div className="flex items-baseline justify-between">
                  <h2 className="text-[18px] font-medium">Who came?</h2>
                  <span className={meta}>
                    {came.length} of {athletes.length}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <p className={meta}>Tap anyone who missed it.</p>
                  {!locked ? (
                    <button type="button" className={cn(secondaryButton, "h-[30px] px-3")} onClick={() => setWalkInOpen(true)}>
                      <UserPlus strokeWidth={1.5} aria-hidden="true" />
                      Add athlete
                    </button>
                  ) : null}
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {athletes.map((a) => {
                    const isAbsent = absent.has(a.athleteId);
                    return (
                      <button
                        key={a.bookingId}
                        type="button"
                        aria-pressed={!isAbsent}
                        disabled={locked}
                        onClick={() =>
                          setAbsent((cur) => {
                            const next = new Set(cur);
                            if (next.has(a.athleteId)) next.delete(a.athleteId);
                            else next.add(a.athleteId);
                            return next;
                          })
                        }
                        className={cn(
                          "flex items-center gap-2 rounded-[10px] border p-2.5 text-left transition-colors",
                          isAbsent ? "border-dashed border-[#C1C1B8] bg-transparent opacity-60" : "border-[#EAEADF] bg-[#F9F9F5] hover:bg-[#F1F1E6]"
                        )}
                      >
                        <Avatar athlete={a} />
                        <span className="flex min-w-0 flex-col">
                          <b className="truncate text-[14px] font-medium">{shortName(a.name)}</b>
                          {isAbsent ? <span className="text-[12px] font-medium text-[#906A29]">Absent</span> : null}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            ) : (
              <section className="flex flex-col gap-3">
                <h2 className="text-[18px] font-medium">Did {first} come?</h2>
                <div className="flex gap-2">
                  {[
                    [true, "Yes"],
                    [false, "No"],
                  ].map(([yes, label]) => {
                    const on = yes ? !noShow : noShow;
                    return (
                      <button
                        key={String(label)}
                        type="button"
                        aria-pressed={on}
                        disabled={locked}
                        onClick={() => setAbsent(yes ? new Set() : new Set(athletes.map((a) => a.athleteId)))}
                        className={cn(
                          "inline-flex h-[40px] flex-1 items-center justify-center gap-1.5 rounded-[8px] border text-[14px] font-medium",
                          on
                            ? yes
                              ? "border-[#6698D2] bg-[#E5EDF7] text-[#0054B4]"
                              : "border-[#F0B144] bg-[#FCEFDA] text-[#906A29]"
                            : "border-[#EAEADF] bg-[#F4F4EB] text-[#1A202C]"
                        )}
                      >
                        {yes ? <Check className="size-4" strokeWidth={1.5} /> : <X className="size-4" strokeWidth={1.5} />}
                        {label}
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            {noShow ? (
              <section className="flex flex-col gap-3">
                <div className="flex items-start gap-3 rounded-[10px] bg-[#F1F1E6] p-4">
                  <CalendarX className="mt-[2px] size-5 flex-none text-[#906A29]" strokeWidth={1.5} aria-hidden="true" />
                  <span className="flex flex-col gap-0.5">
                    <b className="text-[14px] font-medium">{group ? "Nobody came" : `${first} didn't come`}</b>
                    <span className={meta}>No score or summary needed. The session stays charged.</span>
                  </span>
                </div>
                <label className="flex flex-col gap-1.5">
                  <span className="flex items-baseline justify-between">
                    <span className="text-[16px] font-medium">Message to {group ? "families" : `${first}'s family`}</span>
                    <span className={meta}>Optional</span>
                  </span>
                  <textarea
                    className={cn(input, "h-auto py-2")}
                    rows={3}
                    value={summary}
                    disabled={locked}
                    onChange={(e) => setSummary(e.target.value)}
                    placeholder={group ? "For example: We missed you all today. The next session is on…" : `For example: We missed ${first} today. Want to book a make-up session?`}
                  />
                </label>
              </section>
            ) : (
              <>
                <section className="flex flex-col gap-3">
                  <h2 className="text-[18px] font-medium">How was the session?</h2>
                  <div className="flex flex-col gap-2 rounded-[10px] border border-[#EAEADF] bg-[#F7F7F0] p-4">
                    <div className="flex items-baseline justify-between">
                      <span className={meta}>Only you see this score</span>
                      <span className="text-[14px]">
                        <b className="text-[20px] font-semibold">{score}</b>/10{score ? ` · ${scoreWord(score)}` : ""}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={10}
                      step={1}
                      value={score}
                      disabled={locked}
                      onChange={(e) => setScore(Number(e.target.value))}
                      aria-label="Session score from 0 to 10"
                      aria-valuetext={score ? `${score} out of 10, ${scoreWord(score)}` : "Not scored"}
                      className="w-full accent-[#0054B4]"
                    />
                    <div className="flex justify-between text-[12px] text-[#767980]">
                      <span>0</span>
                      <span>10</span>
                    </div>
                  </div>
                </section>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[18px] font-medium">Summary</span>
                  <textarea
                    className={cn(input, "h-auto py-2")}
                    rows={4}
                    maxLength={4000}
                    value={summary}
                    disabled={locked}
                    onChange={(e) => setSummary(e.target.value)}
                    placeholder={group ? "What you worked on, for every family" : `What you worked on with ${first}`}
                  />
                  <span className={meta}>{group ? "Goes to every family that came." : `Goes to ${first}'s family.`}</span>
                </label>
              </>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#EAEADF] pt-4">
              <span className={meta}>
                {locked
                  ? "Feedback was already edited once, so it can't change again. You can still add notes."
                  : noShow
                    ? `${group ? "Everyone marked absent" : "Marked as no-show"} · still charged`
                    : group
                      ? absent.size
                        ? `${athletes.filter((a) => absent.has(a.athleteId)).map((a) => a.name.split(" ")[0]).join(", ")} marked absent · still charged`
                        : "Everyone came"
                      : `Goes to ${first}'s family`}
              </span>
              <span className="flex gap-2">
                {group && screen.submitted ? (
                  <button type="button" className={secondaryButton} onClick={() => setStage("notes")}>
                    Notes for athletes
                  </button>
                ) : null}
                {!locked ? (
                  <button type="button" className={primaryButton} disabled={!canSend || send.isPending} onClick={() => send.mutate()}>
                    {noShow ? <CalendarX strokeWidth={1.5} aria-hidden="true" /> : <Send strokeWidth={1.5} aria-hidden="true" />}
                    {noShow
                      ? "Mark as no-show"
                      : screen.submitted
                        ? "Send update"
                        : group
                          ? `Send to ${plural(came.length, "family", "families")}`
                          : `Send to ${first}'s family`}
                  </button>
                ) : null}
              </span>
            </div>
            {!noShow && !score && !locked ? <p className={meta}>Slide the score above 0 to send.</p> : null}
          </>
        )}
      </div>
      {noteDialog}
      <AddWalkInAthleteDialog
        open={walkInOpen}
        onOpenChange={setWalkInOpen}
        slotId={slotId}
        sessionDate={screen.date}
        onAdded={(result) => {
          setWalkInOpen(false);
          refresh();
          toast({
            title: `${result.athlete.name.split(" ")[0]} added`,
            description: result.requiresPayment ? "They still need to pay. The family can pay from My Sessions." : undefined,
          });
        }}
      />
    </div>
  );
};

export default SessionFeedbackPage;
