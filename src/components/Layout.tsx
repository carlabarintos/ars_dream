import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { LogOutIcon, UserPenIcon } from 'lucide-react'

import { BottomNav } from '@/components/BottomNav'
import { NotificationBell } from '@/components/NotificationBell'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { signOutUser } from '@/features/auth/auth-actions'
import { useAuthStore } from '@/features/auth/auth-store'
import { cn } from '@/lib/utils'

export function Layout({ children }: { children: ReactNode }) {
  const firebaseUser = useAuthStore((state) => state.firebaseUser)
  const isLoading = useAuthStore((state) => state.isLoading)

  return (
    <div className="flex min-h-svh flex-col">
      <header className="border-border sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link to="/" className="font-display text-2xl tracking-wide">
            ARS <span className="text-primary">DREAM</span>
          </Link>

          {isLoading ? null : firebaseUser ? (
            <div className="flex items-center gap-1">
              <NotificationBell />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button>
                    <Avatar>
                      <AvatarImage src={firebaseUser.photoURL ?? undefined} />
                      <AvatarFallback>
                        {(firebaseUser.displayName ?? firebaseUser.email ?? '?')[0].toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <Link to="/profile">
                      <UserPenIcon /> My profile
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => signOutUser()}>
                    <LogOutIcon /> Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : (
            <Button size="sm" asChild>
              <Link to="/sign-in">Sign in</Link>
            </Button>
          )}
        </div>
      </header>
      <main className={cn('flex-1', firebaseUser && 'pb-16')}>{children}</main>
      {firebaseUser && <BottomNav />}
    </div>
  )
}
