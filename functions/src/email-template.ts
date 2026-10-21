// Dependency-free on purpose: also imported by the admin app (OfferChatDialog) to
// preview the acceptance email, so the preview is the exact HTML that gets sent.

export const APP_URL = 'https://arsdreamsports.com'

// Light-theme tokens from src/index.css, flattened to hex (email clients don't support oklch/CSS variables).
const PRIMARY = '#1D67CD'
const NAVY = '#00509E'
const FOREGROUND = '#1e2230'
const MUTED = '#6a6f7c'
const BORDER = '#dfe3ec'
const SECONDARY = '#eef1f7'
const PAGE_BG = '#f6f8fc'
const SUCCESS = '#1f9d5c'
const SANS = "Inter, 'Segoe UI', Roboto, Arial, sans-serif"
// Bebas Neue renders where web fonts load (Apple Mail, iOS); elsewhere the condensed fallbacks keep the look.
const DISPLAY = "'Bebas Neue', 'Arial Narrow', Impact, sans-serif"
// PNG copy of the app header's ars-dream-logo-jp.avif — Outlook and many Gmail clients don't render AVIF.
const LOGO_URL = `${APP_URL}/ars-dream-logo-email.png`

/** The app header (Layout.tsx): white bar with a bottom border and the LogoBadge on the left. */
const HEADER_HTML = `
  <div style="background: #ffffff; border-bottom: 1px solid ${BORDER};">
    <div style="max-width: 640px; margin: 0 auto; padding: 12px 16px;">
      <a href="${APP_URL}" style="display: inline-block; background: #ffffff; border-radius: 12px; padding: 6px; box-shadow: 0 2px 6px rgba(0,0,0,0.12);">
        <img src="${LOGO_URL}" alt="ARS Dream Sports" height="32" style="display: block; height: 32px; width: auto;" />
      </a>
    </div>
  </div>`

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function toBulletLines(text: string | undefined): string[] {
  return (text ?? '').split('\n').map((line) => line.trim()).filter(Boolean)
}

const eyebrow = (text: string) =>
  `<p style="margin: 0 0 12px; font-size: 12px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; color: ${MUTED};">${text}</p>`

/** A "bg-secondary/40 rounded-xl border p-4" info box like the ones on the package page. */
const infoBox = (inner: string) =>
  `<div style="background: ${SECONDARY}; border: 1px solid ${BORDER}; border-radius: 16px; padding: 16px; margin: 0 0 24px;">${inner}</div>`

function bulletRows(lines: string[], bullet: string, color: string): string {
  return lines
    .map(
      (line) =>
        `<tr><td style="width: 20px; vertical-align: top; padding: 0 0 8px; color: ${color}; font-weight: 700; font-size: 14px;">${bullet}</td><td style="padding: 0 0 8px; font-size: 14px; line-height: 1.5;">${escapeHtml(line)}</td></tr>`,
    )
    .join('')
}

const bulletTable = (lines: string[], bullet: string, color: string, textColor = FOREGROUND) =>
  `<table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; color: ${textColor};">${bulletRows(lines, bullet, color)}</table>`

const pill = (text: string, background: string, color: string) =>
  `<span style="display: inline-block; background: ${background}; color: ${color}; font-size: 12px; font-weight: 600; padding: 3px 10px; border-radius: 999px; white-space: nowrap;">${text}</span>`

/** The die-cut perforation seam from TicketSeam.tsx: a dashed rule with a half-circle notch at each edge. */
const ticketSeam = `
  <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
    <tr>
      <td style="width: 9px; height: 18px; background: ${PAGE_BG}; border-radius: 0 9px 9px 0;"></td>
      <td style="padding: 0 13px;"><div style="border-top: 2px dashed ${BORDER}; height: 0; line-height: 0;"></div></td>
      <td style="width: 9px; height: 18px; background: ${PAGE_BG}; border-radius: 9px 0 0 9px;"></td>
    </tr>
  </table>`

export interface EmailContent {
  title: string
  body: string
  ctaLabel: string
  ctaUrl: string
}

const formatDate = (date: Date) =>
  date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila' })

const formatDateTime = (date: Date) =>
  date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Manila',
  })

const DAY_MS = 86_400_000

/** offeredAt + the marathon's acceptance window (default 1 day). Shared by onRegistrationStatusChange, the admin preview and the registrant's offer step. */
export function getOfferAcceptanceDeadline(offeredAt: Date, offerAcceptanceDays: number | undefined): Date {
  return new Date(offeredAt.getTime() + (offerAcceptanceDays ?? 1) * DAY_MS)
}

