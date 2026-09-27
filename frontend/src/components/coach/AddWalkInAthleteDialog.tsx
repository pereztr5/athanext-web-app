import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { addWalkInAthlete, searchWalkInAthletes, type WalkInAthlete } from "@/api/walkIn";

type AddWalkInAthleteDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slotId: string;
  sessionDate: string | null;
  onAdded: (result: {
    bookingId: string;
    athlete: { id: string; name: string };
    requiresPayment: boolean;
    alreadyAdded: boolean;
  }) => void;
};

export const AddWalkInAthleteDialog = ({
  open,
  onOpenChange,
  slotId,
  sessionDate,
  onAdded,
}: AddWalkInAthleteDialogProps) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<WalkInAthlete[]>([]);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const search = async () => {
    const term = query.trim();
    setError(null);
    setSearched(false);
    if (term.length < 2) {
      setResults([]);
      setError("Enter at least 2 characters.");
      return;
    }
    try {
      const response = await searchWalkInAthletes(term);
      setResults(response.athletes);
      setSearched(true);
    } catch (err) {
      setResults([]);
      setError(err instanceof Error ? err.message : "Search failed.");
    }
  };

  const add = async (athleteId: string) => {
    setPendingId(athleteId);
    setError(null);
    try {
      const result = await addWalkInAthlete(slotId, sessionDate, athleteId);
      onAdded(result);
      onOpenChange(false);
      setQuery("");
      setResults([]);
      setSearched(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add this athlete.");
    } finally {
      setPendingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add an athlete</DialogTitle>
          <DialogDescription>
            Search for someone who already has an AthaNext account. They pay from My Sessions. A free session is added with no charge.
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void search();
          }}
        >
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Name or email"
            aria-label="Search athletes by name or email"
          />
          <Button type="submit">Search</Button>
        </form>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {searched && results.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            This person needs an AthaNext account before they can be added.
          </p>
        ) : null}
        <div className="flex flex-col gap-2">
          {results.map((athlete) => (
            <div key={athlete.id} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{athlete.name}</p>
                {athlete.email ? <p className="truncate text-xs text-muted-foreground">{athlete.email}</p> : null}
              </div>
              <Button type="button" size="sm" disabled={pendingId === athlete.id} onClick={() => void add(athlete.id)}>
                Add
              </Button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};
