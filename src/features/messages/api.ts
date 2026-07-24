import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore'
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'

import { db, storage } from '@/firebase/config'
import type { Announcement, GroupMessage, MessageSenderRole, PersonalMessage, PersonalThread, Registration } from '@/types'

const personalThreadsRef = collection(db, 'personalThreads')
const announcementsRef = collection(db, 'announcements')
const groupMessagesRef = collection(db, 'groupMessages')

function personalMessagesRef(userId: string) {
  return collection(db, 'personalThreads', userId, 'messages')
}

export function subscribeToPersonalThreadMessages(userId: string, onData: (messages: PersonalMessage[]) => void) {
  const q = query(personalMessagesRef(userId), orderBy('createdAt', 'asc'))
  return onSnapshot(q, (snapshot) => {
    onData(snapshot.docs.map((d) => ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) }) as PersonalMessage))
  })
}

export async function sendPersonalMessage(userId: string, senderId: string, senderRole: MessageSenderRole, text: string) {
  await addDoc(personalMessagesRef(userId), {
    senderId,
    senderRole,
    text,
    createdAt: serverTimestamp(),
  })

  await setDoc(
    doc(personalThreadsRef, userId),
    {
      userId,
      lastMessageText: text,
      lastMessageAt: serverTimestamp(),
      lastMessageSenderRole: senderRole,
      unreadByUser: senderRole === 'admin',
      unreadByAdmin: senderRole === 'user',
      createdAt: serverTimestamp(),
    },
    { merge: true },
  )
}

export async function markPersonalThreadRead(userId: string, viewer: MessageSenderRole) {
  await setDoc(
    doc(personalThreadsRef, userId),
    viewer === 'admin' ? { unreadByAdmin: false } : { unreadByUser: false },
    { merge: true },
  )
}

export function subscribeToPersonalThread(userId: string, onData: (thread: PersonalThread | null) => void) {
  return onSnapshot(doc(personalThreadsRef, userId), (snapshot) => {
    onData(snapshot.exists() ? ({ ...snapshot.data({ serverTimestamps: 'estimate' }) } as PersonalThread) : null)
  })
}

export function subscribeToAllPersonalThreads(onData: (threads: PersonalThread[]) => void) {
  const q = query(personalThreadsRef, orderBy('lastMessageAt', 'desc'))
  return onSnapshot(q, (snapshot) => {
    onData(snapshot.docs.map((d) => ({ ...d.data({ serverTimestamps: 'estimate' }) }) as PersonalThread))
  })
}

export function subscribeToAnnouncements(onData: (announcements: Announcement[]) => void) {
  const q = query(announcementsRef, orderBy('createdAt', 'desc'))
  return onSnapshot(q, (snapshot) => {
    onData(snapshot.docs.map((d) => ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) }) as Announcement))
  })
}

/** Uploads an admin-selected banner image and returns its public download URL, for use as `AnnouncementInput.bannerImageUrl`. */
export async function uploadAnnouncementBanner(file: File): Promise<string> {
  const storageRef = ref(storage, `announcement-banners/${crypto.randomUUID()}-${file.name}`)
  await uploadBytes(storageRef, file)
  return getDownloadURL(storageRef)
}

export interface AnnouncementInput {
  title: string
  body: string
  bannerImageUrl?: string
  audience: Announcement['audience']
  targetMarathonId?: string
  targetUserIds?: string[]
  feedDeadline?: Date
}

export async function createAnnouncement(input: AnnouncementInput, createdBy: string) {
  await addDoc(announcementsRef, {
    ...input,
    createdBy,
    createdAt: serverTimestamp(),
  })
}

export async function deleteAnnouncement(announcementId: string) {
  await deleteDoc(doc(announcementsRef, announcementId))
}

/** Whether `announcement` should be shown/pushed to a given user, based on its audience targeting. */
export function isAnnouncementVisibleTo(
  announcement: Announcement,
  uid: string | undefined,
  registrations: Registration[],
) {
  if (announcement.audience === 'marathon') {
    return registrations.some((r) => r.marathonId === announcement.targetMarathonId)
  }
  if (announcement.audience === 'users') {
    return !!uid && !!announcement.targetUserIds?.includes(uid)
  }
  return true
}

export function subscribeToGroupMessages(onData: (messages: GroupMessage[]) => void) {
  const q = query(groupMessagesRef, orderBy('createdAt', 'asc'))
  return onSnapshot(q, (snapshot) => {
    onData(snapshot.docs.map((d) => ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) }) as GroupMessage))
  })
}

export async function sendGroupMessage(senderId: string, senderRole: MessageSenderRole, text: string) {
  await addDoc(groupMessagesRef, {
    senderId,
    senderRole,
    text,
    createdAt: serverTimestamp(),
  })
}
