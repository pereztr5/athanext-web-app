/** Small Invites sheets: Fix email (Save and resend), Decline a sign-up, Why the standard fee applies. */
import { useEffect, useState, type ReactNode } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { dangerButton, dialogContent, input, label, meta, primaryButton, secondaryButton } from "@/components/schedule/styles";
import { cn } from "@/lib/utils";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const Sheet = ({
  open,
  title,
  description,
  onClose,
  children,
  footer,
}: {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children?: ReactNode;
  footer: ReactNode;
}) => (
  <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
    <DialogContent className={cn(dialogContent, "max-w-[460px]")}>
      <DialogHeader className="px-5 pb-3 pt-5 pr-14 text-left sm:px-[25px]">
        <DialogTitle className="text-[22px] font-semibold leading-[28px] tracking-[-0.05em]">{title}</DialogTitle>
        <DialogDescription className={description ? meta : "sr-only"}>{description ?? title}</DialogDescription>
      </DialogHeader>
      {children ? <div className="flex flex-col gap-3 px-5 pb-2 sm:px-[25px]">{children}</div> : null}
      <div className="flex justify-end gap-2 px-5 pb-5 pt-3 sm:px-[25px]">{footer}</div>
    </DialogContent>
  </Dialog>
);

export const FixEmailDialog = ({
  invite,
  pending,
  onClose,
  onSave,
}: {
  invite: { parent: string; email: string } | null;
  pending: boolean;
  onClose: () => void;
  onSave: (email: string) => void;
}) => {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setEmail(invite?.email ?? "");
    setError(null);
  }, [invite]);

  const save = () => {
    if (!EMAIL_RE.test(email.trim())) {
      setError("Enter a valid email");
      return;
    }
    onSave(email.trim());
  };

  return (
    <Sheet
      open={Boolean(invite)}
      title="Fix email address"
      description={invite ? `The invite to ${invite.parent} bounced` : undefined}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={secondaryButton} onClick={onClose}>Cancel</button>
          <button type="button" className={primaryButton} disabled={pending} onClick={save}>
            {pending ? "Sending…" : "Save and resend"}
          </button>
        </>
      }
    >
      <label className="flex flex-col gap-1.5">
        <span className={label}>Parent email</span>
        <input
          type="email"
          autoComplete="off"
          className={cn(input, error && "ring-2 ring-[#FDB5B5]")}
          value={email}
          aria-invalid={Boolean(error)}
          onChange={(e) => {
            setEmail(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => e.key === "Enter" && save()}
        />
        {error ? <span className="text-[12px] leading-[16px] text-[#972B2B]">{error}</span> : null}
      </label>
      <p className={meta}>Saving sends a new invite.</p>
    </Sheet>
  );
};

export const DeclineDialog = ({
  open,
  pending,
  onClose,
  onDecline,
}: {
  open: boolean;
  pending: boolean;
  onClose: () => void;
  onDecline: () => void;
}) => (
  <Sheet
    open={open}
    title="Decline this sign-up?"
    description="They are removed from your invites and can still find you on the marketplace."
    onClose={onClose}
    footer={
      <>
        <button type="button" className={secondaryButton} onClick={onClose}>Cancel</button>
        <button type="button" className={dangerButton} disabled={pending} onClick={onDecline}>Decline</button>
      </>
    }
  />
);

export const WhyFeeDialog = ({
  parent,
  since,
  onClose,
}: {
  parent: string | null;
  since: string | null;
  onClose: () => void;
}) => (
  <Sheet
    open={Boolean(parent)}
    title="Why the standard fee applies"
    onClose={onClose}
    footer={
      <>
        <button type="button" className={secondaryButton} onClick={onClose}>Close</button>
        <button type="button" className={primaryButton} onClick={onClose}>Got it</button>
      </>
    }
  >
    <p className="text-[14px] leading-[18px] text-[#484D56]">
      {parent} booked you on the marketplace before you invited them{since ? ` (${since})` : ""}, so they joined as a
      marketplace client. Sessions with them carry the standard marketplace fee.
    </p>
  </Sheet>
);