export const ACCEPTED_COPY = {
  title: "You've got an offer!",
  body: 'Open ARS Dream to choose your package, accept the terms and submit your proof of deposit payment.',
}

/** The bits of a marathon/package/registration the acceptance email shows — plain types so both the Admin SDK and the web SDK side can fill them in. */
export interface AcceptanceEmailInput {
  marathon?: {
    title?: string
    eventDate?: Date
    location?: string
    bannerImageUrl?: string
    sharedInclusions?: string
    packageNotes?: string
    hotelDetails?: string
    hotelImageUrl?: string
    /** Computed by the caller via getOfferAcceptanceDeadline. */
    offerAcceptanceDeadline?: Date
    depositDueDays?: number
  }
  /** The marathon packages offered (Registration.offeredPackageIds) — the registrant picks one when accepting. */
  packages: {
    name: string
    priceAmount: number
    priceCurrency: string
    depositAmount?: number
    description?: string
    details?: { label: string; value: string }[]
    photoUrls?: string[]
    addOns?: { name: string; priceAmount: number; mandatory?: boolean }[]
  }[]
  offerImageUrl?: string
  /** The registrant's profile, for greeting them by name. */
  recipient?: { firstName?: string | null; displayName?: string | null }
}

/** The acceptance email, laid out like the marathon's package page in the app. Shared by onRegistrationStatusChange and the admin preview. */
export function buildAcceptanceEmail({
  marathon,
  packages,
  offerImageUrl,
  recipient,
}: AcceptanceEmailInput): {
  subject: string
  body: string
  html: string
} {
  const title = marathon?.title
  const packageNames = packages.map((pkg) => escapeHtml(pkg.name)).join(', ')
  const sharedInclusions = toBulletLines(marathon?.sharedInclusions)
  const packageNotes = toBulletLines(marathon?.packageNotes)
  const eventDate = marathon?.eventDate && formatDate(marathon.eventDate)
  const depositDueDays = marathon?.depositDueDays ?? 1
  const hotelLines = toBulletLines(marathon?.hotelDetails)
  const hotelImageUrl = marathon?.hotelImageUrl
  const ctaUrl = `${APP_URL}/my-registrations`
  const name = (recipient?.firstName || recipient?.displayName || '').trim()
  const cardTitle = name ? `You've got an offer, ${escapeHtml(name)}!` : ACCEPTED_COPY.title
  const body =
    (name ? `Hi ${name}, we're` : "We're") +
    (title ? ` offering you a slot on the ${title} tour. ` : ' offering you a slot on this tour. ') +
    ACCEPTED_COPY.body

  const banner = marathon?.bannerImageUrl ? escapeHtml(marathon.bannerImageUrl) : ''
  const lineItem = (text: string, bold = false) =>
    `<p style="margin: 0 0 12px; font-size: 14px; line-height: 1.5; ${bold ? 'font-weight: 600;' : `color: ${MUTED};`}">${text}</p>`

  // The package page hero: banner with the title/location overlaid on a dark fade. The navy bgcolor is the
  // fallback where background images don't render (e.g. Outlook desktop), so the white text stays readable.
  const heroHtml = `
    <div style="border: 1px solid ${BORDER}; border-radius: 16px; overflow: hidden; background: #ffffff; margin: 0 0 24px;">
      <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
        <tr>
          <td bgcolor="#141a26" ${banner ? `background="${banner}"` : ''} style="height: 256px; vertical-align: bottom; padding: 0 20px 20px; background-color: #141a26; ${banner ? `background-image: linear-gradient(to top, rgba(0,0,0,0.85), rgba(0,0,0,0.3) 55%, rgba(0,0,0,0)), url('${banner}'); background-size: cover; background-position: center;` : ''}">
            ${title ? `<p style="margin: 0 0 6px; font-family: ${DISPLAY}; font-size: 48px; line-height: 1; letter-spacing: 1px; color: #ffffff;">${escapeHtml(title)}</p>` : ''}
            ${marathon?.location ? `<p style="margin: 0; font-size: 14px; color: rgba(255,255,255,0.85);">📍 ${escapeHtml(marathon.location)}</p>` : ''}
          </td>
        </tr>
      </table>
      <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; border-top: 1px solid ${BORDER};">
        <tr>
          <td style="width: 50%; padding: 16px; border-right: 1px solid ${BORDER}; vertical-align: top;">
            <p style="margin: 0 0 4px; font-size: 10px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; color: ${MUTED};">📅 Marathon Date</p>
            <p style="margin: 0; font-size: 14px; font-weight: 600;">${eventDate ? escapeHtml(eventDate) : '—'}</p>
          </td>
          <td style="width: 50%; padding: 16px; vertical-align: top;">
            <p style="margin: 0 0 4px; font-size: 10px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; color: ${MUTED};">🎟️ Packages Offered</p>
            <p style="margin: 0; font-size: 14px; font-weight: 600;">${packageNames || '—'}</p>
          </td>
        </tr>
      </table>
    </div>`

  // Mirrors the registration card on the package page ("You already have a registration for this event").
  const statusCardHtml = `
    <div style="background: #ffffff; border: 1px solid ${BORDER}; border-radius: 16px; margin: 0 0 32px;">
      <div style="padding: 20px 20px 4px;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; margin: 0 0 16px;">
          <tr>
            <td style="font-family: ${DISPLAY}; font-size: 26px; line-height: 1; letter-spacing: 1px;">${cardTitle}</td>
            <td style="text-align: right; vertical-align: top;">${pill('Offered', SUCCESS, '#ffffff')}</td>
          </tr>
        </table>
        ${lineItem(escapeHtml(body))}
        ${lineItem(`${packages.length === 1 ? 'Package' : 'Choose from'}: ${packageNames}`)}
        ${packages.some((pkg) => pkg.depositAmount) ? lineItem(`Deposit due within ${depositDueDays} day${depositDueDays === 1 ? '' : 's'} of accepting this offer`, true) : ''}
        ${marathon?.offerAcceptanceDeadline ? lineItem(`Accept this offer by: ${formatDateTime(marathon.offerAcceptanceDeadline)} (Manila time)`, true) : ''}
      </div>
      <div style="border-top: 1px solid ${BORDER}; padding: 16px 20px 20px;">
        <a href="${ctaUrl}" style="display: block; text-align: center; background: ${PRIMARY}; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 600; padding: 12px 20px; border-radius: 10px;">Accept Offer</a>
      </div>
    </div>`

  // Two columns, like the page's sm:grid-cols-2 inclusions list.
  const half = Math.ceil(sharedInclusions.length / 2)
  const inclusionsHtml =
    sharedInclusions.length > 0
      ? infoBox(
          eyebrow('Included in every package') +
            `<table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;"><tr>
              <td style="width: 50%; vertical-align: top; padding-right: 12px;">${bulletTable(sharedInclusions.slice(0, half), '✓', PRIMARY)}</td>
              <td style="width: 50%; vertical-align: top;">${bulletTable(sharedInclusions.slice(half), '✓', PRIMARY)}</td>
            </tr></table>`,
        )
      : ''

  const packageCardHtml = (pkg: AcceptanceEmailInput['packages'][number]) => {
    const currency = escapeHtml(pkg.priceCurrency)
    const descriptionLines = toBulletLines(
      pkg.description ?? (pkg.details ?? []).map((detail) => `${detail.label}: ${detail.value}`).join('\n'),
    )
    const photoUrl = pkg.photoUrls?.[0]
    const addOns = pkg.addOns ?? []
    return `
    <div style="background: #ffffff; border: 2px solid ${PRIMARY}; border-radius: 16px; overflow: hidden; margin: 0 0 24px;">
      ${
        photoUrl
          ? `<img src="${escapeHtml(photoUrl)}" alt="" height="288" style="width: 100%; height: 288px; object-fit: cover; display: block;" />${ticketSeam}`
          : `<div style="height: 10px; background: linear-gradient(to right, ${PRIMARY}, ${NAVY}); background-color: ${PRIMARY};"></div>`
      }
      <div style="padding: 20px 20px 0;">
        <p style="margin: 0; font-family: ${DISPLAY}; font-size: 26px; line-height: 1; letter-spacing: 1px;">${escapeHtml(pkg.name)}</p>
        <p style="margin: 10px 0 0; font-family: ${DISPLAY}; font-size: 32px; line-height: 1.1; letter-spacing: 1px;">${pkg.priceAmount ? `${currency} ${pkg.priceAmount.toLocaleString()}` : 'TBA'}</p>
        ${pkg.depositAmount ? `<p style="margin: 2px 0 0; font-size: 12px; color: ${MUTED};">Deposit ${currency} ${Math.min(pkg.depositAmount, pkg.priceAmount).toLocaleString()}</p>` : ''}
      </div>
      <div style="padding: 16px 20px 20px;">
        ${descriptionLines.length > 0 ? bulletTable(descriptionLines, '•', MUTED, MUTED) : ''}
        ${
          addOns.length > 0
            ? `<div style="background: ${SECONDARY}; border: 1px solid ${BORDER}; border-radius: 10px; padding: 12px; margin: 8px 0 0;">
                ${eyebrow('Add-ons')}
                <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
                  ${addOns
                    .map(
                      (addOn) =>
                        `<tr><td style="padding: 0 0 6px; font-size: 14px;">${escapeHtml(addOn.name)}${addOn.mandatory ? ' (required)' : ''}</td><td style="padding: 0 0 6px; font-size: 12px; text-align: right; color: ${MUTED};">+${currency} ${addOn.priceAmount.toLocaleString()}</td></tr>`,
                    )
                    .join('')}
                </table>
              </div>`
            : ''
        }
      </div>
    </div>`
  }

  const hotelHtml =
    hotelLines.length > 0 || hotelImageUrl
      ? infoBox(
          eyebrow('🏨 Hotel') +
            (hotelImageUrl
              ? `<img src="${escapeHtml(hotelImageUrl)}" alt="" style="width: 100%; border-radius: 10px; margin: 0 0 12px; display: block;" />`
              : '') +
            (hotelLines.length > 0 ? bulletTable(hotelLines, '•', MUTED, FOREGROUND) : ''),
        )
      : ''

  const html = `
    <div style="background: ${PAGE_BG}; font-family: ${SANS}; color: ${FOREGROUND};">
      <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;600;700&display=swap" rel="stylesheet" />
      ${HEADER_HTML}
      <div style="max-width: 640px; margin: 0 auto; padding: 32px 16px;">
        ${title ? `<p style="margin: 0 0 24px; font-size: 14px; color: ${MUTED};">Marathons &nbsp;›&nbsp; <span style="color: ${FOREGROUND};">${escapeHtml(title)}</span></p>` : ''}

        ${heroHtml}
        ${statusCardHtml}

        <p style="margin: 0; font-size: 12px; font-weight: 600; letter-spacing: 2.5px; text-transform: uppercase; color: ${PRIMARY};">Packages</p>
        <p style="margin: 4px 0; font-family: ${DISPLAY}; font-size: 32px; line-height: 1.1; letter-spacing: 1px;">${packages.length === 1 ? 'Your Package' : 'Your Options'}</p>
        <p style="margin: 0 0 20px; font-size: 14px; color: ${MUTED};">${packages.length === 1 ? "Here's everything included in the package we're offering you." : "Pick one of these packages (and any add-ons) when you accept your offer."}</p>

        ${inclusionsHtml}
        ${packages.map(packageCardHtml).join('')}
        ${packageNotes.length > 0 ? infoBox(eyebrow('Notes') + bulletTable(packageNotes, '•', MUTED, MUTED)) : ''}
        ${hotelHtml}
        ${offerImageUrl ? `<img src="${escapeHtml(offerImageUrl)}" alt="" style="width: 100%; border-radius: 16px; margin: 0 0 24px; display: block;" />` : ''}

        <p style="margin: 8px 0 0; text-align: center; font-size: 12px; color: ${MUTED};">
          ARS Dream Sports · <a href="${APP_URL}" style="color: ${MUTED};">arsdreamsports.com</a>
        </p>
      </div>
    </div>`

  return {
    subject: title ? `${ACCEPTED_COPY.title} — ${title}` : ACCEPTED_COPY.title,
    body,
    html,
  }
}

