import { AthleteSettings } from "@/components/settings/AthleteSettings";
import { CoachSettings } from "@/components/settings/CoachSettings";
import { useRole } from "@/hooks/useRole";

/** Account settings: coaches (ATH-87) and everyone else, athletes and parents first (ATH-91). */
const AccountSettings = () => {
  const { isCoach } = useRole();
  return isCoach ? <CoachSettings /> : <AthleteSettings />;
};

export default AccountSettings;
