import { useState } from "react";
import type { KeyboardEvent } from "react";
import { Button } from '../ui/button';
import { MapPin, Instagram, MessageCircle, Loader2 } from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import rowerIcon from '../../assets/images/colored-rowing.png';
import footballIcon from '../../assets/images/colored-soccer.png';
import { SPORTS_OPTIONS, normalizePosition } from "@/utils/db";
import type { Coach } from '@/types/coachProfile'
import { isPublicCoachRatingVisible, publicCoachRatingLabel } from "@/utils/publicRating";
import { BrandPill, BrandStar } from "@/components/brand";
import { coachAcademy, organizationPath } from "@/utils/coachAcademy";
import { Link } from "react-router-dom";

interface CoachCardProps {
    coach: Coach;
    onViewProfile: (coachId: string) => void;
    onSession?: (coachId: string) => void;
    onViewPackages?: () => void;
    onSendMessage?: (coach: Coach) => void;
    disableSendMessage?: boolean;
    isSendingMessage?: boolean;
}

/**
 * Display-only sentence case: "Technical Skills" -> "Technical skills".
 * Words written fully in capitals (e.g. "GK", "U18") are left alone.
 */
const toSentenceCase = (value: string) => {
    const words = value.trim().split(/\s+/);
    return words
        .map((word, index) => {
            const isAcronym = word.length > 1 && word === word.toUpperCase() && /[A-Z]/.test(word);
            if (isAcronym) return word;
            const lower = word.toLowerCase();
            return index === 0 ? lower.charAt(0).toUpperCase() + lower.slice(1) : lower;
        })
        .join(' ');
};

const pillToggleClass =
    "inline-flex items-center whitespace-nowrap rounded-[4px] px-2 py-[3px] text-[12px] font-medium leading-[13px] tracking-[-0.03em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0054B4]/40";

