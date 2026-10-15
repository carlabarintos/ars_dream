import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { LogOutIcon, MoonIcon, SunIcon, UserPenIcon } from 'lucide-react'

import { BottomNav } from '@/components/BottomNav'
import { InstallAppButton } from '@/components/InstallAppButton'
import { LogoBadge } from '@/components/LogoBadge'
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
import { useThemeStore } from '@/lib/theme-store'
import { cn } from '@/lib/utils'

function ThemeToggle() {
  const theme = useThemeStore((state) => state.theme)
  const toggleTheme = useThemeStore((state) => state.toggleTheme)

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
    >
      {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
    </Button>
  )
}

export function Layout({ children }: { children: ReactNode }) {
  const firebaseUser = useAuthStore((state) => state.firebaseUser)
  const isLoading = useAuthStore((state) => state.isLoading)

  return (
    <div className="flex min-h-svh flex-col">
      <header className="border-border sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link to="/" aria-label="ARS Dream">
            <LogoBadge className="rounded-xl p-1.5 shadow-md" imgClassName="h-8 w-auto" />
          </Link>

          {isLoading ? null : firebaseUser ? (
            <div className="flex items-center gap-1">
              <InstallAppButton />
              <ThemeToggle />
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
            <div className="flex items-center gap-1">
              <InstallAppButton />
              <ThemeToggle />
              <Button size="sm" asChild>
                <Link to="/sign-in">Sign in</Link>
              </Button>
            </div>
          )}
        </div>
      </header>
      <main className={cn('flex-1', firebaseUser && 'pb-16')}>{children}</main>
      <footer
        className={cn(
          'border-border text-muted-foreground border-t px-4 py-6 text-center text-xs',
          firebaseUser && 'pb-16',
        )}
      >
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-4 gap-y-1">
          <span>© {new Date().getFullYear()} ARS Dream Sports</span>
          <Link to="/terms" className="hover:text-foreground hover:underline">
            Terms of Service
          </Link>
          <Link to="/privacy" className="hover:text-foreground hover:underline">
            Privacy Policy
          </Link>
          <span>v{__APP_VERSION__}</span>
        </div>
      </footer>
      {firebaseUser && <BottomNav />}
    </div>
  )
}
