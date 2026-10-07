/**
 * Messages (Working Copy): what a one-to-one conversation is about, and the shortcuts that go
 * with it. Coaches see "Parent of {athlete}, {age}", "{first}'s profile", "Book session",
 * "Share session notes" and "Suggest times"; families see "Book". The shortcuts fill the
 * message box so the coach can review before sending.
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, CalendarPlus, FileText, User } from "lucide-react";
import { rosterAPI } from "@/api/roster";
import { BookAthleteDialog } from "@/components/athletes/BookAthleteDialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { dialogContent, meta, primaryButton, secondaryButton } from "@/components/schedule/styles";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/routes";
import { getZonedISODate, zonedWallTimeToUtc } from "@/utils/dateHelpers";
import { formatClock, formatDayISO } from "@/utils/schedule";
import { useViewerTimeZone } from "@/hooks/useViewerTimeZone";

export type ConversationContext = {
  athlete_id?: string;
  athlete_name?: string;
  age?: number;
  holder_name?: string;
  holder_is_parent?: boolean;
  latest_notes?: { slot_id: string; date: string; summary: string } | null;
  coach_id?: string;
  coach_slug?: string | null;
  coach_name?: string;
};

export const useConversationContext = (conversationId: string | null | undefined, isGroup: boolean) =>
  useQuery({
    queryKey: ["conversation-context", conversationId],
    enabled: Boolean(conversationId) && !isGroup,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_conversation_context", { p_conversation_id: conversationId! });
      if (error) throw error;
      return (data ?? null) as ConversationContext | null;
    },
  });

const chip = "inline-flex h-[30px] items-center gap-1.5 rounded-[8px] border border-[#EAEADF] bg-[#F4F4EB] px-3 text-[13px] font-medium text-[#1A202C] hover:bg-[#EAEADF] [&>svg]:size-4";

/** The line under the name: "Parent of Ava Patel, 13" for coaches. */
export const conversationSubline = (ctx: ConversationContext | null | undefined) =>
  ctx?.athlete_name && ctx.holder_is_parent && ctx.holder_name !== ctx.athlete_name
    ? `Parent of ${ctx.athlete_name}${ctx.age != null ? `, ${ctx.age}` : ""}`
    : ctx?.athlete_name && ctx.age != null && ctx.age >= 18
      ? "Athlete, 18+"
      : null;

export const ConversationHeaderActions = ({ ctx }: { ctx: ConversationContext | null | undefined }) => {
  const [booking, setBooking] = useState(false);
  if (ctx?.athlete_id) {
    const first = (ctx.athlete_name ?? "").split(" ")[0];
    return (
      <span className="hidden gap-2 sm:flex">
        <Link to={`${ROUTES.ATHLETES}/${ctx.athlete_id}`} className={chip}>
          <User strokeWidth={1.5} aria-hidden="true" />
          {first}'s profile
        </Link>
        <button type="button" className={chip} onClick={() => setBooking(true)}>
          <CalendarDays strokeWidth={1.5} aria-hidden="true" />
          Book session
        </button>
        <BookAthleteDialog athleteId={booking ? ctx.athlete_id : null} name={ctx.athlete_name ?? ""} onClose={() => setBooking(false)} />
      </span>
    );
  }
  if (ctx?.coach_id) {
    return (
      <Link to={`${ROUTES.BOOK}?coach=${ctx.coach_id}`} className={cn(chip, "hidden sm:inline-flex")}>
        <CalendarPlus strokeWidth={1.5} aria-hidden="true" />
        Book
      </Link>
    );
  }
  return null;
};

export const ComposerShortcuts = ({ ctx, onFill }: { ctx: ConversationContext | null | undefined; onFill: (text: string) => void }) => {
  const timeZone = useViewerTimeZone();
  const [picking, setPicking] = useState(false);
  const [chosen, setChosen] = useState<string[]>([]);
  const times = useQuery({
    queryKey: ["roster-open-times", ctx?.athlete_id, true],
    enabled: picking && Boolean(ctx?.athlete_id),
    queryFn: () => rosterAPI.openTimes(ctx!.athlete_id!, 12),
  });
  if (!ctx?.athlete_id) return null;
  const label = (date: string, start: string) => {
    const at = zonedWallTimeToUtc(date, start) ?? new Date(NaN);
    return `${formatDayISO(getZonedISODate(at, timeZone), { weekday: "short", month: "short", day: "numeric" })}, ${formatClock(at, timeZone)}`;
  };
  const notes = ctx.latest_notes;
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        className={chip}
        disabled={!notes}
        title={notes ? undefined : "No session notes yet"}
        onClick={() =>
          notes &&
          onFill(
            `Session notes from ${formatDayISO(notes.date, { weekday: "short", month: "short", day: "numeric" })}: ${notes.summary.trim().replace(/[.!?]?$/, ".")} See them here: ${window.location.origin}/sessions/${notes.slot_id}`
          )
        }
      >
        <FileText strokeWidth={1.5} aria-hidden="true" />
        Share session notes
      </button>
      <button type="button" className={chip} onClick={() => setPicking(true)}>
        <CalendarDays strokeWidth={1.5} aria-hidden="true" />
        Suggest times
      </button>
      <Dialog open={picking} onOpenChange={(o) => { setPicking(o); if (!o) setChosen([]); }}>
        <DialogContent className={dialogContent}>
          <DialogHeader className="px-5 pb-3 pt-5 pr-14 text-left sm:px-[25px]">
            <DialogTitle className="text-[22px] font-semibold leading-[28px] tracking-[-0.05em]">Suggest times</DialogTitle>
            <DialogDescription className={meta}>Pick a few open 1-on-1 times. They go into your message.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 px-5 pb-5 sm:px-[25px]">
            {times.isLoading ? <p className={meta}>Finding open times…</p> : null}
            {times.data && !times.data.length ? <p className={meta}>No open 1-on-1 times. Add some in My Schedule.</p> : null}
            <div className="flex max-h-[300px] flex-col gap-2 overflow-y-auto">
              {(times.data ?? []).map((t) => {
                const on = chosen.includes(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setChosen((c) => (on ? c.filter((x) => x !== t.id) : [...c, t.id]))}
                    className={cn(
                      "rounded-[8px] border px-3 py-2.5 text-left text-[14px] font-medium",
                      on ? "border-[#6698D2] bg-[#E5EDF7]" : "border-[#EAEADF] bg-[#F9F9F5]"
                    )}
                  >
                    {label(t.date, t.startTime)}
                  </button>
                );
              })}
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" className={secondaryButton} onClick={() => setPicking(false)}>Cancel</button>
              <button
                type="button"
                className={primaryButton}
                disabled={!chosen.length}
                onClick={() => {
                  const picked = (times.data ?? []).filter((t) => chosen.includes(t.id));
                  onFill(`These times work for me: ${picked.map((t) => label(t.date, t.startTime)).join("; ")}. Book one here: ${window.location.origin}${ROUTES.BOOK}`);
                  setPicking(false);
                  setChosen([]);
                }}
              >
                Add to message
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
