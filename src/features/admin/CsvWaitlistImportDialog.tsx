import { useState } from 'react'
import { toast } from 'sonner'

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
import { bulkWaitlist, type WaitlistImportRow } from '@/features/registrations/api'
import type { Marathon } from '@/types'

import { downloadTextFile, parseCsv, toCsv } from './export-import/csv'

const PROFILE_COLUMNS = ['firstName', 'middleName', 'lastName', 'contactNumber', 'dateOfBirth', 'gender'] as const
const TEMPLATE_COLUMNS = ['email', 'marathons', ...PROFILE_COLUMNS]

/** "First Name" / "first_name" / "FIRSTNAME" all match firstName. */
const normalizeHeader = (header: string) => header.toLowerCase().replace(/[^a-z]/g, '')

/** Sign-up's <input type="date"> needs YYYY-MM-DD; accept anything Date can parse (e.g. 3/15/1990). */
function toIsoDate(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function buildRows(text: string, marathons: Marathon[]): { rows: WaitlistImportRow[]; errors: string[] } {
  const parsed = parseCsv(text)
  const errors = [...parsed.errors]
  const byCode = new Map(marathons.filter((m) => m.code).map((m) => [m.code!.trim().toUpperCase(), m]))
  const rows: WaitlistImportRow[] = []

  parsed.rows.forEach((raw, index) => {
    const cell = (name: string) =>
      (Object.entries(raw).find(([header]) => normalizeHeader(header) === name.toLowerCase())?.[1] ?? '').trim()
    const rowLabel = `Row ${index + 2}`
    const email = cell('email')
    if (!email) {
      errors.push(`${rowLabel}: missing email`)
      return
    }

    const codes = cell('marathons').split(/[\s,;|]+/).filter(Boolean)
    if (codes.length === 0) errors.push(`${rowLabel}: no marathon codes`)
    const marathonIds: string[] = []
    for (const code of codes) {
      const marathon = byCode.get(code.toUpperCase())
      if (!marathon) errors.push(`${rowLabel}: unknown marathon code "${code}"`)
      else if (marathon.status !== 'published') errors.push(`${rowLabel}: "${marathon.title}" isn't published`)
      else marathonIds.push(marathon.id)
    }

    const profile: WaitlistImportRow['profile'] = {}
    for (const column of PROFILE_COLUMNS) {
      let value = cell(column)
      if (column === 'dateOfBirth') value = toIsoDate(value)
      if (column === 'gender') value = value.toLowerCase().replace(/\s+/g, '_')
      if (value) profile[column] = value
    }
    rows.push({ email, marathonIds, profile })
  })

  return { rows, errors }
}

/** Import a waitlist spanning several marathons from CSV: one row per person, `marathons` lists their codes. */
export function CsvWaitlistImportDialog({ marathons }: { marathons: Marathon[] }) {
  const [open, setOpen] = useState(false)
  const [parsed, setParsed] = useState<{ rows: WaitlistImportRow[]; errors: string[] } | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleFile(file: File | undefined) {
    setParsed(file ? buildRows(await file.text(), marathons) : null)
  }

  async function handleSubmit() {
    if (!parsed) return
    setIsSubmitting(true)
    try {
      const { added, invited, alreadyListed } = await bulkWaitlist(parsed.rows)
      toast.success(`Waitlisted ${added}, invited ${invited} to sign up, ${alreadyListed} already listed.`)
      setParsed(null)
      setOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Something went wrong')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setParsed(null)
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">Import Waitlist CSV</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import Waitlist CSV</DialogTitle>
          <DialogDescription>
            One row per person, in waitlist order. <code>email</code> and <code>marathons</code> (marathon codes,
            separated by <code>;</code>) are required; name, contact number, date of birth and gender are optional
            and prefill the sign-up form for people without an account. Everyone gets one email listing the
            marathons they've been waitlisted for.
          </DialogDescription>
        </DialogHeader>
        <Button
          variant="link"
          size="sm"
          className="self-start px-0"
          onClick={() =>
            downloadTextFile(
              'waitlist-template.csv',
              toCsv<Record<string, string>>(
                [{ email: 'runner@example.com', marathons: 'TOKYO-2027;BERLIN-2027', firstName: 'Juan', lastName: 'Dela Cruz' }],
                TEMPLATE_COLUMNS,
              ),
              'text/csv',
            )
          }
        >
          Download template
        </Button>
        <Input type="file" accept=".csv" onChange={(e) => void handleFile(e.target.files?.[0])} />
        {parsed && parsed.errors.length > 0 && (
          <ul className="text-destructive max-h-40 list-disc overflow-y-auto pl-5 text-sm">
            {parsed.errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        )}
        <DialogFooter>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !parsed || parsed.errors.length > 0 || parsed.rows.length === 0}
          >
            {isSubmitting ? 'Importing…' : `Import ${parsed?.rows.length ?? 0} ${parsed?.rows.length === 1 ? 'person' : 'people'}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
