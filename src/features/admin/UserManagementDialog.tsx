import { ChevronRightIcon } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { requestPasswordReset, updateUserProfileAsAdmin, updateUserRole } from '@/features/auth/auth-actions'
import { useAuthStore } from '@/features/auth/auth-store'
import { formatUserName } from '@/features/auth/use-user-profiles'
import { useMarathonsByIds, usePublishedMarathons } from '@/features/marathons/use-marathons'
import { bulkWaitlist } from '@/features/registrations/api'
import { BookingTimeline } from '@/features/registrations/BookingTimeline'
import { QuestionnaireLink } from '@/features/registrations/QuestionnaireLink'
import { isBookingComplete } from '@/features/registrations/registration-flow'
import { StatusBadge } from '@/features/registrations/StatusBadge'
import { useUserRegistrations } from '@/features/registrations/use-registrations'
import type { Gender, Marathon, UserProfile, UserRole } from '@/types'

import { logAdminAction } from './audit-log/api'

const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
]

const ROLE_OPTIONS: { value: UserRole; label: string; description: string }[] = [
  { value: 'user', label: 'User', description: 'Standard registrant access only.' },
  { value: 'finance', label: 'Finance', description: 'Can only view the revenue report — no other admin access.' },
  { value: 'admin', label: 'Admin', description: 'Full access to marathons, registrations, and users.' },
]

export const ROLE_BADGE_VARIANT: Record<UserRole, 'success' | 'warning' | 'secondary'> = {
  admin: 'success',
  finance: 'warning',
  user: 'secondary',
}

function BookingsTab({ profile }: { profile: UserProfile }) {
  const { registrations, isLoading } = useUserRegistrations(profile.uid)
  const marathons = useMarathonsByIds(registrations.map((registration) => registration.marathonId))

  if (isLoading) return <p className="text-muted-foreground text-sm">Loading…</p>
  if (registrations.length === 0) {
    return <p className="text-muted-foreground text-sm">No bookings yet.</p>
  }

  return (
    <div className="flex max-h-[60vh] flex-col gap-2 overflow-y-auto">
      {registrations.map((registration, index) => (
        <details key={registration.id} open={index === 0} className="group rounded-lg border">
          <summary className="flex cursor-pointer list-none items-center gap-2 p-3">
            <ChevronRightIcon className="text-muted-foreground size-4 shrink-0 transition-transform group-open:rotate-90" />
            <span className="min-w-0 flex-1 truncate font-medium">
              {marathons[registration.marathonId]?.title ?? 'Unknown event'}
            </span>
            <StatusBadge
              status={registration.status}
              incomplete={!isBookingComplete(registration, marathons[registration.marathonId])}
            />
          </summary>
          <div className="flex flex-col gap-3 border-t p-4">
            <BookingTimeline
              registration={registration}
              marathon={marathons[registration.marathonId]}
              profile={profile}
            />
            <QuestionnaireLink registration={registration} marathon={marathons[registration.marathonId]} />
          </div>
        </details>
      ))}
    </div>
  )
}

