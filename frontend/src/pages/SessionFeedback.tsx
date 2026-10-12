/**
 * Session feedback (ATH-82), as in the Working Copy check-in: a session card, who was present
 * (everyone starts as present), a 0 to 10 score only the coach sees, one summary for every
 * family who came and, on a group, optional notes for each athlete sent with it. Nobody came:
 * a no-show with an optional message, still charged. After sending, the coach moves on to the
 * next session in the feedback-due queue.
 * Open with ?slotId=<session>; add &notes=1 to go straight to the notes for athletes.
 */
import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarX, Check, ChevronLeft, ChevronRight, Plus, Send, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { feedbackAPI, type FeedbackAthlete } from "@/api/feedback";
import { AthleteNotes } from "@/components/feedback/AthleteNotes";
import { ScoreBox } from "@/components/feedback/ScoreBox";
import { SessionHero } from "@/components/feedback/SessionHero";
import { SessionPageHeader } from "@/components/session/SessionHeader";
import { FeedbackAvatar, FeedbackBar, Question, StarterChips } from "@/components/feedback/parts";
import {
  NO_SHOW_STARTERS,
  appendSentence,
  caption,
  families,
  firstName,
  lastName,
  shortName,
  summaryStarters,
  textarea,
} from "@/components/feedback/helpers";
import { card, dialogContent, iconButton, label, meta, primaryButton, secondaryButton } from "@/components/schedule/styles";
import { useRole } from "@/hooks/useRole";
import { useToast } from "@/hooks/use-toast";
import { useViewerTimeZone } from "@/hooks/useViewerTimeZone";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/routes";
import { formatClock, formatDayISO, sessionStart } from "@/utils/schedule";
import { getZonedISODate } from "@/utils/dateHelpers";

const roundButton = cn(iconButton, "size-[30px] flex-none rounded-full bg-[#F7F7F0]");
const feedbackLink = (id: string) => `${ROUTES.COACH_SESSION_FEEDBACK}?slotId=${id}`;

const SessionFeedbackPage = () => {
  const { isCoach, ready } = useRole();
  const [searchParams] = useSearchParams();
  const slotId = searchParams.get("slotId");

  if (!ready) return null;
  if (!isCoach) return <Navigate to={ROUTES.DASHBOARD} replace />;
  if (!slotId) return <Navigate to={ROUTES.MY_SESSIONS} replace />;
  // Remount per session so moving through the queue starts each one fresh.
  return <SessionFeedback key={slotId} slotId={slotId} startOnNotes={Boolean(searchParams.get("notes"))} />;
};

