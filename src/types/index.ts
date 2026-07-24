import type { Timestamp } from 'firebase/firestore'

export type UserRole = 'user' | 'admin'

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

/** One selectable tour package within a marathon event, e.g. "Standard" vs "VIP". */
export interface MarathonPackage {
  id: string
  name: string
  priceAmount: number
  priceCurrency: string
  details: MarathonDetail[]
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

/** One answer to a marathon's registration question, snapshotting the question's label at submission time. */
export interface QuestionAnswer {
  questionId: string
  label: string
  value: string
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
  status: RegistrationStatus
  /** 1-based position in the marathon's waiting list; null while queued but not yet assigned, or once past the queue. */
  queuePosition: number | null
  termsAcceptedAt: Timestamp | null
  /** Answers to the marathon's registration questions, submitted together with acceptance. Absent until submitted. */
  answers?: QuestionAnswer[]
  proofOfPaymentUrls: string[]
  proofSubmittedAt: Timestamp | null
  adminNote: string | null
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
  createdAt: Timestamp
}

export type AnnouncementAudience = 'all' | 'marathon' | 'users'

/** Admin-authored broadcast. Visibility to a given user is determined by `audience`. */
export interface Announcement {
  id: string
  title: string
  body: string
  bannerImageUrl?: string
  audience: AnnouncementAudience
  /** Present when audience === 'marathon': registrants of this marathon see it. */
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
