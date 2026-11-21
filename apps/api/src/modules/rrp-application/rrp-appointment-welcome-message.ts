/**
 * HU-RRP-07F — appointment welcome copy rendered at delivery time.
 * The intent stores no rendered body. Country labels come from @hu/geography.
 */

import { resolveCountryDisplayName } from "@hu/geography";

export const APPOINTMENT_WELCOME_LOCALES = [
  "en",
  "uk",
  "zh-Hant",
  "ar",
  "de",
  "es",
  "fr",
  "he",
  "ka",
  "pt",
] as const;

export type AppointmentWelcomeLocale = (typeof APPOINTMENT_WELCOME_LOCALES)[number];

interface AppointmentWelcomeCopy {
  readonly greetingNamed: string;
  readonly greetingNameless: string;
  readonly body: string;
}

const WELCOME_COPY: Record<AppointmentWelcomeLocale, AppointmentWelcomeCopy> = {
  en: {
    greetingNamed: "Hello, {name}!",
    greetingNameless: "Hello!",
    body: [
      "Congratulations on your appointment as a Regional Representative of Humanity Union for {country}!",
      "We are pleased to welcome you to this important role. Your initiative, ideas, and commitment can help bring people together and support the development of Humanity Union in your country.",
      "This direct conversation with the Humanity Union administration is confidential and intended for communication regarding your regional activities.",
      "Please feel free to ask questions, share your ideas, and tell us about your plans for developing Humanity Union in your region. We look forward to working together.",
      "Please note that this appointment represents a role within the Humanity Union platform. It does not independently grant administrative or legal authority, establish employment, or create a commitment to provide funding.",
      "Welcome to the Humanity Union team!",
    ].join("\n\n"),
  },
  uk: {
    greetingNamed: "Вітаємо, {name}!",
    greetingNameless: "Вітаємо!",
    body: [
      "Вітаємо з призначенням регіональним представником Humanity Union.",
      "Країна, яку ви представляєте: {country}.",
      "Нам приємно вітати вас у цій важливій ролі. Ваша ініціатива, ідеї та відданість справі можуть об’єднувати людей і підтримувати розвиток Humanity Union у вашій країні.",
      "Ця особиста розмова з адміністрацією Humanity Union є конфіденційною. Вона призначена для спілкування про вашу регіональну діяльність.",
      "Будь ласка, ставте запитання, діліться ідеями та розповідайте про плани розвитку Humanity Union у вашому регіоні. Ми раді працювати разом.",
      "Зверніть увагу: це призначення є роллю на платформі Humanity Union. Саме по собі воно не надає адміністративних чи юридичних повноважень, не створює трудових відносин і не означає зобов’язання надати фінансування.",
      "Ласкаво просимо до команди Humanity Union!",
    ].join("\n\n"),
  },
  "zh-Hant": {
    greetingNamed: "{name}，您好！",
    greetingNameless: "您好！",
    body: [
      "恭喜您獲任命為 Humanity Union 的區域代表。",
      "您所代表的國家：{country}。",
      "我們很高興歡迎您擔任這項重要角色。您的主動、想法與承諾，能幫助人們彼此連結，並支持 Humanity Union 在您的國家發展。",
      "這段與 Humanity Union 行政管理團隊的直接對話是保密的，用於就您的區域工作進行溝通。",
      "歡迎隨時提出問題、分享想法，並告訴我們您對 Humanity Union 在當地發展的計畫。我們期待與您一起努力。",
      "請注意：這項任命是 Humanity Union 平台上的角色。它本身並不授予行政管理或法律上的權限，不構成僱傭關係，也不表示承諾提供資金。",
      "歡迎加入 Humanity Union 團隊！",
    ].join("\n\n"),
  },
  ar: {
    greetingNamed: "مرحبًا {name}!",
    greetingNameless: "مرحبًا!",
    body: [
      "نهنئكم بتعيينكم ممثلًا إقليميًا في Humanity Union.",
      "البلد الذي تمثلونه: {country}.",
      "يسرّنا أن نرحب بكم في هذا الدور المهم. يمكن لمبادرتكم وأفكاركم والتزامكم أن تجمع الناس وتدعم تطور Humanity Union في بلدكم.",
      "هذه المحادثة المباشرة مع إدارة Humanity Union سرية، وهي مخصصة للتواصل بشأن نشاطكم الإقليمي.",
      "لا تترددوا في طرح الأسئلة ومشاركة أفكاركم وإخبارنا بخططكم لتطوير Humanity Union في منطقتكم. نتطلع إلى العمل معًا.",
      "يرجى ملاحظة أن هذا التعيين دور داخل منصة Humanity Union. وهو بحد ذاته لا يمنح صلاحية إدارية أو قانونية، ولا ينشئ علاقة عمل، ولا ينشئ التزامًا بتقديم تمويل.",
      "أهلًا بكم في فريق Humanity Union!",
    ].join("\n\n"),
  },
  de: {
    greetingNamed: "Guten Tag, {name}!",
    greetingNameless: "Guten Tag!",
    body: [
      "Herzlichen Glückwunsch zu Ihrer Berufung als regionale Vertretung von Humanity Union.",
      "Das Land, das Sie vertreten: {country}.",
      "Wir freuen uns, Sie in dieser wichtigen Rolle willkommen zu heißen. Ihre Initiative, Ihre Ideen und Ihr Engagement können Menschen zusammenbringen und die Entwicklung von Humanity Union in Ihrem Land unterstützen.",
      "Dieses direkte Gespräch mit der Verwaltung von Humanity Union ist vertraulich und dient dem Austausch über Ihre regionale Arbeit.",
      "Bitte stellen Sie Fragen, teilen Sie Ihre Ideen und erzählen Sie uns von Ihren Plänen für die Entwicklung von Humanity Union in Ihrer Region. Wir freuen uns auf die Zusammenarbeit.",
      "Bitte beachten Sie: Diese Berufung ist eine Rolle auf der Plattform von Humanity Union. Sie verleiht für sich genommen keine administrative oder rechtliche Befugnis, begründet kein Arbeitsverhältnis und schafft keine Zusage einer Finanzierung.",
      "Willkommen im Team von Humanity Union!",
    ].join("\n\n"),
  },
  es: {
    greetingNamed: "Hola, {name}.",
    greetingNameless: "Hola.",
    body: [
      "Felicitaciones por su nombramiento como representante regional de Humanity Union.",
      "País que representa: {country}.",
      "Nos complace darle la bienvenida a esta función importante. Su iniciativa, sus ideas y su compromiso pueden unir a las personas y apoyar el desarrollo de Humanity Union en su país.",
      "Esta conversación directa con la administración de Humanity Union es confidencial y está destinada a la comunicación sobre sus actividades regionales.",
      "No dude en hacer preguntas, compartir sus ideas y contarnos sus planes para desarrollar Humanity Union en su región. Esperamos trabajar juntos.",
      "Tenga en cuenta que este nombramiento representa una función dentro de la plataforma de Humanity Union. Por sí mismo, no otorga autoridad administrativa ni jurídica, no establece una relación laboral ni crea un compromiso de financiación.",
      "Le damos la bienvenida al equipo de Humanity Union.",
    ].join("\n\n"),
  },
  fr: {
    greetingNamed: "Bonjour {name},",
    greetingNameless: "Bonjour,",
    body: [
      "Félicitations pour votre nomination à la représentation régionale de Humanity Union.",
      "Pays que vous représentez : {country}.",
      "Nous sommes heureux de vous accueillir dans ce rôle important. Votre initiative, vos idées et votre engagement peuvent rassembler les gens et soutenir le développement de Humanity Union dans votre pays.",
      "Cette conversation directe avec l’administration de Humanity Union est confidentielle. Elle est destinée aux échanges concernant vos activités régionales.",
      "N’hésitez pas à poser des questions, à partager vos idées et à nous parler de vos projets pour développer Humanity Union dans votre région. Nous nous réjouissons de travailler ensemble.",
      "Veuillez noter que cette nomination correspond à un rôle sur la plateforme Humanity Union. Elle ne confère pas, à elle seule, d’autorité administrative ou juridique, ne crée pas de relation d’emploi et n’entraîne aucun engagement de financement.",
      "Bienvenue dans l’équipe de Humanity Union !",
    ].join("\n\n"),
  },
  he: {
    greetingNamed: "שלום {name}!",
    greetingNameless: "שלום!",
    body: [
      "ברכות על המינוי לייצוג אזורי ב-Humanity Union.",
      "המדינה שאותה אתם מייצגים: {country}.",
      "אנו שמחים לקבל את פניכם בתפקיד החשוב הזה. היוזמה, הרעיונות והמחויבות שלכם יכולים לקרב בין אנשים ולתמוך בהתפתחות Humanity Union במדינה שלכם.",
      "שיחה ישירה זו עם הנהלת Humanity Union חסויה, ונועדה לתקשורת בנוגע לפעילות האזורית שלכם.",
      "מוזמנים לשאול שאלות, לשתף רעיונות ולספר על התוכניות שלכם לפיתוח Humanity Union באזורכם. אנו מצפים לעבודה משותפת.",
      "שימו לב: מינוי זה הוא תפקיד בפלטפורמה של Humanity Union. כשלעצמו הוא אינו מעניק סמכות ניהולית או משפטית, אינו יוצר יחסי עבודה ואינו יוצר התחייבות למימון.",
      "ברוכים הבאים לצוות Humanity Union!",
    ].join("\n\n"),
  },
  ka: {
    greetingNamed: "გამარჯობა, {name}!",
    greetingNameless: "გამარჯობა!",
    body: [
      "გილოცავთ Humanity Union-ის რეგიონულ წარმომადგენლად დანიშვნას.",
      "ქვეყანა, რომელსაც წარმოადგენთ: {country}.",
      "მოხარულები ვართ, რომ ამ მნიშვნელოვან როლში გესალმებით. თქვენს ინიციატივას, იდეებსა და ერთგულებას შეუძლია ადამიანების დაახლოება და Humanity Union-ის განვითარების მხარდაჭერა თქვენს ქვეყანაში.",
      "ეს პირდაპირი საუბარი Humanity Union-ის ადმინისტრაციასთან კონფიდენციალურია და განკუთვნილია თქვენს რეგიონულ საქმიანობაზე კომუნიკაციისთვის.",
      "გთხოვთ, თავისუფლად დასვათ კითხვები, გაგვიზიაროთ იდეები და მოგვიყვეთ გეგმები Humanity Union-ის განვითარების შესახებ თქვენს რეგიონში. მოუთმენლად ველით თანამშრომლობას.",
      "გთხოვთ, გაითვალისწინოთ: ეს დანიშვნა Humanity Union-ის პლატფორმაზე არსებული როლია. ის თავისთავად არ ანიჭებს ადმინისტრაციულ ან სამართლებრივ უფლებამოსილებას, არ ამყარებს შრომით ურთიერთობას და არ ქმნის დაფინანსების ვალდებულებას.",
      "კეთილი იყოს თქვენი მობრძანება Humanity Union-ის გუნდში!",
    ].join("\n\n"),
  },
  pt: {
    greetingNamed: "Olá, {name}!",
    greetingNameless: "Olá!",
    body: [
      "Parabéns pela sua nomeação como representante regional da Humanity Union.",
      "País que você representa: {country}.",
      "É uma satisfação dar-lhe as boas-vindas nesta função importante. A sua iniciativa, as suas ideias e o seu compromisso podem aproximar pessoas e apoiar o desenvolvimento da Humanity Union no seu país.",
      "Esta conversa direta com a administração da Humanity Union é confidencial e destina-se à comunicação sobre as suas atividades regionais.",
      "Fique à vontade para fazer perguntas, partilhar ideias e contar os seus planos para desenvolver a Humanity Union na sua região. Esperamos trabalhar em conjunto.",
      "Note que esta nomeação representa uma função na plataforma da Humanity Union. Por si só, não concede autoridade administrativa ou jurídica, não estabelece vínculo de emprego e não cria um compromisso de financiamento.",
      "Boas-vindas à equipe da Humanity Union!",
    ].join("\n\n"),
  },
};

