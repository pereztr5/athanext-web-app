/**
 * Shared link for a published week of group sessions (ATH-72): the pick-and-pay card on its
 * own page, for families who got the link outside the app.
 */
import { Link, useParams } from "react-router-dom";
import { GroupOfferCard } from "@/components/schedule/GroupOfferCard";
import { ROUTES } from "@/routes";

const GroupOfferPage = () => {
  const { id } = useParams();
  return (
    <div className="flex justify-center px-4 py-10 md:py-16">
      <div className="flex w-full max-w-[420px] flex-col gap-4">
        {id ? <GroupOfferCard offerId={id} /> : null}
        <Link to={ROUTES.COACHES} className="text-center text-[14px] font-medium text-[#0054B4] hover:underline">
          Browse coaches
        </Link>
      </div>
    </div>
  );
};

export default GroupOfferPage;
