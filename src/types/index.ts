import type { Timestamp } from 'firebase/firestore'

/** 'finance' can only see the revenue report (RequireFinanceAccess) — no other admin capability. */
export type UserRole = 'user' | 'admin' | 'finance'

export type Gender = 'male' | 'female' | 'other' | 'prefer_not_to_say'

export interface UserProfile {
  uid: string
  displayName: string | null
  email: string | null
  photoURL: string | null
  role: UserRole
  fcmTokens: string[]
  createdAt: Timestamp
  /** Only present for accounts created via the email sign-up form, not Google sign-in. */
  firstName?: string
  middleName?: string | null
  lastName?: string
  contactNumber?: string
  dateOfBirth?: string
  gender?: Gender
}

export type MarathonStatus = 'draft' | 'published' | 'closed'

/** A single labeled fact about a package, e.g. { label: 'Inclusions', value: 'Roundtrip airfare, 4-star hotel' }. */
export interface MarathonDetail {
  label: string
  value: string
}

/** An optional add-on a registrant can toggle on for a package, e.g. "Add Companion" — adds its price on top of the package's base price. Priced in the parent package's currency. */
export interface MarathonPackageAddOn {
  id: string
  name: string
  priceAmount: number
}

/** One selectable tour package within a marathon event, e.g. "Standard" vs "VIP". */
export interface MarathonPackage {
  id: string
  name: string
  priceAmount: number
  priceCurrency: string
  details: MarathonDetail[]
  /** Optional photos shown as a carousel on the package selection page. Absent/empty means no carousel is shown. */
  photoUrls?: string[]
  /** Default "standard offer" image shown to an admin (and sendable to the registrant via chat) when accepting a registrant into this package. Absent means no default has been uploaded yet. */
  offerImageUrl?: string
  /** Optional toggleable extras a registrant can add on top of this package, e.g. "Add Companion". Absent/empty means no add-ons are offered. */
  addOns?: MarathonPackageAddOn[]
}

export type QuestionType = 'text' | 'bool' | 'int' | 'dropdown'

/** A single registration question an admin defines for a marathon, e.g. an agreement checkbox, emergency contact, dietary restrictions. */
export interface MarathonQuestion {
  id: string
  label: string
  type: QuestionType
  required: boolean
  /** Choices for a 'dropdown' item. */
  options?: string[]
}

