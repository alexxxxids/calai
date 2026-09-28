import {
  CalendarDaysIcon,
  GaugeIcon,
  ShieldCheckIcon,
  SparklesIcon,
  TimerIcon,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

// What CalAI does (docs/spec.md §1–§2), in the words of a user, not of a programmer.
const FEATURES: readonly { icon: LucideIcon; title: string; text: string }[] = [
  {
    icon: CalendarDaysIcon,
    title: 'Sam układa plan',
    text: 'Zadania z terminem trafiają w wolne okienka między lekcjami i treningami. Najpierw to, co najpilniejsze.',
  },
  {
    icon: GaugeIcon,
    title: 'Pilnuje obciążenia',
    text: 'Dzienny limit punktów obciążenia i przerwa po dwóch godzinach ciężkiej pracy. Sześciu godzin nauki z rzędu nie zaplanuje.',
  },
  {
    icon: TimerIcon,
    title: 'Uczy się twojego tempa',
    text: 'Po bloku wpisujesz, ile naprawdę trwał. Kolejne bloki tej pracy same się wydłużają albo skracają.',
  },
  {
    icon: SparklesIcon,
    title: 'Asystent AI',
    text: 'Wgraj zdjęcie listy tematów albo PDF, a AI zaproponuje podział na bloki. Ty poprawiasz i zatwierdzasz.',
  },
];

const STEPS: readonly { title: string; text: string }[] = [
  {
    title: 'Opisz zadanie',
    text: 'Wybierz typ, termin i mniej więcej, ile to potrwa. Resztę możesz dopisać później.',
  },
  {
    title: 'CalAI układa plan',
    text: 'Bloki lądują w wolnych okienkach twojego dnia, z przerwami i w granicach limitu.',
  },
  {
    title: 'Zamknij blok',
    text: 'Zaznacz, czy się udało i ile to trwało. Plan na kolejne dni poprawi się sam.',
  },
];

export default function LandingPage() {
  return (
    <>
      <Hero />
      <Features />
      <HowItWorks />
      <Closing />
    </>
  );
}

function Hero() {
  return (
    <section className="mx-auto flex max-w-3xl flex-col items-center gap-6 px-4 py-16 text-center sm:py-24">
      <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
        Planer, który sam układa twój tydzień
      </h1>
      <p className="max-w-2xl text-lg text-pretty text-muted-foreground">
        Wpisz, co masz zrobić i na kiedy. CalAI rozłoży pracę w wolnych okienkach kalendarza, nie
        pozwoli ci się przeciążyć i z czasem nauczy się twojego tempa.
      </p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button asChild size="lg">
          <Link href="/register">Załóż konto</Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/login">Mam już konto</Link>
        </Button>
      </div>
    </section>
  );
}

function Features() {
  return (
    <section aria-labelledby="features-heading" className="border-y bg-muted/40">
      <div className="mx-auto max-w-5xl px-4 py-16">
        <h2 id="features-heading" className="text-center text-2xl font-semibold tracking-tight">
          Co potrafi CalAI
        </h2>
        <ul className="mt-10 grid gap-6 sm:grid-cols-2">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex gap-4 rounded-xl bg-card p-5 ring-1 ring-foreground/10">
              <Icon className="size-6 shrink-0 text-primary" aria-hidden="true" />
              <div className="flex flex-col gap-1">
                <h3 className="font-medium">{title}</h3>
                <p className="text-sm text-muted-foreground">{text}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section aria-labelledby="how-heading" className="mx-auto max-w-5xl px-4 py-16">
      <h2 id="how-heading" className="text-center text-2xl font-semibold tracking-tight">
        Jak to działa
      </h2>
      <ol className="mt-10 grid gap-6 sm:grid-cols-3">
        {STEPS.map(({ title, text }, index) => (
          <li key={title} className="flex flex-col gap-2">
            <span
              className="flex size-9 items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground"
              aria-hidden="true"
            >
              {index + 1}
            </span>
            <h3 className="font-medium">{title}</h3>
            <p className="text-sm text-muted-foreground">{text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Closing() {
  return (
    <section className="border-t bg-muted/40">
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 px-4 py-16 text-center">
        <ShieldCheckIcon className="size-8 text-primary" aria-hidden="true" />
        <h2 className="text-2xl font-semibold tracking-tight">Twoje dane zostają w Unii</h2>
        <p className="text-pretty text-muted-foreground">
          Baza danych stoi we Frankfurcie, a pliki wysłane do asystenta AI kasujemy zaraz po analizie.
          Szczegóły znajdziesz w{' '}
          <Link href="/privacy" className="underline underline-offset-4 hover:text-foreground">
            polityce prywatności
          </Link>
          .
        </p>
        <Button asChild size="lg">
          <Link href="/register">Zacznij planować</Link>
        </Button>
      </div>
    </section>
  );
}
