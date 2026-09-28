-- Coach-owned FAQ entries for profile edit (Quick info / FAQ polish).
-- Platform faq_items remain the fallback when profile_faqs is empty.

alter table public.coaches
  add column if not exists profile_faqs jsonb not null default '[]'::jsonb;

comment on column public.coaches.profile_faqs is
  'Coach-authored FAQ Q&A list: [{id, question, answer}]. Empty => show platform faq_items.';
