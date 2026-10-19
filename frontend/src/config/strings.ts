/**
 * Centralized String Configuration
 * 
 * All hardcoded strings in the application are defined here.
 * This makes it easy to:
 * - Change text globally
 * - Add translations/i18n later
 * - Maintain consistency across the app
 * - Avoid typos and duplication
 * 
 * Usage:
 * import { strings } from '@/config/strings';
 * 
 * <button>{strings.buttons.save}</button>
 * <p>{strings.errors.unauthorized}</p>
 */

/**
 * Brand
 */
export const BRAND = {
  name: 'AthaNext',
  poweredBy: 'Powered by HazenTech',
} as const;

/**
 * Navigation Strings
 */
export const NAVIGATION = {
  home: 'Home',
  coaches: 'Coaches',
  allCoaches: 'All coaches',
  coachProfile: 'Coach profile',
  becomeCoach: 'Become a coach',
  partnerships: 'Partnerships',
  bookingSuccess: 'Booking success',
  partnershipSuccess: 'Partnership success',
  myAccount: 'My account',
  logout: 'Logout',
  whyMyKonnect: 'Why AthaNext',
  rowingPillars: 'Rowing pillars',
  soccerPillars: 'Soccer pillars',
} as const;

/**
 * Button Labels
 */
export const BUTTONS = {
  save: 'Save',
  cancel: 'Cancel',
  submit: 'Submit',
  delete: 'Delete',
  edit: 'Edit',
  update: 'Update',
  close: 'Close',
  next: 'Next',
  previous: 'Previous',
  apply: 'Apply',
  confirm: 'Confirm',
  reject: 'Reject',
  approve: 'Approve',
  download: 'Download',
  upload: 'Upload',
  search: 'Search',
  filter: 'Filter',
  reset: 'Reset',
  viewMore: 'View more',
  viewLess: 'View less',
  learnMore: 'Learn more',
  bookConsultation: 'Book consultation',
  bookNow: 'Book now',
  viewProfile: 'View profile',
  viewDetails: 'View details',
  getStarted: 'Get started',
  signUp: 'Sign up',
  signIn: 'Sign in',
  signOut: 'Sign out',
  forgotPassword: 'Forgot password?',
  resetPassword: 'Reset password',
  rememberMe: 'Remember me',
  dontHaveAccount: "Don't have an account?",
  haveAccount: 'Already have an account?',
  continueWith: 'Continue with',
  purchase: 'Purchase',
  checkout: 'Checkout',
  addToCart: 'Add to cart',
  removeFromCart: 'Remove from cart',
  applyCoupon: 'Apply coupon',
  reviewNow: 'Review now',
  submitReview: 'Submit review',
  leaveReview: 'Leave a review',
  cancelAppointment: 'Cancel appointment',
  rescheduleAppointment: 'Reschedule appointment',
  back: 'Back',
  createAccount: 'Create account',
} as const;

/**
 * Form Labels & Placeholders
 */
export const FORM = {
  labels: {
    iAm: 'I am a…',
    email: 'Email',
    password: 'Password',
    confirmPassword: 'Confirm password',
    name: 'Name',
    fullName: 'Full name',
    phone: 'Phone number',
    sport: 'Sport',
    gender: 'Gender',
    yearsExperience: 'Years of experience',
    certifications: 'Certifications',
    currentRole: 'Current coaching role',
    whyJoin: 'Why do you want to join?',
    website: 'Website',
    instagram: 'Instagram handle',
    linkedin: 'LinkedIn profile',
    message: 'Message',
    subject: 'Subject',
    description: 'Description',
    date: 'Date',
    time: 'Time',
    duration: 'Duration',
    rating: 'Rating',
    review: 'Review',
    organization: 'Organization',
    backgroundCheck: 'Background check consent',
    insurance: 'Insurance confirmation',
    termsAccepted: 'I agree to the terms and conditions',
    privacyAccepted: 'I agree to the privacy policy',
  },
  placeholders: {
    email: 'Enter your email',
    password: 'Enter your password',
    name: 'Enter your name',
    phone: 'Enter your phone number',
    message: 'Type your message here…',
    search: 'Search…',
    filter: 'Filter results…',
  },
  validation: {
    emailRequired: 'Email is required',
    emailInvalid: 'Please enter a valid email',
    passwordRequired: 'Password is required',
    passwordTooShort: 'Password must be at least 8 characters',
    passwordMismatch: 'Passwords do not match',
    nameRequired: 'Name is required',
    phoneRequired: 'Phone number is required',
    fieldRequired: 'This field is required',
    invalidInput: 'Invalid input',
    minLength: (length: number) => `Minimum ${length} characters required`,
    maxLength: (length: number) => `Maximum ${length} characters allowed`,
  },
} as const;

