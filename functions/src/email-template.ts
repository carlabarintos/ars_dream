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

function escapeHtml(text: string): string {
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

export const ACCEPTED_COPY = {
  title: "You've got an offer!",
  body: 'Open ARS Dream to accept the terms and submit your proof of deposit payment.',
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
    offerAcceptanceDeadline?: Date
    depositDueDays?: number
  }
  /** The marathon's current package matching the registration's packageId, for its description and photo. */
  pkg?: {
    description?: string
    details?: { label: string; value: string }[]
    photoUrls?: string[]
    depositAmount?: number
  }
  /** Price/add-on snapshot from the registration, so the email shows what the registrant actually picked. */
  registration: {
    packageName: string
    packagePriceAmount: number
    packagePriceCurrency: string
    selectedAddOns?: { name: string; priceAmount: number }[]
  }
  offerImageUrl?: string
  /** The registrant's profile, for greeting them by name. */
  recipient?: { firstName?: string | null; displayName?: string | null }
}

/** The acceptance email, laid out like the marathon's package page in the app. Shared by onRegistrationStatusChange and the admin preview. */
export function buildAcceptanceEmail({
  marathon,
  pkg,
  registration,
  offerImageUrl,
  recipient,
}: AcceptanceEmailInput): {
  subject: string
  body: string
  html: string
} {
  const title = marathon?.title
  const currency = escapeHtml(registration.packagePriceCurrency)
  const addOns = registration.selectedAddOns ?? []
  const total = registration.packagePriceAmount + addOns.reduce((sum, addOn) => sum + addOn.priceAmount, 0)
  const description =
    pkg?.description ?? (pkg?.details ?? []).map((detail) => `${detail.label}: ${detail.value}`).join('\n')
  const descriptionLines = toBulletLines(description)
  const photoUrl = pkg?.photoUrls?.[0]
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
            <p style="margin: 0 0 4px; font-size: 10px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; color: ${MUTED};">🎟️ Your Package</p>
            <p style="margin: 0; font-size: 14px; font-weight: 600;">${escapeHtml(registration.packageName)}</p>
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
        ${lineItem(`Package: ${escapeHtml(registration.packageName)} (${currency} ${registration.packagePriceAmount.toLocaleString()})`)}
        ${addOns.length > 0 ? lineItem(`Add-ons: ${addOns.map((addOn) => escapeHtml(addOn.name)).join(', ')}`) : ''}
        ${addOns.length > 0 ? lineItem(`Total: ${currency} ${total.toLocaleString()}`, true) : ''}
        ${marathon?.offerAcceptanceDeadline ? lineItem(`Accept this offer by: ${formatDate(marathon.offerAcceptanceDeadline)}`, true) : ''}
        ${pkg?.depositAmount ? lineItem(`Deposit due: within ${depositDueDays} day${depositDueDays === 1 ? '' : 's'} of accepting this offer`, true) : ''}
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

  const packageCardHtml = `
    <div style="background: #ffffff; border: 2px solid ${PRIMARY}; border-radius: 16px; overflow: hidden; margin: 0 0 24px;">
      ${
        photoUrl
          ? `<img src="${escapeHtml(photoUrl)}" alt="" height="288" style="width: 100%; height: 288px; object-fit: cover; display: block;" />${ticketSeam}`
          : `<div style="height: 10px; background: linear-gradient(to right, ${PRIMARY}, ${NAVY}); background-color: ${PRIMARY};"></div>`
      }
      <div style="padding: 20px 20px 0;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
          <tr>
            <td style="font-family: ${DISPLAY}; font-size: 26px; line-height: 1; letter-spacing: 1px;">${escapeHtml(registration.packageName)}</td>
            <td style="text-align: right; vertical-align: top;">${pill('Your package', SECONDARY, FOREGROUND)}</td>
          </tr>
        </table>
        <p style="margin: 10px 0 0; font-family: ${DISPLAY}; font-size: 32px; line-height: 1.1; letter-spacing: 1px;">${currency} ${total.toLocaleString()}</p>
        ${addOns.length > 0 ? `<p style="margin: 2px 0 0; font-size: 12px; color: ${MUTED};">Base package ${currency} ${registration.packagePriceAmount.toLocaleString()}</p>` : ''}
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
                        `<tr><td style="padding: 0 0 6px; font-size: 14px;"><span style="color: ${PRIMARY}; font-weight: 700;">✓</span>&nbsp; ${escapeHtml(addOn.name)}</td><td style="padding: 0 0 6px; text-align: right; font-size: 12px; font-weight: 700; color: ${MUTED}; white-space: nowrap;">+${currency} ${addOn.priceAmount.toLocaleString()}</td></tr>`,
                    )
                    .join('')}
                </table>
              </div>`
            : ''
        }
      </div>
    </div>`

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
        <p style="margin: 4px 0; font-family: ${DISPLAY}; font-size: 32px; line-height: 1.1; letter-spacing: 1px;">Your Package</p>
        <p style="margin: 0 0 20px; font-size: 14px; color: ${MUTED};">Here's everything included in the package you picked.</p>

        ${inclusionsHtml}
        ${packageCardHtml}
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

export const INVOICE_COPY = {
  title: 'Your invoice is ready',
  body: 'Pay your deposit using the payment instructions, then upload your proof of payment in ARS Dream.',
}

export interface InvoiceEmailInput {
  marathon?: {
    title?: string
    paymentInstructions?: string
    /** Computed by the caller: offer acceptance time + `depositDueDays`. */
    depositDeadline?: Date
    balanceDeadline?: Date
  }
  /** The package's current deposit amount; absent/0 means the full amount is due by the balance deadline. */
  depositAmount?: number
  registration: AcceptanceEmailInput['registration']
  recipient?: AcceptanceEmailInput['recipient']
}

/** Sent once the registrant accepts their offer (status → terms_accepted): the price breakdown with deposit and balance due dates. */
export function buildInvoiceEmail({ marathon, depositAmount, registration, recipient }: InvoiceEmailInput): {
  subject: string
  body: string
  html: string
} {
  const title = marathon?.title
  const currency = escapeHtml(registration.packagePriceCurrency)
  const money = (amount: number) => `${currency} ${amount.toLocaleString()}`
  const addOns = registration.selectedAddOns ?? []
  const total = registration.packagePriceAmount + addOns.reduce((sum, addOn) => sum + addOn.priceAmount, 0)
  const deposit = Math.min(depositAmount ?? 0, total)
  const name = (recipient?.firstName || recipient?.displayName || '').trim()
  const body = (name ? `Hi ${name}, thanks` : 'Thanks') + ` for accepting your offer${title ? ` for the ${title} tour` : ''}. ` + INVOICE_COPY.body

  const row = (label: string, amount: string, strong = false) =>
    `<tr><td style="padding: 6px 0; font-size: 14px; ${strong ? 'font-weight: 700;' : `color: ${MUTED};`}">${label}</td><td style="padding: 6px 0; text-align: right; font-size: 14px; white-space: nowrap; ${strong ? 'font-weight: 700;' : ''}">${amount}</td></tr>`
  const dueRow = (label: string, date: Date | undefined, amount: number) =>
    row(`${label}${date ? ` <span style="font-weight: 400; color: ${MUTED};">· due ${formatDate(date)}</span>` : ''}`, money(amount), true)
  const instructions = toBulletLines(marathon?.paymentInstructions)

  const html = `
    <div style="background: ${PAGE_BG}; font-family: ${SANS}; color: ${FOREGROUND};">
      <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;600;700&display=swap" rel="stylesheet" />
      ${HEADER_HTML}
      <div style="max-width: 640px; margin: 0 auto; padding: 32px 16px;">
        <div style="background: #ffffff; border: 1px solid ${BORDER}; border-radius: 16px; padding: 20px; margin: 0 0 24px;">
          <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; margin: 0 0 12px;">
            <tr>
              <td style="font-family: ${DISPLAY}; font-size: 26px; line-height: 1; letter-spacing: 1px;">Invoice${title ? ` — ${escapeHtml(title)}` : ''}</td>
              <td style="text-align: right; vertical-align: top;">${pill('Invoiced', PRIMARY, '#ffffff')}</td>
            </tr>
          </table>
          <p style="margin: 0 0 16px; font-size: 14px; line-height: 1.5; color: ${MUTED};">${escapeHtml(body)}</p>
          <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
            ${row(`${escapeHtml(registration.packageName)} package`, money(registration.packagePriceAmount))}
            ${addOns.map((addOn) => row(`Add-on: ${escapeHtml(addOn.name)}`, money(addOn.priceAmount))).join('')}
            <tr><td colspan="2" style="border-top: 1px solid ${BORDER}; height: 0; line-height: 0;"></td></tr>
            ${row('Total', money(total), true)}
            ${deposit > 0 ? dueRow('Deposit', marathon?.depositDeadline, deposit) : ''}
            ${dueRow(deposit > 0 ? 'Remaining balance' : 'Amount due', marathon?.balanceDeadline, total - deposit)}
          </table>
        </div>
        ${instructions.length > 0 ? infoBox(eyebrow('Payment instructions') + bulletTable(instructions, '•', MUTED, FOREGROUND)) : ''}
        <a href="${APP_URL}/my-registrations" style="display: block; text-align: center; background: ${PRIMARY}; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 600; padding: 12px 20px; border-radius: 10px; margin: 0 0 24px;">Submit proof of payment</a>
        <p style="margin: 8px 0 0; text-align: center; font-size: 12px; color: ${MUTED};">
          ARS Dream Sports · <a href="${APP_URL}" style="color: ${MUTED};">arsdreamsports.com</a>
        </p>
      </div>
    </div>`

  return { subject: title ? `${INVOICE_COPY.title} — ${title}` : INVOICE_COPY.title, body, html }
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
