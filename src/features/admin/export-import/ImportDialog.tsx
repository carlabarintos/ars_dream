import { useState, type ChangeEvent, type ReactNode } from 'react'
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
import { getAllUsersOnce } from '@/features/auth/api'
import { getAllMarathonsOnce } from '@/features/marathons/api'
import { getAllRegistrationsOnce } from '@/features/registrations/api'

import { parseCsv } from './csv'
import { applyRestorePlan, buildFullRestorePlan, buildQueueRestorePlan, type RestorePlan } from './restore-plan'
import type { MarathonRow, RegistrationRow, UserRow } from './serialize'

export type ImportScope =
  | { mode: 'full' }
  | { mode: 'queue'; marathonId: string; existingRegistrationIds: Set<string> }

type Step = 'pick' | 'preview' | 'done'

async function readZipCsv(zip: import('jszip'), filename: string): Promise<string> {
  const entry = zip.file(filename)
  if (!entry) throw new Error(`Backup .zip is missing ${filename}`)
  return entry.async('string')
}

async function buildPlanFromFullZip(file: File): Promise<{ plan: RestorePlan; parseErrors: string[] }> {
  const { default: JSZip } = await import('jszip')
  const zip = await JSZip.loadAsync(file)

  const [marathonsText, registrationsText, usersText] = await Promise.all([
    readZipCsv(zip, 'marathons.csv'),
    readZipCsv(zip, 'registrations.csv'),
    readZipCsv(zip, 'users.csv'),
  ])

  const marathonsParsed = parseCsv(marathonsText)
  const registrationsParsed = parseCsv(registrationsText)
  const usersParsed = parseCsv(usersText)

  const [existingMarathons, existingRegistrations, existingUsers] = await Promise.all([
    getAllMarathonsOnce(),
    getAllRegistrationsOnce(),
    getAllUsersOnce(),
  ])

  const plan = buildFullRestorePlan(
    {
      marathonRows: marathonsParsed.rows as unknown as MarathonRow[],
      registrationRows: registrationsParsed.rows as unknown as RegistrationRow[],
      userRows: usersParsed.rows as unknown as UserRow[],
    },
    new Set(existingMarathons.map((m) => m.id)),
    new Set(existingRegistrations.map((r) => r.id)),
    new Set(existingUsers.map((u) => u.uid)),
  )

  return {
    plan,
    parseErrors: [...marathonsParsed.errors, ...registrationsParsed.errors, ...usersParsed.errors],
  }
}

async function buildPlanFromQueueCsv(
  file: File,
  existingRegistrationIds: Set<string>,
): Promise<{ plan: RestorePlan; parseErrors: string[] }> {
  const text = await file.text()
  const parsed = parseCsv(text)
  const plan = buildQueueRestorePlan(parsed.rows as unknown as RegistrationRow[], existingRegistrationIds)
  return { plan, parseErrors: parsed.errors }
}

export function ImportDialog({ scope, trigger }: { scope: ImportScope; trigger?: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<Step>('pick')
  const [isBusy, setIsBusy] = useState(false)
  const [plan, setPlan] = useState<RestorePlan | null>(null)
  const [loadErrors, setLoadErrors] = useState<string[]>([])

  function reset() {
    setStep('pick')
    setPlan(null)
    setLoadErrors([])
  }

  async function handleFileSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setIsBusy(true)
    try {
      const { plan: builtPlan, parseErrors } =
        scope.mode === 'full'
          ? await buildPlanFromFullZip(file)
          : await buildPlanFromQueueCsv(file, scope.existingRegistrationIds)
      setPlan(builtPlan)
      setLoadErrors(parseErrors)
      setStep('preview')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not read that file.')
    } finally {
      setIsBusy(false)
    }
  }

  async function handleConfirm() {
    if (!plan) return
    setIsBusy(true)
    try {
      const result = await applyRestorePlan(plan)
      toast.success(
        `Restored ${result.marathonsWritten} marathon(s), ${result.registrationsWritten} registration(s), ${result.usersWritten} user(s).`,
      )
      setStep('done')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Restore failed partway through — check the data before retrying.')
    } finally {
      setIsBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) reset()
      }}
    >
      <DialogTrigger asChild>{trigger ?? <Button variant="outline">Import (Restore) Data</Button>}</DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Restore from backup</DialogTitle>
          <DialogDescription>
            {scope.mode === 'full'
              ? 'Select a previously-exported .zip backup. Nothing is written until you confirm.'
              : 'Select a previously-exported queue .csv for this marathon. Nothing is written until you confirm.'}
          </DialogDescription>
        </DialogHeader>

        {step === 'pick' && (
          <div className="flex flex-col gap-3">
            <input
              type="file"
              accept={scope.mode === 'full' ? '.zip' : '.csv'}
              disabled={isBusy}
              onChange={handleFileSelected}
              className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium"
            />
            {isBusy && <p className="text-muted-foreground text-sm">Reading file…</p>}
          </div>
        )}

        {step === 'preview' && plan && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-3 gap-2 text-sm">
              {scope.mode === 'full' && (
                <PlanCount
                  label="Marathons"
                  detail={`${plan.marathons.toCreate.length} new, ${plan.marathons.toUpdate.length} updated`}
                />
              )}
              <PlanCount
                label="Registrations"
                detail={`${plan.registrations.toUpdate.length} updated, ${plan.registrations.skippedMissing.length} skipped`}
              />
              {scope.mode === 'full' && (
                <PlanCount
                  label="Users"
                  detail={`${plan.users.toUpdate.length} updated, ${plan.users.skippedMissing.length} skipped`}
                />
              )}
            </div>

            {(loadErrors.length > 0 || plan.parseErrors.length > 0) && (
              <div className="rounded-md border border-warning/40 bg-warning/10 p-3 text-xs">
                <p className="mb-1 font-medium">Some rows couldn't be read and will be skipped:</p>
                <ul className="list-inside list-disc">
                  {[...loadErrors, ...plan.parseErrors].map((message, i) => (
                    <li key={i}>{message}</li>
                  ))}
                </ul>
              </div>
            )}

            {(plan.registrations.skippedMissing.length > 0 || plan.users.skippedMissing.length > 0) && (
              <div className="text-muted-foreground rounded-md border border-dashed border-border p-3 text-xs">
                Rows with no matching existing record can't be recreated (no client-side create path for
                admin-authored registrations, and Firebase Auth accounts can't be created this way) and will
                be skipped.
              </div>
            )}

            <div className="text-muted-foreground rounded-md border border-dashed border-border p-3 text-xs">
              Proof-of-payment links, push notification tokens, and Firebase Auth accounts are never
              restored. Marathon capacity counters are recalculated from live registration data, not
              restored verbatim.
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={reset} disabled={isBusy}>
                Choose a different file
              </Button>
              <Button onClick={handleConfirm} loading={isBusy}>
                Confirm Restore
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === 'done' && (
          <DialogFooter>
            <Button onClick={() => setOpen(false)}>Close</Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}

function PlanCount({ label, detail }: { label: string; detail: string }) {
  return (
    <div className="rounded-md border border-border p-2">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="text-xs font-medium">{detail}</p>
    </div>
  )
}
