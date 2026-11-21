/**
 * HU-RRP-07G.4 — Regional Representative admin interface catalogs.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const repoRoot = path.resolve(webRoot, "../..");
const webDir = path.join(webRoot, "src/features/i18n/messages");
const packagedDir = path.join(repoRoot, "apps/api/assets/packaged-web-ui-catalogs");

const LOCALES = ["en", "uk", "zh-Hant", "ar", "de", "es", "fr", "he", "ka", "pt"] as const;

const OBSOLETE_CLAIMS = [
  "Applicants must be at least 18",
  "at least 18 years old",
  "Legal first name is required.",
  "Legal last name is required.",
  "Profession is required.",
  "Residence country is required.",
  "Relevant experience is required.",
  "Select a funding model.",
  "Country to represent",
  "Applicant identity",
] as const;

const DELIVERY_KEYS = [
  "deliveryWarningTitle",
  "deliveryPendingRetry",
  "deliveryFailedTerminal",
  "deliveryPreviouslyFailed",
  "deliveryPaused",
  "deliveryIntentMissing",
  "deliveryAppointmentMissing",
] as const;

const DELIVERY_WARNINGS: Record<string, Record<(typeof DELIVERY_KEYS)[number], string>> = {
  uk: {
    deliveryWarningTitle: "Доставка повідомлень",
    deliveryPendingRetry: "Рішення збережено, але повідомлення не вдалося доставити. Спробу доставки буде повторено автоматично.",
    deliveryFailedTerminal: "Рішення збережено, але повідомлення не вдалося доставити. Автоматичні спроби завершено. Ви можете зв’язатися з учасником через Повідомлення.",
    deliveryPreviouslyFailed: "Рішення збережено. Це повідомлення не доставлено, і автоматичні спроби вже завершено. Ви можете зв’язатися з учасником через Повідомлення.",
    deliveryPaused: "Рішення збережено, але повідомлення не надіслано, оскільки доставку призупинено.",
    deliveryIntentMissing: "Для цього рішення немає повідомлення, яке очікує на доставку.",
    deliveryAppointmentMissing: "Для цього призначення немає повідомлення, яке очікує на доставку.",
  },
  "zh-Hant": {
    deliveryWarningTitle: "訊息送達",
    deliveryPendingRetry: "決定已儲存，但訊息未能送出。系統會自動再試一次。",
    deliveryFailedTerminal: "決定已儲存，但訊息未能送出。自動送達已結束。您可以透過「訊息」聯絡參與者。",
    deliveryPreviouslyFailed: "決定已儲存。這則訊息未送出，且自動送達已經結束。您可以透過「訊息」聯絡參與者。",
    deliveryPaused: "決定已儲存，但因為訊息送達已暫停，所以訊息沒有送出。",
    deliveryIntentMissing: "這項決定沒有待送出的訊息。",
    deliveryAppointmentMissing: "這項任命沒有待送出的訊息。",
  },
  ar: {
    deliveryWarningTitle: "تسليم الرسائل",
    deliveryPendingRetry: "تم حفظ القرار، لكن تعذر تسليم الرسالة. ستُجرى محاولة أخرى تلقائيًا.",
    deliveryFailedTerminal: "تم حفظ القرار، لكن تعذر تسليم الرسالة. انتهت محاولات التسليم التلقائي. يمكنكم التواصل مع المشارك عبر الرسائل.",
    deliveryPreviouslyFailed: "تم حفظ القرار. لم تُسلَّم هذه الرسالة، وقد انتهت محاولات التسليم التلقائي. يمكنكم التواصل مع المشارك عبر الرسائل.",
    deliveryPaused: "تم حفظ القرار، لكن الرسالة لم تُرسل لأن تسليم الرسائل متوقف.",
    deliveryIntentMissing: "لا توجد رسالة بانتظار التسليم لهذا القرار.",
    deliveryAppointmentMissing: "لا توجد رسالة بانتظار التسليم لهذا التعيين.",
  },
  de: {
    deliveryWarningTitle: "Nachrichtenzustellung",
    deliveryPendingRetry: "Die Entscheidung wurde gespeichert, aber die Nachricht konnte nicht zugestellt werden. Ein weiterer Versuch erfolgt automatisch.",
    deliveryFailedTerminal: "Die Entscheidung wurde gespeichert, aber die Nachricht konnte nicht zugestellt werden. Die automatische Zustellung ist beendet. Sie können die teilnehmende Person über Nachrichten kontaktieren.",
    deliveryPreviouslyFailed: "Die Entscheidung wurde gespeichert. Diese Nachricht wurde nicht zugestellt, und die automatische Zustellung ist beendet. Sie können die teilnehmende Person über Nachrichten kontaktieren.",
    deliveryPaused: "Die Entscheidung wurde gespeichert, aber die Nachricht wurde nicht gesendet, weil die Zustellung pausiert ist.",
    deliveryIntentMissing: "Für diese Entscheidung wartet keine Nachricht auf die Zustellung.",
    deliveryAppointmentMissing: "Für diese Berufung wartet keine Nachricht auf die Zustellung.",
  },
  es: {
    deliveryWarningTitle: "Entrega de mensajes",
    deliveryPendingRetry: "La decisión se guardó, pero el mensaje no se pudo entregar. Se hará otro intento automáticamente.",
    deliveryFailedTerminal: "La decisión se guardó, pero el mensaje no se pudo entregar. La entrega automática ha terminado. Puede contactar al participante desde Mensajes.",
    deliveryPreviouslyFailed: "La decisión se guardó. Este mensaje no se entregó y la entrega automática ha terminado. Puede contactar al participante desde Mensajes.",
    deliveryPaused: "La decisión se guardó, pero el mensaje no se envió porque la entrega de mensajes está en pausa.",
    deliveryIntentMissing: "No hay ningún mensaje pendiente de entrega para esta decisión.",
    deliveryAppointmentMissing: "No hay ningún mensaje pendiente de entrega para este nombramiento.",
  },
  fr: {
    deliveryWarningTitle: "Remise des messages",
    deliveryPendingRetry: "La décision a été enregistrée, mais le message n’a pas pu être remis. Une nouvelle tentative aura lieu automatiquement.",
    deliveryFailedTerminal: "La décision a été enregistrée, mais le message n’a pas pu être remis. La remise automatique est terminée. Vous pouvez contacter le participant dans Messages.",
    deliveryPreviouslyFailed: "La décision a été enregistrée. Ce message n’a pas été remis et la remise automatique est terminée. Vous pouvez contacter le participant dans Messages.",
    deliveryPaused: "La décision a été enregistrée, mais le message n’a pas été envoyé parce que la remise des messages est suspendue.",
    deliveryIntentMissing: "Aucun message n’est en attente de remise pour cette décision.",
    deliveryAppointmentMissing: "Aucun message n’est en attente de remise pour cette nomination.",
  },
  he: {
    deliveryWarningTitle: "מסירת הודעות",
    deliveryPendingRetry: "ההחלטה נשמרה, אך לא ניתן היה למסור את ההודעה. ניסיון נוסף יתבצע אוטומטית.",
    deliveryFailedTerminal: "ההחלטה נשמרה, אך לא ניתן היה למסור את ההודעה. המסירה האוטומטית הסתיימה. אפשר ליצור קשר עם המשתתף דרך הודעות.",
    deliveryPreviouslyFailed: "ההחלטה נשמרה. הודעה זו לא נמסרה, והמסירה האוטומטית הסתיימה. אפשר ליצור קשר עם המשתתף דרך הודעות.",
    deliveryPaused: "ההחלטה נשמרה, אך ההודעה לא נשלחה כי מסירת ההודעות מושהית.",
    deliveryIntentMissing: "אין הודעה שממתינה למסירה עבור החלטה זו.",
    deliveryAppointmentMissing: "אין הודעה שממתינה למסירה עבור מינוי זה.",
  },
  ka: {
    deliveryWarningTitle: "შეტყობინების მიწოდება",
    deliveryPendingRetry: "გადაწყვეტილება შენახულია, მაგრამ შეტყობინების მიწოდება ვერ მოხერხდა. კიდევ ერთი მცდელობა შესრულდება ავტომატურად.",
    deliveryFailedTerminal: "გადაწყვეტილება შენახულია, მაგრამ შეტყობინების მიწოდება ვერ მოხერხდა. ავტომატური მიწოდება დასრულდა. მონაწილეს შეგიძლიათ დაუკავშირდეთ შეტყობინებებიდან.",
    deliveryPreviouslyFailed: "გადაწყვეტილება შენახულია. ეს შეტყობინება არ მიტანილა და ავტომატური მიწოდება დასრულდა. მონაწილეს შეგიძლიათ დაუკავშირდეთ შეტყობინებებიდან.",
    deliveryPaused: "გადაწყვეტილება შენახულია, მაგრამ შეტყობინება არ გაგზავნილა, რადგან მიწოდება შეჩერებულია.",
    deliveryIntentMissing: "ამ გადაწყვეტილებისთვის მიწოდების მომლოდინე შეტყობინება არ არის.",
    deliveryAppointmentMissing: "ამ დანიშვნისთვის მიწოდების მომლოდინე შეტყობინება არ არის.",
  },
  pt: {
    deliveryWarningTitle: "Entrega de mensagens",
    deliveryPendingRetry: "A decisão foi guardada, mas a mensagem não pôde ser entregue. Será feita outra tentativa automaticamente.",
    deliveryFailedTerminal: "A decisão foi guardada, mas a mensagem não pôde ser entregue. A entrega automática terminou. Pode contactar o participante em Mensagens.",
    deliveryPreviouslyFailed: "A decisão foi guardada. Esta mensagem não foi entregue e a entrega automática terminou. Pode contactar o participante em Mensagens.",
    deliveryPaused: "A decisão foi guardada, mas a mensagem não foi enviada porque a entrega de mensagens está em pausa.",
    deliveryIntentMissing: "Não há nenhuma mensagem à espera de entrega para esta decisão.",
    deliveryAppointmentMissing: "Não há nenhuma mensagem à espera de entrega para esta nomeação.",
  },
};

function readJson(filePath: string): Record<string, unknown> {
  return JSON.parse(readFileSync(filePath, "utf8")) as Record<string, unknown>;
}

function leaves(node: unknown, prefix = "", out: Map<string, string> = new Map()): Map<string, string> {
  if (typeof node === "string") {
    if (prefix) out.set(prefix, node);
    return out;
  }
  if (node && typeof node === "object" && !Array.isArray(node)) {
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      leaves(value, prefix ? `${prefix}.${key}` : key, out);
    }
  }
  return out;
}

function tokens(value: string): string {
  return [...value.matchAll(/\{[A-Za-z_][A-Za-z0-9_]*\}/g)].map((match) => match[0]).join("|");
}

function tags(value: string): string {
  return [...value.matchAll(/<\/?[A-Za-z0-9]+>/g)].map((match) => match[0]).join("|");
}

function adminLeaves(catalog: Map<string, string>): Map<string, string> {
  const out = new Map<string, string>();
  for (const [key, value] of catalog) {
    if (key.startsWith("rrpApplication.admin.")) out.set(key, value);
  }
  return out;
}

describe("HU-RRP-07G.4 admin interface localization", () => {
  const english = adminLeaves(leaves(readJson(path.join(webDir, "en.json"))));

  it("covers every admin key in each installed locale", () => {
    assert.equal(english.size, 80);
    for (const locale of LOCALES) {
      for (const dir of [webDir, packagedDir]) {
        const catalog = adminLeaves(leaves(readJson(path.join(dir, `${locale}.json`))));
        assert.deepEqual([...catalog.keys()], [...english.keys()], `${locale} ${dir}`);
        for (const [key, value] of catalog) {
          assert.equal(value.trim().length > 0, true, `${locale} ${key}`);
        }
      }
    }
  });

  it("keeps placeholders and packaged copies aligned without English copies", () => {
    for (const locale of LOCALES) {
      const web = adminLeaves(leaves(readJson(path.join(webDir, `${locale}.json`))));
      const packaged = adminLeaves(leaves(readJson(path.join(packagedDir, `${locale}.json`))));
      for (const [key, source] of english) {
        const value = web.get(key);
        assert.ok(value, key);
        assert.equal(tokens(value), tokens(source), `${locale} ${key}`);
        assert.equal(tags(value), tags(source), `${locale} ${key}`);
        assert.equal(packaged.get(key), value, `${locale} ${key}`);
        if (locale !== "en") assert.notEqual(value, source, `${locale} ${key}`);
      }
    }
  });

  it("preserves delivery warnings and does not revive obsolete requirements", () => {
    for (const locale of LOCALES) {
      const catalog = adminLeaves(leaves(readJson(path.join(webDir, `${locale}.json`))));
      for (const [key, value] of catalog) {
        assert.equal(/\b18\b/.test(value), false, `${locale} ${key}`);
        for (const claim of OBSOLETE_CLAIMS) {
          assert.equal(value.includes(claim), false, `${locale} ${key} ${claim}`);
        }
      }
    }
    for (const [locale, expected] of Object.entries(DELIVERY_WARNINGS)) {
      const web = leaves(readJson(path.join(webDir, `${locale}.json`)));
      const packaged = leaves(readJson(path.join(packagedDir, `${locale}.json`)));
      for (const key of DELIVERY_KEYS) {
        const pathKey = `rrpApplication.admin.messages.${key}`;
        assert.equal(web.get(pathKey), expected[key], pathKey);
        assert.equal(packaged.get(pathKey), expected[key], pathKey);
      }
    }
    assert.match(english.get("rrpApplication.admin.intro") ?? "", /internal platform designation only/i);
    assert.match(english.get("rrpApplication.admin.disclaimer.platformOnly") ?? "", /does not confer legal authority/i);
    assert.match(english.get("rrpApplication.admin.confirmApprove.lineNoFunding") ?? "", /No funding commitment/i);
    assert.match(english.get("rrpApplication.admin.confirmApprove.lineNoAdmin") ?? "", /No administrator rights/i);
    assert.match(english.get("rrpApplication.admin.confirmRevoke.lineHistory") ?? "", /status is not changed/i);
    assert.match(english.get("rrpApplication.admin.fields.reviewNote") ?? "", /required/i);
    assert.equal(english.get("rrpApplication.admin.fields.fundingModel"), "Funding model");
    assert.equal(tokens(english.get("rrpApplication.admin.fields.consentAccepted") ?? ""), "{version}|{at}");
  });
});