/**
 * Success Messages
 */
export const SUCCESS = {
  saved: 'Saved successfully',
  updated: 'Updated successfully',
  deleted: 'Deleted successfully',
  created: 'Created successfully',
  submitted: 'Submitted successfully',
  uploaded: 'Uploaded successfully',
  signedUp: 'Account created successfully',
  signedIn: 'Signed in successfully',
  signedOut: 'Signed out successfully',
  reviewSubmitted: 'Your review has been submitted',
  appointmentBooked: 'Appointment booked successfully',
  appointmentCancelled: 'Appointment cancelled successfully',
  appointmentRescheduled: 'Appointment rescheduled successfully',
  paymentProcessed: 'Payment processed successfully',
  applicationSubmitted: 'Application submitted successfully',
  emailSent: 'Email sent successfully',
  passwordReset: 'Password reset successfully',
  profileUpdated: 'Profile updated successfully',
  settingsSaved: 'Settings saved successfully',
  checkEmail: 'If your account exists, we have sent a reset link to that email.',
  verifyEmail: 'Please verify your email',
  welcomeBack: "Welcome back",
  thankYou: 'Thank you',
} as const;

/**
 * Error Messages
 */
export const ERRORS = {
  // Authentication
  unauthorized: 'You must be logged in',
  forbidden: 'You do not have permission',
  sessionExpired: 'Your session has expired',
  loginFailed: 'Login failed',
  signUpFailed: 'Sign up failed',
  logoutFailed: 'Logout failed',
  
  // Validation
  formInvalid: 'Please fix the errors in the form',
  requiredField: 'This field is required',
  invalidEmail: 'Invalid email address',
  invalidPassword: 'Invalid password',
  
  // User Actions
  alreadyReviewed: "You've already reviewed this coach. Each user can only submit one review per coach.",
  userNotFound: 'User not found',
  coachNotFound: 'Coach not found',
  reviewNotFound: 'Review not found',
  appointmentNotFound: 'Appointment not found',
  
  // Network/Server
  networkError: 'Network error. Please try again.',
  serverError: 'Server error. Please try again later.',
  timeout: 'Request timeout. Please try again.',
  connectionFailed: 'Connection failed',
  
  // General
  somethingWentWrong: 'Something went wrong',
  tryAgain: 'Please try again',
  unexpectedError: 'An unexpected error occurred',
  notAvailable: 'Not available',
  couldNotLoad: 'Could not load content',
  
  // Specific Operations
  failedToFetchCoaches: 'Failed to fetch coaches',
  failedToFetchReviews: 'Failed to fetch reviews',
  failedToSubmitReview: 'Failed to submit review',
  failedToBookAppointment: 'Failed to book appointment',
  failedToCancelAppointment: 'Failed to cancel appointment',
  failedToProcessPayment: 'Failed to process payment',
  failedToSubmitApplication: 'Failed to submit application',
  failedToLoadPartnerships: 'Failed to load partnerships',
} as const;

/**
 * Warning Messages
 */
export const WARNINGS = {
  unsavedChanges: 'You have unsaved changes',
  confirmDelete: 'Are you sure you want to delete?',
  confirmLogout: 'Are you sure you want to logout?',
  confirmCancel: 'Are you sure? This action cannot be undone.',
  sessionEnding: 'Your session is about to expire',
  offlineMode: 'You are currently offline',
  loadingFailed: 'Failed to load content',
} as const;

/**
 * Info Messages
 */
export const INFO = {
  loading: 'Loading…',
  noResults: 'No results found',
  noData: 'No data available',
  empty: 'Empty',
  pending: 'Pending',
  inProgress: 'In progress',
  completed: 'Completed',
  processing: 'Processing…',
  pleaseWait: 'Please wait…',
  optional: 'Optional',
  required: 'Required',
} as const;