/** A reusable set of registration questions, authored once so admins can start a new marathon's questionnaire from it instead of rebuilding it by hand. Copied into `Marathon.questions` at authoring time — editing a template does not affect marathons that already copied from it. */
export interface QuestionnaireTemplate {
  id: string
  title: string
  questions: MarathonQuestion[]
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface Marathon {
  id: string
  title: string
  description: string
  bannerImageUrl: string
  location: string
  eventDate: Timestamp
  registrationOpensAt: Timestamp
  registrationClosesAt: Timestamp
  capacity: number
  confirmedCount: number
  paymentInstructions: string
  /** Selectable packages for this event (e.g. Standard, VIP). Absent on events created before this field existed. */
  packages?: MarathonPackage[]
  /** Registration questions a registrant must complete before payment (e.g. an agreement checkbox, emergency contact, dietary restrictions). Absent on events created before this field existed. May originate from a QuestionnaireTemplate copied in at authoring time, but is independent of it thereafter. */
  questions?: MarathonQuestion[]
  /** Once passed, this stops appearing in the Home/Timeline feed — independent of `status`/`registrationClosesAt`, and doesn't affect any other view (e.g. a registrant's My Registrations still shows it). Absent means always shown while published. */
  feedDeadline?: Timestamp
  /** Which registration round this is, starting at 1. Incremented by reopenMarathon each time a closed marathon is reopened for a fresh round — confirmedCount resets to 0 and everyone still active in the old round gets a new cycle-scoped registration in the queue. Absent means cycle 1 (predates this field). */
  cycle?: number
  status: MarathonStatus
  createdBy: string
  createdAt: Timestamp
}

export type RegistrationStatus =
  | 'queued'
  | 'accepted'
  | 'rejected'
  | 'terms_accepted'
  | 'payment_submitted'
  | 'confirmed'
  | 'payment_rejected'
  | 'cancelled'

/** One answer to a marathon's registration question, snapshotting the question's label at submission time. */
export interface QuestionAnswer {
  questionId: string
  label: string
  value: string
}

/** Snapshot of one add-on selected at registration time, so this stays accurate even if the package's add-on is later edited or removed. */
export interface SelectedAddOn {
  addOnId: string
  name: string
  priceAmount: number
}

export interface Registration {
  id: string
  userId: string
  marathonId: string
  packageId: string
  /** Snapshot of the package's name/price at registration time, so this stays accurate even if the package is later edited or removed. */
  packageName: string
  packagePriceAmount: number
  packagePriceCurrency: string
  /** Add-ons selected alongside the package, if any. Absent/empty means none were selected. */
  selectedAddOns?: SelectedAddOn[]
  status: RegistrationStatus
  /** 1-based position in the marathon's waiting list; null while queued but not yet assigned, or once past the queue. */
  queuePosition: number | null
  termsAcceptedAt: Timestamp | null
  /** Answers to the marathon's registration questions, submitted together with acceptance. Absent until submitted. */
  answers?: QuestionAnswer[]
  proofOfPaymentUrls: string[]
  proofSubmittedAt: Timestamp | null
  adminNote: string | null
  /** The package's standard offer image, snapshotted at accept time (see OfferChatDialog) — included in the acceptance email and chat message. Absent if no offer image was set/attached. */
  offerImageUrl?: string
  /** Set when the registrant self-cancels (see 'cancelled' status). Absent/null otherwise. */
  cancelledAt?: Timestamp | null
  /** Which of the marathon's registration rounds this belongs to (see Marathon.cycle). Absent means cycle 1 (predates this field). */
  cycle?: number
  /** Set by reopenMarathon when this carried-forward registration's package no longer exists in the marathon's current packages list. Cleared (false/absent) once the registrant picks a new package via the existing swap flow. Only ever true while status is 'queued'. */
  packageUpdateRequired?: boolean
  createdAt: Timestamp
  updatedAt: Timestamp
}

export type MessageSenderRole = 'user' | 'admin'

/** One user's private support thread with staff. Doc id === userId. Created lazily on first message. */
export interface PersonalThread {
  userId: string
  lastMessageText: string | null
  lastMessageAt: Timestamp | null
  lastMessageSenderRole: MessageSenderRole | null
  unreadByUser: boolean
  unreadByAdmin: boolean
  createdAt: Timestamp
}

export interface PersonalMessage {
  id: string
  senderId: string
  senderRole: MessageSenderRole
  text: string
  /** Optional image attached to this message, e.g. a package's standard offer sent alongside registration acceptance. */
  imageUrl?: string
  createdAt: Timestamp
}

export type AnnouncementAudience = 'all' | 'marathon' | 'marathon_confirmed' | 'users'

/** Admin-authored broadcast. Visibility to a given user is determined by `audience`. */
export interface Announcement {
  id: string
  title: string
  body: string
  bannerImageUrl?: string
  audience: AnnouncementAudience
  /** Present when audience === 'marathon' or 'marathon_confirmed': registrants of this marathon see it (for 'marathon_confirmed', only those with a 'confirmed' registration whose questionnaire, if any, is fully answered). */
  targetMarathonId?: string
  /** Present when audience === 'users': exactly these uids see it. */
  targetUserIds?: string[]
  /** Once passed, this stops appearing in the Home/Timeline feed — it's still shown in the Messages page's Announcements tab. Absent means always shown in the feed. */
  feedDeadline?: Timestamp
  createdBy: string
  createdAt: Timestamp
}

/** Single shared thread; every signed-in user and admin can post to and read it. */
export interface GroupMessage {
  id: string
  senderId: string
  senderRole: MessageSenderRole
  text: string
  createdAt: Timestamp
}

/**
 * Kept in sync by hand with functions/src/audit-log.ts (a separate package that can't
 * import from src/) — the two action lists must match.
 */
export type AuditAction =
  | 'registration_accepted'
  | 'registration_rejected'
  | 'payment_confirmed'
  | 'payment_rejected'
  | 'marathon_published'
  | 'marathon_closed'
  | 'marathon_reopened'
  | 'user_role_changed'
  | 'operational_data_cleared'

export type AuditTargetType = 'registration' | 'marathon' | 'user' | 'system'

/** Immutable record of a sensitive admin action, for accountability once more than one person has admin access. Never updated or deleted once written. */
export interface AuditLogEntry {
  id: string
  actorId: string
  actorName: string | null
  actorEmail: string | null
  action: AuditAction
  targetType: AuditTargetType
  targetId: string
  targetLabel: string | null
  metadata: Record<string, string | number> | null
  createdAt: Timestamp
}
