import {
  ArrowRightIcon,
  CheckCircle2Icon,
  ClipboardListIcon,
  CreditCardIcon,
  FileTextIcon,
  GlobeIcon,
  HeadphonesIcon,
  TrophyIcon,
} from 'lucide-react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { DestinationArt } from '@/components/DestinationArt'
import { LogoBadge } from '@/components/LogoBadge'
import { MedalOrbit } from '@/components/MedalOrbit'
import { MedalIcon, type MedalCity } from '@/components/MedalIcon'
import { RouteLines } from '@/components/RouteLines'
import { FlowRibbon } from './FlowRibbon'

const DESTINATIONS: { city: string; medalCity: MedalCity; country: string; note: string }[] = [
  { city: 'New York', medalCity: 'new-york', country: 'United States', note: 'Five boroughs, one finish line in Central Park.' },
  { city: 'Berlin', medalCity: 'berlin', country: 'Germany', note: 'Flat, fast streets built for a personal best.' },
  { city: 'London', medalCity: 'london', country: 'United Kingdom', note: 'From Greenwich to The Mall.' },
  { city: 'Tokyo', medalCity: 'tokyo', country: 'Japan', note: 'Neon-lit crowds all the way to Nihonbashi.' },
  { city: 'Sydney', medalCity: 'sydney', country: 'Australia', note: 'Harbour views from the Bridge to the Opera House.' },
]

const STEPS = [
  { icon: ClipboardListIcon, title: 'Join the Queue', description: 'Apply for a tour package and hold your place in a transparent, first-come queue.' },
  { icon: CheckCircle2Icon, title: 'Get Accepted', description: 'Our team reviews applications and confirms your slot as capacity allows.' },
  { icon: FileTextIcon, title: 'Accept Terms', description: 'Review your tour terms and, if the event needs it, answer a short questionnaire.' },
  { icon: CreditCardIcon, title: 'Submit Payment', description: 'Send proof of payment for our team to verify against your package.' },
  { icon: TrophyIcon, title: 'Confirmed', description: "You're booked. We'll see you at the start line." },
]

const HEADLINE = ["Run", "the", "world's", 'greatest', 'marathons.']

// Medals swaying around the final CTA, each on its own timer for an organic, non-synced feel.
const CTA_MEDALS: { city: MedalCity; className: string; rotate: string; duration: string; delay: string }[] = [
  { city: 'new-york', className: 'top-6 left-[6%] w-20', rotate: '-8deg', duration: '5.2s', delay: '0s' },
  { city: 'berlin', className: 'top-2 right-[9%] w-16', rotate: '6deg', duration: '4.6s', delay: '-1.4s' },
  { city: 'tokyo', className: 'bottom-6 right-[5%] w-20', rotate: '7deg', duration: '5s', delay: '-0.6s' },
  { city: 'london', className: 'bottom-10 left-[11%] w-16', rotate: '-5deg', duration: '5.8s', delay: '-2.1s' },
  { city: 'sydney', className: 'top-1/2 left-[1%] w-14 -translate-y-1/2', rotate: '-6deg', duration: '4.8s', delay: '-3s' },
]

function ReserveButton({ className = '' }: { className?: string }) {
  return (
    <Button size="lg" asChild className={`group text-base transition-transform hover:-translate-y-0.5 active:scale-[0.98] ${className}`}>
      <Link to="/sign-in">
        Reserve Your Spot
        <ArrowRightIcon className="transition-transform group-hover:translate-x-1" />
      </Link>
    </Button>
  )
}