function WaitlistTab({ profile }: { profile: UserProfile }) {
  const { marathons, isLoading } = usePublishedMarathons()
  const { registrations } = useUserRegistrations(profile.uid)
  const [selected, setSelected] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  // Same rule as bulkWaitlist: an active entry on the current cycle blocks re-adding; rejected/cancelled don't.
  const isListed = (marathon: Marathon) =>
    registrations.some(
      (registration) =>
        registration.marathonId === marathon.id &&
        (registration.cycle ?? 1) === (marathon.cycle ?? 1) &&
        !['rejected', 'cancelled'].includes(registration.status),
    )

  async function handleSubmit() {
    if (!profile.email) {
      toast.error('This user has no email on file.')
      return
    }
    setIsSubmitting(true)
    try {
      const { added, alreadyListed } = await bulkWaitlist([{ email: profile.email, marathonIds: selected }])
      toast.success(
        added > 0
          ? `${formatUserName(profile)} added to the waitlist and emailed.`
          : `Already listed (${alreadyListed}).`,
      )
      setSelected([])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Something went wrong')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) return <p className="text-muted-foreground text-sm">Loading…</p>
  if (marathons.length === 0) return <p className="text-muted-foreground text-sm">No open marathons.</p>

  return (
    <div className="flex flex-col gap-4">
      <div className="flex max-h-[50vh] flex-col gap-2 overflow-y-auto">
        {marathons.map((marathon) => {
          const listed = isListed(marathon)
          return (
            <label key={marathon.id} className="flex items-center gap-3 rounded-lg border p-3">
              <Checkbox
                checked={listed || selected.includes(marathon.id)}
                disabled={listed}
                onCheckedChange={(checked) =>
                  setSelected((ids) => (checked ? [...ids, marathon.id] : ids.filter((id) => id !== marathon.id)))
                }
              />
              <span className="min-w-0 flex-1 truncate font-medium">{marathon.title}</span>
              {listed && <Badge variant="secondary">Already listed</Badge>}
            </label>
          )
        })}
      </div>
      <DialogFooter>
        <Button onClick={handleSubmit} disabled={selected.length === 0} loading={isSubmitting}>
          Add to waitlist{selected.length > 0 ? ` (${selected.length})` : ''}
        </Button>
      </DialogFooter>
    </div>
  )
}

function ProfileTab({ profile, onSaved }: { profile: UserProfile; onSaved: () => void }) {
  const currentUid = useAuthStore((state) => state.firebaseUser?.uid)
  const actorProfile = useAuthStore((state) => state.profile)
  const [firstName, setFirstName] = useState(profile.firstName ?? '')
  const [middleName, setMiddleName] = useState(profile.middleName ?? '')
  const [lastName, setLastName] = useState(profile.lastName ?? '')
  const [contactNumber, setContactNumber] = useState(profile.contactNumber ?? '')
  const [dateOfBirth, setDateOfBirth] = useState(profile.dateOfBirth ?? '')
  const [gender, setGender] = useState<Gender | ''>(profile.gender ?? '')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSendingReset, setIsSendingReset] = useState(false)
  const [isUpdatingRole, setIsUpdatingRole] = useState(false)
  const isSelf = currentUid === profile.uid

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!gender) {
      toast.error('Please select a gender.')
      return
    }
    setIsSubmitting(true)
    try {
      await updateUserProfileAsAdmin(profile.uid, {
        firstName,
        middleName: middleName.trim() || undefined,
        lastName,
        contactNumber,
        dateOfBirth,
        gender: gender as Gender,
      })
      toast.success('User profile updated.')
      onSaved()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Something went wrong')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handlePasswordReset() {
    if (!profile.email) {
      toast.error('This user has no email on file.')
      return
    }
    setIsSendingReset(true)
    try {
      await requestPasswordReset(profile.email)
      toast.success(`Password reset email sent to ${profile.email}.`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Something went wrong')
    } finally {
      setIsSendingReset(false)
    }
  }

  async function handleRoleChange(nextRole: UserRole) {
    if (nextRole === profile.role) return
    if (!window.confirm(`Change ${formatUserName(profile)}'s role from "${profile.role}" to "${nextRole}"?`)) return

    setIsUpdatingRole(true)
    try {
      await updateUserRole(profile.uid, nextRole)
      if (currentUid) {
        await logAdminAction({
          actorId: currentUid,
          actorName: actorProfile?.displayName ?? null,
          actorEmail: actorProfile?.email ?? null,
          action: 'user_role_changed',
          targetType: 'user',
          targetId: profile.uid,
          targetLabel: formatUserName(profile),
          metadata: { from: profile.role, to: nextRole },
        })
      }
      toast.success(`${formatUserName(profile)}'s role is now "${nextRole}".`)
      onSaved()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Something went wrong')
    } finally {
      setIsUpdatingRole(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="admin-firstName">First name</Label>
          <Input id="admin-firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="admin-lastName">Last name</Label>
          <Input id="admin-lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="admin-middleName">Middle name (optional)</Label>
        <Input id="admin-middleName" value={middleName} onChange={(e) => setMiddleName(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="admin-contactNumber">Contact number</Label>
          <Input
            id="admin-contactNumber"
            type="tel"
            value={contactNumber}
            onChange={(e) => setContactNumber(e.target.value)}
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="admin-dateOfBirth">Date of birth</Label>
          <Input
            id="admin-dateOfBirth"
            type="date"
            value={dateOfBirth}
            onChange={(e) => setDateOfBirth(e.target.value)}
            required
          />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="admin-gender">Gender</Label>
        <Select value={gender} onValueChange={(value) => setGender(value as Gender)}>
          <SelectTrigger id="admin-gender">
            <SelectValue placeholder="Select…" />
          </SelectTrigger>
          <SelectContent>
            {GENDER_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-border pt-4">
        <div>
          <p className="text-sm font-medium">Password</p>
          <p className="text-muted-foreground text-xs">
            Sends a reset link to the user's email. Only works for email/password accounts.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!profile.firstName}
          loading={isSendingReset}
          onClick={handlePasswordReset}
        >
          Send reset email
        </Button>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-border pt-4">
        <div>
          <p className="text-sm font-medium">Role</p>
          <p className="text-muted-foreground text-xs">
            {isSelf
              ? "You can't change your own role."
              : ROLE_OPTIONS.find((option) => option.value === profile.role)?.description}
          </p>
        </div>
        <Select
          value={profile.role}
          onValueChange={(value) => handleRoleChange(value as UserRole)}
          disabled={isSelf || isUpdatingRole}
        >
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ROLE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DialogFooter>
        <Button type="submit" loading={isSubmitting}>
          Save changes
        </Button>
      </DialogFooter>
    </form>
  )
}

export function UserManagementDialog({ profile }: { profile: UserProfile }) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Manage
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Manage user</DialogTitle>
          <DialogDescription className="flex items-center gap-2">
            {profile.email ?? 'No email on file'}
            <Badge variant={ROLE_BADGE_VARIANT[profile.role]}>{profile.role}</Badge>
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="profile">
          <TabsList>
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="bookings">Bookings</TabsTrigger>
            <TabsTrigger value="waitlist">Waitlist</TabsTrigger>
          </TabsList>
          <TabsContent value="profile">
            <ProfileTab profile={profile} onSaved={() => setOpen(false)} />
          </TabsContent>
          <TabsContent value="bookings">
            <BookingsTab profile={profile} />
          </TabsContent>
          <TabsContent value="waitlist">
            <WaitlistTab profile={profile} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
