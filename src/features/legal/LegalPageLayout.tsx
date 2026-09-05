import type { ReactNode } from 'react'

export function LegalPageLayout({
  title,
  lastUpdated,
  children,
}: {
  title: string
  lastUpdated: string
  children: ReactNode
}) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-display text-3xl tracking-wide">{title}</h1>
      <p className="text-muted-foreground mt-1 text-sm">Last updated {lastUpdated}</p>

      <div className="mt-8 flex flex-col gap-6 text-sm leading-relaxed [&_h2]:font-display [&_h2]:mt-6 [&_h2]:text-lg [&_h2]:tracking-wide [&_p]:text-muted-foreground [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:text-muted-foreground [&_li]:mt-1">
        {children}
      </div>
    </div>
  )
}