// Company letterhead and bank details from the office's invoice template (SPORTS SITE INVOICING.xlsx).
const COMPANY_NAME = 'ARS DREAM CORPORATION'
const COMPANY_LINES = [
  'Suite 1701 Metropolitan Tower, 1746 A. Mabini St. Malate, Manila, Philippines (1004)',
  'Phone: (632) 5235689',
  'Fax: (632) 5216958',
  'Email: kntct.manila@arsdream-ph.com / outbound@arsdream-ph.com',
]
const BANK_DETAILS = [
  ['ACCOUNT NAME', COMPANY_NAME],
  ['BANK NAME', 'BDO - USD ACCOUNT'],
  ['ACCT #', '111500005396'],
]
const INVOICE_NOTES = [
  'This document serves as a computation for the services offered.',
  'This document is not for tax purposes.',
  'Payments with tax included in the computation will be issued an official Sales Invoice as official document.',
  'This is not an official document, only an internal document for rate purposes.',
]

type Recipient = AcceptanceEmailInput['recipient'] & { lastName?: string | null }

interface ServiceDocument {
  /** "SERVICE INVOICE" / "ACKNOWLEDGEMENT RECEIPT" — rendered as 【HEADING】. */
  heading: string
  /** Invoice/receipt number. */
  number: string
  issuedAt: Date
  marathonTitle?: string
  eventDate?: Date
  runnerName: string
  currency: string
  /** Lines below the marathon row. */
  items: { label: string; amount: number }[]
  inclusions: string[]
  /** The totals block under the items, e.g. TOTAL / DEPOSIT AMOUNT DUE / PAYMENT DUE DATE. */
  summary: { label: string; value: string }[]
  /** Disclaimers or the receipt's acknowledgement, above the bank details. */
  notes: string[]
  intro: string
  ctaLabel: string
}

