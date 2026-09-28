import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Polityka prywatności',
};

interface PolicySection {
  title: string;
  paragraphs?: readonly string[];
  items?: readonly string[];
}

// RODO information (spec NFR-04, docs/decisions.md ADR-008, ADR-017). Every service named here
// really receives data; when a new one appears in docs/architecture.md, it must appear here too.
const SECTIONS: readonly PolicySection[] = [
  {
    title: 'Kto odpowiada za twoje dane',
    paragraphs: [
      'CalAI to szkolny projekt z informatyki. Administratorami twoich danych są autorzy projektu szkolnego CalAI. Aplikacja nie jest usługą komercyjną: nie sprzedajemy danych, nie wyświetlamy reklam i nie korzystamy z narzędzi analitycznych.',
      'W sprawach swoich danych skontaktuj się z autorami projektu szkolnego CalAI.',
    ],
  },
  {
    title: 'Jakie dane zbieramy',
    items: [
      'Konto: adres e-mail, hasło (zapisane tylko jako skrót, którego nie da się odwrócić) i moment potwierdzenia, że masz ukończone 18 lat.',
      'Profil: imię, strefa czasowa, godziny dnia, w których planujemy, poziom refleksji i dzienny limit obciążenia.',
      'Planowanie: typy zadań, zadania, bloki w kalendarzu, wydarzenia cykliczne, nawyki i ich odhaczenia.',
      'Refleksja: odpowiedzi z cotygodniowej ankiety i comiesięcznego podsumowania.',
      'Asystent AI: pliki i opisy, które sam wyślesz do analizy, oraz dziennik zapytań (rodzaj, czas i liczba tokenów, bez treści), potrzebny do dziennego limitu.',
      'Integracje, jeśli z nich skorzystasz: subskrypcja powiadomień (techniczny adres przeglądarki), prywatny link do kalendarza iCal i adresy kalendarzy, które zaimportujesz.',
    ],
  },
  {
    title: 'Po co je przetwarzamy',
    items: [
      'Żeby działało planowanie: układanie bloków, pilnowanie limitu obciążenia i dopasowanie planu do twojego tempa.',
      'Żeby cię zalogować i wysłać kod potwierdzający albo kod do zmiany hasła.',
      'Żeby asystent AI mógł przygotować propozycję podziału zadania albo planu lekcji.',
    ],
    paragraphs: [
      'Podstawą jest umowa o korzystanie z aplikacji, którą zawierasz, zakładając konto (art. 6 ust. 1 lit. b RODO).',
    ],
  },
  {
    title: 'Gdzie są twoje dane i kto je widzi',
    items: [
      'Supabase: baza danych, logowanie i tymczasowe pliki. Serwery w Unii Europejskiej, we Frankfurcie nad Menem.',
      'Vercel: serwery, na których działa aplikacja. Kod obsługujący twoje żądania działa we Frankfurcie.',
      'Brevo: wysyłka wiadomości e-mail z kodami. Widzi twój adres e-mail i treść wiadomości.',
      'Google (Gemini API): analiza plików, które sam wyślesz asystentowi AI. Wysyłamy je z wyłączonym zapisywaniem rozmowy po stronie Google.',
    ],
    paragraphs: ['Nikomu innemu twoich danych nie przekazujemy.'],
  },
  {
    title: 'Pliki dla asystenta AI',
    paragraphs: [
      'Plik trafia najpierw do prywatnego folderu, do którego dostęp masz tylko ty. Zaraz po analizie, także nieudanej, usuwamy go. Zanim wyślesz pierwszy plik, aplikacja przypomni ci, że trafi on do zewnętrznej usługi AI.',
    ],
  },
  {
    title: 'Tylko dla pełnoletnich',
    paragraphs: [
      'Z CalAI mogą korzystać tylko osoby, które mają ukończone 18 lat. Wymagają tego warunki usługi Gemini API, z której korzysta asystent. Przy rejestracji potwierdzasz swój wiek, a my zapisujemy moment tego potwierdzenia.',
    ],
  },
  {
    title: 'Jak długo je przechowujemy',
    paragraphs: [
      'Dopóki masz konto. Pliki dla asystenta AI przechowujemy tylko na czas analizy. Po usunięciu konta usuwamy wszystkie twoje dane.',
    ],
  },
  {
    title: 'Twoje prawa',
    items: [
      'Dostęp do danych: większość z nich widzisz w aplikacji, a o pełną kopię możesz poprosić autorów.',
      'Poprawianie: profil i ustawienia zmienisz w Ustawieniach.',
      'Usunięcie: konto razem ze wszystkimi danymi usuniesz sam w Ustawieniach, w sekcji Konto.',
      'Ograniczenie przetwarzania i sprzeciw: napisz do autorów projektu.',
      'Skarga do Prezesa Urzędu Ochrony Danych Osobowych, jeśli uważasz, że przetwarzamy twoje dane niezgodnie z prawem.',
    ],
  },
  {
    title: 'Pliki cookie',
    paragraphs: [
      'Używamy tylko niezbędnych plików cookie, w których przeglądarka trzyma twoją sesję logowania. Wybrany motyw (jasny albo ciemny) zapisujemy w pamięci przeglądarki. Nie używamy reklam ani narzędzi śledzących.',
    ],
  },
];

export default function PrivacyPage() {
  return (
    <article className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-12">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">Polityka prywatności</h1>
        <p className="text-sm text-muted-foreground">Ostatnia zmiana: 27 września 2026 r.</p>
      </header>
      {SECTIONS.map((section) => (
        <PolicySectionView key={section.title} section={section} />
      ))}
    </article>
  );
}

function PolicySectionView({ section }: { section: PolicySection }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xl font-semibold tracking-tight">{section.title}</h2>
      {section.items && (
        <ul className="flex list-disc flex-col gap-2 pl-5">
          {section.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
      {section.paragraphs?.map((paragraph) => (
        <p key={paragraph}>{paragraph}</p>
      ))}
    </section>
  );
}