/**
 * Page Titles & Headings
 */
export const TITLES = {
  home: 'Welcome to AthaNext',
  allCoaches: 'All coaches',
  coachProfile: 'Coach profile',
  becomeCoach: 'Become a coach',
  partnerships: 'Our partnerships',
  bookingSuccess: 'Booking confirmed',
  partnershipSuccess: 'Partnership application submitted',
  whyMyKonnect: 'Why choose AthaNext',
  rowingPillars: 'Rowing pillars',
  soccerPillars: 'Soccer pillars',
  reviews: 'Reviews',
  myAppointments: 'My appointments',
  myPackages: 'My packages',
  myProfile: 'My profile',
  settings: 'Settings',
  faqs: 'Frequently asked questions',
  contactUs: 'Contact us',
  aboutUs: 'About us',
  privacyPolicy: 'Privacy policy',
  termsOfService: 'Terms of service',
  becomeCoachHero: 'Become an AthaNext coach',
  coachRequirements: 'Coach requirements',
  howItWorks: 'How it works',
  readyToJoinNetwork: 'Ready to join our coaching network?',
} as const;

/**
 * Coach-Related Strings
 */
export const COACH = {
  coachProfile: 'Coach profile',
  coaching: 'Coaching',
  experience: 'Experience',
  specializations: 'Specializations',
  certifications: 'Certifications',
  hourlyRate: 'Hourly rate',
  rating: 'Rating',
  reviews: 'Reviews',
  availability: 'Availability',
  consultationFee: 'Consultation fee',
  freeConsultation: 'Free consultation',
  bookConsultation: 'Book a consultation',
  contactCoach: 'Contact coach',
  aboutCoach: 'About',
  yearsCoaching: 'Years of coaching',
  clients: 'Clients',
  achievements: 'Achievements',
  packages: 'Packages',
  selectPackage: 'Select a package',
  applyToBecomeCoach: 'Apply to become a coach',
  applicationDescription: "Fill out the application form below. We'll review your submission and contact you within 3-5 business days.",
  personalInformation: 'Personal information',
  professionalBackground: 'Professional background',
  onlinePresence: 'Online presence (optional)',
  applicationStatement: 'Application statement',
  requiredConfirmations: 'Required confirmations',
  sportsYouCoach: 'Sport(s) you coach',
  yearsOfCoachingExperience: 'Years of coaching experience',
  currentCoachingRole: 'Current coaching role (optional)',
  coachingCertifications: 'Coaching Certifications/Credentials',
  whyJoinMyKonnect: 'Why do you want to join ATHANEXT? * (50-500 characters)',
  websiteUrl: 'Website',
  instagramHandle: 'Instagram handle',
  linkedinProfile: 'LinkedIn profile',
  consentToBackgroundCheck: 'I consent to a background check',
  confirmProfessionalInsurance: 'I confirm I have or will obtain professional liability insurance',
  submitApplication: 'Submit application',
  submittingApplication: 'Submitting…',
  becomeCoachHeroSubtitle: 'Share your expertise. Impact athletes. Grow your coaching business.',
  becomeCoachHeroDescription: 'Join our verified network of elite coaches and connect with dedicated athletes ready to invest in their development.',
  coachRequirementsDescription: 'We maintain high standards to ensure quality for our athletes',
  requirement1: 'Proven coaching experience in your sport',
  requirement2: 'Valid coaching certifications or credentials',
  requirement3: 'Professional liability insurance',
  requirement4: 'Commitment to athlete development',
  requirement5: 'Clear communication with families',
  howItWorksDescription: 'Simple steps to start coaching on AthaNext',
  howItWorksStep1Title: 'Apply',
  howItWorksStep1Desc: 'Submit your coaching credentials and experience for review',
  howItWorksStep2Title: 'Verification',
  howItWorksStep2Desc: 'We verify your credentials',
  howItWorksStep3Title: 'Profile setup',
  howItWorksStep3Desc: 'Create your coach profile, set your rates, and availability',
  howItWorksStep4Title: 'Start coaching',
  howItWorksStep4Desc: 'Athletes can discover and book sessions with you immediately',
  readyToJoinNetworkSubtitle: 'Start making an impact on the next generation of athletes',
  applyToBecomeCoachButton: 'Apply to become a coach',
  allSportCoaches: 'All sport coaches',
  findYourPerfectMatch: 'Find your perfect coaching match',
  searchPlaceholder: 'Search coaches, specialties, locations…',
  sport: 'Sport',
  position: 'Position',
  filter: 'Filter',
  sortBy: 'Sort by',
  highestRated: 'Highest rated',
  lowestPrice: 'Lowest price',
  showLess: 'Show less',
  more: 'more',
  newCoach: 'New coach',
  yearsExp: 'years exp',
  freeConsultButton: 'Free consult',
  sessionButton: 'Session - $',
  packagesButton: 'Packages',
  viewFullProfile: 'View full profile',
} as const;