const docNumber = (prefix: string, registrationId: string) => `${prefix}-${registrationId.slice(0, 8).toUpperCase()}`

const runnerNameOf = (recipient: Recipient | undefined) =>
  [recipient?.firstName, recipient?.lastName].filter(Boolean).join(' ').trim() || recipient?.displayName?.trim() || ''

const moneyIn = (currency: string) => (amount: number) =>
  `${amount < 0 ? '(' : ''}${escapeHtml(currency)} ${Math.abs(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${amount < 0 ? ')' : ''}`

/** The office's invoice/receipt spreadsheet as an email: letterhead, 【HEADING】, item table, totals, notes and bank details. */
function serviceDocumentHtml(doc: ServiceDocument): string {
  const money = moneyIn(doc.currency)
  const cell = 'border: 1px solid #000000; padding: 6px 8px; font-size: 13px;'
  const head = `${cell} background: ${SECONDARY}; font-size: 11px; font-weight: 700; text-align: center;`
  const itemRow = (date: string, label: string, price: string, quantity: string, total: string, bold = false) =>
    `<tr><td style="${cell} text-align: center; white-space: nowrap;">${date}</td><td style="${cell} text-align: center; ${bold ? 'font-weight: 700;' : ''}">${label}</td><td style="${cell} text-align: right; white-space: nowrap;">${price}</td><td style="${cell} text-align: center;">${quantity}</td><td style="${cell} text-align: right; white-space: nowrap;">${total}</td></tr>`

  return `
    <div style="background: ${PAGE_BG}; font-family: ${SANS}; color: #000000;">
      <div style="max-width: 680px; margin: 0 auto; padding: 24px 12px;">
        <div style="background: #ffffff; border: 1px solid ${BORDER}; padding: 24px;">
          <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
            <tr>
              <td style="width: 120px; vertical-align: top;"><img src="${LOGO_URL}" alt="ARS Dream" width="110" style="display: block; width: 110px; height: auto;" /></td>
              <td style="vertical-align: top; text-align: right; font-size: 11px; line-height: 1.5; color: ${MUTED};">${COMPANY_LINES.map(escapeHtml).join('<br />')}</td>
            </tr>
          </table>
          <p style="margin: 24px 0; text-align: center; font-size: 26px; letter-spacing: 1px;">【${escapeHtml(doc.heading)}】</p>
          <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; margin: 0 0 16px;">
            <tr>
              <td style="vertical-align: bottom; font-size: 15px; font-weight: 700; line-height: 1.6;">
                ${doc.marathonTitle ? escapeHtml(doc.marathonTitle) : ''}<br />${escapeHtml(doc.runnerName)}
              </td>
              <td style="vertical-align: bottom; text-align: right; font-size: 13px; line-height: 1.6;">
                ${formatDate(doc.issuedAt)}<br /><span style="font-size: 11px; color: ${MUTED};">${doc.heading.includes('RECEIPT') ? 'RECEIPT' : 'INVOICE'} # ${escapeHtml(doc.number)}</span>
              </td>
            </tr>
          </table>
          <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; border-collapse: collapse;">
            <tr><td style="${head} width: 70px;">日付 (DATE)</td><td style="${head}">項目 (ITEM)</td><td style="${head} width: 110px;">金額 (PRICE)</td><td style="${head} width: 36px;">数 (QTY)</td><td style="${head} width: 120px;">合計 (TOTAL)</td></tr>
            ${doc.marathonTitle ? itemRow(doc.eventDate ? formatDate(doc.eventDate) : '', escapeHtml(doc.marathonTitle), '', '', '', true) : ''}
            ${doc.items.map((item) => itemRow('', escapeHtml(item.label), money(item.amount), '1', money(item.amount))).join('')}
            ${
              doc.inclusions.length > 0
                ? `<tr><td style="${cell}"></td><td colspan="4" style="${cell}"><p style="margin: 0 0 6px; font-size: 11px; font-weight: 700;">INCLUSIONS</p>${bulletTable(doc.inclusions, '•', '#000000', '#000000')}</td></tr>`
                : ''
            }
            ${doc.summary
              .map(
                (row) =>
                  `<tr><td colspan="2" style="${cell} text-align: right; font-weight: 700;">${escapeHtml(row.label)}</td><td colspan="3" style="${cell} text-align: center; font-weight: 700; white-space: nowrap;">${row.value}</td></tr>`,
              )
              .join('')}
          </table>
          <div style="margin: 16px 0; font-size: 12px; line-height: 1.6;">
            ${doc.notes.map((note, index) => `<p style="margin: 0;">${index === 0 ? '<b>Note:</b> ' : ''}${escapeHtml(note)}</p>`).join('')}
          </div>
          <p style="margin: 0 0 4px; font-size: 13px; font-weight: 700;">BANK DETAILS:</p>
          <table role="presentation" cellpadding="0" cellspacing="0" style="font-size: 12px; font-weight: 700; margin: 0 0 20px;">
            ${BANK_DETAILS.map(([label, value]) => `<tr><td style="padding: 1px 16px 1px 0;">${label}:</td><td>${value}</td></tr>`).join('')}
          </table>
          <p style="margin: 0; padding: 10px 0 0; border-top: 1px solid #000000; text-align: center; font-size: 15px; font-weight: 700;">${COMPANY_NAME}</p>
        </div>
        <!-- class="no-print": hidden when the registrant downloads the document from My Bookings (booking-documents.ts). -->
        <p class="no-print" style="margin: 20px 0 12px; font-size: 14px; line-height: 1.5; color: ${MUTED};">${escapeHtml(doc.intro)}</p>
        <a class="no-print" href="${APP_URL}/my-registrations" style="display: block; text-align: center; background: ${PRIMARY}; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 600; padding: 12px 20px; border-radius: 10px; margin: 0 0 24px;">${doc.ctaLabel}</a>
        <p class="no-print" style="margin: 8px 0 0; text-align: center; font-size: 12px; color: ${MUTED};">
          ARS Dream Sports · <a href="${APP_URL}" style="color: ${MUTED};">arsdreamsports.com</a>
        </p>
      </div>
    </div>`
}

