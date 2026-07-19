import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface ReadyToStartProps {
  onFreeConsultation: () => void;
  onBookSession: () => void;
  onViewPackages: () => void;
  hourlyRate?: number;
  buttonClass: string;
}

export function ReadyToStart({ 
  onFreeConsultation,
  onBookSession,
  onViewPackages,
  hourlyRate = 138,
  buttonClass 
}: ReadyToStartProps) {
  return (
    <Card className="bg-gradient-to-tl from-green-100 via-sky-50/50 to-white backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-lg">Ready to Start?</CardTitle>
        <p className="text-sm text-black">
          Book your first session and get a personalized training plan tailored to your goals.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button 
          className="w-full bg-transparent hover:bg-gray-50 text-[#0D7FF2] border-2 border-[#0D7FF2] font-medium"
          onClick={onFreeConsultation}
        >
          Free 15 Minute Consultation
        </Button>        
      </CardContent>
    </Card>
  );
}
