import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Star } from "lucide-react";
import { useCoaches } from "@/hooks/useCoaches";

interface OtherTopCoachesProps {
    currentCoachId?: string;
}

export function OtherTopCoaches({ currentCoachId }: OtherTopCoachesProps) {
    const navigate = useNavigate();
    const { coaches, coachesLoading } = useCoaches();

    return (
        <Card className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
            <CardHeader>
                <CardTitle className="text-lg">Other Top Coaches</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                {coachesLoading ? (
                    // Loading state
                    [...Array(3)].map((_, index) => (
                        <div key={index} className="flex items-center gap-3 p-2 rounded-lg animate-pulse">
                            <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex-shrink-0" />
                            <div className="flex-1 space-y-2">
                                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4" />
                                <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/2" />
                            </div>
                        </div>
                    ))
                ) : coaches && coaches.length > 0 ? (
                    coaches
                        .filter((c) => c.is_verified === true && c.id !== currentCoachId)
                        .slice(0, 3)
                        .map((coach) => (
                            <div
                                key={coach.id}
                                className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer transition-colors"
                                onClick={() => navigate(`/coach/${coach.id}`)}
                            >
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0`}>
                                    <img src={coach.profile_image_url} alt={coach.name} className="w-10 h-10 rounded-full" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold truncate">{coach.name}</p>
                                    <p className="text-xs text-muted-foreground truncate">
                                        {coach.specialties?.[0] || 'Coach'}
                                    </p>
                                </div>
                                <div className="flex items-center gap-1 flex-shrink-0">
                                    <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                                    <span className="text-xs font-medium">{coach.rating?.toFixed(1) || 'New'}</span>
                                </div>
                            </div>
                        ))
                ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">
                        No other coaches available
                    </p>
                )}

                <Button
                    variant="outline"
                    className="w-full mt-2"
                    onClick={() => navigate('/coaches')}
                >
                    View All Coaches
                </Button>
            </CardContent>
        </Card>
    );
}
