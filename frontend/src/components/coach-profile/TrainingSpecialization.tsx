import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dumbbell, CheckCircle, MapPin, Video, Users } from "lucide-react";

interface TrainingSpecializationProps {
  specializations?: string[];
  sessionTypes?: string[];
  locations?: string[];
  iconColor: string;
}

export function TrainingSpecialization({
  specializations = [],
  sessionTypes = [],
  locations = [],
  iconColor
}: TrainingSpecializationProps) {
  // Default specializations based on image
  const defaultSpecializations = [
    "Shot Stopping & Positioning",
    "Distribution & Footwork",
    "Collegiate Preparation",
    "Advanced Shot Stopping"
  ];

  const specs = specializations.length > 0 ? specializations : defaultSpecializations;

  return (
    <Card className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Dumbbell className={`h-5 w-5 ${iconColor}`} />
          Training Specialization + Format
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Specializations */}
          <div>
            <h4 className="text-sm font-semibold mb-3">Specializations</h4>
            <div className="grid md:grid-cols-2 gap-2">
              {specs.map((spec, index) => (
                <div key={index} className="flex items-center gap-2">
                  <CheckCircle className={`h-4 w-4 ${iconColor} flex-shrink-0`} />
                  <span className="text-sm">{spec}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Training Format */}
          {sessionTypes.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold mb-3">Training Format</h4>
              <div className="space-y-2">
                {sessionTypes.map((type, index) => (
                  <div key={index} className="flex items-start gap-2">
                    {type.toLowerCase().includes('virtual') ? (
                      <Video className={`h-4 w-4 ${iconColor} mt-0.5 flex-shrink-0`} />
                    ) : (
                      <MapPin className={`h-4 w-4 ${iconColor} mt-0.5 flex-shrink-0`} />
                    )}
                    <span className="text-sm font-medium">{type}</span>
                    {type.toLowerCase().includes('person') && locations.length > 0 && (
                      <span className="text-sm text-muted-foreground">: {locations[0]}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
