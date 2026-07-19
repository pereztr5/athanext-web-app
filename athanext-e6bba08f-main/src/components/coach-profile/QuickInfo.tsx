import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchLocationFromZipCode, formatLocationDisplay, LocationInfo } from "@/utils/geolocation";

interface QuickInfoProps {
  responseTime?: number;
  sessionTypes?: string[];
  languages?: string[];
  locations?: string[];
  zipCode?: string;
  cancellationPolicy?: string;
}

export function QuickInfo({ 
  responseTime = 24,
  sessionTypes,
  languages,
  locations,
  zipCode,
  cancellationPolicy,
}: QuickInfoProps) {
  const [locationInfo, setLocationInfo] = useState<LocationInfo | null>(null);

  useEffect(() => {
    if (zipCode) {
      const fetchLocation = async () => {
        const location = await fetchLocationFromZipCode(zipCode);
        if (location) {
          setLocationInfo(location);
        }
      };
      fetchLocation();
    }
  }, [zipCode]);

  const locationDisplay = locationInfo ? formatLocationDisplay(locationInfo) : null;
  const displayLocation = locationDisplay || locations?.[0] || 'Not specified';
  return (
    <Card className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
      <CardHeader className="pb-4">
        <CardTitle className="text-xl font-bold">Quick Info</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-between items-start">
          <span className="text-sm font-semibold text-foreground">Response Time</span>
          <span className="text-sm text-muted-foreground text-right">Within {responseTime} hours</span>
        </div>
        
        <div className="flex justify-between items-start">
          <span className="text-sm font-semibold text-foreground">Session Types</span>
          <span className="text-sm text-muted-foreground text-right">
            {sessionTypes?.join(' & ') || 'Virtual & In-person'}
          </span>
        </div>
        
        <div className="flex justify-between items-start">
          <span className="text-sm font-semibold text-foreground">Languages</span>
          <span className="text-sm text-muted-foreground text-right">
            {languages?.join(', ') || 'English'}
          </span>
        </div>

        <div className="flex justify-between items-start">
          <span className="text-sm font-semibold text-foreground">Location</span>
          <span className="text-sm text-muted-foreground text-right">{displayLocation}</span>
        </div>
        
        {cancellationPolicy && (
          <div className="pt-2 border-t border-border">
            <p className="text-sm text-muted-foreground">
              {cancellationPolicy}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
