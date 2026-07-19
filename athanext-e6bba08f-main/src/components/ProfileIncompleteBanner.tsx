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
            className="fixed top-[3.7rem] left-0 right-0 z-40 w-full bg-yellow-50 border-b border-yellow-200 px-4 py-3 cursor-pointer hover:bg-yellow-100 transition-colors"
        >
            <div className="max-w-8xl mx-auto flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-1">
                    <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0" />
                    <div className="flex-1">
                        <p className="text-sm font-medium text-yellow-800">
                            Your profile is incomplete ({profileCompletion}% complete)
                        </p>
                        <p className="text-xs text-yellow-700 mt-0.5">
                            Click here to complete your profile and increase your visibility
                        </p>
                    </div>
                </div>

                <button
                    onClick={handleDismiss}
                    className="p-1 hover:bg-yellow-200 rounded-full transition-colors flex-shrink-0"
                    aria-label="Dismiss notification"
                >
                    <X className="h-4 w-4 text-yellow-600" />
                </button>
            </div>
        </div>
    );
}
