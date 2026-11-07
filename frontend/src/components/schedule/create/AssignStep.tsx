/**
 * "Book it for" (Working Copy 2 coach7.js assignModal): the coach already agreed a 1-on-1 with
 * someone. Athletes with credits are booked straight away (undo from the toast); anyone else
 * gets the session as an offer with the payment link, since booking without payment needs
 * credits or a family paying outside AthaNext.
 */
import { errorMessage } from "@/utils/errorMessage";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Search } from "@/components/icons";
import { rosterAPI } from "@/api/roster";
import { scheduleAPI, type ScheduleSession } from "@/api/schedule";
import { ToastAction } from "@/components/ui/toast";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { money } from "@/utils/booking";
import { getZonedISODate } from "@/utils/dateHelpers";
import { formatClock, formatDayISO, plural, sessionLink, sessionStart } from "@/utils/schedule";
import { input, meta } from "../styles";
import { backLink, sheetBody } from "./classes";
import { Avatar } from "./parts";

export const AssignStep = ({
  session,
  coachId,
  coachName,
  slug,
  timeZone,
  sheet,
  onBack,
  onDone,
}: {
  session: ScheduleSession;
  coachId: string;
  coachName: string;
  slug: string | null;
  timeZone: string;
  sheet: boolean;
  onBack: () => void;
  onDone: () => void;
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const rosterQuery = useQuery({ queryKey: ["coach-roster"], queryFn: () => rosterAPI.roster() });

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...(rosterQuery.data ?? [])]
      .filter((a) => !q || a.name.toLowerCase().includes(q))
      .sort((a, b) => (b.lastDate ?? "").localeCompare(a.lastDate ?? ""))
      .slice(0, 12);
  }, [rosterQuery.data, query]);

  const start = sessionStart(session);
  const when = `${formatDayISO(getZonedISODate(start, timeZone), { weekday: "short", month: "short", day: "numeric" })} at ${formatClock(start, timeZone)}`;

  const invalidate = () => {
    for (const key of ["coach-schedule", "coach-roster", "coach-athlete", "sessions"]) {
      queryClient.invalidateQueries({ queryKey: [key] });
    }
  };

  const book = useMutation({
    mutationFn: async ({ id, name, credits }: { id: string; name: string; credits: number }) => {
      if (credits > 0) return { ids: await rosterAPI.book(id, [session.id], "credit"), name };
      const first = name.split(" ")[0];
      const link = sessionLink(slug, coachId, session.id);
      await scheduleAPI.offerSession(
        [session.id],
        [id],
        false,
        `${first}, ${coachName.split(" ")[0] || "your coach"} booked ${when} for you (${money(session.price)}). Pay here: ${link}`
      );
      return { ids: [] as string[], name };
    },
    onSuccess: ({ ids, name }) => {
      invalidate();
      const first = name.split(" ")[0];
      if (ids.length) {
        const undo = () =>
          rosterAPI
            .undoBooking(ids)
            .then(() => {
              invalidate();
              toast({ title: "Booking undone" });
            })
            .catch((e: Error) => toast({ title: "Couldn't undo", description: e.message, variant: "destructive" }));
        toast({
          title: `Booked ${first} for ${when} with a credit`,
          action: (
            <ToastAction altText="Undo the booking" onClick={undo}>
              Undo
            </ToastAction>
          ),
        });
      } else {
        toast({ title: `Sent ${when} to ${first}`, description: `${first} got the payment link. It's theirs once they pay.` });
      }
      onDone();
    },
    onError: (err: unknown) =>
      toast({ title: errorMessage(err, "Couldn't book that time"), variant: "destructive" }),
  });

  return (
    <div className={sheet ? sheetBody : "flex flex-col gap-4"}>
      <button type="button" className={backLink} onClick={onBack}>
        <ChevronLeft strokeWidth={1.5} aria-hidden="true" />
        Back
      </button>
      <span className={meta}>
        {when.replace(" at ", " · ")} · {money(session.price)}
      </span>
      <label className="relative flex items-center">
        <Search className="pointer-events-none absolute left-3 size-4 text-dark-300" strokeWidth={1.5} aria-hidden="true" />
        <input
          className={cn(input, "pl-9")}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search your athletes"
          aria-label="Search your athletes"
          autoComplete="off"
          autoFocus
        />
      </label>
      {rosterQuery.isLoading ? (
        <p className={meta}>Loading your athletes…</p>
      ) : list.length ? (
        <div className="-mx-2 flex flex-col">
          {list.map((a) => (
            <button
              key={a.id}
              type="button"
              disabled={book.isPending}
              className="flex w-full items-center gap-3 rounded-control px-2 py-2.5 text-left text-dark-300 hover:bg-light-400 disabled:cursor-not-allowed disabled:bg-transparent [&>svg]:size-4 [&>svg]:flex-none"
              onClick={() => book.mutate({ id: a.id, name: a.name, credits: a.credits })}
            >
              <Avatar name={a.name} imageUrl={a.imageUrl} size={36} />
              <span className="flex min-w-0 grow flex-col gap-0.5">
                <b className="truncate text-label-sm text-dark">{a.name}</b>
                <span className={meta}>{a.credits ? `Uses 1 of ${plural(a.credits, "credit")}` : "Payment link sent"}</span>
              </span>
              <ChevronRight strokeWidth={1.5} aria-hidden="true" />
            </button>
          ))}
        </div>
      ) : (
        <p className={meta}>{query ? "No athletes match." : "Athletes who book with you or join from your invites show up here."}</p>
      )}
    </div>
  );
};
