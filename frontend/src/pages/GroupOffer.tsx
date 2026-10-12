/**
 * Shared link for a published week of group sessions (ATH-72 / WC4 week post): the same
 * pick-and-pay card families see in chat, on its own page.
 */
import { Link, useParams } from "react-router-dom";
import { GroupOfferCard } from "@/components/schedule/GroupOfferCard";
import { ROUTES } from "@/routes";

const GroupOfferPage = () => {
  const { id } = useParams();
  return (
    <div className="flex min-h-[60vh] justify-center bg-[#F4F4EB] px-4 py-10 md:py-16">
      <div className="flex w-full max-w-[460px] flex-col gap-4">
        {id ? <GroupOfferCard offerId={id} /> : null}
        <Link to={ROUTES.COACHES} className="text-center text-[14px] font-medium text-[#0054B4] hover:underline">
          Browse coaches
        </Link>
      </div>
    </div>
  );
};

export default GroupOfferPage;
