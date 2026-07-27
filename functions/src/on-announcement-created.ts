import { onDocumentCreated } from 'firebase-functions/v2/firestore'

import { db } from './admin.js'
import { sendAndPruneTokens } from './notify.js'

interface MarathonQuestion {
  id: string
  type: 'text' | 'bool' | 'int' | 'dropdown'
  required: boolean
}

interface QuestionAnswer {
  questionId: string
  value: string
}

/** Mirrors isQuestionAnswered in src/features/registrations/registration-flow.ts — a 'bool' question is always answered. */
function isQuestionAnswered(question: MarathonQuestion, value: string | undefined) {
  if (question.type === 'bool') return true
  if (question.type === 'int') return (value ?? '').trim() !== '' && !Number.isNaN(Number(value))
  return (value ?? '').trim() !== ''
}

function hasCompletedQuestionnaire(questions: MarathonQuestion[], answers: QuestionAnswer[] | undefined) {
  const answerValues = Object.fromEntries((answers ?? []).map((a) => [a.questionId, a.value]))
  return questions.filter((q) => q.required).every((q) => isQuestionAnswered(q, answerValues[q.id]))
}

async function getTargetUserDocs(
  audience: string,
  targetMarathonId: string | undefined,
  targetUserIds: string[] | undefined,
) {
  if (audience === 'marathon' && targetMarathonId) {
    const registrationsSnapshot = await db
      .collection('registrations')
      .where('marathonId', '==', targetMarathonId)
      .get()
    const userIds = [...new Set(registrationsSnapshot.docs.map((doc) => doc.data().userId as string))]
    if (userIds.length === 0) return []
    return await db.getAll(...userIds.map((id) => db.collection('users').doc(id)))
  }

  if (audience === 'marathon_confirmed' && targetMarathonId) {
    const marathonDoc = await db.collection('marathons').doc(targetMarathonId).get()
    const questions = (marathonDoc.data()?.questions ?? []) as MarathonQuestion[]
    const registrationsSnapshot = await db
      .collection('registrations')
      .where('marathonId', '==', targetMarathonId)
      .where('status', '==', 'confirmed')
      .get()
    const userIds = [
      ...new Set(
        registrationsSnapshot.docs
          .filter((doc) => hasCompletedQuestionnaire(questions, doc.data().answers as QuestionAnswer[] | undefined))
          .map((doc) => doc.data().userId as string),
      ),
    ]
    if (userIds.length === 0) return []
    return await db.getAll(...userIds.map((id) => db.collection('users').doc(id)))
  }

  if (audience === 'users' && targetUserIds && targetUserIds.length > 0) {
    return await db.getAll(...targetUserIds.map((id) => db.collection('users').doc(id)))
  }

  const usersSnapshot = await db.collection('users').get()
  return usersSnapshot.docs
}

export const onAnnouncementCreated = onDocumentCreated('announcements/{announcementId}', async (event) => {
  const announcement = event.data?.data()
  if (!announcement) return

  const userDocs = await getTargetUserDocs(
    announcement.audience,
    announcement.targetMarathonId,
    announcement.targetUserIds,
  )
  const tokensByOwner = userDocs
    .filter((userDoc) => userDoc.exists)
    .map((userDoc) => ({
      ref: userDoc.ref,
      tokens: (userDoc.data()?.fcmTokens ?? []) as string[],
    }))

  await sendAndPruneTokens(
    tokensByOwner,
    { title: announcement.title, body: announcement.body },
    '/',
  )
})
