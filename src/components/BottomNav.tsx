import {
  BanknoteIcon,
  ClipboardListIcon,
  FileClockIcon,
  HomeIcon,
  MessageCircleIcon,
  TicketIcon,
  TrophyIcon,
  UserIcon,
  UsersIcon,
} from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'

import { useIsAdmin, useIsFinance } from '@/features/auth/auth-store'
import { cn } from '@/lib/utils'

const USER_ITEMS = [
  { to: '/', label: 'Home', icon: HomeIcon, match: (p: string) => p === '/' },
  { to: '/my-registrations', label: 'My Bookings', icon: TicketIcon, match: (p: string) => p.startsWith('/my-registrations') },
  { to: '/messages', label: 'Messages', icon: MessageCircleIcon, match: (p: string) => p.startsWith('/messages') },
  { to: '/profile', label: 'Profile', icon: UserIcon, match: (p: string) => p.startsWith('/profile') },
]

const ADMIN_ITEMS = [
  { to: '/', label: 'Home', icon: HomeIcon, match: (p: string) => p === '/' },
  { to: '/admin/users', label: 'Users', icon: UsersIcon, match: (p: string) => p.startsWith('/admin/users') },
  {
    to: '/admin/messages',
    label: 'Messages',
    icon: MessageCircleIcon,
    match: (p: string) => p.startsWith('/admin/messages'),
  },
  {
    to: '/admin/questionnaire-templates',
    label: 'Questionnaires',
    icon: ClipboardListIcon,
    match: (p: string) => p.startsWith('/admin/questionnaire-templates'),
  },
  {
    to: '/admin',
    label: 'Marathons',
    icon: TrophyIcon,
    match: (p: string) => p === '/admin' || p.startsWith('/admin/marathons'),
  },
  {
    to: '/admin/audit-log',
    label: 'Audit Log',
    icon: FileClockIcon,
    match: (p: string) => p.startsWith('/admin/audit-log'),
  },
]

const FINANCE_ITEMS = [
  { to: '/', label: 'Home', icon: HomeIcon, match: (p: string) => p === '/' },
  {
    to: '/admin/revenue',
    label: 'Revenue',
    icon: BanknoteIcon,
    match: (p: string) => p.startsWith('/admin/revenue'),
  },
]

export function BottomNav() {
  const location = useLocation()
  const isAdmin = useIsAdmin()
  const isFinance = useIsFinance()
  const items = isAdmin ? ADMIN_ITEMS : isFinance ? FINANCE_ITEMS : USER_ITEMS

  return (
    <nav
      className="border-border bg-background/95 fixed inset-x-0 bottom-0 z-40 border-t backdrop-blur"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="mx-auto flex max-w-6xl items-stretch justify-around">
        {items.map((item) => {
          const isActive = item.match(location.pathname)
          const Icon = item.icon
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                'flex flex-1 flex-col items-center gap-1 py-2.5 text-xs font-medium transition-colors',
                isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className="size-5" />
              {item.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
