/**
 * Pieces of the coach's athlete page (Working Copy `.sp-*`): the date tile and a session row.
 */
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "@/components/icons";
import type { AthleteSession } from "@/api/roster";
import { formatDayISO } from "@/utils/schedule";
import { zoned } from "./helpers";

/** Working Copy `.dt.sm`. */
export const DateTile = ({ day }: { day: string }) => (
  <span className="flex size-[44px] flex-none flex-col items-center justify-center rounded-control border border-light-525 bg-light-400 text-center text-dark">
    <small className="text-label-xsm">{formatDayISO(day, { weekday: "short" })}</small>
    <b className="text-subtitle">{formatDayISO(day, { day: "numeric" })}</b>
  </span>
);

/** Working Copy `.sp-sr`: a link to the session, or a plain row with an action on the right. */
export const SessionRow = ({
  session,
  timeZone,
  right,
  children,
}: {
  session: AthleteSession;
  timeZone: string;
  right?: ReactNode;
  children: ReactNode;
}) => {
  const { day } = zoned(session.date, session.startTime, timeZone);
  const inner = (
    <>
      <DateTile day={day} />
      <span className="flex min-w-0 grow flex-col gap-0.5">
        <span className="text-label-sm">{session.kind === "group" ? session.name : session.pillar || session.name}</span>
        {children}
      </span>
      {right ?? <ChevronRight className="size-4 flex-none text-dark-200" strokeWidth={1.5} aria-hidden="true" />}
    </>
  );
  const row = "flex w-full items-center gap-3 border-b border-light-525 py-2.5 text-left";
  return right ? (
    <div className={row}>{inner}</div>
  ) : (
    <Link to={`/sessions/${session.id}`} className={row}>
      {inner}
    </Link>
  );
};
