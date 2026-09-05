import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { RouteLines } from '@/components/RouteLines'
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
    <>
      <section className="relative overflow-hidden bg-gradient-to-br from-primary via-brand-navy to-[#041d3d] px-4 pt-14 pb-24 sm:pt-20 sm:pb-28">
        <RouteLines className="pointer-events-none absolute inset-0 h-full w-full opacity-30" />
        <svg
          className="pointer-events-none absolute top-1/2 right-[-8%] h-[min(52vw,420px)] w-[min(52vw,420px)] -translate-y-1/2 opacity-90 max-sm:top-auto max-sm:right-[-22%] max-sm:bottom-[-18%] max-sm:h-[70vw] max-sm:w-[70vw] max-sm:translate-y-0 max-sm:opacity-40"
          viewBox="0 0 300 300"
          aria-hidden="true"
        >
          <circle cx="150" cy="150" r="130" fill="none" stroke="#fff" strokeOpacity="0.5" strokeWidth="1.5" />
          <ellipse cx="150" cy="150" rx="52" ry="130" fill="none" stroke="#fff" strokeOpacity="0.5" strokeWidth="1.5" />
          <ellipse cx="150" cy="150" rx="95" ry="130" fill="none" stroke="#fff" strokeOpacity="0.5" strokeWidth="1.5" />
          <line x1="20" y1="150" x2="280" y2="150" stroke="#fff" strokeOpacity="0.5" strokeWidth="1.5" />
          <line x1="35" y1="95" x2="265" y2="95" stroke="#fff" strokeOpacity="0.5" strokeWidth="1.5" />
          <line x1="35" y1="205" x2="265" y2="205" stroke="#fff" strokeOpacity="0.5" strokeWidth="1.5" />
        </svg>

        <div className="relative mx-auto flex max-w-2xl flex-col items-center text-center">
          <span className="mb-4 inline-flex items-center gap-2 text-xs font-semibold tracking-[0.2em] text-white/70 uppercase before:h-px before:w-6 before:bg-white/70 after:h-px after:w-6 after:bg-white/70">
            Account
          </span>
          <h1 className="font-display max-w-[14ch] text-5xl leading-[0.95] tracking-wide text-white sm:text-6xl">
            Your Profile
          </h1>
          <p className="mt-5 max-w-[46ch] text-white/80">
            Keep your travel details accurate — we use this for tour paperwork and booking confirmations.
          </p>
        </div>
      </section>

      <div className="relative z-10 mx-auto -mt-10 flex max-w-sm flex-col px-4 pb-8 sm:-mt-12">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl">Personal information</CardTitle>
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
    </>
  )
}
