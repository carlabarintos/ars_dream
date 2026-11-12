import { useState, type ReactNode } from 'react'
import { XIcon } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FileUploadButton } from '@/features/admin/FileUploadButton'
import type { Registration } from '@/types'

import { addExtraPassports, removeExtraPassport } from './api'
import { UploadedFileThumb } from './BookingDocumentDialog'

/** ID documents beyond each runner's own passport (2nd passport, residency card, certificates, companions' passports…). Shown once the deposit is approved. */
export function ExtraPassports({
  registration,
  editable,
  className = 'h-24',
  leading,
}: {
  registration: Registration
  editable: boolean
  className?: string
  /** Tiles shown first in the same row, e.g. the runner's own passport. */
  leading?: ReactNode
}) {
  const [name, setName] = useState('')
  const passports = registration.extraPassports ?? []
  if (!editable && !passports.length && !leading) return null

  return (
    <div className="flex flex-col gap-2">
      {(passports.length > 0 || leading) && (
        <div className="flex flex-wrap gap-3">
          {leading}
          {passports.map((passport) => (
            <div key={passport.url} className="flex flex-col gap-1.5">
              <UploadedFileThumb url={passport.url} label={passport.name} className={className} />
              {editable && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    try {
                      await removeExtraPassport(registration.id, passport)
                    } catch (error) {
                      toast.error(error instanceof Error ? error.message : 'Something went wrong')
                    }
                  }}
                >
                  <XIcon /> Remove
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
      {editable && (
        <div className="flex max-w-md gap-2">
          <Input
            placeholder="What is it? (e.g. residency card, 2nd passport, Maria's passport)"
            aria-label="Document description"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <FileUploadButton
            variant="outline"
            accept="image/*,application/pdf"
            multiple
            disabled={!name.trim()}
            onFiles={async (files) => {
              await addExtraPassports(registration.id, name.trim(), files)
              setName('')
              toast.success(files.length > 1 ? `${files.length} documents added.` : 'Document added.')
            }}
          >
            Add Other ID
          </FileUploadButton>
        </div>
      )}
    </div>
  )
}