const actionButtonBase =
    "h-[34px] rounded-[8px] border text-[14px] font-medium tracking-[-0.03em] shadow-none min-w-0";

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
    const academy = coachAcademy(coach?.company);
    const primarySpecialty = specialtyList[0]
        ? (() => {
            const label = toSentenceCase(specialtyList[0]);
            return /\bcoach$/i.test(label) ? label : `${label} coach`;
        })()
        : 'Coach';
    const primaryLocation = coach?.locations?.[0] || 'Location not specified';
    const sportOption = SPORTS_OPTIONS.find(
        (option) => option.value.toLowerCase() === (coach?.sport || "").toLowerCase()
    );
    const getFavoritePositionLabel = (value: string) =>
        toSentenceCase(
            sportOption?.positions.find((position) => position.value === value)?.label ||
            normalizePosition(sportOption?.value || "", value)
        );

    const sportSource = ((coach as any)?.sport || (coach as any)?.sport_type || '').toLowerCase();
    const isRowing = sportSource.includes('row');
    const sportIcon = isRowing ? rowerIcon : footballIcon;

    const maxBadgesToShow = 2;
    const visibleBadges = showAllSpecialties ? specialtyList : specialtyList.slice(0, maxBadgesToShow);
    const extraBadgeCount = Math.max(specialtyList.length - maxBadgesToShow, 0);
    const visibleFavoritePositions = showAllPositions
        ? favoritePositions
        : favoritePositions.slice(0, maxBadgesToShow);
    const extraFavoritePositionCount = Math.max(favoritePositions.length - maxBadgesToShow, 0);

    const ratingVisible = isPublicCoachRatingVisible(coach?.total_reviews, coach?.rating);
    const messageDisabled = disableSendMessage || !onSendMessage || isSendingMessage;

    const openProfile = () => {
        if (coach.id) {
            onViewProfile(coach.id);
        }
    };

    const handleCardKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            openProfile();
        }
    };

    return (
        <Card
            key={coach.id}
            role="button"
            tabIndex={0}
            aria-label={`View ${coach?.name} profile`}
            onClick={openProfile}
            onKeyDown={handleCardKeyDown}
            className="h-full w-full max-w-md md:max-w-none mx-auto flex flex-col cursor-pointer rounded-[10px] border border-[#EAEADF] bg-[#F7F7F0] text-[#1A202C] shadow-none transition-colors hover:border-[#DCDCCF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0054B4]/30"
        >
            <CardContent className="flex flex-1 flex-col gap-5 px-[25px] pt-[30px] pb-[25px]">
                <div className="flex flex-1 flex-col gap-5">
                    {/* Header: avatar, name block, rating */}
                    <div className="flex items-start gap-3">
                        <div className="relative size-10 flex-none">
                            {coach?.image_url ? (
                                <img
                                    src={coach.image_url}
                                    alt={coach?.name}
                                    className="size-10 rounded-full object-cover"
                                />
                            ) : (
                                <div className="flex size-10 items-center justify-center rounded-full bg-[#E5EDF7] text-[14px] font-medium tracking-[-0.03em] text-[#0054B4]">
                                    {initials}
                                </div>
                            )}
                            <img
                                src={sportIcon}
                                alt=""
                                aria-hidden="true"
                                className="absolute -bottom-1 -right-1 size-4 rounded-full bg-[#F7F7F0] p-px"
                            />
                        </div>

                        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                            <div className="flex min-w-0 items-center gap-1.5">
                                <p className="truncate text-[20px] font-medium leading-[18px] tracking-[-0.05em] text-[#1A202C]">
                                    {coach?.name || 'Unknown coach'}
                                </p>
                                {coach?.is_verified && (
                                    <span className="inline-flex flex-none" title="Verified coach">
                                        <svg
                                            width="16"
                                            height="16"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="#0054B4"
                                            strokeWidth={1.5}
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            role="img"
                                            aria-label="Verified coach"
                                        >
                                            <circle cx="12" cy="12" r="9" />
                                            <path d="m8.5 12 2.5 2.5 5-5" />
                                        </svg>
                                    </span>
                                )}
                                {coach?.instagram_handle && (
                                    <a
                                        href={`https://instagram.com/${coach.instagram_handle}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={(e) => e.stopPropagation()}
                                        className="inline-flex flex-none items-center justify-center rounded-[4px] text-[#767980] transition-colors hover:text-[#1A202C] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0054B4]/40"
                                        aria-label={`View ${coach.name}'s Instagram profile`}
                                    >
                                        <Instagram className="size-4" strokeWidth={1.5} />
                                    </a>
                                )}
                            </div>
                            <div className="flex min-w-0 flex-wrap items-center gap-[6px]">
                                <p className="text-[14px] leading-[18px] tracking-[-0.03em] text-[#767980]">
                                    {primarySpecialty}
                                </p>
                                {academy && (
                                    <Link
                                        to={organizationPath(academy)}
                                        onClick={(e) => e.stopPropagation()}
                                        className="min-w-0 max-w-full rounded-[4px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6698D2]"
                                    >
                                        <BrandPill tone="muted" className="min-w-0 max-w-full hover:text-[#0054B4]">
                                            <span className="truncate">{academy}</span>
                                        </BrandPill>
                                    </Link>
                                )}
                            </div>
                            <p className="flex items-center gap-1 text-[12px] leading-[14px] tracking-[-0.03em] text-[#767980]">
                                <MapPin className="size-3 flex-none" strokeWidth={2} aria-hidden="true" />
                                <span className="truncate">{primaryLocation}</span>
                            </p>
                        </div>

                        <div className="flex flex-none items-center gap-1 text-[14px] font-medium leading-[18px] tracking-[-0.03em] text-[#1A202C]">
                            <BrandStar filled={ratingVisible} size={16} />
                            <span>{publicCoachRatingLabel(coach?.rating, coach?.total_reviews)}</span>
                            {ratingVisible ? (
                                <span className="text-[12px] font-normal leading-[14px] text-[#767980]">
                                    {coach?.total_reviews || 0} reviews
                                </span>
                            ) : null}
                        </div>
                    </div>

                    {/* Specialty + position pills */}
                    {(specialtyList.length > 0 || favoritePositions.length > 0) && (
                        <div className="flex flex-wrap gap-1.5">
                            {visibleBadges.map((specialty, index) => (
                                <BrandPill key={`${specialty}-${index}`} tone="neutral">
                                    {toSentenceCase(specialty)}
                                </BrandPill>
                            ))}
                            {extraBadgeCount > 0 && (
                                <button
                                    type="button"
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        setShowAllSpecialties((prev) => !prev);
                                    }}
                                    className={`${pillToggleClass} bg-[#F1F1E6] text-[#484D56] hover:bg-[#EAEADF]`}
                                    aria-expanded={showAllSpecialties}
                                    aria-label={
                                        showAllSpecialties
                                            ? 'Show fewer specialties'
                                            : `Show all ${specialtyList.length} specialties`
                                    }
                                >
                                    {showAllSpecialties ? 'Less' : `+${extraBadgeCount}`}
                                </button>
                            )}
                            {visibleFavoritePositions.map((position, index) => (
                                <BrandPill key={`favorite-${position}-${index}`} tone="teal">
                                    {getFavoritePositionLabel(position)}
                                </BrandPill>
                            ))}
                            {extraFavoritePositionCount > 0 && (
                                <button
                                    type="button"
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        setShowAllPositions((prev) => !prev);
                                    }}
                                    className={`${pillToggleClass} bg-[#E7F4F8] text-[#1599BC] hover:bg-[#D9EEF4]`}
                                    aria-expanded={showAllPositions}
                                    aria-label={
                                        showAllPositions
                                            ? 'Show fewer favourite positions'
                                            : `Show all ${favoritePositions.length} favourite positions`
                                    }
                                >
                                    {showAllPositions ? 'Less' : `+${extraFavoritePositionCount}`}
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2.5">
                    <div className="flex gap-2">
                        <Button
                            type="button"
                            className={`${actionButtonBase} flex-1 border-[#6698D2] bg-[#0054B4] px-3 text-[#F1F1E6] hover:bg-[#004390]`}
                            onClick={(event) => {
                                event.stopPropagation();
                                if (onSession) {
                                    onSession(coach.id!);
                                    return;
                                }
                                onViewProfile(coach.id!);
                            }}
                        >
                            Book a session
                        </Button>
                        <Button
                            type="button"
                            className={`${actionButtonBase} flex-1 border-[#EAEADF] bg-[#F4F4EB] px-3 text-[#1A202C] hover:bg-[#EAEADF]`}
                            onClick={(event) => {
                                event.stopPropagation();
                                if (onViewPackages) {
                                    onViewPackages();
                                    return;
                                }
                                onViewProfile(coach.id!);
                            }}
                        >
                            View packages
                        </Button>
                        <Button
                            type="button"
                            className={`${actionButtonBase} w-[34px] flex-none border-[#EAEADF] bg-[#F4F4EB] p-0 text-[#1A202C] hover:bg-[#EAEADF] disabled:opacity-60`}
                            disabled={messageDisabled}
                            aria-label={isSendingMessage ? 'Starting a conversation' : `Send ${coach?.name || 'this coach'} a message`}
                            aria-busy={isSendingMessage || undefined}
                            title={isSendingMessage ? 'Starting...' : 'Send a message'}
                            onClick={(event) => {
                                event.stopPropagation();
                                if (onSendMessage) {
                                    onSendMessage(coach);
                                }
                            }}
                        >
                            {isSendingMessage ? (
                                <Loader2 className="size-4 animate-spin" strokeWidth={1.5} aria-hidden="true" />
                            ) : (
                                <MessageCircle className="size-4" strokeWidth={1.5} aria-hidden="true" />
                            )}
                        </Button>
                    </div>
                    <button
                        type="button"
                        className="self-center rounded-[4px] text-[14px] font-medium leading-[18px] tracking-[-0.03em] text-[#0054B4] transition-colors hover:text-[#004390] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0054B4]/40"
                        onClick={(event) => {
                            event.stopPropagation();
                            openProfile();
                        }}
                    >
                        View full profile
                    </button>
                </div>
            </CardContent>
        </Card>
    );
}

export default CoachCard
