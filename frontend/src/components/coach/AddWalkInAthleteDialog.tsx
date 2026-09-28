import { useState } from "react";
import { Search, UserPlus } from "lucide-react";
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
      <DialogContent className="gap-0 overflow-hidden p-0 font-sans tracking-[-0.03em] text-[#1A202C] sm:max-w-lg">
        <DialogHeader className="space-y-1.5 px-[25px] py-5 pr-14 text-left">
          <DialogTitle className="text-[24px] font-semibold leading-[30px] tracking-[-0.05em] text-[#1A202C]">
            Add an athlete
          </DialogTitle>
          <DialogDescription className="text-[14px] leading-[18px] tracking-[-0.03em] text-[#767980]">
            Search for someone who already has an AthaNext account. They pay from My Sessions. A free session is added with no charge.
          </DialogDescription>
        </DialogHeader>
        <div className="h-px bg-[#EAEADF]" />
        <div className="flex flex-col gap-[10px] px-[25px] pb-[25px] pt-5">
          <form
            className="flex gap-[10px]"
            onSubmit={(event) => {
              event.preventDefault();
              void search();
            }}
          >
            <div className="relative flex-1">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#A3A6AB]"
                strokeWidth={1.5}
                aria-hidden="true"
              />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Name or email"
                aria-label="Search athletes by name or email"
                className="pl-9"
              />
            </div>
            <Button type="submit" className="h-[38px]">
              Search
            </Button>
          </form>
          {error ? <p className="text-[12px] leading-[14px] tracking-[-0.03em] text-destructive">{error}</p> : null}
          {searched && results.length === 0 ? (
            <p className="rounded-[8px] bg-[#F4F4EB] p-4 text-[14px] leading-[18px] tracking-[-0.03em] text-[#767980]">
              This person needs an AthaNext account before they can be added.
            </p>
          ) : null}
          {results.length > 0 ? (
            <div className="flex max-h-[320px] flex-col gap-[10px] overflow-y-auto">
              {results.map((athlete) => (
                <div
                  key={athlete.id}
                  className="flex items-center justify-between gap-3 rounded-[8px] border border-[#EAEADF] bg-[#F4F4EB] px-4 py-3"
                >
                  <div className="flex min-w-0 flex-col gap-1.5">
                    <p className="truncate text-[16px] font-medium leading-[18px] tracking-[-0.05em] text-[#1A202C]">
                      {athlete.name}
                    </p>
                    {athlete.email ? (
                      <p className="truncate text-[14px] leading-[18px] tracking-[-0.03em] text-[#767980]">{athlete.email}</p>
                    ) : null}
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="shrink-0 bg-[#F7F7F0]"
                    disabled={pendingId === athlete.id}
                    onClick={() => void add(athlete.id)}
                    aria-label={`Add ${athlete.name}`}
                  >
                    <UserPlus className="size-4" strokeWidth={1.5} aria-hidden="true" />
                    {pendingId === athlete.id ? "Adding..." : "Add"}
                  </Button>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
};
