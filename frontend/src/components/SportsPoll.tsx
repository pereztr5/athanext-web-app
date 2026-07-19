import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { HelpCircle, CheckCircle2 } from "lucide-react";
import { useSportsPoll } from "@/hooks/useSportsPoll";
import { toast } from "@/hooks/use-toast";
import { colors } from "@/config/colors";
import nextIcon from "../assets/images/whats-next.png";
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
        title: "Please select a sport",
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
        title: "Thank you for voting!",
        description: "Your vote has been recorded successfully.",
      });
    } catch (error) {
      toast({
        title: "Voting failed",
        description: "Please try again later.",
        variant: "destructive"
      });
    }
  };

  if (hasVoted) {
    return (
      <Card
        className="group relative overflow-hidden border-2 transition-all duration-300 hover:shadow-lg h-full self-stretch flex flex-col"
        style={{
          borderColor: colors.pastel.purple.foreground + '80',
          background: `linear-gradient(to bottom right, ${colors.pastel.purple.main}cc, ${colors.pastel.pink.main}80)`,
        }}
      >
        <CardHeader className="text-center pb-4 flex-shrink-0">
          <div
            className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full border"
            style={{
              backgroundColor: colors.status.success + '20',
              borderColor: colors.status.success + '40',
            }}
          >
            <CheckCircle2 style={{ color: colors.status.success }} className="h-6 w-6" />
          </div>
          <CardTitle className="text-xl font-bold text-foreground">
            Thanks for Voting!
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center flex-grow flex flex-col justify-center">
          <p className="text-muted-foreground mb-4">
            Your vote has been recorded. We'll use this feedback to prioritize which sport to add next to {strings.brand.name}.
          </p>
          <div className="text-sm text-muted-foreground">
            Stay tuned for updates!
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      className="group relative overflow-hidden border-2 transition-all duration-300 hover:shadow-lg hover:scale-105 hover:-translate-y-1 h-full self-stretch flex flex-col"
      style={{
        borderColor: colors.pastel.purple.foreground + '80',
        background: `linear-gradient(to bottom right, ${colors.pastel.purple.main}cc, ${colors.pastel.pink.main}80)`,
      }}
    >
      <CardHeader className="text-center pb-4 flex-shrink-0">
        <img src={nextIcon} alt="What's Next Icon" className="mx-auto" />

        <CardTitle className="text-2xl font-bold text-foreground">
          What Sport Next?
        </CardTitle>
      </CardHeader>
      <CardContent className="text-center flex-grow flex flex-col justify-center">
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-muted-foreground mb-6">
            Help us decide which sport to add to {strings.brand.name}!
          </p>

          <RadioGroup value={selectedSport} onValueChange={setSelectedSport} className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 md:gap-x-4 gap-y-3 mb-6 text-left">
            {sportsOptions.map((sport) => (
              <div key={sport.id} className="flex items-center space-x-2">
                <RadioGroupItem value={sport.id} id={sport.id} />
                <Label
                  htmlFor={sport.id}
                  className="cursor-pointer text-xs sm:text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
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
            {isLoading ? "Submitting..." : "Submit Vote"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
