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

import { db } from '@/firebase/config'
import type { Announcement, GroupMessage, MessageSenderRole, PersonalMessage, PersonalThread } from '@/types'

const personalThreadsRef = collection(db, 'personalThreads')
const announcementsRef = collection(db, 'announcements')
const groupMessagesRef = collection(db, 'groupMessages')

function personalMessagesRef(userId: string) {
  return collection(db, 'personalThreads', userId, 'messages')
}

export function subscribeToPersonalThreadMessages(userId: string, onData: (messages: PersonalMessage[]) => void) {
  const q = query(personalMessagesRef(userId), orderBy('createdAt', 'asc'))
  return onSnapshot(q, (snapshot) => {
    onData(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as PersonalMessage))
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

export function subscribeToAllPersonalThreads(onData: (threads: PersonalThread[]) => void) {
  const q = query(personalThreadsRef, orderBy('lastMessageAt', 'desc'))
  return onSnapshot(q, (snapshot) => {
    onData(snapshot.docs.map((d) => ({ ...d.data() }) as PersonalThread))
  })
}

export function subscribeToAnnouncements(onData: (announcements: Announcement[]) => void) {
  const q = query(announcementsRef, orderBy('createdAt', 'desc'))
  return onSnapshot(q, (snapshot) => {
    onData(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Announcement))
  })
}

export async function createAnnouncement(createdBy: string, title: string, body: string) {
  await addDoc(announcementsRef, {
    title,
    body,
    createdBy,
    createdAt: serverTimestamp(),
  })
}

export async function deleteAnnouncement(announcementId: string) {
  await deleteDoc(doc(announcementsRef, announcementId))
}

export function subscribeToGroupMessages(onData: (messages: GroupMessage[]) => void) {
  const q = query(groupMessagesRef, orderBy('createdAt', 'asc'))
  return onSnapshot(q, (snapshot) => {
    onData(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as GroupMessage))
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
