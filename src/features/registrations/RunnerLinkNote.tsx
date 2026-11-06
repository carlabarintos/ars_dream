import { Link2Icon } from 'lucide-react'

import type { Registration } from '@/types'

import { isOnSharedPackage } from './registration-flow'

/** "Runner 1 · with Maria Santos": who a booking shares its package with, for the admin lists. */
export function RunnerLinkNote({ registration }: { registration: Registration }) {
  if (!isOnSharedPackage(registration)) return null
  const { partOf, companions } = registration
  const others = partOf?.leadName ?? companions?.map((runner) => runner.name || runner.email).filter(Boolean).join(', ')
  return (
    <div className="text-primary mt-1 flex items-center gap-1 text-xs font-medium">
      <Link2Icon className="size-3.5 shrink-0" aria-hidden="true" />
      Runner {partOf?.runner ?? 1} · with {others}
    </div>
  )
}
