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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { sendAdminPasswordReset, updateUserProfileAsAdmin, updateUserRole } from '@/features/auth/auth-actions'
import { useAuthStore } from '@/features/auth/auth-store'
import { formatUserName } from '@/features/auth/use-user-profiles'
import { useMarathonsByIds } from '@/features/marathons/use-marathons'
import { StatusBadge } from '@/features/registrations/StatusBadge'
import { useUserRegistrations } from '@/features/registrations/use-registrations'
import type { Gender, UserProfile } from '@/types'

const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
]

function BookingsTab({ userId }: { userId: string }) {
  const { registrations, isLoading } = useUserRegistrations(userId)
  const marathons = useMarathonsByIds(registrations.map((registration) => registration.marathonId))

  if (isLoading) return <p className="text-muted-foreground text-sm">Loading…</p>
  if (registrations.length === 0) {
    return <p className="text-muted-foreground text-sm">No bookings yet.</p>
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Marathon</TableHead>
          <TableHead>Package</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {registrations.map((registration) => (
          <TableRow key={registration.id}>
            <TableCell className="font-medium">
              {marathons[registration.marathonId]?.title ?? 'Unknown event'}
            </TableCell>
            <TableCell className="text-muted-foreground">{registration.packageName}</TableCell>
            <TableCell>
              <StatusBadge status={registration.status} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function ProfileTab({ profile, onSaved }: { profile: UserProfile; onSaved: () => void }) {
  const currentUid = useAuthStore((state) => state.firebaseUser?.uid)
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
      await sendAdminPasswordReset(profile.email)
      toast.success(`Password reset email sent to ${profile.email}.`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Something went wrong')
    } finally {
      setIsSendingReset(false)
    }
  }

  async function handleToggleRole() {
    const nextRole = profile.role === 'admin' ? 'user' : 'admin'
    const verb = nextRole === 'admin' ? 'grant admin access to' : 'revoke admin access from'
    if (!window.confirm(`Are you sure you want to ${verb} ${formatUserName(profile)}?`)) return

    setIsUpdatingRole(true)
    try {
      await updateUserRole(profile.uid, nextRole)
      toast.success(nextRole === 'admin' ? `${formatUserName(profile)} is now an admin.` : `${formatUserName(profile)} is no longer an admin.`)
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
          <p className="text-sm font-medium">Admin access</p>
          <p className="text-muted-foreground text-xs">
            {isSelf
              ? "You can't change your own admin access."
              : profile.role === 'admin'
                ? 'This user can manage marathons, registrations, and other users.'
                : 'Grant this user full admin access to the dashboard.'}
          </p>
        </div>
        <Button
          type="button"
          variant={profile.role === 'admin' ? 'destructive' : 'outline'}
          size="sm"
          disabled={isSelf}
          loading={isUpdatingRole}
          onClick={handleToggleRole}
        >
          {profile.role === 'admin' ? 'Revoke admin' : 'Make admin'}
        </Button>
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
            <Badge variant={profile.role === 'admin' ? 'success' : 'secondary'}>{profile.role}</Badge>
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="profile">
          <TabsList>
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="bookings">Bookings</TabsTrigger>
          </TabsList>
          <TabsContent value="profile">
            <ProfileTab profile={profile} onSaved={() => setOpen(false)} />
          </TabsContent>
          <TabsContent value="bookings">
            <BookingsTab userId={profile.uid} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
