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
import { useMarathonsByIds } from '@/features/marathons/use-marathons'
import { RegistrationWizard } from '@/features/registrations/RegistrationWizard'
import { getPendingActionStep, type PendingActionStep } from '@/features/registrations/registration-flow'
import { useUserRegistrations } from '@/features/registrations/use-registrations'
import type { Registration } from '@/types'

const ACTION_LABEL: Record<PendingActionStep, string> = {
  terms: 'Accept Terms & Conditions',
  payment: 'Submit Proof of Payment',
}

export function NotificationBell() {
  const uid = useAuthStore((state) => state.firebaseUser?.uid)
  const { registrations } = useUserRegistrations(uid)
  const [activeRegistration, setActiveRegistration] = useState<Registration | null>(null)

  const needsAction = registrations.filter((r) =>
    ['accepted', 'terms_accepted', 'payment_rejected'].includes(r.status),
  )
  const marathons = useMarathonsByIds(needsAction.map((r) => r.marathonId))

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="hover:bg-secondary relative rounded-full p-2" aria-label="Notifications">
            <BellIcon className="size-5" />
            {needsAction.length > 0 && (
              <Badge
                variant="destructive"
                className="absolute -top-0.5 -right-0.5 h-4 min-w-4 justify-center rounded-full px-1 text-[10px] leading-none"
              >
                {needsAction.length}
              </Badge>
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
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
                  onSelect={() => setActiveRegistration(registration)}
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
          <DropdownMenuItem asChild>
            <Link to="/my-registrations">View all registrations</Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {activeRegistration && (
        <RegistrationWizard
          registration={activeRegistration}
          marathon={marathons[activeRegistration.marathonId]}
          onClose={() => setActiveRegistration(null)}
        />
      )}
    </>
  )
}
