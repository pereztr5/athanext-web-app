import { Badge } from '../ui/badge';
import { useState } from "react";
import { Button } from '../ui/button';
import { MapPin, Star, Instagram } from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import rowerIcon from '../../assets/images/colored-rowing.png';
import footballIcon from '../../assets/images/colored-soccer.png';
import { CoachVerificationBadge } from './CoachVerificationBadge';
import { PRIMARY, colors } from '@/config/colors';
import { SPORTS_OPTIONS, normalizePosition } from "@/utils/db";
import type { Coach } from '@/types/coachProfile'
interface CoachCardProps {
    coach: Coach;
    onViewProfile: (coachId: string) => void;
    onSession?: (coachId: string) => void;
    onViewPackages?: () => void;
    onSendMessage?: (coach: Coach) => void;
    disableSendMessage?: boolean;
    isSendingMessage?: boolean;
}

const CoachCard = ({
    coach,
    onViewProfile,
    onSession,
    onViewPackages,
    onSendMessage,
    disableSendMessage,
    isSendingMessage,
}: CoachCardProps) => {
    const [showAllSpecialties, setShowAllSpecialties] = useState(false);
    const [showAllPositions, setShowAllPositions] = useState(false);

    const initials = coach?.name
        ?.split(' ')
        .map(word => word.charAt(0))
        .join('')
        .toUpperCase() || 'NC';

    const specialtyList = Array.isArray(coach?.specialties)
        ? coach.specialties.filter((item): item is string => Boolean(item && String(item).trim()))
        : [];
    const rawFavoritePositions =
        (coach as any)?.favourite_positions ?? (coach as any)?.favorite_positions ?? [];
    const favoritePositions = Array.isArray(rawFavoritePositions)
        ? rawFavoritePositions.filter((item): item is string => Boolean(item && String(item).trim()))
        : typeof rawFavoritePositions === "string"
            ? rawFavoritePositions.split(",").map((item) => item.trim()).filter(Boolean)
            : [];
    const primarySpecialty = specialtyList[0] || 'Coach';
    const primaryLocation = coach?.locations?.[0] || 'Location not specified';
    const sportOption = SPORTS_OPTIONS.find(
        (option) => option.value.toLowerCase() === (coach?.sport || "").toLowerCase()
    );
    const getFavoritePositionLabel = (value: string) =>
        sportOption?.positions.find((position) => position.value === value)?.label ||
        normalizePosition(sportOption?.value || "", value);

    // Special styling only for specific elements

    const initialsClass = "text-primary font-bold text-lg";
    const avatarInnerClass = "w-16 h-16 bg-primary/30 rounded-full flex items-center justify-center";
    const avatarClass = "relative p-1 group-hover:bg-gradient-to-br from-primary/20 to-primary/10 rounded-full flex items-center justify-center mr-4";

    const sportSource = ((coach as any)?.sport || (coach as any)?.sport_type || '').toLowerCase();
    const isRowing = sportSource.includes('row');
    const isSoccer = ["soccer", "football", "scoccer"].some((s) => sportSource.includes(s));
    const sportIcon = isRowing ? rowerIcon : isSoccer ? footballIcon : footballIcon;
    const isGoalkeeper = coach?.position === "goalkeeper";
    const badgeClass = isGoalkeeper
        ? "bg-[#E8F3EB] hover:bg-[#cfebd6] text-[#1B8A3B] border border-[#1B8A3B33]"
        : "bg-[#ECF0F3] hover:bg-[#e0e6eb] text-[#0A3A67] border border-[#0A3A6736]";
    const favoriteBadgeStyle = isRowing
        ? {
            backgroundColor: colors.rowingBlueTheme.badgeBackground,
            color: colors.rowingBlueTheme.badgeText,
            borderColor: colors.rowingBlueTheme.primary,
        }
        : isSoccer
          ? {
              backgroundColor: colors.soccerTheme.cardLight,
              color: colors.soccerTheme.cardLightText,
              borderColor: colors.soccerTheme.primary,
          }
          : {
              backgroundColor: colors.pastel.blue.main,
              color: colors.pastel.blue.foreground,
              borderColor: colors.primary.main,
          };
    const maxBadgesToShow = 2;
    const visibleBadges = specialtyList.slice(0, maxBadgesToShow);
    const extraBadges = specialtyList.slice(maxBadgesToShow);
    const visibleFavoritePositions = favoritePositions.slice(0, maxBadgesToShow);
    const extraFavoritePositions = favoritePositions.slice(maxBadgesToShow);

    return (
        <Card
            key={coach.id}
            role="button"
            tabIndex={0}
            aria-label={`View ${coach?.name} profile`}
            onClick={() => {
                if (coach.id) {
                    onViewProfile(coach.id);
                }
            }}
            className="rounded-xl group hover:shadow-xl transition-all duration-300 hover:-translate-y-2 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm h-full flex flex-col cursor-pointer w-full max-w-md md:max-w-none mx-auto"
        >
            <CardContent className="p-4 flex flex-col flex-1 h-full">
                <div className="flex-1 flex flex-col gap-3">
                    <div className="flex mb-1 flex-shrink-0">
                        <div>
                            {coach?.image_url ? (
                                <div className="relative w-16 h-16 mr-5">
                                    <img src={coach?.image_url} alt={coach?.name} className="w-full h-full rounded-full object-cover" />
                                    <div className="absolute -bottom-3 left-1/2 transform -translate-x-1/2 rounded-full p-1 bg-white">
                                        <img src={sportIcon} alt="sport" className="w-5 h-5" />
                                    </div>
                                </div>
                            ) : (
                                <div className={avatarClass}>
                                    <div className={avatarInnerClass}>
                                        <span className={initialsClass}>{initials}</span>
                                    </div>
                                    <div className="absolute -bottom-3 left-1/2 transform -translate-x-1/2 rounded-full p-1 bg-white">
                                        <img src={sportIcon} alt="sport" className="w-5 h-5" />
                                    </div>
                                </div>
                            )
                            }
                        </div>
                        <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                                <p className="font-bold text-lg text-foreground leading-tight">{coach?.name || 'Unknown Coach'}</p>
                                {coach?.is_verified && <CoachVerificationBadge className="h-4 w-4" />}
                                {coach?.instagram_handle && (
                                    <a
                                        href={`https://instagram.com/${coach.instagram_handle}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={(e) => e.stopPropagation()}
                                        className="inline-flex items-center justify-center w-6 h-6 bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 rounded-full hover:opacity-80 transition-opacity"
                                        aria-label={`View ${coach.name}'s Instagram profile`}
                                    >
                                        <Instagram className="h-3.5 w-3.5 text-white" />
                                    </a>
                                )}
                            </div>
                            <p className="text-sm text-muted-foreground">{primarySpecialty}</p>
                            <div className="flex items-center gap-1 text-sm text-muted-foreground mb-1">
                                <MapPin className="h-4 w-4" />
                                <span>{primaryLocation}</span>
                            </div>
                            {visibleBadges.length > 0 && (
                                <div className="flex flex-wrap gap-2 mb-1">
                                    {visibleBadges.map((specialty, index) => (
                                        <Badge
                                            key={`${specialty}-${index}`}
                                            className="w-fit text-xs font-semibold bg-[#ECF0F3] text-[#0A3A67] border border-[#0A3A6736] px-3 py-1"
                                        >
                                            {specialty}
                                        </Badge>
                                    ))}
                                    {extraBadges.length > 0 && (
                                        <button
                                            type="button"
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                setShowAllSpecialties((prev) => !prev);
                                            }}
                                            className="px-3 py-1 rounded-full bg-[#ECF0F3] text-[#0A3A67] border border-[#0A3A6736] text-xs font-semibold hover:bg-[#e0e6eb] transition-colors"
                                            aria-expanded={showAllSpecialties}
                                            aria-label={`Show all ${specialtyList.length} specialties`}
                                        >
                                            +{extraBadges.length}
                                        </button>
                                    )}
                                </div>
                            )}
                            {showAllSpecialties && (
                                <div className="flex flex-wrap gap-2 mb-1">
                                    {extraBadges.map((specialty, index) => (
                                        <Badge
                                            key={`all-${specialty}-${index}`}
                                            className="w-fit text-xs font-semibold bg-[#ECF0F3] text-[#0A3A67] border border-[#0A3A6736] px-3 py-1"
                                        >
                                            {specialty}
                                        </Badge>
                                    ))}
                                </div>
                            )}
                            {favoritePositions.length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                    {visibleFavoritePositions.map((position, index) => (
                                        <Badge
                                            key={`${position}-${index}`}
                                            className="w-fit text-xs font-semibold px-3 py-1 border transition-opacity hover:opacity-90"
                                            style={favoriteBadgeStyle}
                                        >
                                            {getFavoritePositionLabel(position)}
                                        </Badge>
                                    ))}
                                    {extraFavoritePositions.length > 0 && (
                                        <button
                                            type="button"
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                setShowAllPositions((prev) => !prev);
                                            }}
                                            className="px-3 py-1 rounded-full text-xs font-semibold border transition-opacity hover:opacity-90"
                                            style={favoriteBadgeStyle}
                                            aria-expanded={showAllPositions}
                                            aria-label={`Show all ${favoritePositions.length} favorite positions`}
                                        >
                                            +{extraFavoritePositions.length}
                                        </button>
                                    )}
                                </div>
                            )}
                            {showAllPositions && (
                                <div className="flex flex-wrap gap-2">
                                    {extraFavoritePositions.map((position, index) => (
                                        <Badge
                                            key={`all-favorite-${position}-${index}`}
                                            className="w-fit text-xs font-semibold px-3 py-1 border transition-opacity hover:opacity-90"
                                            style={favoriteBadgeStyle}
                                        >
                                            {getFavoritePositionLabel(position)}
                                        </Badge>
                                    ))}
                                </div>
                            )}
                            
                        </div>
                    </div>

                </div>

                {/* Divider */}
                <div className='w-full h-[1px] bg-[#F0F0F0] mt-3' />

                {/* Rating near buttons */}
                <div className="w-full flex items-center justify-between gap-2 flex-wrap mt-3">
                    <div className="w-fit flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1 bg-[#FFFBEB] px-3 py-2 rounded-[.8rem]">
                            <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                            <span className="font-semibold text-sm">{coach?.rating || 0}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">({coach?.total_reviews || 0} {" "} reviews)</span>
                    </div>
                </div>

                {/* Bio intentionally hidden on All Coaches view as requested */}

                <div className="flex flex-col gap-3 items-center justify-center mt-3">
                    <div className='grid grid-cols-2 gap-2 w-full sm:flex sm:flex-row sm:justify-center sm:items-stretch'>
                        {/* <Button
                            variant="outline"
                            className="flex-1 text-xs rounded-full whitespace-nowrap"
                        >
                            Free Consultant
                        </Button> */}
                        <Button
                            className="w-full sm:flex-1 text-xs font-medium rounded-full whitespace-normal sm:whitespace-nowrap min-w-0"
                            style={{ backgroundColor: PRIMARY.main, color: PRIMARY.foreground }}
                            onClick={(event) => {
                                event.stopPropagation();
                                if (onSession) {
                                    onSession(coach.id!);
                                    return;
                                }
                                onViewProfile(coach.id!);
                            }}
                        >
                            Book a Session
                        </Button>
                        <Button
                            className="w-full sm:flex-1 text-xs font-medium rounded-full whitespace-normal sm:whitespace-nowrap min-w-0"
                            style={{ backgroundColor: PRIMARY.main, color: PRIMARY.foreground }}
                                onClick={(event) => {
                                event.stopPropagation();
                                if (onViewPackages) {
                                    onViewPackages();
                                    return;
                                }
                                onViewProfile(coach.id!);
                            }}
                        >
                            View Packages
                        </Button>
                        <Button
                            className="col-span-2 w-full sm:flex-1 text-xs font-medium rounded-full whitespace-normal sm:whitespace-nowrap disabled:opacity-70 sm:col-span-1 min-w-0"
                            type="button"
                            disabled={disableSendMessage || !onSendMessage || isSendingMessage}
                            style={{ backgroundColor: PRIMARY.main, color: PRIMARY.foreground }}
                            onClick={(event) => {
                                event.stopPropagation();
                                if (onSendMessage) {
                                    onSendMessage(coach);
                                }
                            }}
                        >
                            {isSendingMessage ? "Starting..." : "Send a Message"}
                        </Button>
                    </div>
                    <Button
                        variant="secondary"
                        className="w-full py-6 text-sm font-medium rounded-[1.5rem] shadow-sm bg-black hover:bg-gray-500 text-white"
                        onClick={() => {
                            if (coach.id) {
                                onViewProfile(coach.id);
                            }
                        }}
                    >
                        View Full Profile
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}

export default CoachCard