/** Shared by every invoice/receipt email. */
interface ServiceDocumentContext {
  marathon?: { title?: string; eventDate?: Date }
  registrationId: string
  /** Shared inclusions plus the package description, one per line — the INCLUSIONS row. */
  inclusions?: string
  recipient?: Recipient
}

/** Package + add-ons from the registration's snapshot, as invoice lines. */
export function packageLineItems(registration: {
  packageName: string
  packagePriceAmount: number
  selectedAddOns?: { name: string; priceAmount: number }[]
}): { label: string; amount: number }[] {
  return [
    { label: registration.packageName, amount: registration.packagePriceAmount },
    ...(registration.selectedAddOns ?? []).map((addOn) => ({ label: `Add-on: ${addOn.name}`, amount: addOn.priceAmount })),
  ]
}

/** Final-invoice credits (isDeposit lines, e.g. "Deposit paid") become totals rows rather than items, like the spreadsheet's full-payment sheet. */
function splitFinalInvoice(items: { label: string; amount: number; isDeposit?: boolean }[], money: (amount: number) => string) {
  const charges = items.filter((item) => !item.isDeposit)
  return {
    charges,
    balance: items.reduce((sum, item) => sum + item.amount, 0),
    summary: [
      { label: 'TOTAL', value: money(charges.reduce((sum, item) => sum + item.amount, 0)) },
      ...items
        .filter((item) => item.isDeposit)
        .map((credit) => ({ label: credit.label.toUpperCase(), value: money(Math.abs(credit.amount)) })),
    ],
  }
}

