import {
  ArrowRightIcon,
  CheckCircle2Icon,
  ChevronDownIcon,
  ClipboardListIcon,
  CreditCardIcon,
  FileTextIcon,
  GlobeIcon,
  HeadphonesIcon,
  ShieldCheckIcon,
  TrophyIcon,
} from 'lucide-react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { BibCard } from '@/components/BibCard'
import { DestinationArt } from '@/components/DestinationArt'
import { LogoBadge } from '@/components/LogoBadge'
import { MedalIcon, type MedalCity } from '@/components/MedalIcon'
import { RouteLines } from '@/components/RouteLines'
import { Reveal } from './Reveal'
import { useParallax } from './use-parallax'

const DESTINATIONS: {
  n: string
  city: string
  medalCity: MedalCity
  country: string
  note: string
  landmark: string
}[] = [
  {
    n: '01',
    city: 'New York',
    medalCity: 'new-york',
    country: 'United States',
    note: 'Five boroughs, one finish line in Central Park.',
    landmark: 'Statue of Liberty',
  },
  {
    n: '02',
    city: 'Berlin',
    medalCity: 'berlin',
    country: 'Germany',
    note: 'Flat, fast streets built for a personal best.',
    landmark: 'Brandenburg Gate',
  },
  {
    n: '03',
    city: 'London',
    medalCity: 'london',
    country: 'United Kingdom',
    note: 'From Greenwich to The Mall.',
    landmark: 'Big Ben & red double-decker',
  },
  {
    n: '04',
    city: 'Tokyo',
    medalCity: 'tokyo',
    country: 'Japan',
    note: 'Neon-lit crowds all the way to Nihonbashi.',
    landmark: 'Mt. Fuji & Tokyo Tower',
  },
  {
    n: '05',
    city: 'Sydney',
    medalCity: 'sydney',
    country: 'Australia',
    note: 'Harbour views from the Bridge to the Opera House.',
    landmark: 'Opera House & Harbour Bridge',
  },
]

const STEPS = [
  {
    icon: ClipboardListIcon,
    title: 'Join the Queue',
    description: 'Apply for a tour package and hold your place in a transparent, first-come queue.',
  },
  {
    icon: CheckCircle2Icon,
    title: 'Get Accepted',
    description: 'Our team reviews applications and confirms your slot as capacity allows.',
  },
  {
    icon: FileTextIcon,
    title: 'Accept Terms',
    description: 'Review your tour terms and, if the event needs it, answer a short questionnaire.',
  },
  {
    icon: CreditCardIcon,
    title: 'Submit Payment',
    description: 'Send proof of payment for our team to verify against your package.',
  },
  {
    icon: TrophyIcon,
    title: 'Confirmed',
    description: "You're booked. We'll see you at the start line.",
  },
]

// Scattered around the final CTA, as if pinned to the wall behind "your next start line" —
// one finisher medal per major, each swaying on its own timer for an organic, non-synced feel.
const CTA_MEDALS: {
  city: MedalCity
  className: string
  rotate: string
  duration: string
  delay: string
}[] = [
  { city: 'new-york', className: 'top-2 left-[6%] w-16 sm:top-6 sm:w-20', rotate: '-8deg', duration: '5.2s', delay: '0s' },
  { city: 'berlin', className: 'top-0 right-[9%] w-14 sm:top-2 sm:w-16', rotate: '6deg', duration: '4.6s', delay: '-1.4s' },
  { city: 'tokyo', className: 'bottom-2 right-[5%] w-16 sm:bottom-6 sm:w-20', rotate: '7deg', duration: '5s', delay: '-0.6s' },
  { city: 'london', className: 'bottom-4 left-[11%] w-14 sm:bottom-10 sm:w-16', rotate: '-5deg', duration: '5.8s', delay: '-2.1s' },
  { city: 'sydney', className: 'top-1/2 left-[1%] w-12 -translate-y-1/2 sm:w-14', rotate: '-6deg', duration: '4.8s', delay: '-3s' },
]

const VALUE_PROPS = [
  {
    icon: ShieldCheckIcon,
    title: 'Vetted, Capacity-Managed Bookings',
    description: 'No overselling — every package tracks real capacity, so a confirmed seat is a guaranteed seat.',
  },
  {
    icon: HeadphonesIcon,
    title: 'Manila-Based Race Concierge',
    description: 'Real people reviewing your queue, payments, and questions — not a faceless booking engine.',
  },
  {
    icon: GlobeIcon,
    title: 'End-to-End Tour Logistics',
    description: 'From queue to confirmation, we manage the package details so you can focus on training.',
  },
]

