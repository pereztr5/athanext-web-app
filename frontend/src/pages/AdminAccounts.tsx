import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  callAdminAccounts,
  searchAdminAccounts,
  type AdminAccount,
} from "@/api/adminAccounts";
import { ROUTES } from "@/routes";

const PERSONAS = ["athlete", "parent", "coach"] as const;

export default function AdminAccounts() {
  const { isAdmin, ready: adminReady } = useIsAdmin();
  const { user, initialCheckComplete, profileReady, loading } = useAuth();
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AdminAccount[]>([]);
  const [selected, setSelected] = useState<AdminAccount | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [persona, setPersona] = useState<(typeof PERSONAS)[number]>("athlete");
  const [confirmEmail, setConfirmEmail] = useState("");

  const search = useMutation({
    mutationFn: () => searchAdminAccounts(query.trim()),
    onSuccess: (users) => {
      setResults(users);
      setSelected(null);
    },
    onError: (error: Error) => {
      toast({ title: "Search failed", description: error.message, variant: "destructive" });
    },
  });

  const save = useMutation({
    mutationFn: () =>
      callAdminAccounts({
        action: "update",
        user_id: selected!.id,
        name,
        email,
        persona,
      }),
    onSuccess: () => {
      toast({ title: "Account updated" });
      setSelected((current) =>
        current ? { ...current, name, email, persona_type: persona } : current
      );
      setResults((current) =>
        current.map((account) =>
          account.id === selected?.id ? { ...account, name, email, persona_type: persona } : account
        )
      );
    },
    onError: (error: Error) => {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    },
  });

  const setActive = useMutation({
    mutationFn: (active: boolean) =>
      callAdminAccounts({
        action: active ? "reactivate" : "deactivate",
        user_id: selected!.id,
      }),
    onSuccess: (_data, active) => {
      toast({ title: active ? "Account reactivated" : "Account deactivated" });
      setSelected((current) => (current ? { ...current, is_active: active } : current));
      setResults((current) =>
        current.map((account) =>
          account.id === selected?.id ? { ...account, is_active: active } : account
        )
      );
    },
    onError: (error: Error) => {
      toast({ title: "Could not change access", description: error.message, variant: "destructive" });
    },
  });

  const remove = useMutation({
    mutationFn: () => callAdminAccounts({ action: "delete", user_id: selected!.id }),
    onSuccess: () => {
      toast({ title: "Account deleted" });
      setResults((current) => current.filter((account) => account.id !== selected?.id));
      setSelected(null);
      setConfirmEmail("");
    },
    onError: (error: Error) => {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    },
  });

  if (!initialCheckComplete || !profileReady || loading || !adminReady) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth?mode=signin" replace />;
  if (!isAdmin) return <Navigate to={ROUTES.DASHBOARD} replace />;

  const choose = (account: AdminAccount) => {
    setSelected(account);
    setName(account.name);
    setEmail(account.email);
    setPersona(account.persona_type && PERSONAS.includes(account.persona_type) ? account.persona_type : "athlete");
    setConfirmEmail("");
  };

  return (
    <div className="mx-auto flex w-full max-w-[880px] flex-col gap-6 px-4 py-8">
      <div>
        <h1 className="text-[28px] font-medium tracking-[-1px] text-[#1A202C]">Accounts</h1>
        <p className="mt-1 text-[14px] text-[#767980]">
          Search for a person, then change their name, email, or persona. Deactivate keeps their sessions. Delete removes the login and does not refund payments.
        </p>
      </div>

      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          search.mutate();
        }}
      >
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Name or email"
          className="h-auto rounded-[8px] border-[#EAEADF] bg-[#F7F7F0] px-3 py-2"
        />
        <Button type="submit" disabled={query.trim().length < 2 || search.isPending}>
          {search.isPending ? "Searching..." : "Search"}
        </Button>
      </form>

      <div className="grid gap-4 md:grid-cols-[240px_minmax(0,1fr)]">
        <div className="flex flex-col gap-2">
          {results.length === 0 ? (
            <p className="text-[14px] text-[#A3A6AB]">No accounts shown yet.</p>
          ) : (
            results.map((account) => (
              <button
                key={account.id}
                type="button"
                onClick={() => choose(account)}
                className={`rounded-[10px] border px-3 py-2 text-left ${
                  selected?.id === account.id
                    ? "border-[#0054B4] bg-[#E5EDF7]"
                    : "border-[#EAEADF] bg-[#F7F7F0]"
                }`}
              >
                <p className="text-[14px] font-medium text-[#1A202C]">{account.name}</p>
                <p className="truncate text-[12px] text-[#767980]">{account.email}</p>
                <p className="text-[12px] text-[#A3A6AB]">
                  {account.persona_type || "No persona"}
                  {account.is_active ? "" : " · Deactivated"}
                </p>
              </button>
            ))
          )}
        </div>

        {selected ? (
          <form
            className="flex flex-col gap-4 rounded-[10px] border border-[#EAEADF] bg-[#F7F7F0] p-5"
            onSubmit={(event) => {
              event.preventDefault();
              save.mutate();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="account-name">Name</Label>
              <Input id="account-name" value={name} onChange={(event) => setName(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="account-email">Email</Label>
              <Input id="account-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="account-persona">Persona</Label>
              <select
                id="account-persona"
                value={persona}
                onChange={(event) => setPersona(event.target.value as (typeof PERSONAS)[number])}
                className="h-10 w-full rounded-[8px] border border-[#EAEADF] bg-white px-3 text-[14px]"
              >
                {PERSONAS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={save.isPending || !name.trim() || !email.trim()}>
                {save.isPending ? "Saving..." : "Save changes"}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={setActive.isPending}
                onClick={() => setActive.mutate(!selected.is_active)}
              >
                {selected.is_active ? "Deactivate" : "Reactivate"}
              </Button>
            </div>
            <div className="space-y-2 border-t border-[#EAEADF] pt-4">
              <Label htmlFor="confirm-email">Type {selected.email} to delete this login</Label>
              <Input
                id="confirm-email"
                value={confirmEmail}
                onChange={(event) => setConfirmEmail(event.target.value)}
              />
              <Button
                type="button"
                variant="destructive"
                disabled={remove.isPending || confirmEmail.trim().toLowerCase() !== selected.email.toLowerCase()}
                onClick={() => remove.mutate()}
              >
                {remove.isPending ? "Deleting..." : "Delete account"}
              </Button>
              <p className="text-[12px] text-[#767980]">
                Upcoming sessions are cancelled. Past sessions stay, without a refund. The login is removed.
              </p>
            </div>
          </form>
        ) : (
          <p className="text-[14px] text-[#A3A6AB]">Choose an account to edit it.</p>
        )}
      </div>
    </div>
  );
}
