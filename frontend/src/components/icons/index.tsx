// AthaNext icons: Hugeicons stroke set (@hugeicons/core-free-icons 4.3.5, MIT), per the design system.
// Exported under the names the app used with Lucide, so call sites only change their import path.
// The full name mapping is the design system's Icon mapping section. Defaults: stroke 1.5, currentColor.
import { forwardRef } from "react";
import { HugeiconsIcon, type HugeiconsProps, type IconSvgElement } from "@hugeicons/react";
import {
  Activity01Icon,
  Add01Icon,
  Agreement01Icon,
  Alert02Icon,
  AlertCircleIcon,
  ArrowDown01Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  ArrowUp01Icon,
  ArrowUpDownIcon,
  Award01Icon,
  Award05Icon,
  BankIcon,
  BoatIcon,
  BookOpen01Icon,
  Brain02Icon,
  Briefcase01Icon,
  Building03Icon,
  Calendar01Icon,
  Calendar03Icon,
  CalendarAdd01Icon,
  CalendarBlockIcon,
  CalendarCheckIn01Icon,
  CalendarRemove01Icon,
  CalendarSyncIcon,
  Call02Icon,
  Camera01Icon,
  Cancel01Icon,
  ChartColumnIcon,
  ChartDecreaseIcon,
  ChartIncreaseIcon,
  ChartLineData01Icon,
  CheckmarkBadge01Icon,
  CheckmarkCircle02Icon,
  CheckmarkSquare02Icon,
  CircleIcon,
  Clock01Icon,
  Clock04Icon,
  Comment01Icon,
  CommentBlock01Icon,
  Compass01Icon,
  Copy01Icon,
  CreditCardIcon,
  DashboardSquare01Icon,
  Database01Icon,
  Delete02Icon,
  Dollar01Icon,
  DollarCircleIcon,
  Download01Icon,
  DragDropVerticalIcon,
  Dumbbell01Icon,
  FavouriteIcon,
  File01Icon,
  FileUploadIcon,
  FilterIcon,
  Flag01Icon,
  FlashIcon,
  Globe02Icon,
  GridIcon,
  HelpCircleIcon,
  Home01Icon,
  Image01Icon,
  InboxIcon,
  InformationCircleIcon,
  InstagramIcon,
  JusticeScale01Icon,
  Key01Icon,
  Layers01Icon,
  Link01Icon,
  Link02Icon,
  LinkSquare02Icon,
  Loading03Icon,
  Location01Icon,
  Logout01Icon,
  Mail01Icon,
  Medal01Icon,
  Menu01Icon,
  Message01Icon,
  Message02Icon,
  MinusSignIcon,
  Money01Icon,
  MoreHorizontalIcon,
  Mortarboard01Icon,
  Notification03Icon,
  PackageIcon,
  PencilEdit02Icon,
  PiggyBankIcon,
  PlantIcon,
  PlayCircleIcon,
  RefreshIcon,
  RepeatIcon,
  Rocket01Icon,
  Search01Icon,
  SecurityCheckIcon,
  SentIcon,
  Settings02Icon,
  Share08Icon,
  Shield01Icon,
  ShoppingBag02Icon,
  ShoppingCart01Icon,
  SidebarLeftIcon,
  SparklesIcon,
  SquareLock02Icon,
  StarIcon,
  Store01Icon,
  Tag01Icon,
  Target02Icon,
  TaskDaily01Icon,
  Tick02Icon,
  TickDouble02Icon,
  Ticket01Icon,
  Upload01Icon,
  UserAdd01Icon,
  UserCheck01Icon,
  UserGroupIcon,
  UserIcon,
  UserRemove01Icon,
  Video01Icon,
  ViewIcon,
  ViewOffSlashIcon,
  Wallet01Icon,
  Wifi01Icon,
  WifiDisconnected01Icon,
} from "@hugeicons/core-free-icons";

export type IconProps = Omit<HugeiconsProps, "icon" | "altIcon" | "showAlt">;
export type AppIcon = ReturnType<typeof makeIcon>;
/** Kept for call sites typed against Lucide. */
export type LucideIcon = AppIcon;
export type LucideProps = IconProps;

function makeIcon(icon: IconSvgElement, name: string) {
  const Icon = forwardRef<SVGSVGElement, IconProps>(({ size = 24, strokeWidth = 1.5, ...props }, ref) => (
    <HugeiconsIcon ref={ref} icon={icon} size={size} strokeWidth={strokeWidth} color="currentColor" {...props} />
  ));
  Icon.displayName = name;
  return Icon;
}