export const INVOICE_COPY = {
  title: 'Your invoice is ready',
  body: 'Pay your deposit to the bank account on the invoice, then upload your proof of payment in ARS Dream.',
}

export interface InvoiceEmailInput extends ServiceDocumentContext {
  marathon?: ServiceDocumentContext['marathon'] & {
    /** Computed by the caller: offer acceptance time + `depositDueDays`. */
    depositDeadline?: Date
    balanceDeadline?: Date
  }
  /** The package's current deposit amount; absent/0 means the full amount is due by the balance deadline. */
  depositAmount?: number
  /** Price/add-on snapshot from the registration, so the email shows what the registrant actually picked. */
  registration: Parameters<typeof packageLineItems>[0] & { packagePriceCurrency: string }
  issuedAt: Date
}

/** Sent once the registrant accepts their offer (status → terms_accepted): the deposit service invoice. */
export function buildInvoiceEmail({
  marathon,
  depositAmount,
  registration,
  registrationId,
  inclusions,
  issuedAt,
  recipient,
}: InvoiceEmailInput): { subject: string; body: string; html: string } {
  const title = marathon?.title
  const money = moneyIn(registration.packagePriceCurrency)
  const items = packageLineItems(registration)
  const total = items.reduce((sum, item) => sum + item.amount, 0)
  const deposit = Math.min(depositAmount ?? 0, total)
  const dueDate = deposit > 0 ? marathon?.depositDeadline : marathon?.balanceDeadline
  const runnerName = runnerNameOf(recipient)
  const body =
    (runnerName ? `Hi ${runnerName}, thanks` : 'Thanks') +
    ` for accepting your offer${title ? ` for the ${title} tour` : ''}. ` +
    INVOICE_COPY.body

  const html = serviceDocumentHtml({
    heading: 'SERVICE INVOICE',
    number: docNumber('INV', registrationId),
    issuedAt,
    marathonTitle: title,
    eventDate: marathon?.eventDate,
    runnerName,
    currency: registration.packagePriceCurrency,
    items,
    inclusions: toBulletLines(inclusions),
    summary: [
      { label: 'TOTAL', value: money(total) },
      { label: deposit > 0 ? 'DEPOSIT AMOUNT DUE' : 'AMOUNT DUE', value: money(deposit > 0 ? deposit : total) },
      ...(dueDate ? [{ label: 'PAYMENT DUE DATE', value: formatDate(dueDate) }] : []),
      ...(deposit > 0 && deposit < total && marathon?.balanceDeadline
        ? [{ label: `BALANCE ${money(total - deposit)} DUE DATE`, value: formatDate(marathon.balanceDeadline) }]
        : []),
    ],
    notes: INVOICE_NOTES,
    intro: body,
    ctaLabel: 'Submit proof of payment',
  })

  return { subject: title ? `${INVOICE_COPY.title} — ${title}` : INVOICE_COPY.title, body, html }
}

