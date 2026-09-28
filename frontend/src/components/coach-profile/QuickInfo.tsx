import { useEffect, useState } from "react";
import { fetchLocationFromZipCode, formatLocationDisplay, LocationInfo } from "@/utils/geolocation";
import { CoachProfileCard, CoachProfileCardHeader } from "./CoachProfileCard";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const SESSION_TYPE_CHOICES = [
  { value: "virtual", label: "Virtual" },
  { value: "in-person", label: "In person" },
] as const;

interface QuickInfoProps {
  responseTime?: number;
  sessionTypes?: string[];
  languages?: string[];
  locations?: string[];
  zipCode?: string;
  cancellationPolicy?: string;
  isEditMode?: boolean;
  onFieldChange?: (field: string, value: unknown) => void;
}

/** "in-person" -> "In person" */
const formatSessionType = (value: string) => {
  const spaced = value.replace(/-/g, " ").trim().toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
};

const parseLanguages = (raw: string): string[] =>
  raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

export function QuickInfo({
  responseTime = 24,
  sessionTypes,
  languages,
  locations,
  zipCode,
  cancellationPolicy,
  isEditMode = false,
  onFieldChange,
}: QuickInfoProps) {
  const [locationInfo, setLocationInfo] = useState<LocationInfo | null>(null);
  // Local draft so commas/spaces aren't stripped while typing.
  // (Parent stores string[]; syncing that back on every keystroke ate trailing commas.)
  const [languagesDraft, setLanguagesDraft] = useState(() =>
    (languages || []).join(", ")
  );

  useEffect(() => {
    if (zipCode) {
      const fetchLocation = async () => {
        const location = await fetchLocationFromZipCode(zipCode);
        if (location) {
          setLocationInfo(location);
        }
      };
      fetchLocation();
    } else {
      setLocationInfo(null);
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

  const toggleSessionType = (value: string) => {
    if (!onFieldChange) return;
    const normalized = (sessionTypes || []).map((t) =>
      t.toLowerCase().replace(/\s+/g, "-")
    );
    const has = normalized.includes(value);
    const next = has
      ? (sessionTypes || []).filter(
          (t) => t.toLowerCase().replace(/\s+/g, "-") !== value
        )
      : [...(sessionTypes || []), value];
    onFieldChange("session_types", next);
  };

  if (isEditMode && onFieldChange) {
    return (
      <CoachProfileCard>
        <CoachProfileCardHeader title="Quick info" />
        <div className="flex flex-col gap-4">
          <div className="space-y-1.5">
            <Label className="text-[12px] text-[#767980]">Response time (hours)</Label>
            <Input
              type="number"
              min={1}
              max={168}
              value={responseTime}
              onChange={(e) =>
                onFieldChange("response_time_hours", Math.max(1, Number(e.target.value) || 1))
              }
              className="border-[#EAEADF] bg-[#F4F4EB]"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[12px] text-[#767980]">Session types</Label>
            <div className="flex flex-wrap gap-2">
              {SESSION_TYPE_CHOICES.map((opt) => {
                const active = (sessionTypes || []).some(
                  (t) => t.toLowerCase().replace(/\s+/g, "-") === opt.value
                );
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => toggleSessionType(opt.value)}
                    className={cn(
                      "h-8 rounded-[8px] border px-3 text-[13px] font-medium",
                      active
                        ? "border-[#6698D2] bg-[#0054B4] text-[#F1F1E6]"
                        : "border-[#EAEADF] bg-[#F4F4EB] text-[#1A202C]"
                    )}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[12px] text-[#767980]">Languages (comma-separated)</Label>
            <Input
              value={languagesDraft}
              onChange={(e) => {
                const next = e.target.value;
                setLanguagesDraft(next);
                onFieldChange("languages", parseLanguages(next));
              }}
              onBlur={() => {
                const parsed = parseLanguages(languagesDraft);
                setLanguagesDraft(parsed.join(", "));
                onFieldChange("languages", parsed);
              }}
              className="border-[#EAEADF] bg-[#F4F4EB]"
              placeholder="English, Spanish"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[12px] text-[#767980]">Cancellation policy</Label>
            <Textarea
              value={cancellationPolicy || ""}
              onChange={(e) => onFieldChange("cancellation_policy", e.target.value)}
              className="min-h-[72px] border-[#EAEADF] bg-[#F4F4EB]"
              placeholder="Flexible cancellation up to 24 hours before session"
            />
          </div>
          <p className="text-[12px] text-[#767980]">
            Location follows your zip code on the profile header. Save with{" "}
            <span className="font-medium text-[#484D56]">Save changes</span> at the top.
          </p>
        </div>
      </CoachProfileCard>
    );
  }

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
          <p className="text-[14px] font-medium leading-[18px] tracking-[-0.03em] text-[#767980]">
            {cancellationPolicy}
          </p>
        </div>
      )}
    </CoachProfileCard>
  );
}
