import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { HelpCircle, CheckCircle2 } from "@/components/icons";
import { useSportsPoll } from "@/hooks/useSportsPoll";
import { toast } from "@/hooks/use-toast";
import nextIcon from "../../assets/images/whats-next.png";
import { strings } from "@/config/strings";


export const SportsPoll = () => {
  const { sportsOptions, submitVote, isLoading } = useSportsPoll();
  const [selectedSport, setSelectedSport] = useState("");
  const [hasVoted, setHasVoted] = useState(false);
  const localVoteKey = "sports_poll_voted";

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(localVoteKey);
    if (stored === "true") {
      setHasVoted(true);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (typeof window !== "undefined" && window.localStorage.getItem(localVoteKey) === "true") {
      setHasVoted(true);
      return;
    }

    if (!selectedSport) {
      toast({
        title: "Select a sport",
        description: "Choose which sport you'd like to see added next.",
        variant: "destructive"
      });
      return;
    }

    try {
      await submitVote(selectedSport);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(localVoteKey, "true");
      }
      setHasVoted(true);
      toast({
        title: "Vote recorded",
        description: "Thanks for voting.",
      });
    } catch (error) {
      toast({
        title: "Voting failed",
        description: "Try again later.",
        variant: "destructive"
      });
    }
  };

  if (hasVoted) {
    return (
      <Card className="relative flex h-full flex-col self-stretch overflow-hidden">
        <CardHeader className="text-center pb-4 flex-shrink-0">
          <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full border border-success-300 bg-success-50">
            <CheckCircle2 className="size-6 text-success-600" strokeWidth={1.5} />
          </div>
          <CardTitle className="text-card-title text-dark">
            Thanks for voting
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center flex-grow flex flex-col justify-center">
          <p className="mb-4 text-paragraph text-dark-300">
            Your vote has been recorded. We'll use this feedback to prioritize which sport to add next to {strings.brand.name}.
          </p>
          <div className="text-body-m text-dark-300">
            Stay tuned for updates.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="relative flex h-full flex-col self-stretch overflow-hidden">
      <CardHeader className="text-center pb-4 flex-shrink-0">
        <img src={nextIcon} alt="What's next" className="mx-auto" />

        <CardTitle className="text-section text-dark">
          What sport next?
        </CardTitle>
      </CardHeader>
      <CardContent className="text-center flex-grow flex flex-col justify-center">
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="mb-6 text-paragraph text-dark-300">
            Help us decide which sport to add to {strings.brand.name}.
          </p>

          <RadioGroup value={selectedSport} onValueChange={setSelectedSport} className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 md:gap-x-4 gap-y-3 mb-6 text-left">
            {sportsOptions.map((sport) => (
              <div key={sport.id} className="flex items-center space-x-2">
                <RadioGroupItem value={sport.id} id={sport.id} />
                <Label
                  htmlFor={sport.id}
                  className="cursor-pointer text-label-sm text-dark peer-disabled:cursor-not-allowed peer-disabled:text-dark-200"
                >
                  {sport.name}
                </Label>
              </div>
            ))}
          </RadioGroup>

          <Button
            type="submit"
            className="w-full mb-4"
            disabled={isLoading || !selectedSport}
          >
            {isLoading ? "Submitting…" : "Submit vote"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
