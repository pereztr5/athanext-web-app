/**
 * Video call link on Schedule settings. The coach pastes their own Zoom, Meet or Teams URL.
 * Booking emails and the session page show it; the public coach listing does not.
 */
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Video } from "@/components/icons";
import { getMeetingUrl, saveMeetingUrl } from "@/api/meetingLinks";
import { useToast } from "@/hooks/use-toast";
import { card, input, label, primaryButton } from "../styles";
import { CardHeading, caption } from "./shared";

export const MeetingLinkCard = ({ coachId }: { coachId: string }) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["meeting-link", coachId], queryFn: () => getMeetingUrl(coachId) });
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (query.data !== undefined) setValue(query.data ?? "");
  }, [query.data]);

  const save = useMutation({
    mutationFn: () => saveMeetingUrl(coachId, value),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["meeting-link", coachId] });
      toast({ title: value.trim() ? "Video link saved" : "Video link removed" });
      setError(null);
    },
    onError: (err: unknown) => setError(err instanceof Error ? err.message : "Couldn't save the link"),
  });

  return (
    <section className={card} aria-label="Video call link">
      <CardHeading icon={Video} title="Video call link" />
      <p className={caption}>
        For virtual sessions. Families and you both get this link in the booking email, and it shows on the session page. It is not on your public profile.
      </p>
      <label className="flex flex-col gap-1.5">
        <span className={label}>Zoom, Google Meet or Teams URL</span>
        <input
          className={input}
          inputMode="url"
          placeholder="https://"
          value={value}
          disabled={query.isLoading}
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
        />
      </label>
      {error ? <p className="text-caption text-error-700">{error}</p> : null}
      <button type="button" className={`${primaryButton} self-start`} disabled={save.isPending || query.isLoading} onClick={() => save.mutate()}>
        {save.isPending ? "Saving…" : "Save link"}
      </button>
    </section>
  );
};
