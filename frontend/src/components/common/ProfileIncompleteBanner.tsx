import { useState } from "react";
import { ROUTES } from "@/routes";
import { AlertCircle, X } from "@/components/icons";
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
            className="fixed top-[3.7rem] left-0 right-0 z-40 w-full cursor-pointer border-b border-info-300 bg-info-50 px-4 py-3 font-sans transition-colors hover:bg-info-100"
        >
            <div className="mx-auto flex max-w-wrapper items-center justify-between gap-3">
                <div className="flex flex-1 items-center gap-3">
                    <AlertCircle strokeWidth={1.5} className="size-4 flex-shrink-0 text-info-700" />
                    <div className="flex-1">
                        <p className="text-label-sm text-info-700">
                            Your profile is {profileCompletion}% complete
                        </p>
                        <p className="mt-0.5 text-caption text-info-700">
                            Finish it so more athletes can find you
                        </p>
                    </div>
                </div>

                <button
                    onClick={handleDismiss}
                    className="flex-shrink-0 rounded-control p-1 text-info-700 transition-colors hover:bg-info-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    aria-label="Dismiss notification"
                >
                    <X strokeWidth={1.5} className="h-4 w-4" />
                </button>
            </div>
        </div>
    );
}
