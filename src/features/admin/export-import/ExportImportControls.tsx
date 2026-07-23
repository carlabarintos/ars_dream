import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'

import { exportFullDatabase } from './full-export'
import { ImportDialog } from './ImportDialog'

export function ExportImportControls() {
  const [isExporting, setIsExporting] = useState(false)

  async function handleExport() {
    setIsExporting(true)
    try {
      await exportFullDatabase()
      toast.success('Backup downloaded.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Export failed.')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="flex gap-2">
      <Button variant="outline" onClick={handleExport} disabled={isExporting}>
        {isExporting ? 'Exporting…' : 'Export All Data'}
      </Button>
      <ImportDialog scope={{ mode: 'full' }} />
    </div>
  )
}