const SessionFeedback = ({ slotId, startOnNotes }: { slotId: string; startOnNotes: boolean }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const timeZone = useViewerTimeZone();

  const screenQuery = useQuery({ queryKey: ["feedback-screen", slotId], queryFn: () => feedbackAPI.screen(slotId) });
  const screen = screenQuery.data;
  const dueQuery = useQuery({ queryKey: ["feedback-due", "queue"], queryFn: () => feedbackAPI.due() });
  const due = dueQuery.data ?? [];

  const [absent, setAbsent] = useState<Set<string>>(new Set());
  const [score, setScore] = useState(0);
  const [summary, setSummary] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [stage, setStage] = useState<"form" | "notes">(startOnNotes ? "notes" : "form");
  const [noteFor, setNoteFor] = useState<FeedbackAthlete | null>(null);
  const [noteText, setNoteText] = useState("");

  useEffect(() => {
    if (!screen) return;
    setAbsent(new Set(screen.athletes.filter((a) => a.attendance && a.attendance !== "present").map((a) => a.athleteId)));
    setScore(screen.score ?? 0);
    setSummary(screen.summary ?? "");
    setNotes(Object.fromEntries(screen.athletes.map((a) => [a.bookingId, a.note ?? ""])));
  }, [screen]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["feedback-screen", slotId] });
    queryClient.invalidateQueries({ queryKey: ["feedback-due"] });
    queryClient.invalidateQueries({ queryKey: ["sessions"] });
  };
  const leave = () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) navigate(-1);
    else navigate(ROUTES.MY_SESSIONS);
  };

  const group = screen?.sessionType === "group";
  const athletes = useMemo(() => screen?.athletes ?? [], [screen]);
  const came = athletes.filter((a) => !absent.has(a.athleteId));
  const missed = athletes.filter((a) => absent.has(a.athleteId));
  const a0 = athletes[0];
  const first = a0 ? firstName(a0.name) : "";
  const adult = a0?.age != null && a0.age >= 18;
  const recipient = adult ? first : `${first}'s family`;
  const noShow = athletes.length > 0 && came.length === 0;
  const locked = Boolean(screen?.submitted && screen.editCount >= 1);
  const canSend = !locked && (noShow || score > 0);
  const withNotes = came.filter((a) => (notes[a.bookingId] ?? "").trim());

  // Only notes that changed, for athletes who came; an emptied note clears it.
  const changedNotes = () =>
    group && !noShow
      ? Object.fromEntries(
          came.filter((a) => (notes[a.bookingId] ?? "").trim() !== (a.note ?? "").trim()).map((a) => [a.bookingId, (notes[a.bookingId] ?? "").trim()])
        )
      : {};

  const goNext = (message: string) => {
    const next = due.find((d) => d.id !== slotId);
    if (next) {
      navigate(feedbackLink(next.id), { replace: true });
      toast({ title: `${message}. Next: ${next.title}, ${formatDayISO(next.date, { weekday: "short", month: "short", day: "numeric" })}` });
    } else {
      leave();
      toast({ title: message });
    }
  };

  const send = useMutation({
    mutationFn: () => feedbackAPI.submit(slotId, [...absent], noShow ? null : score, summary, changedNotes()),
    onSuccess: (result) => {
      refresh();
      if (screen?.submitted) {
        toast({ title: "Feedback updated" });
        leave();
        return;
      }
      if (result.noShow) {
        goNext(`Marked as no-show${summary.trim() ? `. Message sent to ${group ? "families" : recipient}` : ""}`);
        return;
      }
      goNext(
        group
          ? `Feedback sent to ${families(came.length)}${withNotes.length ? ` with ${withNotes.length} personal ${withNotes.length === 1 ? "note" : "notes"}` : ""}`
          : `Feedback sent to ${recipient}`
      );
    },
    onError: (error: unknown) =>
      toast({ title: "Couldn't send feedback", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" }),
  });

  const saveNote = useMutation({
    mutationFn: () => feedbackAPI.setNote(noteFor!.bookingId, noteText),
    onSuccess: () => {
      toast({ title: `Note sent to ${firstName(noteFor!.name)}'s family` });
      setNoteFor(null);
      refresh();
    },
    onError: (error: unknown) =>
      toast({ title: "Couldn't save the note", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" }),
  });

  if (screenQuery.isError) {
    return (
      <div className="mx-auto max-w-[640px] px-4 py-10">
        <p className="text-[14px] text-[#972B2B]">Couldn't open this session. It may not be yours, or it was removed.</p>
      </div>
    );
  }
  if (!screen) return <p className={cn(meta, "px-4 py-10 text-center")}>Loading…</p>;

  const wrap = "mx-auto flex w-full max-w-[640px] flex-col gap-3.5";

  if (stage === "notes") {
    const start = sessionStart(screen);
    const present = athletes.filter((a) => a.attendance === "present" || (!a.attendance && !absent.has(a.athleteId)));
    const family = (a: FeedbackAthlete) => {
      const last = lastName(a.name);
      return a.age != null && a.age < 18 && last ? `the ${last} family` : `${firstName(a.name)}'s family`;
    };
    return (
      <div className="px-4 pb-8 pt-1 md:px-5 md:pb-12">
        <div className={wrap}>
          <SessionPageHeader
            title="Notes for athletes"
            subtitle={`${group ? screen.sessionName : "1-on-1"} · ${formatDayISO(getZonedISODate(start, timeZone), { weekday: "short", month: "short", day: "numeric" })} · ${formatClock(start, timeZone)}`}
            onBack={leave}
            backLabel="Back"
          />
          <div className="flex flex-col gap-1">
            <h2 className="text-[16px] font-medium leading-[18px] tracking-[-0.05em] text-[#1A202C]">Add a note for anyone?</h2>
            <span className={caption}>Optional. Only that athlete's family sees it.</span>
          </div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
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
                    "flex min-h-[60px] min-w-0 items-center gap-2.5 rounded-[16px] border py-2 pl-2.5 pr-3 text-left transition-colors",
                    a.note ? "border-[#BFDDC6] bg-[#CBE7D1]" : "border-[#EAEADF] bg-[#F7F7F0] hover:border-[#99BBE1]"
                  )}
                >
                  <FeedbackAvatar name={a.name} imageUrl={a.imageUrl} />
                  <span className="flex min-w-0 flex-col gap-1">
                    <b className="truncate text-[15px] font-medium">{shortName(a.name)}</b>
                    {a.note ? (
                      <span className="inline-flex items-center gap-[3px] text-[12px] font-semibold text-[#1E7431]">
                        <Check className="size-3" strokeWidth={2} aria-hidden="true" />
                        Note sent
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-[3px] text-[12px] font-semibold text-[#0054B4]">
                        <Plus className="size-3" strokeWidth={2} aria-hidden="true" />
                        Note
                      </span>
                    )}
                  </span>
                </button>
              ))
            ) : (
              <span className={caption}>Nobody came to this session.</span>
            )}
          </div>
          <FeedbackBar>
            <span className={caption}>You can add notes later from the session page.</span>
            <button type="button" className={secondaryButton} onClick={leave}>
              Done
            </button>
          </FeedbackBar>
        </div>
        <Dialog open={Boolean(noteFor)} onOpenChange={(open) => !open && setNoteFor(null)}>
          <DialogContent className={dialogContent}>
            <DialogHeader className="px-5 pb-3 pt-5 pr-14 text-left sm:px-[25px]">
              <DialogTitle className="text-[22px] font-semibold tracking-[-0.05em]">Note for {noteFor ? firstName(noteFor.name) : ""}</DialogTitle>
              <DialogDescription className={meta}>Only {noteFor ? family(noteFor) : ""} sees this.</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-4 px-5 pb-5 sm:px-[25px]">
              <label className="flex flex-col gap-1.5">
                <span className={label}>Note</span>
                <textarea
                  className={textarea}
                  rows={4}
                  maxLength={2000}
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder={`What should ${noteFor ? firstName(noteFor.name) : ""}'s family know?`}
                  autoFocus
                />
              </label>
              <div className="flex justify-end gap-2">
                <button type="button" className={secondaryButton} onClick={() => setNoteFor(null)}>
                  Cancel
                </button>
                <button type="button" className={primaryButton} disabled={!noteText.trim() || saveNote.isPending} onClick={() => saveNote.mutate()}>
                  <Send strokeWidth={1.5} aria-hidden="true" />
                  Send note
                </button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  const qi = due.findIndex((d) => d.id === slotId);
  const step = (by: number) => navigate(feedbackLink(due[(qi + by + due.length) % due.length].id), { replace: true });
  const starters = noShow ? NO_SHOW_STARTERS : summaryStarters(screen.pillar);

  const line = locked
    ? "Feedback was already edited once, so it can't change again. You can still add notes."
    : noShow
      ? `${group ? "Everyone marked absent" : "Marked as no-show"} · still charged`
      : !score
        ? "Slide the score above 0 to send"
        : group
          ? [
              families(came.length),
              missed.length ? `${missed.map((a) => firstName(a.name)).join(", ")} absent` : null,
              withNotes.length ? `${withNotes.length} personal ${withNotes.length === 1 ? "note" : "notes"} included` : null,
            ]
              .filter(Boolean)
              .join(" · ")
          : `Goes to ${recipient}`;

  return (
    <div className="px-4 pb-8 pt-1 md:px-5 md:pb-12">
      <div className={wrap}>
        <div className="flex items-center justify-between gap-3">
          <button type="button" className={roundButton} aria-label="Close" onClick={leave}>
            <X strokeWidth={1.5} />
          </button>
          {qi >= 0 ? (
            <div className="flex items-center gap-2">
              <button type="button" className={roundButton} aria-label="Previous session" disabled={due.length < 2} onClick={() => step(-1)}>
                <ChevronLeft strokeWidth={1.5} />
              </button>
              <span className="flex min-w-[84px] flex-col items-center gap-0.5">
                <b className="text-[14px] font-semibold text-[#1A202C]">
                  {qi + 1} of {due.length}
                </b>
                <span className={caption}>feedback due</span>
              </span>
              <button type="button" className={roundButton} aria-label="Next session" disabled={due.length < 2} onClick={() => step(1)}>
                <ChevronRight strokeWidth={1.5} />
              </button>
            </div>
          ) : null}
        </div>

        <SessionHero screen={screen} timeZone={timeZone} />

        {!screen.started ? (
          <p className={cn(card, "text-[14px] text-[#484D56]")}>Feedback opens once the session starts.</p>
        ) : (
          <>
            {group ? (
              <>
                <Question title="Who was present?">
                  <span className="text-[14px] font-semibold text-[#0054B4]">
                    {came.length} of {athletes.length}
                  </span>
                </Question>
                <span className={caption}>Tap anyone who missed it.</span>
                <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                  {athletes.length ? (
                    athletes.map((a) => {
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
                            "flex min-h-[60px] min-w-0 items-center gap-2.5 rounded-[16px] border py-2 pl-2.5 pr-3 text-left transition-colors disabled:cursor-not-allowed",
                            isAbsent ? "border-dashed border-[#C9C9BD] bg-transparent" : "border-[#EAEADF] bg-[#F7F7F0] hover:enabled:border-[#99BBE1]"
                          )}
                        >
                          <FeedbackAvatar name={a.name} imageUrl={a.imageUrl} className={cn(isAbsent && "opacity-45")} />
                          <span className="flex min-w-0 flex-col gap-1">
                            <b className={cn("truncate text-[15px] font-medium", isAbsent ? "text-[#A3A6AB]" : "text-[#1A202C]")}>{shortName(a.name)}</b>
                            {isAbsent ? <span className="text-[11px] font-semibold text-[#906A29]">Absent</span> : null}
                          </span>
                        </button>
                      );
                    })
                  ) : (
                    <span className={caption}>No athletes on this session.</span>
                  )}
                </div>
              </>
            ) : (
              <>
                <Question title={`Was ${first} present?`} />
                <div className="grid grid-cols-2 gap-2">
                  {([true, false] as const).map((yes) => {
                    const on = yes ? !noShow : noShow;
                    return (
                      <button
                        key={String(yes)}
                        type="button"
                        aria-pressed={on}
                        disabled={locked}
                        onClick={() => setAbsent(yes ? new Set() : new Set(athletes.map((a) => a.athleteId)))}
                        className={cn(
                          "inline-flex h-[50px] items-center justify-center gap-1.5 rounded-[14px] border text-[15px] font-medium transition-colors disabled:cursor-not-allowed [&>svg]:size-4",
                          on
                            ? yes
                              ? "border-[#0054B4] bg-[#0054B4] text-white"
                              : "border-[#906A29] bg-[#FCEFDA] text-[#906A29]"
                            : "border-[#EAEADF] bg-[#F7F7F0] text-[#1A202C]"
                        )}
                      >
                        {yes ? <Check strokeWidth={1.5} aria-hidden="true" /> : <X strokeWidth={1.5} aria-hidden="true" />}
                        {yes ? "Yes" : "No"}
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {noShow ? (
              <div className="flex items-center gap-3.5 rounded-[14px] bg-[#FCEFDA] p-4">
                <span className="flex size-[44px] flex-none items-center justify-center rounded-full bg-[#F7F7F0] text-[#906A29]">
                  <CalendarX className="size-5" strokeWidth={1.5} aria-hidden="true" />
                </span>
                <span className="flex flex-col gap-1">
                  <b className="text-[14px] font-medium text-[#1A202C]">{group ? "Nobody was present" : `${first} wasn't present`}</b>
                  <span className={caption}>No score needed. The session stays charged.</span>
                </span>
              </div>
            ) : (
              <>
                <Question title="How was the session?" />
                <ScoreBox score={score} onChange={setScore} disabled={locked} />
              </>
            )}

            <Question title={noShow ? `Message to ${group ? "families" : recipient}` : group ? "Summary for every family" : "Summary"}>
              {noShow || group ? <span className={caption}>Optional</span> : null}
            </Question>
            <StarterChips
              chips={starters}
              disabled={locked}
              onPick={(c) => {
                setSummary((cur) => appendSentence(cur, c));
                document.getElementById("fb-summary")?.focus();
              }}
            />
            <textarea
              id="fb-summary"
              className={textarea}
              rows={4}
              maxLength={4000}
              value={summary}
              disabled={locked}
              onChange={(e) => setSummary(e.target.value)}
              aria-label={noShow ? "Message" : "Summary"}
              placeholder={
                noShow
                  ? group
                    ? "For example: We missed you all today. The next session is on…"
                    : `For example: We missed ${first} today. Want to book a make-up session?`
                  : group
                    ? "What the group worked on today"
                    : `What you worked on with ${first}`
              }
            />

            {group && !noShow && !locked && came.length ? (
              <AthleteNotes athletes={came} notes={notes} onChange={(id, note) => setNotes((cur) => ({ ...cur, [id]: note }))} />
            ) : null}

            <FeedbackBar>
              <span className={caption}>{line}</span>
              {locked ? (
                group ? (
                  <button type="button" className={secondaryButton} onClick={() => setStage("notes")}>
                    Notes for athletes
                  </button>
                ) : null
              ) : (
                <button type="button" className={primaryButton} disabled={!canSend || send.isPending} onClick={() => send.mutate()}>
                  {noShow ? <CalendarX strokeWidth={1.5} aria-hidden="true" /> : <Send strokeWidth={1.5} aria-hidden="true" />}
                  {noShow ? "Mark as no-show" : screen.submitted ? "Send update" : group ? `Send to ${families(came.length)}` : `Send to ${recipient}`}
                </button>
              )}
            </FeedbackBar>
          </>
        )}
      </div>
    </div>
  );
};

export default SessionFeedbackPage;
