import { useState } from "react";
import { Plus, X } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useAddClientReferrals } from "@/hooks/useReferrals";
import type { AddClientResult, ClientInviteInput } from "@/api/referrals";
import { useCopyInviteLink } from "./useCopyInviteLink";

interface AddClientsModalProps {
  open: boolean;
  onClose: () => void;
  /** Admin override: add clients for this coach, confirmed immediately. */
  coachId?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const emptyRow = (): ClientInviteInput => ({ name: "", email: "" });

const RESULT_LABELS: Record<string, string> = {
  invited: "Invite ready",
  pending_confirmation: "Invite ready (already has an account)",
  confirmed: "Confirmed",
  already_exists: "Already on your list",
  error: "Could not add",
};

export const AddClientsModal = ({ open, onClose, coachId }: AddClientsModalProps) => {
  const [rows, setRows] = useState<ClientInviteInput[]>([emptyRow()]);
  const [results, setResults] = useState<AddClientResult[] | null>(null);
  const { toast } = useToast();
  const addClients = useAddClientReferrals();
  const copyInviteLink = useCopyInviteLink();

  const validRows = rows
    .map((r) => ({ name: r.name.trim(), email: r.email.trim().toLowerCase() }))
    .filter((r) => r.name && EMAIL_RE.test(r.email));
  const hasInvalidRow = rows.some(
    (r) => (r.name.trim() || r.email.trim()) && !(r.name.trim() && EMAIL_RE.test(r.email.trim())),
  );

  const updateRow = (index: number, field: keyof ClientInviteInput, value: string) =>
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)));

  const close = () => {
    setRows([emptyRow()]);
    setResults(null);
    onClose();
  };

  const handleSubmit = async () => {
    try {
      const data = await addClients.mutateAsync({ clients: validRows, coachId });
      setResults(data?.results ?? []);
    } catch (e) {
      toast({
        title: "Could not add clients",
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{results ? "Invites ready" : "Add your current clients"}</DialogTitle>
          <DialogDescription>
            {results
              ? "Send each client their link. It only works for the email you entered and expires in 14 days."
              : coachId
                ? "Admin override: clients with an account are confirmed now; others confirm when they sign up with this email."
                : "Your existing clients book you with no platform service fee once they accept their invite."}
          </DialogDescription>
        </DialogHeader>

        {results ? (
          <ul className="flex flex-col divide-y rounded-[8px] border border-[#EAEADF]">
            {results.map((r) => (
              <li key={r.email} className="flex items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-medium text-[#1A202C]">{r.email}</p>
                  <p className="text-[12px] text-[#767980]">
                    {RESULT_LABELS[r.status] ?? r.status}
                    {r.emailed ? " · emailed" : ""}
                  </p>
                </div>
                {r.invite_link ? (
                  <Button size="sm" variant="outline" onClick={() => copyInviteLink(r.invite_link!)}>
                    Copy link
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex flex-col gap-2">
            {rows.map((row, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input
                  aria-label={`Client ${index + 1} name`}
                  placeholder="Athlete name"
                  value={row.name}
                  onChange={(e) => updateRow(index, "name", e.target.value)}
                  className="flex-1"
                />
                <Input
                  aria-label={`Client ${index + 1} email`}
                  type="email"
                  placeholder="athlete@email.com"
                  value={row.email}
                  onChange={(e) => updateRow(index, "email", e.target.value)}
                  className="flex-[1.4]"
                />
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label="Remove row"
                  disabled={rows.length === 1}
                  onClick={() => setRows((prev) => prev.filter((_, i) => i !== index))}
                >
                  <X className="size-4" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="ghost"
              className="w-fit"
              disabled={rows.length >= 50}
              onClick={() => setRows((prev) => [...prev, emptyRow()])}
            >
              <Plus className="size-4" /> Add another
            </Button>
            {hasInvalidRow ? (
              <p className="text-[12px] text-destructive">Each client needs a name and a valid email.</p>
            ) : null}
          </div>
        )}

        <DialogFooter>
          {results ? (
            <Button onClick={close}>Done</Button>
          ) : (
            <>
              <Button variant="ghost" onClick={close}>Skip for now</Button>
              <Button
                onClick={handleSubmit}
                disabled={validRows.length === 0 || hasInvalidRow || addClients.isPending}
              >
                {addClients.isPending ? "Creating…" : `Create ${validRows.length || ""} invite${validRows.length === 1 ? "" : "s"}`}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