/**
 * Availability-Related Strings
 */
export const AVAILABILITY = {
  availability: 'Availability',
  addAvailability: '+ Add availability',
  viewAvailability: 'View availability',
  availabilityPeriod: 'Availability period:',
  weeklyTimeSlots: 'Weekly time slots',
  noAvailabilitySet: 'No availability set yet',
  noTimeSlotsAvailable: 'No time slots available for this period',
  edit: 'Edit',
  delete: 'Delete',
  previousWeek: 'Previous week',
  nextWeek: 'Next week',
  weekOf: 'Week',
  deleteDialog: {
    periodTitle: 'Delete availability period',
    periodDescription: 'Are you sure you want to delete this availability period? The selected period will be deleted permanently, and all associated sessions will be removed. This action cannot be undone.',
    slotTitle: 'Delete time slot',
    slotDescription: 'Are you sure you want to delete this time slot? This action cannot be undone.',
  },
  table: {
    day: 'Day',
    sessionName: 'Session name',
    price: 'Price',
    sessionPrice: 'Session price',
    duration: 'Duration',
    startTime: 'Start time',
    endTime: 'End time',
    type: 'Type',
    pillar: 'Pillar',
    location: 'Location',
    actions: 'Actions',
  },
  toasts: {
    deleted: 'Availability deleted',
    deletedDescription: 'The availability period has been successfully removed.',
    deleteFailed: 'Error',
    deleteFailedDescription: 'Failed to delete availability. Please try again.',
    comingSoon: 'Coming soon',
    slotDeletionComingSoon: 'Individual slot deletion.',
  },
} as const;

/**
 * Review-Related Strings
 */
export const REVIEWS = {
  reviews: 'Reviews',
  rating: 'Rating',
  leaveReview: 'Leave a review',
  submitReview: 'Submit review',
  yourReview: 'Your review',
  reviewText: 'Review',
  rateCoach: 'Rate this coach',
  helpful: 'Helpful',
  notHelpful: 'Not helpful',
  noReviews: 'No reviews yet',
  average: 'Average rating',
  outOf5: 'out of 5',
  stars: 'Stars',
} as const;

/**
 * Appointment-Related Strings
 */