export const FINAL_INVOICE_COPY = {
  title: 'Your final invoice is ready',
  body: 'Review it, accept the terms & conditions, and upload your proof of payment for the balance in ARS Dream.',
}

export interface FinalInvoiceEmailInput extends ServiceDocumentContext {
  currency: string
  items: { label: string; amount: number; isDeposit?: boolean }[]
  dueDate?: Date
  issuedAt: Date
}

/** Sent when the admin issues the final invoice (status → final_invoiced): the full-payment service invoice. */
export function buildFinalInvoiceEmail({
  marathon,
  currency,
  items,
  dueDate,
  issuedAt,
  registrationId,
  inclusions,
  recipient,
}: FinalInvoiceEmailInput): { subject: string; body: string; html: string } {
  const title = marathon?.title
  const money = moneyIn(currency)
  const { charges, balance, summary } = splitFinalInvoice(items, money)
  const runnerName = runnerNameOf(recipient)
  const body =
    (runnerName ? `Hi ${runnerName}, your` : 'Your') +
    ` final invoice${title ? ` for the ${title} tour` : ''} is ready. ` +
    FINAL_INVOICE_COPY.body

  const html = serviceDocumentHtml({
    heading: 'SERVICE INVOICE',
    number: docNumber('FIN', registrationId),
    issuedAt,
    marathonTitle: title,
    eventDate: marathon?.eventDate,
    runnerName,
    currency,
    items: charges,
    inclusions: toBulletLines(inclusions),
    summary: [
      ...summary,
      { label: 'BALANCE DUE', value: money(balance) },
      ...(dueDate ? [{ label: 'FINAL PAYMENT DUE DATE', value: formatDate(dueDate) }] : []),
    ],
    notes: INVOICE_NOTES,
    intro: body,
    ctaLabel: 'View final invoice',
  })

  return { subject: title ? `${FINAL_INVOICE_COPY.title} — ${title}` : FINAL_INVOICE_COPY.title, body, html }
}

