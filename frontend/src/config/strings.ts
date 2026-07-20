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
  allCoaches: 'All Coaches',
  coachProfile: 'Coach Profile',
  becomeCoach: 'Become a Coach',
  partnerships: 'Partnerships',
  bookingSuccess: 'Booking Success',
  partnershipSuccess: 'Partnership Success',
  myAccount: 'My Account',
  logout: 'Logout',
  whyMyKonnect: 'Why AthaNext',
  rowingPillars: 'Rowing Pillars',
  soccerPillars: 'Soccer Pillars',
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
  viewMore: 'View More',
  viewLess: 'View Less',
  learnMore: 'Learn More',
  bookConsultation: 'Book Consultation',
  bookNow: 'Book Now',
  viewProfile: 'View Profile',
  viewDetails: 'View Details',
  getStarted: 'Get Started',
  signUp: 'Sign Up',
  signIn: 'Sign In',
  signOut: 'Sign Out',
  forgotPassword: 'Forgot Password?',
  resetPassword: 'Reset Password',
  rememberMe: 'Remember Me',
  dontHaveAccount: "Don't have an account?",
  haveAccount: 'Already have an account?',
  continueWith: 'Continue with',
  purchase: 'Purchase',
  checkout: 'Checkout',
  addToCart: 'Add to Cart',
  removeFromCart: 'Remove from Cart',
  applyCoupon: 'Apply Coupon',
  reviewNow: 'Review Now',
  submitReview: 'Submit Review',
  leaveReview: 'Leave a Review',
  cancelAppointment: 'Cancel Appointment',
  rescheduleAppointment: 'Reschedule Appointment',
  back: 'Back',
  createAccount: 'Create Account',
} as const;

/**
 * Form Labels & Placeholders
 */