export const APPOINTMENTS = {
  appointments: 'Appointments',
  myAppointments: 'My appointments',
  upcomingAppointments: 'Upcoming appointments',
  pastAppointments: 'Past appointments',
  bookAppointment: 'Book appointment',
  rescheduleAppointment: 'Reschedule appointment',
  cancelAppointment: 'Cancel appointment',
  appointment: 'Appointment',
  date: 'Date',
  time: 'Time',
  duration: 'Duration',
  coach: 'Coach',
  status: 'Status',
  confirmed: 'Confirmed',
  pending: 'Pending',
  completed: 'Completed',
  cancelled: 'Cancelled',
  selectDate: 'Select date',
  selectTime: 'Select time',
  availableSlots: 'Available slots',
  noAvailableSlots: 'No available slots',
  confirmBooking: 'Confirm booking',
  bookFreeConsultation: 'Book 15 minute free consultation',
  bookSession: 'Book session',
  complimentaryConsultation: 'Complimentary 15-minute consultation',
  chooseTimeSlot: 'Choose a time slot',
  chooseLocation: 'Choose a location',
  sessionDuration: 'Session duration',
  additionalNotes: 'Additional notes (optional)',
  anySpecificGoals: 'Any specific goals or requirements for this session…',
  sessionTotal: 'Session total',
  minutesAtHourlyRate: 'minutes at $',
  perHour: '/hour',
  bookFreeConsultationButton: 'Book free consultation',
  bookSessionButton: 'Book session',
  signInToBook: 'Sign in to book',
  processing: 'Processing…',
  tooManyBookingAttempts: 'Too many booking attempts',
  waitBeforeTryingAgain: 'Please wait before trying to book again.',
  bookingFailed: 'Booking failed',
  errorCreatingBooking: 'There was an error creating your booking. Please try again.',
  authenticationRequired: 'Authentication required',
  pleaseSignInToBook: 'Please sign in to book a session.',
  freeConsultationLimitReached: 'Free consultation limit reached',
  perCoachLimitReached: 'Per-Coach consultation limit reached',
  tooManyConsultationsMessage: (coachName: string, maxConsultations: number) => 
    `You've already booked ${maxConsultations} free consultation${maxConsultations !== 1 ? 's' : ''} with ${coachName}. Ready to upgrade to a paid session?`,
  freeConsultationRules: 'Free consultation rules:',
  youAreEligible: "You're eligible",
  limitReached: 'Limit reached',
  youveAlreadyUsedWithCoach: (coachName: string) => `You've already used your free consultation with ${coachName}.`,
  youHaveRemaining: (remaining: number) => `You have ${remaining} free consultation${remaining !== 1 ? 's' : ''} remaining.`,
  youveUsedBoth: "You've used both of your free consultations.",
  whatNext: "What's next?",
  afterConsultations: (coachName: string, rate: number) => `After your free consultations, paid sessions with ${coachName} start at $${rate}/hour.`,
  continueToBook: 'Continue to book',
  viewPaidOptions: 'View paid options',
} as const;

/**
 * Package-Related Strings
 */
export const PACKAGES = {
  packages: 'Packages',
  package: 'Package',
  myPackages: 'My packages',
  selectPackage: 'Select a package',
  buyPackage: 'Buy package',
  purchasePackage: 'Purchase package',
  packageDetails: 'Package details',
  sessions: 'Sessions',
  validity: 'Validity',
  price: 'Price',
  perSession: 'Per session',
  remainingSessions: 'Remaining sessions',
  sessionUsed: 'Session used',
  packageExpired: 'Package expired',
  renewPackage: 'Renew package',
  packageOptionsWith: 'Package options with',
  noPackagesAvailable: 'No packages available at this time.',
  processing: 'Processing…',
  sessionCount: 'Sessions',
  validFor: 'Valid for',
  days: 'days',
  purchaseFailed: 'Purchase failed',
  purchasePackageButton: 'Purchase package',
} as const;

/**
 * Partnership-Related Strings
 */
export const PARTNERSHIPS = {
  partnerships: 'Partnerships',
  partner: 'Partner',
  ourPartners: 'Our partners',
  partnership: 'Partnership',
  partnershipOpportunity: 'Partnership opportunity',
  submitInquiry: 'Submit inquiry',
  inquiryStatus: 'Inquiry status',
  inquirySubmitted: 'Inquiry submitted',
  availableNow: 'Available now',
  comingSoon: 'Coming soon',
  learnMoreAbout: 'Learn more about',
  explorePartnership: 'Explore this partnership',
} as const;

/**
 * Authentication Strings
 */
export const AUTH = {
  login: 'Login',
  signup: 'Sign up',
  logout: 'Logout',
  email: 'Email',
  password: 'Password',
  confirmPassword: 'Confirm password',
  forgotPassword: 'Forgot password?',
  resetPassword: 'Reset password',
  rememberMe: 'Remember me',
  dontHaveAccount: "Don't have an account? Sign up",
  alreadyHaveAccount: 'Already have an account? Login',
  enterEmail: 'Enter your email',
  enterPassword: 'Enter your password',
  checkEmail: 'Check your email',
  confirmationEmailSent: 'Confirmation email sent',
  createNewPassword: 'Create a new password',
  passwordResetSent: 'Password reset email sent',
} as const;

/**
 * Profile Strings
 */
