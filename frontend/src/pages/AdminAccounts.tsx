import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
import { input } from "@/components/schedule/styles";
import {
  callAdminAccounts,
  searchAdminAccounts,
  type AdminAccount,
} from "@/api/adminAccounts";
import { organizationsAPI } from "@/api/organizations";
import { Switch } from "@/components/ui/switch";
import { ROUTES } from "@/routes";

const PERSONAS = ["athlete", "parent", "coach"] as const;

const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

const labelClass = "text-label-sm text-dark";

const EmptyNote = ({ children }: { children: string }) => (
  <p className="rounded-card border border-light-525 bg-light-300 px-[18px] pb-5 pt-[22px] text-body-m text-dark-300 md:px-[25px] md:pb-[25px] md:pt-[30px]">
    {children}
  </p>
);

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
  const qc = useQueryClient();
  const orgOwners = useQuery({ queryKey: ["admin-org-owners"], queryFn: () => organizationsAPI.adminOwnerIds(), enabled: isAdmin });
  const setOrgOwner = useMutation({
    mutationFn: ({ coachId, enabled }: { coachId: string; enabled: boolean }) => organizationsAPI.adminSetOwner(coachId, enabled),
    onSuccess: (_, { enabled }) => {
      qc.invalidateQueries({ queryKey: ["admin-org-owners"] });
      qc.invalidateQueries({ queryKey: ["organizations-public"] });
      toast({ title: enabled ? "Org status given" : "Org status removed" });
    },
    onError: (error: Error) => toast({ title: "Could not change org status", description: error.message, variant: "destructive" }),
  });

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
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-light-525 border-t-primary" />
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
    <div className="overflow-x-hidden px-4 pb-8 pt-1 md:px-5 md:pb-12">
    <div className="mx-auto flex w-full max-w-wrapper flex-col gap-4 md:gap-6">
      <PageHeader
        title="Accounts"
        subtitle="Search for a person, then change their name, email, or persona. Deactivate keeps their sessions. Delete removes the login and does not refund payments."
      />

      <form
        className="flex gap-[10px]"
        onSubmit={(event) => {
          event.preventDefault();
          search.mutate();
        }}
      >
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Name or email"
          aria-label="Search accounts by name or email"
        />
        <Button type="submit" disabled={query.trim().length < 2 || search.isPending}>
          {search.isPending ? "Searching…" : "Search"}
        </Button>
      </form>

      <div className="grid gap-6 md:grid-cols-[260px_minmax(0,1fr)]">
        <div className="flex flex-col gap-[10px]">
          {results.length === 0 ? (
            <EmptyNote>Search to see accounts here.</EmptyNote>
          ) : (
            results.map((account) => (
              <button
                key={account.id}
                type="button"
                onClick={() => choose(account)}
                className={`flex flex-col gap-1 rounded-control border px-[15px] py-3 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                  selected?.id === account.id
                    ? "border-primary bg-primary-50"
                    : "border-light-525 bg-light-300 hover:bg-light-200"
                }`}
              >
                <p className="text-label-sm text-dark">{account.name}</p>
                <p className="truncate text-caption text-dark-300">{account.email}</p>
                <p className="text-caption text-dark-300">
                  {account.persona_type ? capitalize(account.persona_type) : "No persona"}
                  {account.is_active ? "" : " · Deactivated"}
                </p>
              </button>
            ))
          )}
        </div>

        {selected ? (
          <form
            className="flex flex-col gap-5 rounded-card border border-light-525 bg-light-300 px-[18px] pb-5 pt-[22px] md:px-[25px] md:pb-[25px] md:pt-[30px]"
            onSubmit={(event) => {
              event.preventDefault();
              save.mutate();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="account-name" className={labelClass}>Name</Label>
              <Input id="account-name" value={name} onChange={(event) => setName(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="account-email" className={labelClass}>Email</Label>
              <Input id="account-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="account-persona" className={labelClass}>Persona</Label>
              <select
                id="account-persona"
                value={persona}
                onChange={(event) => setPersona(event.target.value as (typeof PERSONAS)[number])}
                className={input}
              >
                {PERSONAS.map((option) => (
                  <option key={option} value={option}>
                    {capitalize(option)}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap gap-[10px]">
              <Button type="submit" disabled={save.isPending || !name.trim() || !email.trim()}>
                {save.isPending ? "Saving…" : "Save changes"}
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
            {selected.coach_id ? (
              <div className="flex items-start justify-between gap-4 border-t border-light-525 pt-5">
                <div className="flex flex-col gap-1">
                  <Label htmlFor="org-owner" className={labelClass}>Org owner</Label>
                  <p className="text-paragraph-sm text-dark-300">
                    Gives this coach My organization: invite coaches at a % rate, an org page and splits. Turning it off deletes the org, its
                    page and invites. Coaches keep their own profiles, athletes and payments.
                  </p>
                </div>
                <Switch
                  id="org-owner"
                  checked={(orgOwners.data ?? []).includes(selected.coach_id)}
                  disabled={orgOwners.isLoading || setOrgOwner.isPending}
                  onCheckedChange={(enabled) => {
                    if (!enabled && !window.confirm("Remove org status? This deletes the organization, its page and invites.")) return;
                    setOrgOwner.mutate({ coachId: selected.coach_id!, enabled });
                  }}
                />
              </div>
            ) : null}
            <div className="flex flex-col items-start gap-2 border-t border-light-525 pt-5">
              <Label htmlFor="confirm-email" className={labelClass}>Type {selected.email} to delete this login</Label>
              <Input
                id="confirm-email"
                className="w-full"
                value={confirmEmail}
                onChange={(event) => setConfirmEmail(event.target.value)}
              />
              <Button
                type="button"
                variant="destructive"
                disabled={remove.isPending || confirmEmail.trim().toLowerCase() !== selected.email.toLowerCase()}
                onClick={() => remove.mutate()}
              >
                {remove.isPending ? "Deleting…" : "Delete account"}
              </Button>
              <p className="text-paragraph-sm text-dark-300">
                Upcoming sessions are cancelled. Past sessions stay, without a refund. The login is removed.
              </p>
            </div>
          </form>
        ) : (
          <EmptyNote>Choose an account to edit it.</EmptyNote>
        )}
      </div>
    </div>
    </div>
  );
}