export const Activity = makeIcon(Activity01Icon, "Activity");
export const AlertCircle = makeIcon(AlertCircleIcon, "AlertCircle");
export const AlertTriangle = makeIcon(Alert02Icon, "AlertTriangle");
export const ArrowDown = makeIcon(ArrowDown01Icon, "ArrowDown");
export const ArrowLeft = makeIcon(ArrowLeft01Icon, "ArrowLeft");
export const ArrowRight = makeIcon(ArrowRight01Icon, "ArrowRight");
export const ArrowUp = makeIcon(ArrowUp01Icon, "ArrowUp");
export const ArrowUpDown = makeIcon(ArrowUpDownIcon, "ArrowUpDown");
export const Award = makeIcon(Award01Icon, "Award");
export const BadgeCheck = makeIcon(CheckmarkBadge01Icon, "BadgeCheck");
export const Banknote = makeIcon(Money01Icon, "Banknote");
export const Bell = makeIcon(Notification03Icon, "Bell");
export const BookOpen = makeIcon(BookOpen01Icon, "BookOpen");
export const Brain = makeIcon(Brain02Icon, "Brain");
export const Briefcase = makeIcon(Briefcase01Icon, "Briefcase");
export const Building2 = makeIcon(Building03Icon, "Building2");
export const Calendar = makeIcon(Calendar03Icon, "Calendar");
export const CalendarCheck = makeIcon(CalendarCheckIn01Icon, "CalendarCheck");
export const CalendarCheck2 = makeIcon(CalendarCheckIn01Icon, "CalendarCheck2");
export const CalendarDays = makeIcon(Calendar01Icon, "CalendarDays");
export const CalendarIcon = makeIcon(Calendar03Icon, "CalendarIcon");
export const CalendarOff = makeIcon(CalendarBlockIcon, "CalendarOff");
export const CalendarPlus = makeIcon(CalendarAdd01Icon, "CalendarPlus");
export const CalendarSync = makeIcon(CalendarSyncIcon, "CalendarSync");
export const CalendarX = makeIcon(CalendarRemove01Icon, "CalendarX");
export const Camera = makeIcon(Camera01Icon, "Camera");
export const ChartColumn = makeIcon(ChartColumnIcon, "ChartColumn");
export const ChartSpline = makeIcon(ChartLineData01Icon, "ChartSpline");
export const Check = makeIcon(Tick02Icon, "Check");
export const CheckCheck = makeIcon(TickDouble02Icon, "CheckCheck");
export const CheckCircle = makeIcon(CheckmarkCircle02Icon, "CheckCircle");
export const CheckCircle2 = makeIcon(CheckmarkCircle02Icon, "CheckCircle2");
export const ChevronDown = makeIcon(ArrowDown01Icon, "ChevronDown");
export const ChevronLeft = makeIcon(ArrowLeft01Icon, "ChevronLeft");
export const ChevronRight = makeIcon(ArrowRight01Icon, "ChevronRight");
export const ChevronUp = makeIcon(ArrowUp01Icon, "ChevronUp");
export const Circle = makeIcon(CircleIcon, "Circle");
export const CircleAlert = makeIcon(AlertCircleIcon, "CircleAlert");
export const CircleCheck = makeIcon(CheckmarkCircle02Icon, "CircleCheck");
export const CircleDollarSign = makeIcon(DollarCircleIcon, "CircleDollarSign");
export const CircleHelp = makeIcon(HelpCircleIcon, "CircleHelp");
export const ClipboardList = makeIcon(TaskDaily01Icon, "ClipboardList");
export const Clock = makeIcon(Clock01Icon, "Clock");
export const Clock3 = makeIcon(Clock01Icon, "Clock3");
export const Compass = makeIcon(Compass01Icon, "Compass");
export const Copy = makeIcon(Copy01Icon, "Copy");
export const CreditCard = makeIcon(CreditCardIcon, "CreditCard");
export const Database = makeIcon(Database01Icon, "Database");
export const DollarSign = makeIcon(Dollar01Icon, "DollarSign");
export const Dot = makeIcon(CircleIcon, "Dot");
export const Download = makeIcon(Download01Icon, "Download");
export const Dumbbell = makeIcon(Dumbbell01Icon, "Dumbbell");
export const ExternalLink = makeIcon(LinkSquare02Icon, "ExternalLink");
export const Eye = makeIcon(ViewIcon, "Eye");
export const EyeOff = makeIcon(ViewOffSlashIcon, "EyeOff");
export const FileText = makeIcon(File01Icon, "FileText");
export const FileUp = makeIcon(FileUploadIcon, "FileUp");
export const Filter = makeIcon(FilterIcon, "Filter");
export const Flag = makeIcon(Flag01Icon, "Flag");
export const Globe = makeIcon(Globe02Icon, "Globe");
export const GraduationCap = makeIcon(Mortarboard01Icon, "GraduationCap");
export const GripVertical = makeIcon(DragDropVerticalIcon, "GripVertical");
export const Handshake = makeIcon(Agreement01Icon, "Handshake");
export const Hash = makeIcon(GridIcon, "Hash");
export const Heart = makeIcon(FavouriteIcon, "Heart");
export const HelpCircle = makeIcon(HelpCircleIcon, "HelpCircle");
export const History = makeIcon(Clock04Icon, "History");
export const House = makeIcon(Home01Icon, "House");
export const Image = makeIcon(Image01Icon, "Image");
export const ImageIcon = makeIcon(Image01Icon, "ImageIcon");
export const Inbox = makeIcon(InboxIcon, "Inbox");
export const Info = makeIcon(InformationCircleIcon, "Info");
export const Instagram = makeIcon(InstagramIcon, "Instagram");
export const KeyRound = makeIcon(Key01Icon, "KeyRound");
export const Landmark = makeIcon(BankIcon, "Landmark");
export const Layers = makeIcon(Layers01Icon, "Layers");
export const LayoutGrid = makeIcon(DashboardSquare01Icon, "LayoutGrid");
export const Link = makeIcon(Link01Icon, "Link");
export const Link2 = makeIcon(Link02Icon, "Link2");
export const Loader2 = makeIcon(Loading03Icon, "Loader2");
export const Lock = makeIcon(SquareLock02Icon, "Lock");
export const LogOut = makeIcon(Logout01Icon, "LogOut");
export const Mail = makeIcon(Mail01Icon, "Mail");
export const MapPin = makeIcon(Location01Icon, "MapPin");
export const Medal = makeIcon(Medal01Icon, "Medal");
export const Menu = makeIcon(Menu01Icon, "Menu");
export const MessageCircle = makeIcon(Message01Icon, "MessageCircle");
export const MessageSquare = makeIcon(Comment01Icon, "MessageSquare");
export const MessageSquareOff = makeIcon(CommentBlock01Icon, "MessageSquareOff");
export const MessageSquareText = makeIcon(Message02Icon, "MessageSquareText");
export const Minus = makeIcon(MinusSignIcon, "Minus");
export const MoreHorizontal = makeIcon(MoreHorizontalIcon, "MoreHorizontal");
export const Package = makeIcon(PackageIcon, "Package");
export const PanelLeft = makeIcon(SidebarLeftIcon, "PanelLeft");
export const Pencil = makeIcon(PencilEdit02Icon, "Pencil");
export const Phone = makeIcon(Call02Icon, "Phone");
export const PiggyBank = makeIcon(PiggyBankIcon, "PiggyBank");
export const PlayCircle = makeIcon(PlayCircleIcon, "PlayCircle");
export const Plus = makeIcon(Add01Icon, "Plus");
export const RefreshCcw = makeIcon(RefreshIcon, "RefreshCcw");
export const RefreshCw = makeIcon(RefreshIcon, "RefreshCw");
export const Repeat = makeIcon(RepeatIcon, "Repeat");
export const Rocket = makeIcon(Rocket01Icon, "Rocket");
export const Scale = makeIcon(JusticeScale01Icon, "Scale");
export const Search = makeIcon(Search01Icon, "Search");
export const Send = makeIcon(SentIcon, "Send");
export const Settings = makeIcon(Settings02Icon, "Settings");
export const Share2 = makeIcon(Share08Icon, "Share2");
export const Shield = makeIcon(Shield01Icon, "Shield");
export const ShieldCheck = makeIcon(SecurityCheckIcon, "ShieldCheck");
export const Ship = makeIcon(BoatIcon, "Ship");
export const ShoppingBag = makeIcon(ShoppingBag02Icon, "ShoppingBag");
export const ShoppingCart = makeIcon(ShoppingCart01Icon, "ShoppingCart");
export const Sparkles = makeIcon(SparklesIcon, "Sparkles");
export const Sprout = makeIcon(PlantIcon, "Sprout");
export const SquareCheck = makeIcon(CheckmarkSquare02Icon, "SquareCheck");
export const Star = makeIcon(StarIcon, "Star");
export const Store = makeIcon(Store01Icon, "Store");
export const Tag = makeIcon(Tag01Icon, "Tag");
export const Target = makeIcon(Target02Icon, "Target");
export const Ticket = makeIcon(Ticket01Icon, "Ticket");
export const Trash2 = makeIcon(Delete02Icon, "Trash2");
export const TrendingDown = makeIcon(ChartDecreaseIcon, "TrendingDown");
export const TrendingUp = makeIcon(ChartIncreaseIcon, "TrendingUp");
export const TriangleAlert = makeIcon(Alert02Icon, "TriangleAlert");
export const Trophy = makeIcon(Award05Icon, "Trophy");
export const Upload = makeIcon(Upload01Icon, "Upload");
export const User = makeIcon(UserIcon, "User");
export const UserCheck = makeIcon(UserCheck01Icon, "UserCheck");
export const UserPlus = makeIcon(UserAdd01Icon, "UserPlus");
export const UserX = makeIcon(UserRemove01Icon, "UserX");
export const Users = makeIcon(UserGroupIcon, "Users");
export const Video = makeIcon(Video01Icon, "Video");
export const Wallet = makeIcon(Wallet01Icon, "Wallet");
export const Wifi = makeIcon(Wifi01Icon, "Wifi");
export const WifiOff = makeIcon(WifiDisconnected01Icon, "WifiOff");
export const X = makeIcon(Cancel01Icon, "X");
export const Zap = makeIcon(FlashIcon, "Zap");
