import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { LogoBadge } from '@/components/LogoBadge'
import { RouteLines } from '@/components/RouteLines'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { getFriendlyErrorMessage } from '@/lib/friendly-error'
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
      toast.error(getFriendlyErrorMessage(error, 'auth'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-primary via-brand-navy to-[#041d3d] px-10 lg:flex lg:flex-col lg:items-center lg:justify-center">
        <RouteLines className="pointer-events-none absolute inset-0 h-full w-full opacity-30" />
        <svg
          className="pointer-events-none absolute top-1/2 right-[-15%] h-[min(50vw,460px)] w-[min(50vw,460px)] -translate-y-1/2 opacity-60"
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

        <div className="relative flex max-w-md flex-col items-center text-center">
          <LogoBadge className="animate-fade-up-in mb-8" />
          <span
            className="animate-fade-up-in mb-4 inline-flex items-center gap-2 text-xs font-semibold tracking-[0.2em] text-white/70 uppercase before:h-px before:w-6 before:bg-white/70 after:h-px after:w-6 after:bg-white/70"
            style={{ animationDelay: '100ms' }}
          >
            Manila's Marathon Travel Specialists
          </span>
          <h1
            className="animate-fade-up-in font-display text-5xl leading-[0.95] tracking-wide text-white"
            style={{ animationDelay: '180ms' }}
          >
            Your next start line is waiting.
          </h1>
          <p
            className="animate-fade-up-in mt-6 text-white/80"
            style={{ animationDelay: '320ms' }}
          >
            Sign in to track your place in the queue, or create an account to start your tour
            package application.
          </p>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-6 flex justify-center lg:hidden">
            <LogoBadge className="animate-fade-up-in" />
          </div>

          <Card>
            <CardHeader className="items-center text-center">
              <span className="text-primary text-xs font-semibold tracking-[0.2em] uppercase">
                {mode === 'sign-in' ? 'Welcome Back' : 'Get Started'}
              </span>
              <CardDescription>
                {mode === 'sign-in'
                  ? 'Sign in to join the queue for your next race.'
                  : 'Create an account to get started.'}
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
                {mode === 'sign-up' && (
                  <p className="text-muted-foreground text-xs">
                    By creating an account, you agree to our{' '}
                    <Link to="/terms" className="text-primary hover:underline">
                      Terms of Service
                    </Link>{' '}
                    and{' '}
                    <Link to="/privacy" className="text-primary hover:underline">
                      Privacy Policy
                    </Link>
                    .
                  </p>
                )}
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
      </div>
    </div>
  )
}
