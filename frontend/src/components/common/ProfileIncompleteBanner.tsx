import { useState } from "react";
import { ROUTES } from "@/routes";
import { AlertCircle, X } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";

interface ProfileIncompleteBannerProps {
    profileCompletion?: number;
}

export function ProfileIncompleteBanner({
    profileCompletion = 0,
}: ProfileIncompleteBannerProps) {
    const navigate = useNavigate();
    const location = useLocation();
    const [isDismissed, setIsDismissed] = useState(false);

    // Show only on profile page
    const isProfileRoute = location.pathname === ROUTES.PROFILE;

    if (profileCompletion >= 100 || isDismissed || !isProfileRoute) {
        return null;
    }

    const handleClick = () => {
        navigate(ROUTES.PROFILE);
    };

    const handleDismiss = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsDismissed(true);
    };

    return (
        <div
            onClick={handleClick}
            className="fixed top-[3.7rem] left-0 right-0 z-40 w-full cursor-pointer border-b border-[#EAEADF] bg-[#FDF7EC] px-4 py-3 font-sans tracking-[-0.03em] transition-colors hover:bg-[#FAF0DE]"
        >
            <div className="max-w-8xl mx-auto flex items-center justify-between gap-3">
                <div className="flex flex-1 items-center gap-3">
                    <AlertCircle strokeWidth={1.5} className="h-5 w-5 flex-shrink-0 text-[#906A29]" />
                    <div className="flex-1">
                        <p className="text-[14px] font-medium leading-[18px] text-[#1A202C]">
                            Your profile is {profileCompletion}% complete
                        </p>
                        <p className="mt-0.5 text-[12px] leading-[14px] text-[#906A29]">
                            Finish it so more athletes can find you
                        </p>
                    </div>
                </div>

                <button
                    onClick={handleDismiss}
                    className="flex-shrink-0 rounded-[5px] p-1 text-[#906A29] transition-colors hover:bg-[#F4E6CB]"
                    aria-label="Dismiss notification"
                >
                    <X strokeWidth={1.5} className="h-4 w-4" />
                </button>
            </div>
        </div>
    );
}