export const PROFILE = {
  myProfile: 'My profile',
  editProfile: 'Edit profile',
  profile: 'Profile',
  personalInfo: 'Personal information',
  accountSettings: 'Account settings',
  preferences: 'Preferences',
  privacy: 'Privacy',
  notifications: 'Notifications',
  changePassword: 'Reset password',
  deleteAccount: 'Delete account',
  uploadPhoto: 'Upload photo',
  bio: 'Bio',
  location: 'Location',
  joinDate: 'Join date',
  member: 'Member',
} as const;

/**
 * Landing Page Strings
 */
export const LANDING = {
  hero: {
    headline: 'Find your perfect coach',
    subheadline: 'Connect with expert coaches in your sport',
    cta: 'Get started',
  },
  benefits: {
    title: 'Why choose AthaNext',
    expert: 'Expert coaches',
    flexible: 'Flexible scheduling',
    affordable: 'Affordable packages',
    verified: 'Verified professionals',
  },
  testimonials: {
    title: 'What our users say',
    greatService: 'Amazing coaching experience',
    recommended: 'I would highly recommend AthaNext',
  },
  cta: {
    primary: 'Get started today',
    secondary: 'Learn more',
  },
} as const;

/**
 * Footer Strings
 */
export const FOOTER = {
  company: 'Company',
  about: 'About us',
  careers: 'Careers',
  blog: 'Blog',
  contact: 'Contact',
  legal: 'Legal',
  privacy: 'Privacy policy',
  terms: 'Terms of service',
  cookies: 'Cookie policy',
  social: 'Follow us',
  rights: '© 2026 AthaNext. All rights reserved.',
  newsletter: 'Subscribe to our newsletter',
} as const;

/**
 * Email Strings
 */
export const EMAIL = {
  welcome: 'Welcome to AthaNext',
  confirmEmail: 'Confirm your email',
  resetPassword: 'Reset your password',
  appointmentConfirmed: 'Your appointment has been confirmed',
  appointmentReminder: 'Appointment reminder',
  reviewRequest: 'Please leave a review',
  newMessage: 'You have a new message',
  newsletter: 'AthaNext newsletter',
} as const;

/**
 * Status Labels
 */
export const STATUS = {
  active: 'Active',
  inactive: 'Inactive',
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  completed: 'Completed',
  cancelled: 'Cancelled',
  expired: 'Expired',
  draft: 'Draft',
  published: 'Published',
  archived: 'Archived',
} as const;

/**
 * Time-Related Strings
 */
export const TIME = {
  today: 'Today',
  tomorrow: 'Tomorrow',
  thisWeek: 'This week',
  thisMonth: 'This month',
  lastMonth: 'Last month',
  lastWeek: 'Last week',
  ago: 'ago',
  in: 'in',
  minutes: 'minutes',
  hours: 'hours',
  days: 'days',
  weeks: 'weeks',
  months: 'months',
  years: 'years',
  justNow: 'Just now',
} as const;

/**
 * About Us Page Strings
 */
export const ABOUT = {
  hero: {
    mainTitle: 'Connecting greatness, producing results',
    subtitle:
      "We're on a mission to revolutionize athletic training by connecting passionate athletes with world-class coaches from around the globe.",
    ctaButton: 'Explore our story',
  },
  missionVision: {
    missionTitle: 'Our mission',
    visionTitle: 'Our vision',
  },
  coreValues: {
    title: 'Our core values',
    subtitle: 'The principles that guide everything we do at AthaNext',
  },
  leadership: {
    title: 'Meet our leadership team',
    subtitle: 'Visionary leaders dedicated to transforming athletic training',
  },
  navigation: {
    aboutUs: 'About',
  },
} as const;

/**
 * Complete Strings Palette
 */
export const strings = {
  brand: BRAND,
  navigation: NAVIGATION,
  buttons: BUTTONS,
  form: FORM,
  success: SUCCESS,
  errors: ERRORS,
  warnings: WARNINGS,
  info: INFO,
  titles: TITLES,
  coach: COACH,
  availability: AVAILABILITY,
  reviews: REVIEWS,
  appointments: APPOINTMENTS,
  packages: PACKAGES,
  partnerships: PARTNERSHIPS,
  auth: AUTH,
  profile: PROFILE,
  landing: LANDING,
  footer: FOOTER,
  email: EMAIL,
  status: STATUS,
  time: TIME,
  about: ABOUT,
} as const;

export default strings;
