import { useLocation, useNavigate } from "react-router-dom";
import { CalendarPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { ROUTES } from "@/routes";
import type { BookSlotPayload } from "@/utils/slotBooking";

interface BookSessionButtonProps {
  coachId: string;
  coachName: string;
  /** Present when the viewer can book (athletes and parents). Omit for viewers who can't book. */
  onBookSlot?: (payload: BookSlotPayload) => void;
  onMessageCoach?: () => void;
}

/**
 * "Book a session" on the coach profile opens Book a Session with this coach (ATH-73).
 * Signed-out visitors go to sign-in and come back; coaches don't see it.
 */
export const BookSessionButton = ({ coachId, onBookSlot }: BookSessionButtonProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  if (user && !onBookSlot) return null;

  const target = `${ROUTES.BOOK}?coach=${coachId}`;
  const handleClick = () => {
    if (!user) {
      navigate(`${ROUTES.AUTH}?mode=signin`, { state: { from: { pathname: ROUTES.BOOK, search: `?coach=${coachId}` } } });
      return;
    }
    navigate(target, { state: { from: location } });
  };

  return (
    <Button onClick={handleClick}>
      <CalendarPlus strokeWidth={1.5} aria-hidden="true" />
      Book a session
    </Button>
  );
};
