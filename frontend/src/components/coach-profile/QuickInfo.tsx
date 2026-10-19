import { useEffect, useState } from "react";
import { fetchLocationFromZipCode, formatLocationDisplay, LocationInfo } from "@/utils/geolocation";
import { CoachProfileCard, CoachProfileCardHeader } from "./CoachProfileCard";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { choice } from "@/components/schedule/styles";

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
            <Label className="text-caption text-dark-300">Response time (hours)</Label>
            <Input
              type="number"
              min={1}
              max={168}
              value={responseTime}
              onChange={(e) =>
                onFieldChange("response_time_hours", Math.max(1, Number(e.target.value) || 1))
              }
              className="border-dark-250 bg-light"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-caption text-dark-300">Session types</Label>
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
                    aria-pressed={active}
                    className={cn(choice(active), "h-8 min-h-8")}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-caption text-dark-300">Languages (comma-separated)</Label>
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
              className="border-dark-250 bg-light"
              placeholder="English, Spanish"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-caption text-dark-300">Cancellation policy</Label>
            <Textarea
              value={cancellationPolicy || ""}
              onChange={(e) => onFieldChange("cancellation_policy", e.target.value)}
              className="min-h-[72px] border-dark-250 bg-light"
              placeholder="Flexible cancellation up to 24 hours before session"
            />
          </div>
          <p className="text-caption text-dark-300">
            Location follows your zip code on the profile header. Save with{" "}
            <span className="font-medium text-dark-400">Save changes</span> at the top.
          </p>
        </div>
      </CoachProfileCard>
    );
  }

  return (
    <CoachProfileCard>
      <CoachProfileCardHeader title="Quick info" />
      <dl className="flex flex-col gap-[10px] text-body-m">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-start justify-between gap-3">
            <dt className="shrink-0 text-dark-300">{label}</dt>
            <dd className="text-right text-label-sm text-dark">{value}</dd>
          </div>
        ))}
      </dl>
      {cancellationPolicy && (
        <div className="rounded-control border border-light-525 bg-light-400 p-[10px]">
          <p className="text-paragraph-sm text-dark-300">
            {cancellationPolicy}
          </p>
        </div>
      )}
    </CoachProfileCard>
  );
}