const UNSAFE_DISPLAY_NAME = /[<>\u0000-\u001F\u007F]/;
const MAX_DISPLAY_NAME_LENGTH = 120;

export function isSafeWelcomeDisplayName(value: string | null | undefined): value is string {
  if (typeof value !== "string") {
    return false;
  }
  const trimmed = value.trim();
  if (!trimmed || [...trimmed].length > MAX_DISPLAY_NAME_LENGTH) {
    return false;
  }
  return !UNSAFE_DISPLAY_NAME.test(trimmed);
}

/**
 * Profile display name wins. A blank profile falls back to the auth display name.
 * An unsafe profile name does not fall through to a different name.
 */
export function selectWelcomeDisplayName(input: {
  profileDisplayName?: string | null;
  authDisplayName?: string | null;
}): string | null {
  const profile = input.profileDisplayName?.trim() ?? "";
  if (profile) {
    return isSafeWelcomeDisplayName(profile) ? profile : null;
  }
  const auth = input.authDisplayName?.trim() ?? "";
  return auth && isSafeWelcomeDisplayName(auth) ? auth : null;
}

export function appointmentWelcomeCopyLocale(locale: string | null | undefined): AppointmentWelcomeLocale {
  if (typeof locale === "string" && (APPOINTMENT_WELCOME_LOCALES as readonly string[]).includes(locale)) {
    return locale as AppointmentWelcomeLocale;
  }
  return "en";
}

function fill(template: string, token: string, value: string): string {
  return template.split(token).join(value);
}

function welcomeCountryName(countryCode: string, locale: AppointmentWelcomeLocale): string {
  const resolved = resolveCountryDisplayName({
    countryCode,
    locale,
  }).displayName.trim();
  if (!resolved || UNSAFE_DISPLAY_NAME.test(resolved)) {
    const fallback = countryCode.trim().toUpperCase();
    return fallback || countryCode;
  }
  return resolved;
}

export function renderAppointmentWelcomeMessage(input: {
  displayName?: string | null;
  countryCode: string;
  locale?: string | null;
}): string {
  const locale = appointmentWelcomeCopyLocale(input.locale);
  const copy = WELCOME_COPY[locale];
  const country = welcomeCountryName(input.countryCode, locale);
  const name = isSafeWelcomeDisplayName(input.displayName) ? input.displayName.trim() : null;
  const greeting = name ? fill(copy.greetingNamed, "{name}", name) : copy.greetingNameless;
  return `${greeting}\n\n${fill(copy.body, "{country}", country)}`;
}
