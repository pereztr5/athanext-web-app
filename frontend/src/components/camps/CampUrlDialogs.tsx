/**
 * The camp editor and Registrations on My profile, driven by the URL so links can open them:
 * /profile?camp=<id>&view=registrations, /profile?camp=<id>&view=edit, /profile?camp=new&view=edit.
 */
import { useSearchParams } from "react-router-dom";
import { useCampDialogs } from "./useCampDialogs";
import { CampEditorDialog } from "./CampEditorDialog";
import { CampRegistrations } from "./CampRegistrations";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const CampUrlDialogs = () => {
  const [params] = useSearchParams();
  const { close } = useCampDialogs();
  const camp = params.get("camp");
  const view = params.get("view");
  const campId = camp && UUID.test(camp) ? camp : null;
  return (
    <>
      <CampEditorDialog
        open={view === "edit" && (camp === "new" || Boolean(campId))}
        campId={campId}
        onOpenChange={(open) => {
          if (!open) close();
        }}
      />
      {campId ? (
        <CampRegistrations
          open={view === "registrations"}
          campId={campId}
          onOpenChange={(open) => {
            if (!open) close();
          }}
        />
      ) : null}
    </>
  );
};
