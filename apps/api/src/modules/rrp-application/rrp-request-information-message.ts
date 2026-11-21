/**
 * HU-RRP-07F.4 — request-information copy rendered at delivery time.
 * The administrator's note is quoted, not translated. The application id
 * stays on the intent and is not written into this body.
 */

import { resolveCountryDisplayName } from "@hu/geography";

import { MAX_DIRECT_MESSAGE_LENGTH } from "../direct-messaging/direct-messaging.validators.js";
import { appointmentWelcomeCopyLocale } from "./rrp-appointment-welcome-message.js";

const NOTE_MAX_LENGTH = 1200;
const DISALLOWED_NOTE_CHARACTERS = /[<>\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

interface RequestInformationCopy {
  readonly heading: string;
  readonly explanation: string;
  readonly neededLabel: string;
  readonly nextLabel: string;
  readonly nextBody: string;
  readonly disclaimer: string;
  readonly noteFallback: string;
}

const REQUEST_INFORMATION_COPY: Record<
  ReturnType<typeof appointmentWelcomeCopyLocale>,
  RequestInformationCopy
> = {
  en: {
    heading: "More Information Is Needed",
    explanation:
      "An administrator has requested additional information about your Regional Representative application for {country}.",
    neededLabel: "What is needed:",
    nextLabel: "Next step:",
    nextBody:
      "Open My Regional Applications in your Workspace, update your application, and reply in this conversation.",
    disclaimer: "This request does not change your account role or grant legal authority.",
    noteFallback: "Please provide the requested information.",
  },
  uk: {
    heading: "Потрібна додаткова інформація",
    explanation:
      "Адміністратор просить додаткову інформацію щодо вашої заявки на роль регіонального представника Humanity Union. Країна: {country}.",
    neededLabel: "Що потрібно:",
    nextLabel: "Наступний крок:",
    nextBody:
      "Відкрийте «Мої регіональні заявки» у Робочому просторі, оновіть заявку та дайте відповідь у цій розмові.",
    disclaimer: "Цей запит не змінює роль вашого облікового запису і не надає юридичних повноважень.",
    noteFallback: "Будь ласка, надайте запитану інформацію.",
  },
  "zh-Hant": {
    heading: "需要補充資料",
    explanation:
      "管理員請您就 Humanity Union 區域代表申請補充資料。您所代表的國家：{country}。",
    neededLabel: "需要補充的內容：",
    nextLabel: "下一步：",
    nextBody: "請在工作區開啟「我的區域申請」，更新申請內容，並在這段對話中回覆。",
    disclaimer: "此請求不會變更您的帳戶角色，也不授予法律權限。",
    noteFallback: "請提供所要求的資料。",
  },
  ar: {
    heading: "نحتاج إلى معلومات إضافية",
    explanation:
      "طلب أحد المشرفين معلومات إضافية حول طلبكم للتمثيل الإقليمي في Humanity Union. البلد: {country}.",
    neededLabel: "ما المطلوب:",
    nextLabel: "الخطوة التالية:",
    nextBody:
      "افتحوا «طلباتي الإقليمية» في مساحة العمل، حدّثوا الطلب، ثم ردّوا في هذه المحادثة.",
    disclaimer: "لا يغيّر هذا الطلب دور حسابكم ولا يمنح صلاحية قانونية.",
    noteFallback: "يرجى تقديم المعلومات المطلوبة.",
  },
  de: {
    heading: "Weitere Informationen werden benötigt",
    explanation:
      "Eine Administratorin oder ein Administrator hat zusätzliche Informationen zu Ihrer Bewerbung als regionale Vertretung von Humanity Union angefordert. Land: {country}.",
    neededLabel: "Was benötigt wird:",
    nextLabel: "Nächster Schritt:",
    nextBody:
      "Öffnen Sie im Arbeitsbereich „Meine regionalen Bewerbungen“, aktualisieren Sie Ihre Bewerbung und antworten Sie in diesem Gespräch.",
    disclaimer:
      "Diese Anfrage ändert nicht die Rolle Ihres Kontos und verleiht keine rechtliche Befugnis.",
    noteFallback: "Bitte stellen Sie die angeforderten Informationen bereit.",
  },
  es: {
    heading: "Se necesita más información",
    explanation:
      "Un administrador ha solicitado información adicional sobre su solicitud de representante regional de Humanity Union. País: {country}.",
    neededLabel: "Qué se necesita:",
    nextLabel: "Siguiente paso:",
    nextBody:
      "Abra Mis solicitudes regionales en su Espacio de trabajo, actualice su solicitud y responda en esta conversación.",
    disclaimer: "Esta solicitud no cambia el rol de su cuenta ni otorga autoridad legal.",
    noteFallback: "Proporcione la información solicitada.",
  },
  fr: {
    heading: "Des informations complémentaires sont nécessaires",
    explanation:
      "Un administrateur a demandé des informations complémentaires au sujet de votre candidature à la représentation régionale de Humanity Union. Pays : {country}.",
    neededLabel: "Ce qui est nécessaire :",
    nextLabel: "Prochaine étape :",
    nextBody:
      "Ouvrez Mes candidatures régionales dans votre Espace de travail, mettez à jour votre candidature et répondez dans cette conversation.",
    disclaimer:
      "Cette demande ne modifie pas le rôle de votre compte et ne confère aucune autorité juridique.",
    noteFallback: "Veuillez fournir les informations demandées.",
  },
  he: {
    heading: "נדרש מידע נוסף",
    explanation:
      "מנהל ביקש מידע נוסף לגבי הבקשה שלכם לייצוג אזורי ב-Humanity Union. המדינה: {country}.",
    neededLabel: "מה נדרש:",
    nextLabel: "הצעד הבא:",
    nextBody:
      "פתחו את «הבקשות האזוריות שלי» במרחב העבודה, עדכנו את הבקשה והשיבו בשיחה זו.",
    disclaimer: "בקשה זו אינה משנה את תפקיד החשבון ואינה מעניקה סמכות משפטית.",
    noteFallback: "נא לספק את המידע המבוקש.",
  },
  ka: {
    heading: "საჭიროა დამატებითი ინფორმაცია",
    explanation:
      "ადმინისტრატორმა დამატებითი ინფორმაცია მოითხოვა თქვენს Humanity Union-ის რეგიონული წარმომადგენლობის განაცხადზე. ქვეყანა: {country}.",
    neededLabel: "რა არის საჭირო:",
    nextLabel: "შემდეგი ნაბიჯი:",
    nextBody:
      "გახსენით „ჩემი რეგიონული განაცხადები“ სამუშაო სივრცეში, განაახლეთ განაცხადი და უპასუხეთ ამ საუბარში.",
    disclaimer: "ეს მოთხოვნა არ ცვლის თქვენი ანგარიშის როლს და არ გაძლევთ სამართლებრივ უფლებამოსილებას.",
    noteFallback: "გთხოვთ, მოგვაწოდოთ მოთხოვნილი ინფორმაცია.",
  },
  pt: {
    heading: "São necessárias mais informações",
    explanation:
      "Um administrador pediu informações adicionais sobre a sua candidatura a representante regional da Humanity Union. País: {country}.",
    neededLabel: "O que é necessário:",
    nextLabel: "Próximo passo:",
    nextBody:
      "Abra As minhas candidaturas regionais na sua Área de trabalho, atualize a candidatura e responda nesta conversa.",
    disclaimer: "Este pedido não altera o papel da sua conta nem concede autoridade jurídica.",
    noteFallback: "Forneça as informações solicitadas.",
  },
};

function fill(template: string, token: string, value: string): string {
  return template.split(token).join(value);
}

function limitCodePoints(value: string, maxLength: number): string {
  const characters = [...value];
  if (characters.length <= maxLength) {
    return value;
  }
  return characters.slice(0, maxLength).join("").trimEnd();
}

/**
 * Remove characters the direct-message validator rejects.
 * Line breaks stay. The remaining words are the administrator's own.
 */
export function sanitizeRequestInformationNote(note: string | null | undefined): string {
  if (typeof note !== "string" || note.length === 0) {
    return "";
  }
  const cleaned = note
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(DISALLOWED_NOTE_CHARACTERS, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return limitCodePoints(cleaned, NOTE_MAX_LENGTH);
}

function requestCountryName(countryCode: string, locale: ReturnType<typeof appointmentWelcomeCopyLocale>): string {
  const resolved = resolveCountryDisplayName({ countryCode, locale }).displayName.trim();
  if (!resolved || /[<>\u0000-\u001F\u007F]/.test(resolved)) {
    const fallback = countryCode.trim().toUpperCase();
    return fallback || countryCode;
  }
  return resolved;
}

function composeRequestInformationMessage(input: {
  copy: RequestInformationCopy;
  country: string;
  note: string;
}): string {
  return [
    input.copy.heading,
    "",
    fill(input.copy.explanation, "{country}", input.country),
    "",
    input.copy.neededLabel,
    "",
    input.note,
    "",
    input.copy.nextLabel,
    "",
    input.copy.nextBody,
    "",
    input.copy.disclaimer,
  ].join("\n");
}

export function renderRequestInformationMessage(input: {
  countryCode: string;
  requestExplanation?: string | null;
  locale?: string | null;
}): string {
  const locale = appointmentWelcomeCopyLocale(input.locale);
  const copy = REQUEST_INFORMATION_COPY[locale];
  const country = requestCountryName(input.countryCode, locale);
  const sanitized = sanitizeRequestInformationNote(input.requestExplanation);
  const note = sanitized || copy.noteFallback;
  let text = composeRequestInformationMessage({ copy, country, note });
  if ([...text].length <= MAX_DIRECT_MESSAGE_LENGTH) {
    return text;
  }
  const overflow = [...text].length - MAX_DIRECT_MESSAGE_LENGTH;
  const shortened = limitCodePoints(note, Math.max(0, [...note].length - overflow));
  text = composeRequestInformationMessage({
    copy,
    country,
    note: shortened || copy.noteFallback,
  });
  return limitCodePoints(text, MAX_DIRECT_MESSAGE_LENGTH);
}