export function LandingPage() {
  const year = new Date().getFullYear()
  const heroParallax = useParallax(0.15)
  const linesParallax = useParallax(0.06)

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary via-brand-navy to-[#041d3d] px-4 py-20 sm:py-28">
        <RouteLines
          className="pointer-events-none absolute inset-0 h-full w-full opacity-30"
          style={{ transform: `translateY(${linesParallax}px)` }}
        />
        <svg
          className="pointer-events-none absolute top-1/2 right-[-10%] h-[min(60vw,520px)] w-[min(60vw,520px)] -translate-y-1/2 opacity-70 max-lg:hidden"
          viewBox="0 0 300 300"
          aria-hidden="true"
          style={{ transform: `translateY(calc(-50% + ${heroParallax}px))` }}
        >
          <circle cx="150" cy="150" r="130" fill="none" stroke="#fff" strokeOpacity="0.5" strokeWidth="1.5" />
          <ellipse cx="150" cy="150" rx="52" ry="130" fill="none" stroke="#fff" strokeOpacity="0.5" strokeWidth="1.5" />
          <ellipse cx="150" cy="150" rx="95" ry="130" fill="none" stroke="#fff" strokeOpacity="0.5" strokeWidth="1.5" />
          <line x1="20" y1="150" x2="280" y2="150" stroke="#fff" strokeOpacity="0.5" strokeWidth="1.5" />
          <line x1="35" y1="95" x2="265" y2="95" stroke="#fff" strokeOpacity="0.5" strokeWidth="1.5" />
          <line x1="35" y1="205" x2="265" y2="205" stroke="#fff" strokeOpacity="0.5" strokeWidth="1.5" />
        </svg>

        <div
          className="animate-fade-up-in pointer-events-none absolute top-[58%] left-4 hidden xl:block 2xl:left-12"
          style={{ animationDelay: '700ms' }}
          aria-hidden="true"
        >
          <div className="animate-bib-float">
            <BibCard className="rotate-6 scale-90 opacity-90" />
          </div>
        </div>

        <div className="relative mx-auto flex max-w-5xl flex-col items-center text-center">
          <LogoBadge className="animate-fade-up-in mb-8 sm:p-5" imgClassName="h-12 w-auto sm:h-16" />

          <span
            className="animate-fade-up-in mb-4 inline-flex items-center gap-2 text-xs font-semibold tracking-[0.2em] text-white/70 uppercase before:h-px before:w-6 before:bg-white/70 after:h-px after:w-6 after:bg-white/70"
            style={{ animationDelay: '100ms' }}
          >
            Manila's Only Major Marathon Travel Specialists
          </span>
          <h1
            className="animate-fade-up-in font-display max-w-[16ch] text-6xl leading-[0.95] tracking-wide text-white sm:text-7xl md:text-8xl"
            style={{ animationDelay: '180ms' }}
          >
            Run the world's greatest marathons.
          </h1>
          <p
            className="animate-fade-up-in mt-6 max-w-[52ch] text-lg text-white/80"
            style={{ animationDelay: '320ms' }}
          >
            From Tokyo to New York, Berlin to Sydney — we handle your tour package for the World
            Marathon Majors, one carefully managed queue at a time.
          </p>

          <div
            className="animate-fade-up-in mt-9 flex flex-col gap-3 sm:flex-row"
            style={{ animationDelay: '440ms' }}
          >
            <Button size="lg" asChild className="text-base transition-transform hover:-translate-y-0.5">
              <Link to="/sign-in">
                Reserve Your Spot
                <ArrowRightIcon />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              asChild
              className="border-white/30 bg-white/5 text-base text-white transition-transform hover:-translate-y-0.5 hover:bg-white/10 hover:text-white"
            >
              <a href="#how-it-works">See How It Works</a>
            </Button>
          </div>

          <div
            className="animate-fade-up-in mt-10 flex justify-center xl:hidden"
            style={{ animationDelay: '600ms' }}
            aria-hidden="true"
          >
            <div className="animate-bib-float">
              <BibCard className="scale-90 opacity-90" />
            </div>
          </div>

          <div
            className="animate-fade-up-in mt-14 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-white/70"
            style={{ animationDelay: '540ms' }}
          >
            <span>5 World Marathon Majors</span>
            <span className="size-1 rounded-full bg-white/40" />
            <span>Queue-Based Fair Booking</span>
            <span className="size-1 rounded-full bg-white/40" />
            <span>Manila-Based Race Concierge</span>
          </div>

          <a
            href="#how-it-works"
            aria-label="Scroll to how it works"
            className="text-white/50 hover:text-white/80 mt-16 animate-bounce transition-colors motion-reduce:animate-none"
          >
            <ChevronDownIcon className="size-6" />
          </a>
        </div>
      </section>

      {/* Destinations */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:py-24">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="text-primary text-xs font-semibold tracking-[0.2em] uppercase">
            Where We Take You
          </span>
          <h2 className="font-display mt-3 text-4xl tracking-wide sm:text-5xl">
            Five majors. One passport.
          </h2>
          <p className="text-muted-foreground mt-4">
            Each tour package is built around one of the world's most iconic race weekends — we
            handle the logistics, you handle the miles.
          </p>
        </Reveal>

        <div className="mt-12 grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-5">
          {DESTINATIONS.map((destination, index) => (
            <Reveal key={destination.city} delay={index * 80}>
              <div className="border-border bg-card h-full overflow-hidden rounded-xl border transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
                <div className="relative aspect-[6/5] w-full overflow-hidden">
                  <DestinationArt
                    city={destination.medalCity}
                    className="scale-105 transition-transform duration-500 group-hover:scale-110"
                  />
                  <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-black/55 to-transparent" />
                  <span className="font-display absolute top-2 right-3 text-3xl text-white/25">
                    {destination.n}
                  </span>
                  <span className="absolute bottom-1.5 left-3 text-[9px] font-semibold tracking-wider text-white/85 uppercase">
                    {destination.landmark}
                  </span>
                </div>
                <div className="p-5">
                  <h3 className="font-display text-2xl tracking-wide">{destination.city}</h3>
                  <p className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
                    {destination.country}
                  </p>
                  <p className="text-muted-foreground mt-3 text-sm">{destination.note}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="bg-secondary/40 px-4 py-20 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <Reveal className="mx-auto max-w-2xl text-center">
            <span className="text-primary text-xs font-semibold tracking-[0.2em] uppercase">
              The Process
            </span>
            <h2 className="font-display mt-3 text-4xl tracking-wide sm:text-5xl">
              Booking, done right.
            </h2>
            <p className="text-muted-foreground mt-4">
              A real travel-agency process, not an instant checkout — every applicant is reviewed
              so we can guarantee your package.
            </p>
          </Reveal>

          <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-5">
            {STEPS.map((step, index) => (
              <Reveal key={step.title} delay={index * 100} className="flex flex-col items-center gap-3 text-center">
                <div className="relative transition-transform duration-300 hover:scale-105">
                  <span className="border-primary/20 bg-card text-primary flex size-14 items-center justify-center rounded-full border-2">
                    <step.icon className="size-6" />
                  </span>
                  <span className="bg-primary text-primary-foreground absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full text-[10px] font-bold">
                    {index + 1}
                  </span>
                </div>
                <h3 className="font-semibold">{step.title}</h3>
                <p className="text-muted-foreground text-sm">{step.description}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Value props */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:py-24">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="text-primary text-xs font-semibold tracking-[0.2em] uppercase">
            Why Travel With Us
          </span>
          <h2 className="font-display mt-3 text-4xl tracking-wide sm:text-5xl">
            Built for runners who fly to race.
          </h2>
        </Reveal>

        <div className="mt-12 grid grid-cols-1 gap-8 sm:grid-cols-3">
          {VALUE_PROPS.map((prop, index) => (
            <Reveal
              key={prop.title}
              delay={index * 120}
              className="flex flex-col items-center gap-3 text-center"
            >
              <span className="bg-primary/10 text-primary flex size-12 items-center justify-center rounded-full transition-transform duration-300 hover:scale-110">
                <prop.icon className="size-6" />
              </span>
              <h3 className="font-semibold">{prop.title}</h3>
              <p className="text-muted-foreground text-sm">{prop.description}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative overflow-hidden bg-gradient-to-br from-brand-navy to-[#041d3d] px-4 py-20 text-center sm:py-24">
        <RouteLines className="pointer-events-none absolute inset-0 h-full w-full opacity-20" />

        {CTA_MEDALS.map((medal, index) => (
          <div
            key={medal.city}
            className={`animate-fade-up-in pointer-events-none absolute hidden opacity-90 sm:block ${medal.className}`}
            style={{ animationDelay: `${index * 90}ms` }}
            aria-hidden="true"
          >
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

        <Reveal className="relative mx-auto max-w-2xl">
          <h2 className="font-display text-4xl tracking-wide text-white sm:text-5xl">
            Your next start line is waiting.
          </h2>
          <p className="mt-4 text-white/80">
            Create your account to see live availability and join the queue for our current
            tours.
          </p>
          <Button size="lg" asChild className="mt-8 text-base transition-transform hover:-translate-y-0.5">
            <Link to="/sign-in">
              Create Your Account
              <ArrowRightIcon />
            </Link>
          </Button>

          <div className="mt-10 flex justify-center gap-3 sm:hidden" aria-hidden="true">
            {CTA_MEDALS.map((medal, index) => (
              <MedalIcon
                key={medal.city}
                city={medal.city}
                className="animate-medal-sway w-11 opacity-90"
                style={{
                  ['--medal-rotate' as string]: medal.rotate,
                  animationDuration: medal.duration,
                  animationDelay: `${index * 90}ms`,
                }}
              />
            ))}
          </div>
        </Reveal>
      </section>

      {/* Footer */}
      <footer className="bg-foreground px-4 py-10">
        <div className="text-background mx-auto flex max-w-6xl flex-col items-center gap-4 sm:flex-row sm:justify-between">
          <LogoBadge className="p-2" imgClassName="h-8 w-auto" />
          <p className="text-background/60 text-sm">
            © {year} ARS Dream Sports · Manila, Philippines
          </p>
          <Button variant="secondary" size="sm" asChild>
            <Link to="/sign-in">Sign In</Link>
          </Button>
        </div>
      </footer>
    </>
  )
}
