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

/** Legacy label/value fact on a package — superseded by `MarathonPackage.description`, still read for packages saved before that. */
export interface MarathonDetail {
  label: string
  value: string
}

/** An add-on a registrant can toggle on (or that's always included, if `mandatory`) for a package, e.g. "Add Companion" — adds its price on top of the package's base price. Priced in the parent package's currency. */
export interface MarathonPackageAddOn {
  id: string
  name: string
  priceAmount: number
  /** Always included and can't be unticked by the registrant. Absent means optional. */
  mandatory?: boolean
}

/** One selectable tour package within a marathon event, e.g. "Standard" vs "VIP". */
export interface MarathonPackage {
  id: string
  name: string
  priceAmount: number
  priceCurrency: string
  /** Up-front deposit due `Marathon.depositDueDays` after the offer is accepted, in `priceCurrency`; the rest is due by `Marathon.balanceDeadline`. Absent means no deposit split — the full amount is due. */
  depositAmount?: number
  /** Free-text package details, e.g. inclusions. Line breaks are preserved when shown. */
  description?: string
  /** @deprecated Legacy label/value rows; read via `getPackageDescription`, never written anymore. */
  details?: MarathonDetail[]
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
  /** Admin-only reference code for matching rows in bulk imports, e.g. "TOKYO-2027". Never shown to registrants. Empty/absent means none. */
  code?: string
  /** null means the date hasn't been announced yet (shown as TBA). Stored as null rather than omitted so orderBy('eventDate') still returns it. */
  eventDate: Timestamp | null
  registrationOpensAt: Timestamp
  /** null means no closing date — registration stays open until the admin closes the marathon or it fills up. */
  registrationClosesAt: Timestamp | null
  capacity: number
  confirmedCount: number
  paymentInstructions: string
  /** Inclusions common to every package (e.g. race bib, airport transfers), one per line. Shown once above the package cards instead of repeated in each package's description. */
  sharedInclusions?: string
  /** Event-wide notes (e.g. visa reminders, exclusions), one per line. Shown once below the package cards. */
  packageNotes?: string
  /** Hotel name/address/room details, one per line. Shown only in the offer email (below the notes), not on the marathon page. */
  hotelDetails?: string
  /** Optional hotel photo shown with `hotelDetails` in the offer email. Empty/absent means none. */
  hotelImageUrl?: string
  /** Days after the offer is sent (`Registration.offeredAt`) that the registrant has to accept it; absent means 1. Shown in the offer email and offer step. Past it, flagOverdueRegistrations flags the registration overdue (an admin decides whether to cancel). */
  offerAcceptanceDays?: number
  /** Days after the registrant accepts their offer (`Registration.termsAcceptedAt`) that each package's `depositAmount` is due. */
  depositDueDays?: number
  /** When the remaining balance (total minus deposit) is due. */
  balanceDeadline?: Timestamp
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
  /** Deposit approved (slot locked, counted in confirmedCount); add-ons are worked out over the booking's chat until the admin issues `finalInvoice`. */
  | 'deposit_paid'
  /** Admin issued `finalInvoice`; the registrant accepts the T&C and submits balance proof, which goes back through payment_submitted/payment_rejected. */
  | 'final_invoiced'
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

/** One line on a final invoice; negative amounts are credits (e.g. the deposit already paid, discounts). */
export interface InvoiceLineItem {
  label: string
  amount: number
  /** Marks a credit for money already paid ("Deposit paid", or "Balance paid" on an additional invoice), so the booking total (getRegistrationTotalAmount) can exclude it. */
  isDeposit?: boolean
}

/** Admin-built final invoice, in the registration's `packagePriceCurrency`. Balance due = sum of `items`. */
export interface FinalInvoice {
  items: InvoiceLineItem[]
  dueDate: Timestamp
  issuedAt: Timestamp
}

export interface Registration {
  id: string
  userId: string
  marathonId: string
  /** Empty ('' / 0) while on the waitlist — the registrant picks one of `offeredPackageIds` when accepting their offer. */
  packageId: string
  /** Snapshot of the chosen package's name/price at offer acceptance, so this stays accurate even if the package is later edited or removed. */
  packageName: string
  packagePriceAmount: number
  packagePriceCurrency: string
  /** Add-ons selected alongside the package, if any. Absent/empty means none were selected. */
  selectedAddOns?: SelectedAddOn[]
  status: RegistrationStatus
  /** 1-based position in the marathon's waiting list; null while queued but not yet assigned, or once past the queue. */
  queuePosition: number | null
  /** Admin-reordered sort key for the queue; falls back to createdAt when absent. */
  queueSortAt?: Timestamp
  termsAcceptedAt: Timestamp | null
  /** Answers to the marathon's registration questions, submitted together with acceptance. Absent until submitted. */
  answers?: QuestionAnswer[]
  proofOfPaymentUrls: string[]
  proofSubmittedAt: Timestamp | null
  adminNote: string | null
  /** The package's standard offer image, snapshotted at accept time (see OfferChatDialog) — included in the acceptance email and chat message. Absent if no offer image was set/attached. */
  offerImageUrl?: string
  /** Packages the admin offered (set by acceptRegistration); the registrant picks one of these when accepting. Absent on offers made before this field existed, where `packageId` was already chosen at join time. */
  offeredPackageIds?: string[]
  /** When the admin sent the offer (status → 'accepted'), set by acceptRegistration. Absent on offers sent before this field existed. */
  offeredAt?: Timestamp
  /** Set by flagOverdueRegistrations to the status the registration went overdue in ('accepted' = offer not accepted in time, 'terms_accepted' = deposit not paid in time). Only meaningful while it still equals `status` — see `isOverdue`. */
  overdueStatus?: RegistrationStatus
  overdueAt?: Timestamp
  /** Set when the registrant self-cancels (see 'cancelled' status). Absent/null otherwise. */
  cancelledAt?: Timestamp | null
  /** Who cancelled, set by cancelRegistration alongside `cancelledAt`. Only meaningful while status is 'cancelled'. */
  cancelledBy?: 'user' | 'admin'
  /** Which of the marathon's registration rounds this belongs to (see Marathon.cycle). Absent means cycle 1 (predates this field). */
  cycle?: number
  /** Set by confirmPayment when the deposit is approved (→ 'deposit_paid'). Its presence means this registration holds a counted seat. */
  depositPaidAt?: Timestamp
  /** Already-approved proofs (the deposit's, copied by confirmPayment; plus a paid balance's, archived by issueFinalInvoice on an Additional Invoice) so new balance proof can reuse `proofOfPaymentUrls`. */
  depositProofUrls?: string[]
  /** Present once the admin issues the final invoice (→ 'final_invoiced'). A payment_submitted/payment_rejected registration with this set is on its balance payment, not its deposit. */
  finalInvoice?: FinalInvoice
  /** When the registrant accepted the T&C on the final invoice. */
  finalTermsAcceptedAt?: Timestamp
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
  /** 'system' = a booking history entry (status change, overdue flag) written by Cloud Functions — see functions/src/booking-event.ts. */
  senderRole: MessageSenderRole | 'system'
  text: string
  /** Optional image attached to this message, e.g. a package's standard offer sent alongside registration acceptance. */
  imageUrl?: string
  /** On system 'proof submitted' entries: the proof-of-payment files submitted at that point. */
  attachmentUrls?: string[]
  /** Set when sent from a booking's chat, so the message also shows on that booking (see BookingChatDialog). */
  registrationId?: string
  /** Snapshot of the booking's marathon title, shown as a "re:" tag in the full thread. */
  registrationLabel?: string
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
  | 'registration_cancelled'
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

export type LegalPageId = 'terms' | 'privacy'

/** An admin-authored override for a legal page — falls back to that page's built-in default copy whenever body is empty. */
export interface LegalContent {
  id: LegalPageId
  body: string
  updatedAt: Timestamp
}
