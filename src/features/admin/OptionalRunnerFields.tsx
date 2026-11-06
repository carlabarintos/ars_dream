import { hasRepeatedEmail } from '@/features/registrations/registration-flow'
import { CompanionFields } from '@/features/registrations/RegistrationWizard'

type Row = { name: string; email: string }

/** Name + email for runners 2+ in an admin dialog. Rows may be left blank, for the lead or a later Link Runner to fill in. */
export function OptionalRunnerFields({
  count,
  rows,
  leadEmail,
  onChange,
}: {
  count: number
  rows: Row[]
  leadEmail: string | null | undefined
  onChange: (rows: Row[]) => void
}) {
  if (count === 0) return null
  return (
    <div className="flex flex-col gap-2">
      <p className="text-muted-foreground text-xs">Additional runners (optional, leave blank if not known yet)</p>
      {Array.from({ length: count }, (_, i) => (
        <CompanionFields
          key={i}
          runner={i + 1}
          value={rows[i]}
          leadEmail={leadEmail}
          hint={null}
          onChange={(field, value) => {
            const next = Array.from({ length: Math.max(rows.length, i + 1) }, (_, j) => rows[j] ?? { name: '', email: '' })
            next[i] = { ...next[i], [field]: value }
            onChange(next)
          }}
        />
      ))}
      {hasRepeatedEmail(rows.slice(0, count)) && (
        <p className="text-destructive text-xs" role="alert">
          Each runner needs their own email.
        </p>
      )}
    </div>
  )
}
