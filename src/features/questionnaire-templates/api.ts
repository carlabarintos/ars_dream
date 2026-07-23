import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'

import { db } from '@/firebase/config'
import type { MarathonQuestion, QuestionnaireTemplate } from '@/types'

const questionnaireTemplatesRef = collection(db, 'questionnaireTemplates')

export function subscribeToQuestionnaireTemplates(onData: (templates: QuestionnaireTemplate[]) => void) {
  const q = query(questionnaireTemplatesRef, orderBy('title', 'asc'))
  return onSnapshot(q, (snapshot) => {
    onData(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as QuestionnaireTemplate))
  })
}

export function subscribeToQuestionnaireTemplate(
  templateId: string,
  onData: (template: QuestionnaireTemplate | null) => void,
) {
  return onSnapshot(doc(db, 'questionnaireTemplates', templateId), (snapshot) => {
    onData(snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as QuestionnaireTemplate) : null)
  })
}

export interface QuestionnaireTemplateInput {
  title: string
  questions: MarathonQuestion[]
}

export async function createQuestionnaireTemplate(input: QuestionnaireTemplateInput) {
  await addDoc(questionnaireTemplatesRef, {
    ...input,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

export async function updateQuestionnaireTemplate(templateId: string, input: QuestionnaireTemplateInput) {
  await updateDoc(doc(db, 'questionnaireTemplates', templateId), { ...input, updatedAt: serverTimestamp() })
}

export async function deleteQuestionnaireTemplate(templateId: string) {
  await deleteDoc(doc(db, 'questionnaireTemplates', templateId))
}
