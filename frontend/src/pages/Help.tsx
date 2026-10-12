/**
 * In-app Help (Working Copy `c-help` / `a-help`): search, category tiles, common questions,
 * and a Message support sheet. Content is the prototype placeholder set.
 */
import { useMemo, useState } from "react";
import { BookOpen, ChevronDown, MessageCircle, Search } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LegalCard } from "@/components/legal/LegalLinks";
import { card, dialogContent, input, label, meta, pageTitle, primaryButton, secondaryButton } from "@/components/schedule/styles";
import { useAuth } from "@/contexts/AuthContext";
import { useRole } from "@/hooks/useRole";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { HELP_ARTICLES } from "@/utils/helpArticles";

const TOPICS = {
  coach: ["A payment or refund", "A booking", "Payouts", "My account", "Something else"],
  athlete: ["A payment or refund", "A booking", "A coach", "My account", "Something else"],
} as const;

const Help = () => {
  const { isCoach } = useRole();
  const { user, userName } = useAuth();
  const { toast } = useToast();
  const role = isCoach ? "coach" : "athlete";
  const list = HELP_ARTICLES[role];
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string | null>(null);
  const [supportOpen, setSupportOpen] = useState(false);
  const [topic, setTopic] = useState("");
  const [msg, setMsg] = useState("");
  const [errors, setErrors] = useState<{ topic?: string; msg?: string }>({});

  const arts = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return list.flatMap((c) => c.articles.map((a) => ({ category: c.name, ...a }))).filter((a) => {
      if (cat && a.category !== cat) return false;
      if (!needle) return true;
      return `${a.title} ${a.body}`.toLowerCase().includes(needle);
    });
  }, [list, cat, q]);

  const heading = cat || (q.trim() ? "Results" : "Common questions");
  const email = user?.email || "";

  const send = () => {
    const next: typeof errors = {};
    if (!topic) next.topic = "Choose a topic";
    if (msg.trim().length < 10) next.msg = "Tell us a bit more";
    setErrors(next);
    if (Object.keys(next).length) return;
    setSupportOpen(false);
    setTopic("");
    setMsg("");
    toast({ title: "Message sent. We usually reply within a day" });
  };

  return (
    <div className="overflow-x-hidden px-4 pb-8 pt-1 md:px-5 md:pb-12">
      <div className="mx-auto flex w-full max-w-[1000px] flex-col gap-5">
        <header className="flex flex-col gap-[10px]">
          <h1 className={pageTitle}>Help</h1>
          <p className="text-[16px] leading-[18px] text-[#767980]">
            {isCoach ? "Answers for running your coaching business on AthaNext" : "Answers about booking, payments and your account"}
          </p>
        </header>

        <label className="relative block">
          <span className="sr-only">Search help</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#767980]" strokeWidth={1.5} aria-hidden="true" />
          <input
            className={cn(input, "border border-[#EAEADF] bg-[#F7F7F0] pl-9")}
            placeholder={isCoach ? "Search help, for example payouts or parent accounts" : "Search help, for example credits or cancel"}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {list.map((c) => {
            const on = cat === c.name;
            const Icon = c.icon;
            return (
              <button
                key={c.name}
                type="button"
                onClick={() => setCat((cur) => (cur === c.name ? null : c.name))}
                className={cn(card, "items-start gap-3 p-[18px] text-left md:p-5", on && "border-[#1A202C]")}
              >
                <span className="inline-flex size-8 items-center justify-center rounded-[8px] bg-[#E5EDF7] text-[#0054B4]">
                  <Icon className="size-4" strokeWidth={1.5} aria-hidden="true" />
                </span>
                <span className="text-[16px] font-medium leading-[18px] tracking-[-0.05em]">{c.name}</span>
                <span className={meta}>{c.articles.length} articles</span>
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_317px]">
          <section className={cn(card, "gap-0")}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-[16px] font-medium leading-[18px] tracking-[-0.05em]">
                <BookOpen className="size-5 text-[#767980]" strokeWidth={1.5} aria-hidden="true" />
                {heading}
              </h2>
              {cat ? (
                <button type="button" className="text-[14px] font-medium text-[#0054B4] hover:underline" onClick={() => setCat(null)}>
                  Show all
                </button>
              ) : null}
            </div>
            {arts.length ? (
              <div className="flex flex-col">
                {arts.map((a) => (
                  <details key={a.title} className="group border-t border-[#EAEADF] first:border-t-0">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-3.5 text-left text-[14px] font-medium leading-[18px] [&::-webkit-details-marker]:hidden">
                      {a.title}
                      <ChevronDown className="size-4 shrink-0 text-[#767980] transition-transform group-open:rotate-180" strokeWidth={1.5} aria-hidden="true" />
                    </summary>
                    <p className="pb-3.5 text-[14px] leading-[20px] text-[#484D56]">{a.body}</p>
                  </details>
                ))}
              </div>
            ) : (
              <p className={meta}>No articles match. Try different words or contact support.</p>
            )}
          </section>

          <div className="flex flex-col gap-5">
            <section className={card}>
              <h2 className="flex items-center gap-2 text-[16px] font-medium leading-[18px] tracking-[-0.05em]">
                <MessageCircle className="size-5 text-[#767980]" strokeWidth={1.5} aria-hidden="true" />
                Contact support
              </h2>
              <p className="text-[14px] leading-[18px] text-[#484D56]">
                Questions about your account, a payment or {isCoach ? "a family" : "a coach"}. We usually reply within a day.
              </p>
              <button type="button" className={cn(secondaryButton, "self-start")} onClick={() => setSupportOpen(true)}>
                Message support
              </button>
              <a className={meta} href="mailto:support@athanext.com">
                support@athanext.com
              </a>
            </section>
            <LegalCard role={role} compact />
          </div>
        </div>
      </div>

      <Dialog open={supportOpen} onOpenChange={setSupportOpen}>
        <DialogContent className={dialogContent}>
          <DialogHeader className="px-5 pb-3 pt-5 pr-14 text-left sm:px-[25px]">
            <DialogTitle className="text-[22px] font-semibold leading-[28px] tracking-[-0.05em]">Message support</DialogTitle>
            <DialogDescription className={meta}>
              We reply by email{email ? ` to ${email}` : userName ? ` to ${userName}` : ""}.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 px-5 pb-5 sm:px-[25px]">
            <label className="flex flex-col gap-1.5">
              <span className={label}>Topic</span>
              <select
                className={input}
                value={topic}
                onChange={(e) => {
                  setTopic(e.target.value);
                  setErrors((x) => ({ ...x, topic: undefined }));
                }}
              >
                <option value="">Choose a topic</option>
                {TOPICS[role].map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
              {errors.topic ? <span className="text-[12px] text-[#972B2B]">{errors.topic}</span> : null}
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={label}>How can we help?</span>
              <textarea
                className={cn(input, "h-auto min-h-[120px] py-2")}
                rows={5}
                value={msg}
                onChange={(e) => {
                  setMsg(e.target.value);
                  setErrors((x) => ({ ...x, msg: undefined }));
                }}
              />
              {errors.msg ? <span className="text-[12px] text-[#972B2B]">{errors.msg}</span> : null}
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" className={secondaryButton} onClick={() => setSupportOpen(false)}>
                Cancel
              </button>
              <button type="button" className={primaryButton} onClick={send}>
                Send
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Help;
