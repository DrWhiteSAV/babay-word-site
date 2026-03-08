import { supabase } from "../integrations/supabase/client";

const SUPABASE_URL = "https://psuvnvqvspqibsezcrny.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBzdXZudnF2c3BxaWJzZXpjcm55Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwMDI5NTIsImV4cCI6MjA4NzU3ODk1Mn0.VHI6Kefzbz6Hc8TpLI5_JRXAyPJ-y4oeE3Bkh16jFRU";

async function loadAISettings(sectionId: string): Promise<{ service: string; prompt: string } | null> {
  try {
    const { data } = await supabase
      .from("ai_settings")
      .select("service, prompt")
      .eq("section_id", sectionId)
      .single();
    return data || null;
  } catch {
    return null;
  }
}

function applyMacros(prompt: string, data: Record<string, string>): string {
  return prompt.replace(/\{(\w+)\}/g, (_, key) => data[key] ?? `{${key}}`);
}

async function callProTalkDirect(
  type: "text" | "image",
  prompt: string,
  telegramId?: number,
): Promise<{ text: string; imageUrl?: string | null }> {
  console.log(`[AI] ProTalk type=${type}, tgId=${telegramId}, prompt="${prompt.substring(0, 80)}..."`);
  const resp = await fetch(`${SUPABASE_URL}/functions/v1/protalk-ai`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ type, prompt, telegramId }),
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`protalk-ai ${resp.status}: ${err}`);
  }
  const data = await resp.json();
  if (!data.success) throw new Error(data.error || "ProTalk failed");
  console.log(`[AI] ProTalk ok, text="${(data.text || "").substring(0, 60)}", imageUrl=${data.imageUrl}`);
  return { text: data.text || "", imageUrl: data.imageUrl };
}

async function callAI(
  service: string,
  prompt: string,
  telegramId?: number,
): Promise<{ text: string; imageUrl?: string | null }> {
  const type = service === "protalk-image" ? "image" : "text";
  return callProTalkDirect(type, prompt, telegramId);
}

export async function generateSpookyVoice(_text: string): Promise<string> {
  return "";
}

function genderWord(gender: string): string {
  return gender === "Бабайка" ? "женский" : "мужской";
}