export const FORM = {
  labels: {
    iAm: 'I am a...',
    email: 'Email',
    password: 'Password',
    confirmPassword: 'Confirm Password',
    name: 'Name',
    fullName: 'Full Name',
    phone: 'Phone Number',
    sport: 'Sport',
    gender: 'Gender',
    yearsExperience: 'Years of Experience',
    certifications: 'Certifications',
    currentRole: 'Current Coaching Role',
    whyJoin: 'Why do you want to join?',
    website: 'Website',
    instagram: 'Instagram Handle',
    linkedin: 'LinkedIn Profile',
    message: 'Message',
    subject: 'Subject',
    description: 'Description',
    date: 'Date',
    time: 'Time',
    duration: 'Duration',
    rating: 'Rating',
    review: 'Review',
    organization: 'Organization',
    backgroundCheck: 'Background Check Consent',
    insurance: 'Insurance Confirmation',
    termsAccepted: 'I agree to the terms and conditions',
    privacyAccepted: 'I agree to the privacy policy',
  },
  placeholders: {
    email: 'Enter your email',
    password: 'Enter your password',
    name: 'Enter your name',
    phone: 'Enter your phone number',
    message: 'Type your message here...',
    search: 'Search...',
    filter: 'Filter results...',
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
  welcomeBack: "Welcome back!",
  thankYou: 'Thank you!',
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
  loading: 'Loading...',
  noResults: 'No results found',
  noData: 'No data available',
  empty: 'Empty',
  pending: 'Pending',
  inProgress: 'In progress',
  completed: 'Completed',
  processing: 'Processing...',
  pleaseWait: 'Please wait...',
  optional: 'Optional',
  required: 'Required',
} as const;

/**
 * Page Titles & Headings
 */
export const TITLES = {
  home: 'Welcome to AthaNext',
  allCoaches: 'All Coaches',
  coachProfile: 'Coach Profile',
  becomeCoach: 'Become a Coach',
  partnerships: 'Our Partnerships',
  bookingSuccess: 'Booking Confirmed',
  partnershipSuccess: 'Partnership Application Submitted',
  whyMyKonnect: 'Why Choose AthaNext',
  rowingPillars: 'Rowing Pillars',
  soccerPillars: 'Soccer Pillars',
  reviews: 'Reviews',
  myAppointments: 'My Appointments',
  myPackages: 'My Packages',
  myProfile: 'My Profile',
  settings: 'Settings',
  faqs: 'Frequently Asked Questions',
  contactUs: 'Contact Us',
  aboutUs: 'About Us',
  privacyPolicy: 'Privacy Policy',
  termsOfService: 'Terms of Service',
  becomeCoachHero: 'Become an AthaNext Coach',
  coachRequirements: 'Coach Requirements',
  howItWorks: 'How It Works',
  readyToJoinNetwork: 'Ready to Join Our Coaching Network?',
} as const;

/**
 * Coach-Related Strings
 */
export const COACH = {
  coachProfile: 'Coach Profile',
  coaching: 'Coaching',
  experience: 'Experience',
  specializations: 'Specializations',
  certifications: 'Certifications',
  hourlyRate: 'Hourly Rate',
  rating: 'Rating',
  reviews: 'Reviews',
  availability: 'Availability',
  consultationFee: 'Consultation Fee',
  freeConsultation: 'Free Consultation',
  bookConsultation: 'Book a Consultation',
  contactCoach: 'Contact Coach',
  aboutCoach: 'About',
  yearsCoaching: 'Years of Coaching',
  clients: 'Clients',
  achievements: 'Achievements',
  packages: 'Packages',
  selectPackage: 'Select a Package',
  applyToBecomeCoach: 'Apply to Become a Coach',
  applicationDescription: "Fill out the application form below. We'll review your submission and contact you within 3-5 business days.",
  personalInformation: 'Personal Information',
  professionalBackground: 'Professional Background',
  onlinePresence: 'Online Presence (Optional)',
  applicationStatement: 'Application Statement',
  requiredConfirmations: 'Required Confirmations',
  sportsYouCoach: 'Sport(s) You Coach',
  yearsOfCoachingExperience: 'Years of Coaching Experience',
  currentCoachingRole: 'Current Coaching Role (Optional)',
  coachingCertifications: 'Coaching Certifications/Credentials',
  whyJoinMyKonnect: 'Why do you want to join ATHANEXT? * (50-500 characters)',
  websiteUrl: 'Website',
  instagramHandle: 'Instagram Handle',
  linkedinProfile: 'LinkedIn Profile',
  consentToBackgroundCheck: 'I consent to a background check',
  confirmProfessionalInsurance: 'I confirm I have or will obtain professional liability insurance',
  submitApplication: 'Submit Application',
  submittingApplication: 'Submitting...',
  becomeCoachHeroSubtitle: 'Share your expertise. Impact athletes. Grow your coaching business.',
  becomeCoachHeroDescription: 'Join our verified network of elite coaches and connect with dedicated athletes ready to invest in their development.',
  coachRequirementsDescription: 'We maintain high standards to ensure quality for our athletes',
  requirement1: 'Proven coaching experience in your sport',
  requirement2: 'Valid coaching certifications or credentials',
  requirement3: 'Background check completion',
  requirement4: 'Professional liability insurance',
  requirement5: 'Commitment to athlete development',
  howItWorksDescription: 'Simple steps to start coaching on AthaNext',
  howItWorksStep1Title: 'Apply',
  howItWorksStep1Desc: 'Submit your coaching credentials and experience for review',
  howItWorksStep2Title: 'Verification',
  howItWorksStep2Desc: 'We verify your credentials',
  howItWorksStep3Title: 'Profile Setup',
  howItWorksStep3Desc: 'Create your coach profile, set your rates, and availability',
  howItWorksStep4Title: 'Start Coaching',
  howItWorksStep4Desc: 'Athletes can discover and book sessions with you immediately',
  readyToJoinNetworkSubtitle: 'Start making an impact on the next generation of athletes',
  applyToBecomeCoachButton: 'Apply to Become a Coach',
  allSportCoaches: 'All Sport Coaches',
  findYourPerfectMatch: 'Find your perfect coaching match',
  searchPlaceholder: 'Search coaches, specialties, locations...',
  sport: 'Sport',
  position: 'Position',
  filter: 'Filter',
  sortBy: 'Sort by',
  highestRated: 'Highest Rated',
  lowestPrice: 'Lowest Price',
  showLess: 'Show less',
  more: 'more',
  newCoach: 'New Coach',
  yearsExp: 'years exp',
  freeConsultButton: 'Free Consult',
  sessionButton: 'Session - $',
  packagesButton: 'Packages',
  viewFullProfile: 'View Full Profile',
} as const;

/**
 * Availability-Related Strings
 */
export const AVAILABILITY = {
  availability: 'Availability',
  addAvailability: '+ Add Availability',
  viewAvailability: 'View Availability',
  availabilityPeriod: 'Availability Period:',
  weeklyTimeSlots: 'Weekly Time Slots',
  noAvailabilitySet: 'No availability set yet',
  noTimeSlotsAvailable: 'No time slots available for this period',
  edit: 'Edit',
  delete: 'Delete',
  previousWeek: 'Previous Week',
  nextWeek: 'Next Week',
  weekOf: 'Week',
  deleteDialog: {
    periodTitle: 'Delete Availability Period',
    periodDescription: 'Are you sure you want to delete this availability period? The selected period will be deleted permanently, and all associated sessions will be removed. This action cannot be undone.',
    slotTitle: 'Delete Time Slot',
    slotDescription: 'Are you sure you want to delete this time slot? This action cannot be undone.',
  },
  table: {
    day: 'Day',
    sessionName: 'Session Name',
    price: 'Price',
    sessionPrice: 'Session Price',
    duration: 'Duration',
    startTime: 'Start Time',
    endTime: 'End Time',
    type: 'Type',
    pillar: 'Pillar',
    location: 'Location',
    actions: 'Actions',
  },
  toasts: {
    deleted: 'Availability Deleted',
    deletedDescription: 'The availability period has been successfully removed.',
    deleteFailed: 'Error',
    deleteFailedDescription: 'Failed to delete availability. Please try again.',
    comingSoon: 'Coming Soon',
    slotDeletionComingSoon: 'Individual slot deletion.',
  },
} as const;

/**
 * Review-Related Strings
 */
export const REVIEWS = {
  reviews: 'Reviews',
  rating: 'Rating',
  leaveReview: 'Leave a Review',
  submitReview: 'Submit Review',
  yourReview: 'Your Review',
  reviewText: 'Review',
  rateCoach: 'Rate this Coach',
  helpful: 'Helpful',
  notHelpful: 'Not Helpful',
  noReviews: 'No reviews yet',
  average: 'Average Rating',
  outOf5: 'out of 5',
  stars: 'Stars',
} as const;

/**
 * Appointment-Related Strings
 */
export const APPOINTMENTS = {
  appointments: 'Appointments',
  myAppointments: 'My Appointments',
  upcomingAppointments: 'Upcoming Appointments',
  pastAppointments: 'Past Appointments',
  bookAppointment: 'Book Appointment',
  rescheduleAppointment: 'Reschedule Appointment',
  cancelAppointment: 'Cancel Appointment',
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
  selectDate: 'Select Date',
  selectTime: 'Select Time',
  availableSlots: 'Available Slots',
  noAvailableSlots: 'No available slots',
  confirmBooking: 'Confirm Booking',
  bookFreeConsultation: 'Book 15 Minute Free Consultation',
  bookSession: 'Book Session',
  complimentaryConsultation: 'Complimentary 15-minute consultation',
  chooseTimeSlot: 'Choose a time slot',
  chooseLocation: 'Choose a location',
  sessionDuration: 'Session Duration',
  additionalNotes: 'Additional Notes (Optional)',
  anySpecificGoals: 'Any specific goals or requirements for this session...',
  sessionTotal: 'Session Total',
  minutesAtHourlyRate: 'minutes at $',
  perHour: '/hour',
  bookFreeConsultationButton: 'Book Free Consultation',
  bookSessionButton: 'Book Session',
  signInToBook: 'Sign In to Book',
  processing: 'Processing...',
  tooManyBookingAttempts: 'Too many booking attempts',
  waitBeforeTryingAgain: 'Please wait before trying to book again.',
  bookingFailed: 'Booking failed',
  errorCreatingBooking: 'There was an error creating your booking. Please try again.',
  authenticationRequired: 'Authentication required',
  pleaseSignInToBook: 'Please sign in to book a session.',
  freeConsultationLimitReached: 'Free Consultation Limit Reached',
  perCoachLimitReached: 'Per-Coach Consultation Limit Reached',
  tooManyConsultationsMessage: (coachName: string, maxConsultations: number) => 
    `You've already booked ${maxConsultations} free consultation${maxConsultations !== 1 ? 's' : ''} with ${coachName}. Ready to upgrade to a paid session?`,
  freeConsultationRules: 'Free Consultation Rules:',
  youAreEligible: "You're eligible!",
  limitReached: 'Limit reached',
  youveAlreadyUsedWithCoach: (coachName: string) => `You've already used your free consultation with ${coachName}.`,
  youHaveRemaining: (remaining: number) => `You have ${remaining} free consultation${remaining !== 1 ? 's' : ''} remaining.`,
  youveUsedBoth: "You've used both of your free consultations.",
  whatNext: "What's next?",
  afterConsultations: (coachName: string, rate: number) => `After your free consultations, paid sessions with ${coachName} start at $${rate}/hour.`,
  continueToBook: 'Continue to Book',
  viewPaidOptions: 'View Paid Options',
} as const;

/**
 * Package-Related Strings
 */
export const PACKAGES = {
  packages: 'Packages',
  package: 'Package',
  myPackages: 'My Packages',
  selectPackage: 'Select a Package',
  buyPackage: 'Buy Package',
  purchasePackage: 'Purchase Package',
  packageDetails: 'Package Details',
  sessions: 'Sessions',
  validity: 'Validity',
  price: 'Price',
  perSession: 'Per Session',
  remainingSessions: 'Remaining Sessions',
  sessionUsed: 'Session Used',
  packageExpired: 'Package Expired',
  renewPackage: 'Renew Package',
  packageOptionsWith: 'Package Options with',
  noPackagesAvailable: 'No packages available at this time.',
  processing: 'Processing...',
  sessionCount: 'Sessions',
  validFor: 'Valid for',
  days: 'days',
  purchaseFailed: 'Purchase failed',
  purchasePackageButton: 'Purchase Package',
} as const;

/**
 * Partnership-Related Strings
 */
export const PARTNERSHIPS = {
  partnerships: 'Partnerships',
  partner: 'Partner',
  ourPartners: 'Our Partners',
  partnership: 'Partnership',
  partnershipOpportunity: 'Partnership Opportunity',
  submitInquiry: 'Submit Inquiry',
  inquiryStatus: 'Inquiry Status',
  inquirySubmitted: 'Inquiry Submitted',
  availableNow: 'Available Now',
  comingSoon: 'Coming Soon',
  learnMoreAbout: 'Learn more about',
  explorePartnership: 'Explore this partnership',
} as const;

/**
 * Authentication Strings
 */
export const AUTH = {
  login: 'Login',
  signup: 'Sign Up',
  logout: 'Logout',
  email: 'Email',
  password: 'Password',
  confirmPassword: 'Confirm Password',
  forgotPassword: 'Forgot Password?',
  resetPassword: 'Reset Password',
  rememberMe: 'Remember Me',
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
  myProfile: 'My Profile',
  editProfile: 'Edit Profile',
  profile: 'Profile',
  personalInfo: 'Personal Information',
  accountSettings: 'Account Settings',
  preferences: 'Preferences',
  privacy: 'Privacy',
  notifications: 'Notifications',
  changePassword: 'Reset Password',
  deleteAccount: 'Delete Account',
  uploadPhoto: 'Upload Photo',
  bio: 'Bio',
  location: 'Location',
  joinDate: 'Join Date',
  member: 'Member',
} as const;

/**
 * Landing Page Strings
 */
export const LANDING = {
  hero: {
    headline: 'Find Your Perfect Coach',
    subheadline: 'Connect with expert coaches in your sport',
    cta: 'Get Started',
  },
  benefits: {
    title: 'Why Choose AthaNext',
    expert: 'Expert Coaches',
    flexible: 'Flexible Scheduling',
    affordable: 'Affordable Packages',
    verified: 'Verified Professionals',
  },
  testimonials: {
    title: 'What Our Users Say',
    greatService: 'Amazing coaching experience!',
    recommended: 'I would highly recommend AthaNext',
  },
  cta: {
    primary: 'Get Started Today',
    secondary: 'Learn More',
  },
} as const;

/**
 * Footer Strings
 */
export const FOOTER = {
  company: 'Company',
  about: 'About Us',
  careers: 'Careers',
  blog: 'Blog',
  contact: 'Contact',
  legal: 'Legal',
  privacy: 'Privacy Policy',
  terms: 'Terms of Service',
  cookies: 'Cookie Policy',
  social: 'Follow Us',
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
  newsletter: 'AthaNext Newsletter',
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
  thisWeek: 'This Week',
  thisMonth: 'This Month',
  lastMonth: 'Last Month',
  lastWeek: 'Last Week',
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
    mainTitle: 'Connecting Greatness, Producing Results',
    subtitle:
      "We're on a mission to revolutionize athletic training by connecting passionate athletes with world-class coaches from around the globe.",
    ctaButton: 'Explore Our Story',
  },
  missionVision: {
    missionTitle: 'Our Mission',
    visionTitle: 'Our Vision',
  },
  coreValues: {
    title: 'Our Core Values',
    subtitle: 'The principles that guide everything we do at AthaNext',
  },
  leadership: {
    title: 'Meet Our Leadership Team',
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
