import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'

import { db } from '@/firebase/config'
import type { LegalContent, LegalPageId } from '@/types'

export function subscribeToLegalContent(id: LegalPageId, onData: (content: LegalContent | null) => void) {
  return onSnapshot(doc(db, 'legalContent', id), (snapshot) => {
    onData(snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as LegalContent) : null)
  })
}

/** An empty/whitespace-only body clears the override, so the page falls back to its built-in default copy. */
export async function saveLegalContent(id: LegalPageId, body: string) {
  await setDoc(doc(db, 'legalContent', id), { body: body.trim(), updatedAt: serverTimestamp() })
}