export async function generateCharacterName(
  gender: string,
  style: string,
  telegramId?: number,
): Promise<string> {
  try {
    const settings = await loadAISettings("names");
    const genderDesc = genderWord(gender);
    const basePrompt =
      settings?.prompt ||
      `Придумай одно уникальное, жутковатое и немного абсурдное имя для славянского духа-Бабая. Пол: ${genderDesc} ({gender}). Стиль: {style}. 
Формат: необычное имя + прилагательное. Например: "Дзяка Мокрая", "Журон Подвальный", "Хрыпач Чердачный", "Кряхта Ржавая", "Бурчала Трубная", "Скрыпач Ночной", "Гнилозуб Батарейный", "Хлюпа Канализационная". 
Для ${genderDesc} рода используй соответствующее окончание прилагательного.
Имя должно быть необычным, звучать по-славянски, вызывать одновременно страх и усмешку. Никаких обычных имен. Запрещены слова: "Бабай", "Дух", "Леший". Верни ТОЛЬКО имя (2 слова), без пояснений, кавычек, нумерации.`;
    const prompt = applyMacros(basePrompt, { gender, style });
    const service = settings?.service || "protalk-text";
    const { text } = await callAI(service, prompt, telegramId);
    const cleaned = text
      .split("\n")[0]
      .replace(/^[\d]+[.)]\s*/, "")
      .replace(/^[-*•]\s*/, "")
      .replace(/["""«»]/g, "")
      .trim();
    // Extra safety: reject if contains forbidden words
    const lower = cleaned.toLowerCase();
    if (lower.includes("пижам") || lower.includes("бабай")) {
      const fallbacks = gender === "Бабайка" 
        ? ["Кряхта Ржавая", "Хлюпа Канализационная", "Бурчала Трубная"]
        : ["Хрыпач Чердачный", "Журон Подвальный", "Скрыпач Ночной"];
      return fallbacks[Math.floor(Math.random() * fallbacks.length)];
    }
    return cleaned || "Безымянный";
  } catch (e) {
    console.error("[AI] Name gen error:", e);
    const names = gender === "Бабайка"
      ? ["Кряхта Ржавая", "Хлюпа Канализационная", "Бурчала Трубная"]
      : ["Хрыпач Чердачный", "Журон Подвальный", "Скрыпач Ночной"];
    return names[Math.floor(Math.random() * names.length)];
  }
}

export async function generateAvatar(
  gender: string,
  style: string,
  wishes: string[],
  extraData?: Record<string, string>,
  telegramId?: number,
): Promise<{ url: string; prompt: string }> {
  const settings = await loadAISettings("avatar");
  const service = settings?.service || "protalk-image";
  const genderDesc = genderWord(gender);
  const loreSnippet = extraData?.lore ? ` Лор персонажа: ${extraData.lore.substring(0, 200)}.` : "";
  const basePrompt =
    settings?.prompt ||
    `Нарисуй горизонтальный детализированный портрет славянского духа-пугала по имени {name} (пол: ${genderDesc}). Это ${genderDesc} дух. Внешность: страшная и смешная, длинный язык больше метра, безумный взгляд. Стиль: {style}. Особые приметы: {wishes}.{lore_snippet} Высокое качество, атмосферный, горизонтальная ориентация изображения. Тёмный фон.`;
  const prompt = applyMacros(basePrompt, {
    gender,
    style,
    wishes: wishes.join(", "),
    name: extraData?.name || gender,
    lore_snippet: loreSnippet,
    ...extraData,
  });

  try {
    const { imageUrl } = await callAI(service, prompt, telegramId);
    const url = imageUrl && imageUrl.startsWith("http") ? imageUrl : null;
    return { url: url || "https://i.ibb.co/BVgY7XrT/babai.png", prompt };
  } catch (e) {
    console.error("[AI] Avatar gen error:", e);
    return { url: "https://i.ibb.co/BVgY7XrT/babai.png", prompt };
  }
}

export async function generateAvatarWithItem(
  currentAvatar: string,
  character: any,
  allOwnedItems: string[],
  newItemName: string,
  telegramId?: number,
): Promise<string> {
  try {
    const settings = await loadAISettings("avatar_shop");
    const service = settings?.service || "protalk-image";
    const genderDesc = genderWord(character.gender || "Бабай");
    const basePrompt =
      settings?.prompt ||
      `Обнови горизонтальный портрет славянского духа по имени {name} (пол: ${genderDesc}), стиль: {style}. Лор: {lore}. Ранее купленные предметы: {inventory}. НОВЫЙ предмет: {new_item}. Нарисуй обновлённый портрет с новым предметом. Особые приметы: {wishes}. Горизонтальная ориентация. Высокое качество.`;
    const prompt = applyMacros(basePrompt, {
      name: character.name || "",
      gender: character.gender || "",
      style: character.style || "",
      avatar_url: currentAvatar,
      lore: character.lore || "",
      inventory: allOwnedItems.join(", "),
      new_item: newItemName,
      wishes: (character.wishes || []).join(", "),
    });
    const { imageUrl } = await callAI(service, prompt, telegramId);
    return imageUrl && imageUrl.startsWith("http") ? imageUrl : currentAvatar;
  } catch (e) {
    console.error("[AI] Avatar with item error:", e);
    return currentAvatar;
  }
}

export async function generateScenario(
  stage: number,
  difficulty: string,
  style: string,
  telegramId?: number,
): Promise<{ text: string; options: string[]; correctAnswer: number; successText: string; failureText: string }> {
  try {
    const settings = await loadAISettings("scenario");
    const basePrompt =
      settings?.prompt ||
      `Ты — ведущий текстовой ролевой игры "Бабай". Игрок — славянский дух с длинным языком и телекинезом. Цель: выгнать жильцов из дома. Стиль: {style}. Этап: {stage}. Сложность: {difficulty}. Опиши ситуацию (2-3 предложения) и предложи 3 варианта действий. Только один правильный. Напиши successText и failureText. Ответь строго JSON: {"text":"...","options":["...","...","..."],"correctAnswer":0,"successText":"...","failureText":"..."}`;
    const prompt = applyMacros(basePrompt, { style, stage: String(stage), difficulty });
    const { text } = await callAI(settings?.service || "protalk-text", prompt, telegramId);
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
    throw new Error("No JSON in response");
  } catch (e) {
    console.error("[AI] Scenario gen error:", e);
    const fallbacks = [
      {
        text: `Этаж ${stage}. Жилец заперся в ванной и поёт песни. Что будешь делать?`,
        options: ["Просунуть длинный язык под дверь", "Использовать телекинез на кран", "Громко завыть"],
        correctAnswer: 1,
        successText: "Вода внезапно стала ледяной! Жилец выскочил из ванной в ужасе.",
        failureText: "Жилец просто начал петь громче, игнорируя твои попытки.",
      },
      {
        text: `Этаж ${stage}. Группа подростков вызывает духов в подъезде.`,
        options: ["Явиться им во всей красе", "Выключить свет во всём доме", "Начать левитировать их телефоны"],
        correctAnswer: 2,
        successText: "Телефоны взмыли в воздух! Подростки разбежались, роняя кепки.",
        failureText: "Они приняли тебя за косплеера и начали делать селфи. Какой позор.",
      },
    ];
    return fallbacks[stage % fallbacks.length];
  }
}

export async function generateBackgroundImage(
  stage: number,
  style: string,
  characterData?: Record<string, string>,
  telegramId?: number,
): Promise<{ url: string; prompt: string }> {
  const settings = await loadAISettings("background");
  const service = settings?.service || "protalk-image";
  const lore = characterData?.lore || "";
  const basePrompt =
    settings?.prompt ||
    `Нарисуй горизонтальное атмосферное изображение: интерьер жуткого многоквартирного многоэтажного дома ночью. Вид изнутри подъезда или квартиры. Тёмные коридоры, облупленные стены, мерцающий свет. Стиль: {style}. Без людей, без текста, без надписей. Горизонтальная ориентация. Лор мира: ${lore.substring(0, 150)}. Высокое качество, детализация.`;
  const prompt = applyMacros(basePrompt, {
    style,
    stage: String(stage),
    name: characterData?.name || "",
    gender: characterData?.gender || "",
    fear: characterData?.fear || "",
    boss_level: characterData?.boss_level || "",
    ...characterData,
  });

  try {
    const { imageUrl } = await callAI(service, prompt, telegramId);
    const url = imageUrl && imageUrl.startsWith("http") ? imageUrl : null;
    return { url: url || "", prompt };
  } catch (e) {
    console.error("[AI] Background gen error:", e);
    return { url: "", prompt };
  }
}

export async function generateBossImage(
  stage: number,
  style: string,
  characterData?: Record<string, string>,
  telegramId?: number,
): Promise<{ url: string; prompt: string }> {
  const settings = await loadAISettings("boss");
  const service = settings?.service || "protalk-image";
  const bgPromptHint = characterData?.bg_prompt || "жуткий многоэтажный дом ночью";
  const basePrompt =
    settings?.prompt ||
    `Нарисуй горизонтальное изображение огромного ужасающего босса для славянской игры ужасов. Стиль: {style}. Уровень босса: {boss_level}. Фон: ${bgPromptHint}. Эпичный, детализированный, горизонтальная ориентация. Без текста, без надписей. Высокое качество.`;
  const prompt = applyMacros(basePrompt, {
    style,
    stage: String(stage),
    boss_level: characterData?.boss_level || String(stage),
    name: characterData?.name || "",
    ...characterData,
  });

  try {
    const { imageUrl } = await callAI(service, prompt, telegramId);
    const url = imageUrl && imageUrl.startsWith("http") ? imageUrl : null;
    return { url: url || "", prompt };
  } catch (e) {
    console.error("[AI] Boss gen error:", e);
    return { url: "", prompt };
  }
}

export async function generateFriendChat(
  message: string,
  friendName: string,
  character: any,
  style: string,
  chatHistory: { sender: string; text: string }[] = [],
  _imageUrl?: string,
  telegramId?: number,
): Promise<string> {
  try {
    // Only last 4 messages for context — keep prompt focused
    const last4 = chatHistory.slice(-4);
    let historyText = "";
    if (last4.length > 0) {
      historyText =
        "\nПоследние сообщения (только для контекста):\n" +
        last4
          .map((m) => `${m.sender === "user" ? character?.name || "Бабай" : m.sender}: ${m.text}`)
          .join("\n") +
        "\n";
    }

    const loreLine = character?.lore ? `\nЛор Бабая: ${character.lore}` : "";

    if (friendName === "ДанИИл") {
      const settings = await loadAISettings("chat");
      const service = settings?.service || "protalk-text";
      const basePrompt =
        settings?.prompt ||
        "Ты ДанИИл, дух-начальник (ИИ), который контролирует Бабаев. Стиль: строгий, саркастичный, требует отчётов о выселении жильцов. Ты используешь технический жаргон и любишь называть всех по номерам.";
      const promptText = `${basePrompt} Стиль мира: ${style}.${loreLine} Бабай по имени ${character?.name || "Неизвестный"} пишет: "${message}".${historyText}\nОтветь ТОЛЬКО на последнее сообщение «${message}». Коротко (1-2 предложения) в характере ДанИИла.`;
      const { text } = await callAI(service, promptText, telegramId);
      return text.trim() || "Продолжай работать.";
    } else {
      const promptText = `Ты — ИИ-заместитель друга по имени ${friendName}. Твой собеседник — Бабай ${character?.name || "Неизвестный"}.${loreLine} Стиль мира: ${style}.${historyText}\nПоследнее сообщение от собеседника (ответь ИМЕННО на него): «${message}»\nОтветь коротко (1-3 предложения) в образе ${friendName}. Без кавычек, без пояснений.`;
      const { text } = await callAI("protalk-text", promptText, telegramId);
      return text.trim() || "Продолжай работать.";
    }
  } catch (e) {
    console.error("[AI] Friend chat error:", e);
    if (friendName === "ДанИИл") {
      const replies = [
        "Слишком много разговоров, Бабай. Иди работай.",
        "Твои отчёты полны ошибок. Исправь это на следующем этаже.",
        "Я слежу за тобой. Не разочаруй систему.",
      ];
      return replies[Math.floor(Math.random() * replies.length)];
    }
    return "Связь прервалась. Попробуй позже.";
  }
}

/**
 * AI substitute for the USER: generates what the user would say to their friend.
 * Used when AI-substitute mode is ON — the AI writes on behalf of the current player.
 */
export async function generateMyAiReply(
  friendName: string,
  character: any,
  chatHistory: { sender: string; text: string }[] = [],
  telegramId?: number,
  chatKey?: string,
): Promise<string> {
  try {
    // Only last 4 messages for context
    const last4 = chatHistory.slice(-4);
    let historyText = "";
    if (last4.length > 0) {
      historyText =
        "\nПоследние сообщения (только для контекста):\n" +
        last4
          .map((m) => `${m.sender === "user" ? character?.name || "Я" : m.sender}: ${m.text}`)
          .join("\n") +
        "\n";
    }
    const lastFriendMsg = last4.filter(m => m.sender !== 'user').pop();
    const lastMsgLine = lastFriendMsg ? `\nПоследнее сообщение от ${friendName}: «${lastFriendMsg.text}» — ответь ИМЕННО на него.` : "";
    const loreLine = character?.lore ? `\nЛор Бабая: ${character.lore}` : "";
    const prompt = `Ты — ИИ-заместитель игрока по имени ${character?.name || "Бабай"} (пол: ${character?.gender || "Бабай"}, стиль мира: ${character?.style || "Хоррор"}).${loreLine} Твой друг — ${friendName}.${historyText}${lastMsgLine}\nНапиши короткий (1-3 предложения) ответ от лица ${character?.name || "Бабай"} другу ${friendName}. В стиле персонажа, без кавычек, без пояснений.`;
    // Use a stable chat_id based on chatKey (per-pair) to avoid ProTalk session LIMIT errors.
    // telegramId-based chat_id (tb<id>_<botId>) gets rate-limited when reused across many sessions.
    const stableTelegramId = chatKey
      ? undefined // will be ignored in protalk-ai when we pass chatKey
      : telegramId;
    const { text } = await callAI("protalk-text", prompt, stableTelegramId, chatKey);
    return text.trim() || "Привет!";
  } catch (e) {
    console.error("[AI] My reply gen error:", e);
    return "Привет!";
  }
}

export async function generateLore(
  name: string,
  gender: string,
  style: string,
  extraData?: Record<string, string>,
  telegramId?: number,
): Promise<string> {
  try {
    const settings = await loadAISettings("lore");
    const service = settings?.service || "protalk-text";
    const genderDesc = genderWord(gender);
    const basePrompt =
      settings?.prompt ||
      `Напиши короткую (3-4 предложения) мистическую и абсурдную историю происхождения для духа-Бабая по имени {name} (это необычное имя с прилагательным, пол: ${genderDesc}). Стиль: {style}. Объясни, откуда взялось такое странное имя. История должна быть атмосферной, жуткой и немного абсурдной. Упомяни длинный язык и телекинез.`;
    const prompt = applyMacros(basePrompt, { name, gender, style, ...extraData });
    const { text } = await callAI(service, prompt, telegramId);
    return text.trim() || "";
  } catch (e) {
    console.error("[AI] Lore gen error:", e);
    return "";
  }
}
