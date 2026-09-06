import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { confirmPasswordReset, verifyPasswordResetCode } from 'firebase/auth'
import { toast } from 'sonner'

import { LogoBadge } from '@/components/LogoBadge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PageSpinner } from '@/components/ui/spinner'
import { auth } from '@/firebase/config'
import { getFriendlyErrorMessage } from '@/lib/friendly-error'

type Status = 'verifying' | 'ready' | 'invalid' | 'success'

/**
 * Self-hosted handler for Firebase's password-reset email links, so the flow
 * stays on-brand instead of dropping registrants on Firebase's default hosted
 * page. Only takes effect once Firebase Console → Authentication → Templates
 * → Password reset → "customize action URL" is pointed at this route
 * (`/reset-password`) — see the production deployment notes in CLAUDE.md.
 * Until that's configured (and always on the local emulator, which ignores
 * that setting), reset links open the emulator/default Firebase page instead.
 */
export function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const oobCode = searchParams.get('oobCode')
  const navigate = useNavigate()

  const [status, setStatus] = useState<Status>('verifying')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!oobCode) {
      setStatus('invalid')
      return
    }
    verifyPasswordResetCode(auth, oobCode)
      .then((verifiedEmail) => {
        setEmail(verifiedEmail)
        setStatus('ready')
      })
      .catch(() => setStatus('invalid'))
  }, [oobCode])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!oobCode) return
    setIsSubmitting(true)
    try {
      await confirmPasswordReset(auth, oobCode, password)
      setStatus('success')
    } catch (error) {
      toast.error(getFriendlyErrorMessage(error, 'auth'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-[calc(100svh-8rem)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center">
          <LogoBadge />
        </div>
        <Card>
          <CardHeader className="items-center text-center">
            <span className="text-primary text-xs font-semibold tracking-[0.2em] uppercase">
              Reset Password
            </span>
            <CardDescription>
              {status === 'verifying' && 'Checking your reset link…'}
              {status === 'ready' && `Choose a new password for ${email}.`}
              {status === 'invalid' && 'This reset link is invalid or has expired. Please request a new one.'}
              {status === 'success' && 'Your password has been reset. You can now sign in.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {status === 'verifying' && <PageSpinner label="Verifying…" />}
            {status === 'invalid' && (
              <Button className="w-full" onClick={() => navigate('/sign-in')}>
                Back to sign in
              </Button>
            )}
            {status === 'success' && (
              <Button className="w-full" onClick={() => navigate('/sign-in')}>
                Continue to sign in
              </Button>
            )}
            {status === 'ready' && (
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="new-password">New password</Label>
                  <Input
                    id="new-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    minLength={6}
                    required
                    autoFocus
                  />
                </div>
                <Button type="submit" loading={isSubmitting} className="mt-2">
                  Reset password
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
