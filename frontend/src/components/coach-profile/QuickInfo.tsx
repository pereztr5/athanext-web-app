import { useEffect, useState } from "react";
import { fetchLocationFromZipCode, formatLocationDisplay, LocationInfo } from "@/utils/geolocation";
import { CoachProfileCard, CoachProfileCardHeader } from "./CoachProfileCard";

interface QuickInfoProps {
  responseTime?: number;
  sessionTypes?: string[];
  languages?: string[];
  locations?: string[];
  zipCode?: string;
  cancellationPolicy?: string;
}

/** "in-person" -> "In person" */
const formatSessionType = (value: string) => {
  const spaced = value.replace(/-/g, " ").trim().toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
};

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
  const displayLocation = locationDisplay || locations?.[0] || "Not specified";
  const sessionTypesLabel = sessionTypes?.length
    ? sessionTypes.map(formatSessionType).join(" and ")
    : "Virtual and in person";

  const rows: [string, string][] = [
    ["Response time", `Within ${responseTime} hours`],
    ["Session types", sessionTypesLabel],
    ["Languages", languages?.join(", ") || "English"],
    ["Location", displayLocation],
  ];

  return (
    <CoachProfileCard>
      <CoachProfileCardHeader title="Quick info" />
      <dl className="flex flex-col gap-[10px] text-[14px] leading-[18px] tracking-[-0.03em]">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-start justify-between gap-3">
            <dt className="shrink-0 font-medium text-[#484D56]">{label}</dt>
            <dd className="text-right font-normal text-[#767980]">{value}</dd>
          </div>
        ))}
      </dl>
      {cancellationPolicy && (
        <div className="rounded-[8px] border border-[#EAEADF] bg-[#F4F4EB] p-[10px]">
          <p className="text-[14px] font-medium leading-[18px] tracking-[-0.03em] text-[#767980]">{cancellationPolicy}</p>
        </div>
      )}
    </CoachProfileCard>
  );
}