export const DEPOSIT_RECEIPT_COPY = {
  title: 'Deposit received',
  body: "Your deposit was verified and your slot is locked in. We'll go over add-ons with you in your booking's messages, then send your final invoice.",
}

export const BALANCE_RECEIPT_COPY = {
  title: "You're confirmed!",
  body: "Your final payment was verified — you're all set for race day.",
}

export type ReceiptEmailInput = ServiceDocumentContext & { currency: string; receivedAt: Date } & (
    | { kind: 'deposit'; amount: number; items: { label: string; amount: number }[] }
    /** The paid final invoice — its balance is the amount received. */
    | { kind: 'balance'; items: FinalInvoiceEmailInput['items'] }
  )

/** Sent for every approved payment (status → deposit_paid / confirmed): the acknowledgement receipt. */
export function buildReceiptEmail(input: ReceiptEmailInput): { subject: string; body: string; html: string } {
  const { marathon, currency, receivedAt, registrationId, inclusions, recipient } = input
  const title = marathon?.title
  const money = moneyIn(currency)
  const copy = input.kind === 'deposit' ? DEPOSIT_RECEIPT_COPY : BALANCE_RECEIPT_COPY
  const runnerName = runnerNameOf(recipient)
  const body = (runnerName ? `Hi ${runnerName}! ` : '') + copy.body
  const final = input.kind === 'balance' ? splitFinalInvoice(input.items, money) : undefined

  const html = serviceDocumentHtml({
    heading: 'ACKNOWLEDGEMENT RECEIPT',
    number: docNumber(input.kind === 'deposit' ? 'ARD' : 'ARF', registrationId),
    issuedAt: receivedAt,
    marathonTitle: title,
    eventDate: marathon?.eventDate,
    runnerName,
    currency,
    items: final?.charges ?? input.items,
    inclusions: toBulletLines(inclusions),
    summary:
      input.kind === 'deposit'
        ? [
            { label: 'DEPOSIT AMOUNT RECEIVED', value: money(input.amount) },
            { label: 'DATE DEPOSIT RECEIVED', value: formatDate(receivedAt) },
            { label: 'NOTE', value: 'DEPOSIT IS NON-REFUNDABLE' },
          ]
        : [
            ...final!.summary,
            { label: 'BALANCE PAYMENT RECEIVED', value: money(final!.balance) },
            { label: 'DATE PAYMENT RECEIVED', value: formatDate(receivedAt) },
          ],
    notes: [`This is to acknowledge the receipt of your ${input.kind === 'deposit' ? 'deposit' : 'full payment'}.`],
    intro: body,
    ctaLabel: 'View my booking',
  })

  return { subject: title ? `${copy.title} — ${title}` : copy.title, body, html }
}

/** Simple branded layout, reused for every other status-change email. */
export function renderEmailHtml({ title, body, ctaLabel, ctaUrl }: EmailContent): string {
  return `
    <div style="background: ${PAGE_BG}; font-family: ${SANS}; color: ${FOREGROUND};">
      ${HEADER_HTML}
      <div style="max-width: 640px; margin: 0 auto; padding: 32px 16px;">
        <div style="background: #ffffff; border: 1px solid ${BORDER}; border-radius: 16px; padding: 24px;">
          <h1 style="font-family: ${DISPLAY}; font-size: 28px; font-weight: normal; letter-spacing: 1px; margin: 0 0 12px;">${title}</h1>
          <p style="font-size: 14px; line-height: 1.6; margin: 0 0 20px; color: ${MUTED};">${body}</p>
          <a
            href="${ctaUrl}"
            style="display: inline-block; background: ${PRIMARY}; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 600; padding: 12px 20px; border-radius: 10px;"
          >${ctaLabel}</a>
        </div>
      </div>
    </div>
  `
}
