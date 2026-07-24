import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { Logo } from '@/components/Logo'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Gender } from '@/types'
import { signInWithEmail, signUpWithEmail } from './auth-actions'

const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
]

export function SignInPage() {
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in')
  const [firstName, setFirstName] = useState('')
  const [middleName, setMiddleName] = useState('')
  const [lastName, setLastName] = useState('')
  const [contactNumber, setContactNumber] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [gender, setGender] = useState<Gender | ''>('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (mode === 'sign-up' && !gender) {
      toast.error('Please select a gender.')
      return
    }
    setIsSubmitting(true)
    try {
      if (mode === 'sign-up') {
        await signUpWithEmail(
          {
            firstName,
            middleName: middleName.trim() || undefined,
            lastName,
            contactNumber,
            dateOfBirth,
            gender: gender as Gender,
          },
          email,
          password,
        )
      } else {
        await signInWithEmail(email, password)
      }
      navigate('/')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Something went wrong')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <Logo className="h-14 w-auto" />
          <CardDescription>
            {mode === 'sign-in' ? 'Sign in to join the queue for your next race.' : 'Create an account to get started.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {mode === 'sign-up' && (
              <>
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
                  <Input
                    id="middleName"
                    value={middleName}
                    onChange={(e) => setMiddleName(e.target.value)}
                  />
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
              </>
            )}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                required
              />
            </div>
            <Button type="submit" loading={isSubmitting} className="mt-2">
              {mode === 'sign-in' ? 'Sign in' : 'Create account'}
            </Button>
          </form>

          <p className="text-muted-foreground mt-4 text-center text-sm">
            {mode === 'sign-in' ? "Don't have an account? " : 'Already have an account? '}
            <button
              type="button"
              className="text-primary font-medium hover:underline"
              onClick={() => setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in')}
            >
              {mode === 'sign-in' ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
