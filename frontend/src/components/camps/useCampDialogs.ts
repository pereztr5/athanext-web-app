/** Opens the camp editor or Registrations on /camps through the URL (see CampUrlDialogs). */
import { useSearchParams } from "react-router-dom";

export const useCampDialogs = () => {
  const [params, setParams] = useSearchParams();
  const set = (camp: string | null, view: "edit" | "registrations" | null) => {
    const next = new URLSearchParams(params);
    if (camp && view) {
      next.set("camp", camp);
      next.set("view", view);
    } else {
      next.delete("camp");
      next.delete("view");
    }
    setParams(next, { replace: !camp });
  };
  return {
    openEditor: (campId: string | null) => set(campId ?? "new", "edit"),
    openRegistrations: (campId: string) => set(campId, "registrations"),
    close: () => set(null, null),
  };
};
