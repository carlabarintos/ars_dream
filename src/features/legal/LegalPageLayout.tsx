import type { ReactNode } from 'react'

export function LegalPageLayout({
  title,
  lastUpdated,
  showDraftNotice = true,
  children,
}: {
  title: string
  lastUpdated: string
  /** False once an admin has configured real content for this page (see Admin → Legal Pages) — the built-in default copy still shows this notice. */
  showDraftNotice?: boolean
  children: ReactNode
}) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-display text-3xl tracking-wide">{title}</h1>
      <p className="text-muted-foreground mt-1 text-sm">Last updated {lastUpdated}</p>

      {showDraftNotice && (
        <div className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
          <strong>Draft placeholder.</strong> This copy is a starting point, not final legal advice — have
          it reviewed by a lawyer, or configure real content from Admin → Legal Pages.
        </div>
      )}

      <div className="mt-8 flex flex-col gap-6 text-sm leading-relaxed [&_h2]:font-display [&_h2]:mt-6 [&_h2]:text-lg [&_h2]:tracking-wide [&_p]:text-muted-foreground [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:text-muted-foreground [&_li]:mt-1">
        {children}
      </div>
    </div>
  )
}
