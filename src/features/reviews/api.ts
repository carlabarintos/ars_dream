import { collection, deleteDoc, doc, limit, onSnapshot, orderBy, query, updateDoc, where } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { deleteObject, getDownloadURL, ref } from 'firebase/storage'
import { useEffect, useState } from 'react'

import { db, functions, storage } from '@/firebase/config'
import type { Review, ReviewStatus } from '@/types'

// Mirrors the server-side limits in functions/src/submit-review.ts.
export const REVIEW_NAME_MAX = 60
export const REVIEW_COMMENT_MAX = 1000
export const REVIEW_PHOTOS_MAX = 3

export const submitReview = httpsCallable<
  { name?: string; rating: number; comment: string; photos: string[] },
  { id: string }
>(functions, 'submitReview')

export function useReviews(status: ReviewStatus, max = 50) {
  const [reviews, setReviews] = useState<Review[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(
    () =>
      onSnapshot(
        query(collection(db, 'reviews'), where('status', '==', status), orderBy('createdAt', 'desc'), limit(max)),
        (snap) => {
          setReviews(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Review))
          setIsLoading(false)
        },
        () => setIsLoading(false),
      ),
    [status, max],
  )

  // A full page means there may be more; grow `max` to fetch the next page.
  return { reviews, isLoading, hasMore: reviews.length >= max }
}

export function usePhotoUrls(paths: string[]) {
  const [urls, setUrls] = useState<string[]>([])
  const key = paths.join('|')
  useEffect(() => {
    Promise.all(paths.map((p) => getDownloadURL(ref(storage, p)))).then(setUrls, () => setUrls([]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return urls
}

export function approveReview(id: string) {
  return updateDoc(doc(db, 'reviews', id), { status: 'approved' })
}

/** Rejecting (or un-publishing) a review deletes it and its photos. */
export async function deleteReview(review: Review) {
  await Promise.all(review.photoPaths.map((p) => deleteObject(ref(storage, p)).catch(() => {})))
  await deleteDoc(doc(db, 'reviews', review.id))
}

/** Downscales to max 1600px JPEG so uploads stay well under the 2 MB server cap. */
export async function photoToDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', 0.8)
}
