/**
 * In-app Terms / Privacy overlay (WC4 #22). Desktop panel, phone full-screen.
 * Stripe Connect stays external; coach terms open the published coach URL when needed.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { getPrivacyPolicyContent } from "@/api/privacy-policy";
import { getTermsAndConditionsContent } from "@/api/terms";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { COACH_TERMS_URL } from "@/utils/offlinePay";
import { formatDayISO } from "@/utils/schedule";

export type LegalDoc = "terms" | "privacy" | "coach";

type LegalCtx = {
  open: (doc?: LegalDoc) => void;
  close: () => void;
};

const Ctx = createContext<LegalCtx | null>(null);

export const useLegal = () => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useLegal must be used within LegalProvider");
  return ctx;
};

/** Safe open when provider may be missing (tests). */
export const openLegalDoc = (doc: LegalDoc = "terms") => {
  window.dispatchEvent(new CustomEvent("athanext-legal-open", { detail: doc }));
};

const metaLine = (version: string | number | undefined, updated: string | undefined, acceptedAt: string | null) => {
  const bits = [
    version != null ? `Version ${version}` : null,
    updated ? `Updated ${formatDayISO(updated.slice(0, 10), { month: "short", day: "numeric", year: "numeric" })}` : null,
    acceptedAt
      ? `You accepted ${formatDayISO(acceptedAt.slice(0, 10), { month: "short", day: "numeric", year: "numeric" })}`
      : null,
  ].filter(Boolean);
  return bits.join(" · ");
};

export const LegalProvider = ({ children }: { children: ReactNode }) => {
  const [doc, setDoc] = useState<LegalDoc | null>(null);
  const isMobile = useIsMobile();
  const { userProfile } = useAuth();

  const open = useCallback((next: LegalDoc = "terms") => {
    if (next === "coach") {
      window.open(COACH_TERMS_URL, "_blank", "noopener,noreferrer");
      return;
    }
    setDoc(next);
  }, []);
  const close = useCallback(() => setDoc(null), []);

  useEffect(() => {
    const onOpen = (e: Event) => {
      const detail = (e as CustomEvent<LegalDoc>).detail;
      open(detail || "terms");
    };
    window.addEventListener("athanext-legal-open", onOpen);
    return () => window.removeEventListener("athanext-legal-open", onOpen);
  }, [open]);

  useEffect(() => {
    if (!doc) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [doc, close]);

  const terms = useQuery({
    queryKey: ["legal-terms"],
    queryFn: async () => (await getTermsAndConditionsContent()).data,
    enabled: Boolean(doc),
  });
  const privacy = useQuery({
    queryKey: ["legal-privacy"],
    queryFn: async () => (await getPrivacyPolicyContent()).data,
    enabled: Boolean(doc),
  });

  /** Normalize Terms vs Privacy API shapes into one view model. */
  const active = useMemo(() => {
    if (doc === "privacy") {
      const p = privacy.data?.policy;
      if (!p) return null;
      const raw = p.last_updated || "";
      const iso = /^\d{4}-\d{2}-\d{2}/.test(raw) ? raw.slice(0, 10) : null;
      return { content: p.content, last_updated: iso, version: privacy.data?.version };
    }
    const t = terms.data;
    if (!t) return null;
    const raw = t.last_updated || "";
    const iso = /^\d{4}-\d{2}-\d{2}/.test(raw) ? raw.slice(0, 10) : null;
    return { content: t.content, last_updated: iso, version: t.version };
  }, [doc, privacy.data, terms.data]);

  const acceptedAt =
    doc === "privacy"
      ? (userProfile as { privacy_accepted_at?: string | null } | null)?.privacy_accepted_at ?? null
      : (userProfile as { terms_accepted_at?: string | null } | null)?.terms_accepted_at ?? null;

  const value = useMemo(() => ({ open, close }), [open, close]);

  return (
    <Ctx.Provider value={value}>
      {children}
      {doc ? (
        <div className="fixed inset-0 z-[80] flex items-stretch justify-center" role="dialog" aria-modal="true" aria-label="Legal">
          <button type="button" className="absolute inset-0 bg-black/40" aria-label="Close" onClick={close} />
          <div
            className={cn(
              "relative z-[1] flex max-h-[100dvh] w-full flex-col bg-[#F7F7F0] shadow-[0_0_30px_rgba(0,0,0,0.12)]",
              isMobile ? "h-full" : "my-8 max-h-[calc(100dvh-4rem)] max-w-[720px] rounded-[12px] border border-[#EAEADF]"
            )}
          >
            <header className="flex items-center justify-between gap-3 border-b border-[#EAEADF] px-4 py-3 md:px-5">
              <div className="flex gap-1 rounded-[8px] bg-[#F1F1E6] p-[3px]" role="tablist">
                {(
                  [
                    ["terms", "Terms of Service"],
                    ["privacy", "Privacy Policy"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={doc === id}
                    className={cn(
                      "rounded-[6px] px-3 py-1.5 text-[13px] font-medium",
                      doc === id ? "bg-[#F7F7F0] text-[#1A202C]" : "text-[#767980]"
                    )}
                    onClick={() => setDoc(id)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="inline-flex size-8 items-center justify-center rounded-[8px] text-[#767980] hover:bg-[#F1F1E6] hover:text-[#1A202C]"
                aria-label="Close"
                onClick={close}
              >
                <X className="size-4" strokeWidth={1.5} />
              </button>
            </header>
            <div className="border-b border-[#EAEADF] px-4 py-2 text-[12px] text-[#767980] md:px-5">
              {metaLine(active?.version, active?.last_updated ?? undefined, acceptedAt)}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-5 md:py-5">
              {terms.isLoading || privacy.isLoading ? (
                <p className="text-[14px] text-[#767980]">Loading…</p>
              ) : active?.content ? (
                <div
                  className="prose prose-sm max-w-none text-[#484D56] prose-headings:text-[#1A202C] prose-a:text-[#0054B4]"
                  dangerouslySetInnerHTML={{ __html: active.content }}
                />
              ) : (
                <p className="text-[14px] text-[#767980]">Couldn't load this document.</p>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </Ctx.Provider>
  );
};
