import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Gender } from '@/types'
import { updatePersonalInfo } from './auth-actions'
import { useAuthStore } from './auth-store'

const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
]

export function ProfilePage() {
  const profile = useAuthStore((state) => state.profile)
  const navigate = useNavigate()

  const [firstName, setFirstName] = useState(profile?.firstName ?? '')
  const [middleName, setMiddleName] = useState(profile?.middleName ?? '')
  const [lastName, setLastName] = useState(profile?.lastName ?? '')
  const [contactNumber, setContactNumber] = useState(profile?.contactNumber ?? '')
  const [dateOfBirth, setDateOfBirth] = useState(profile?.dateOfBirth ?? '')
  const [gender, setGender] = useState<Gender | ''>(profile?.gender ?? '')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!profile) return
    if (!gender) {
      toast.error('Please select a gender.')
      return
    }
    setIsSubmitting(true)
    try {
      await updatePersonalInfo(profile.uid, {
        firstName,
        middleName: middleName.trim() || undefined,
        lastName,
        contactNumber,
        dateOfBirth,
        gender: gender as Gender,
      })
      toast.success('Personal information updated')
      navigate(-1)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Something went wrong')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="mx-auto flex max-w-sm flex-col px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Personal information</CardTitle>
          <CardDescription>Keep your details up to date.</CardDescription>
        </CardHeader>
        <CardContent className="pb-5">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="firstName">First name</Label>
              <Input
                id="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="middleName">Middle name (optional)</Label>
              <Input id="middleName" value={middleName} onChange={(e) => setMiddleName(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="lastName">Last name</Label>
              <Input
                id="lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="contactNumber">Contact number</Label>
              <Input
                id="contactNumber"
                type="tel"
                value={contactNumber}
                onChange={(e) => setContactNumber(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="dateOfBirth">Date of birth</Label>
              <Input
                id="dateOfBirth"
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="gender">Gender</Label>
              <Select value={gender} onValueChange={(value) => setGender(value as Gender)}>
                <SelectTrigger id="gender">
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
            <div className="mt-2 flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => navigate(-1)}>
                Cancel
              </Button>
              <Button type="submit" loading={isSubmitting} className="flex-1">
                Save changes
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      <p className="text-muted-foreground mt-4 text-center text-xs">Version {__APP_VERSION__}</p>
    </div>
  )
}
