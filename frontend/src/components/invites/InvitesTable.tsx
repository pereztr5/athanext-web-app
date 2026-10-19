/** The Invites work list: Parent | Invited via | Status | Updated | one action per row. Scrolls sideways on phone. */
import type { ReactNode } from "react";
import { Pencil, RefreshCw, Trash2 } from "@/components/icons";
import { BrandPill } from "@/components/brand";
import type { CoachInviteRow } from "@/api/referrals";
import { secondaryButton, smallButton, textButton } from "@/components/schedule/styles";
import { cn } from "@/lib/utils";
import {
  INVITE_STATUS, inviteSubline, parentName, relativeDay, updatedAt, viaLabel, type InviteStatus,
} from "./inviteStatus";

export type InviteAction = "approve" | "decline" | "resend" | "fix" | "remove";

const iconBtn =
  "inline-flex size-[30px] flex-none items-center justify-center rounded-control text-dark-300 transition-colors hover:bg-light-400 hover:text-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:text-dark-200 disabled:hover:bg-transparent [&>svg]:size-4";
const th = "whitespace-nowrap py-3 pr-2.5 text-left text-label-xsm text-dark-300";
const td = "whitespace-nowrap border-t border-light-525 py-3.5 pr-2.5 align-middle";

const IconAction = ({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: ReactNode }) => (
  <button type="button" className={iconBtn} aria-label={label} title={label} disabled={disabled} onClick={onClick}>
    {children}
  </button>
);

export const InvitesTable = ({
  rows,
  busyId,
  onAction,
}: {
  rows: { invite: CoachInviteRow; status: InviteStatus }[];
  busyId: string | null;
  onAction: (action: InviteAction, invite: CoachInviteRow) => void;
}) => (
  <div className="overflow-x-auto">
    <table className="w-full min-w-[560px] border-collapse text-body-m">
      <thead>
        <tr>
          <th className={th}>Parent</th>
          <th className={th}>Invited via</th>
          <th className={th}>Status</th>
          <th className={th}>Updated</th>
          <th className={cn(th, "pr-0")}><span className="sr-only">Actions</span></th>
        </tr>
      </thead>
      <tbody>
        {rows.map(({ invite, status }) => {
          const [statusLabel, tone] = INVITE_STATUS[status];
          const busy = busyId === invite.id;
          return (
            <tr key={invite.id}>
              <td className={td}>
                <div className="flex flex-col gap-1">
                  <span className="font-medium text-dark">{parentName(invite)}</span>
                  <span className={cn("text-caption", status === "bounced" ? "text-error-700" : "text-dark-300")}>
                    {inviteSubline(invite, status)}
                  </span>
                </div>
              </td>
              <td className={cn(td, "text-dark-300")}>{viaLabel(invite)}</td>
              <td className={td}><BrandPill tone={tone}>{statusLabel}</BrandPill></td>
              <td className={cn(td, "text-dark-300")}>{relativeDay(updatedAt(invite))}</td>
              <td className={cn(td, "pr-0 text-right")}>
                {status === "approval" ? (
                  <div className="flex items-center justify-end gap-2">
                    <button type="button" className={cn(textButton, "h-[30px] px-2 text-dark-300")} disabled={busy} onClick={() => onAction("decline", invite)}>
                      Decline
                    </button>
                    <button type="button" className={cn(secondaryButton, smallButton)} disabled={busy} onClick={() => onAction("approve", invite)}>
                      Approve
                    </button>
                  </div>
                ) : status === "sent" || status === "opened" || status === "expired" ? (
                  <IconAction label="Resend invite" disabled={busy} onClick={() => onAction("resend", invite)}>
                    <RefreshCw strokeWidth={1.5} aria-hidden="true" className={cn(busy && "animate-spin")} />
                  </IconAction>
                ) : status === "bounced" ? (
                  <IconAction label="Fix email" disabled={busy} onClick={() => onAction("fix", invite)}>
                    <Pencil strokeWidth={1.5} aria-hidden="true" />
                  </IconAction>
                ) : status === "declined" ? (
                  <IconAction label="Remove from invites" disabled={busy} onClick={() => onAction("remove", invite)}>
                    <Trash2 strokeWidth={1.5} aria-hidden="true" />
                  </IconAction>
                ) : null}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
);