export function LandingPage() {
  const year = new Date().getFullYear()

  return (
    // The milky way (FlowRibbon, z-1) sits above section backgrounds but below their content:
    // every non-decorative section child is z-2.
    <div className="bg-background text-foreground relative [&>*>*:not(.absolute,.sd-pan-sticky)]:relative [&>*>*]:z-[2]">
      <FlowRibbon />

      {/* Hero */}
      <section className="relative flex min-h-[100dvh] items-center overflow-hidden bg-gradient-to-br from-primary via-brand-navy to-[#041d3d] px-4 py-16 lg:py-20">
        <RouteLines className="animate-route-drift pointer-events-none absolute inset-0 h-full w-full opacity-25" />

        <div className="sd-hero-exit mx-auto grid w-full max-w-7xl items-center gap-12 lg:grid-cols-[1.15fr_1fr]">
          <div>
            <span
              className="animate-fade-up-in text-xs font-semibold tracking-[0.2em] text-white/70 uppercase"
              style={{ animationDelay: '60ms' }}
            >
              The Philippines' only World Marathon Majors travel specialist
            </span>
            <h1 className="font-display mt-5 text-6xl leading-[0.92] tracking-wide text-white sm:text-7xl lg:text-[5.5rem]">
              {HEADLINE.map((word, i) => (
                <span key={word} className="inline-block overflow-hidden pr-[0.22em] align-bottom">
                  <span className="kinetic-word" style={{ ['--i' as string]: i }}>
                    {word}
                  </span>
                </span>
              ))}
            </h1>
            <p className="animate-fade-up-in mt-6 max-w-[46ch] text-lg text-white/80" style={{ animationDelay: '520ms' }}>
              Tour packages for the World Marathon Majors, booked through a fair queue and handled
              end to end for Filipino runners.
            </p>
            <div className="animate-fade-up-in mt-9 flex flex-col gap-3 sm:flex-row" style={{ animationDelay: '640ms' }}>
              <ReserveButton />
              <Button
                size="lg"
                variant="outline"
                asChild
                className="border-white/30 bg-white/5 text-base text-white transition-transform hover:-translate-y-0.5 hover:bg-white/10 hover:text-white active:scale-[0.98]"
              >
                <a href="#how-it-works">See How It Works</a>
              </Button>
            </div>
          </div>

          <div className="animate-fade-up-in" style={{ animationDelay: '300ms' }}>
            <MedalOrbit />
          </div>
        </div>
      </section>

      {/* City marquee */}
      <section className="overflow-hidden border-y border-border py-6" aria-hidden="true">
        <div className="animate-marquee flex w-max hover:[animation-play-state:paused]">
          {[0, 1].map((copy) => (
            <div key={copy} className="flex shrink-0 items-center">
              {DESTINATIONS.map((d, i) => (
                <span
                  key={d.city}
                  className={`font-display px-8 text-6xl tracking-wide sm:text-8xl ${
                    i % 2 ? 'text-outline' : 'text-foreground'
                  }`}
                >
                  {d.city}
                </span>
              ))}
            </div>
          ))}
        </div>
      </section>

      {/* Destinations: vertical scroll pans the postcards sideways */}
      <section className="sd-pan">
        <div className="sd-pan-sticky flex flex-col justify-center py-20">
          <div className="mx-auto w-full max-w-7xl px-4">
            <h2 className="font-display text-5xl tracking-wide sm:text-6xl">Five majors. One passport.</h2>
            <p className="text-muted-foreground mt-3 max-w-[52ch]">
              Each package is built around one of the world's most iconic race weekends. We handle
              the logistics, you handle the miles.
            </p>
          </div>
          <div className="sd-pan-viewport mt-10">
            <div className="sd-pan-track flex w-max gap-5 px-4 lg:px-[max(1rem,calc((100vw_-_80rem)/2_+_1rem))]">
              {DESTINATIONS.map((d) => (
                <article
                  key={d.city}
                  className="group border-border bg-card w-[78vw] shrink-0 snap-start overflow-hidden rounded-2xl border transition-transform duration-500 hover:-translate-y-1.5 sm:w-[46vw] lg:w-[30vw]"
                >
                  <div className="aspect-[4/3] overflow-hidden">
                    <DestinationArt
                      city={d.medalCity}
                      className="h-full w-full scale-105 transition-transform duration-700 group-hover:scale-115"
                    />
                  </div>
                  <div className="flex items-end justify-between gap-4 p-6">
                    <div>
                      <h3 className="font-display text-4xl tracking-wide">{d.city}</h3>
                      <p className="text-muted-foreground mt-1 text-sm">{d.note}</p>
                    </div>
                    <span className="text-muted-foreground shrink-0 text-xs">{d.country}</span>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Process: pinned headline, steps on a line that fills as you scroll */}
      <section id="how-it-works" className="scroll-mt-16 px-4 py-24 sm:py-32">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[1fr_1.2fr]">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <h2 className="font-display text-5xl tracking-wide sm:text-7xl">Booking, done right.</h2>
            <p className="text-muted-foreground mt-4 max-w-[44ch]">
              A real travel-agency process, not an instant checkout. Every applicant is reviewed so
              a confirmed seat is a guaranteed seat.
            </p>
          </div>

          <ol className="sd-steps relative">
            <span className="bg-border absolute top-2 bottom-2 left-6 w-px" />
            <span className="sd-fill bg-primary absolute top-2 bottom-2 left-6 w-px origin-top" />
            {STEPS.map((step) => (
              <li key={step.title} className="sd-reveal relative flex gap-6 pb-14 last:pb-0">
                <span className="border-primary/40 bg-card text-primary relative flex size-12 shrink-0 items-center justify-center rounded-full border-2">
                  <step.icon className="size-5" />
                </span>
                <div className="pt-1.5">
                  <h3 className="font-display text-3xl tracking-wide">{step.title}</h3>
                  <p className="text-muted-foreground mt-1 max-w-[46ch]">{step.description}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Why us: asymmetric bento */}
      <section className="mx-auto max-w-7xl px-4 pb-24 sm:pb-32">
        <h2 className="font-display sd-reveal text-5xl tracking-wide sm:text-6xl">Built for runners who fly to race.</h2>
        <div className="mt-10 grid gap-5 md:grid-cols-3 md:grid-rows-2">
          <div className="sd-reveal relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-brand-navy p-8 md:col-span-2 md:row-span-2 md:p-12">
            <RouteLines className="animate-route-drift pointer-events-none absolute inset-0 h-full w-full opacity-30" />
            <div className="relative flex h-full flex-col justify-end">
              <p className="font-display text-7xl leading-none tracking-wide text-white sm:text-9xl">Your seat, guaranteed.</p>
              <p className="mt-4 max-w-[44ch] text-white/85">
                Every package tracks real capacity. When we confirm your seat, it's yours.
              </p>
            </div>
          </div>
          <div className="sd-reveal border-border bg-card rounded-2xl border p-8">
            <HeadphonesIcon className="text-primary size-7" />
            <h3 className="font-display mt-6 text-3xl tracking-wide">Philippines-based concierge</h3>
            <p className="text-muted-foreground mt-2 text-sm">
              Real people review your queue, payments and questions. Not a faceless booking engine.
            </p>
          </div>
          <div className="sd-reveal group relative overflow-hidden rounded-2xl p-8">
            <DestinationArt
              city="tokyo"
              className="absolute inset-0 h-full w-full transition-transform duration-700 group-hover:scale-110"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/50 to-black/10" />
            <div className="relative">
              <GlobeIcon className="size-7 text-white" />
              <h3 className="font-display mt-6 text-3xl tracking-wide text-white">End-to-end logistics</h3>
              <p className="mt-2 text-sm text-white/85">
                From queue to confirmation, we manage the details so you can focus on training.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative overflow-hidden border-t border-border px-4 py-24 text-center sm:py-32">
        {CTA_MEDALS.map((medal) => (
          <div key={medal.city} className={`pointer-events-none absolute hidden opacity-90 md:block ${medal.className}`} aria-hidden="true">
            <MedalIcon
              city={medal.city}
              className="animate-medal-sway"
              style={{
                ['--medal-rotate' as string]: medal.rotate,
                animationDuration: medal.duration,
                animationDelay: medal.delay,
              }}
            />
          </div>
        ))}

        <div className="sd-reveal mx-auto max-w-3xl">
          <h2 className="font-display text-6xl leading-[0.95] tracking-wide sm:text-8xl">Your next start line is waiting.</h2>
          <p className="text-muted-foreground mx-auto mt-5 max-w-[48ch]">
            Create your account to see live availability and join the queue for our current tours.
          </p>
          <ReserveButton className="mt-9" />
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border px-4 py-10">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-4 sm:flex-row sm:justify-between">
          <LogoBadge className="p-2" imgClassName="h-8 w-auto" />
          <p className="text-muted-foreground text-sm">© {year} ARS Dream Sports · Manila, Philippines · v{__APP_VERSION__}</p>
          <Button variant="secondary" size="sm" asChild>
            <Link to="/sign-in">Sign In</Link>
          </Button>
        </div>
      </footer>
    </div>
  )
}
