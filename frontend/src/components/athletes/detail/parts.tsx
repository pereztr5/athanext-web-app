/**
 * Pieces of the coach's athlete page (Working Copy `.sp-*`): the date tile and a session row.
 */
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import type { AthleteSession } from "@/api/roster";
import { formatDayISO } from "@/utils/schedule";
import { zoned } from "./helpers";

/** Working Copy `.dt.sm`. */
export const DateTile = ({ day }: { day: string }) => (
  <span className="flex size-[44px] flex-none flex-col items-center justify-center rounded-[8px] bg-[#F4F4EB] text-center text-[#1A202C]">
    <small className="text-[10px] font-medium uppercase leading-[12px] tracking-[0.05em]">{formatDayISO(day, { weekday: "short" })}</small>
    <b className="text-[16px] font-bold leading-[18px] tracking-[-0.03em]">{formatDayISO(day, { day: "numeric" })}</b>
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
        <span className="text-[14px] font-medium leading-[18px]">{session.kind === "group" ? session.name : session.pillar || session.name}</span>
        {children}
      </span>
      {right ?? <ChevronRight className="size-4 flex-none text-[#A3A6AB]" strokeWidth={1.5} aria-hidden="true" />}
    </>
  );
  const row = "flex w-full items-center gap-3 border-b border-[#EAEADF] py-2.5 text-left";
  return right ? (
    <div className={row}>{inner}</div>
  ) : (
    <Link to={`/sessions/${session.id}`} className={row}>
      {inner}
    </Link>
  );
};
