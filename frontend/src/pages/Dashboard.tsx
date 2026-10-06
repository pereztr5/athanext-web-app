import { AthleteHome } from "@/components/home/AthleteHome";
import { CoachHome } from "@/components/home/CoachHome";
import { useRole } from "@/hooks/useRole";

// Home: Coach Home (ATH-76) for coaches, Athlete Home (ATH-92) for athletes and parents.
const Dashboard = () => {
  const { isCoach, ready } = useRole();
  if (!ready) return null;
  return isCoach ? <CoachHome /> : <AthleteHome />;
};

export default Dashboard;
