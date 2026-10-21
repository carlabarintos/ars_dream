import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BellIcon } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAuthStore } from '@/features/auth/auth-store'
import { formatUserName, useUserProfilesByIds } from '@/features/auth/use-user-profiles'
import { useMarathonsByIds } from '@/features/marathons/use-marathons'
import { useAllPersonalThreads, usePersonalThread } from '@/features/messages/use-messages'
import { RegistrationWizard } from '@/features/registrations/RegistrationWizard'
import { getPendingActionStep, type PendingActionStep } from '@/features/registrations/registration-flow'
import { useUserRegistrations } from '@/features/registrations/use-registrations'

const ACTION_LABEL: Record<PendingActionStep, string> = {
  terms: 'Choose Package & Accept Offer',
  payment: 'Submit Proof of Payment',
  final_payment: 'Pay Final Invoice',
  passport: 'Upload Passport Bio Page',
  questionnaire: 'Answer Questionnaire',
}

export function NotificationBell() {
  const uid = useAuthStore((state) => state.firebaseUser?.uid)
  const isAdmin = useAuthStore((state) => state.profile?.role === 'admin')
  const { registrations } = useUserRegistrations(uid)
  const [activeRegistrationId, setActiveRegistrationId] = useState<string | null>(null)
  // Re-derived live from the subscription every render (not captured once
  // into state) so the wizard always acts on the current server-side status —
  // a frozen copy would let a status change while the dialog is open (e.g.
  // an admin decision) lead to a write the security rules now reject.
  const activeRegistration = activeRegistrationId
    ? (registrations.find((r) => r.id === activeRegistrationId) ?? null)
    : null

  const needsAction = registrations.filter(
    (r) => ['accepted', 'terms_accepted', 'final_invoiced', 'payment_rejected'].includes(r.status),
  )
  const marathons = useMarathonsByIds(needsAction.map((r) => r.marathonId))

  const { thread: ownThread } = usePersonalThread(isAdmin ? undefined : uid)
  const { threads: allThreads } = useAllPersonalThreads(isAdmin)
  const unreadThreads = isAdmin ? allThreads.filter((t) => t.unreadByAdmin) : []
  const senderProfiles = useUserProfilesByIds(unreadThreads.map((t) => t.userId))

  const messagesLink = isAdmin ? '/admin/messages' : '/messages'
  const unreadMessageCount = isAdmin ? unreadThreads.length : ownThread?.unreadByUser ? 1 : 0
  const totalCount = needsAction.length + unreadMessageCount

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="hover:bg-secondary relative rounded-full p-2" aria-label="Notifications">
            <BellIcon className="size-5" />
            {totalCount > 0 && (
              <Badge
                variant="destructive"
                className="absolute -top-0.5 -right-0.5 h-4 min-w-4 justify-center rounded-full px-1 text-[10px] leading-none"
              >
                {totalCount}
              </Badge>
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          {!isAdmin && (
            <>
              <DropdownMenuLabel>Action needed</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {needsAction.length === 0 ? (
                <p className="text-muted-foreground px-2 py-3 text-sm">You're all caught up.</p>
              ) : (
                needsAction.map((registration) => {
                  const marathon = marathons[registration.marathonId]
                  const step = getPendingActionStep(registration, marathon)
                  return (
                    <DropdownMenuItem
                      key={registration.id}
                      onSelect={() => setActiveRegistrationId(registration.id)}
                      className="flex-col items-start gap-0.5 whitespace-normal"
                    >
                      <span className="font-medium">{marathon?.title ?? 'Marathon'}</span>
                      <span className="text-muted-foreground text-xs">
                        {step ? ACTION_LABEL[step] : 'Complete your registration steps'}
                      </span>
                    </DropdownMenuItem>
                  )
                })
              )}
              <DropdownMenuSeparator />
            </>
          )}

          <DropdownMenuLabel>Messages</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {isAdmin ? (
            unreadThreads.length === 0 ? (
              <p className="text-muted-foreground px-2 py-3 text-sm">No new messages.</p>
            ) : (
              unreadThreads.map((thread) => (
                <DropdownMenuItem key={thread.userId} asChild className="flex-col items-start gap-0.5 whitespace-normal">
                  <Link to={messagesLink}>
                    <span className="font-medium">{formatUserName(senderProfiles[thread.userId])}</span>
                    <span className="text-muted-foreground line-clamp-1 text-xs">
                      {thread.lastMessageText ?? 'New message'}
                    </span>
                  </Link>
                </DropdownMenuItem>
              ))
            )
          ) : ownThread?.unreadByUser ? (
            <DropdownMenuItem asChild className="flex-col items-start gap-0.5 whitespace-normal">
              <Link to={messagesLink}>
                <span className="font-medium">Support team</span>
                <span className="text-muted-foreground line-clamp-1 text-xs">
                  {ownThread.lastMessageText ?? 'New message'}
                </span>
              </Link>
            </DropdownMenuItem>
          ) : (
            <p className="text-muted-foreground px-2 py-3 text-sm">No new messages.</p>
          )}

          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link to={isAdmin ? messagesLink : '/my-registrations'}>
              {isAdmin ? 'View all messages' : 'View all registrations'}
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {activeRegistration && (
        <RegistrationWizard
          registration={activeRegistration}
          marathon={marathons[activeRegistration.marathonId]}
          onClose={() => setActiveRegistrationId(null)}
        />
      )}
    </>
  )
}
