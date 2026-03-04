import { supabase } from "../integrations/supabase/client";
import { protalkGenerateText, protalkGenerateImage } from "./protalk";

// Load AI settings for a section from Supabase
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

// Replace macros in prompt with actual player data
function applyMacros(prompt: string, data: Record<string, string>): string {
  return prompt.replace(/\{(\w+)\}/g, (_, key) => data[key] ?? `{${key}}`);
}

// Determine if service is image type
function isImageService(service: string): boolean {
  return service === "protalk-image";
}

// Call ProTalk with correct type based on service field
async function callAI(
  service: string,
  prompt: string,
  telegramId?: number,
): Promise<{ text: string; imageUrl?: string | null }> {
  console.log(`[AI] callAI: service=${service}, telegramId=${telegramId}, promptLen=${prompt.length}`);
  if (isImageService(service)) {
    const result = await protalkGenerateImage(prompt, telegramId);
    console.log(`[AI] image result url=${result.url}`);
    return { text: result.url, imageUrl: result.url };
  } else {
    const text = await protalkGenerateText(prompt, telegramId);
    console.log(`[AI] text result len=${text?.length}`);
    return { text };
  }
}

export async function generateSpookyVoice(_text: string): Promise<string> {
  return "";
}

export async function generateCharacterName(
  gender: string,
  style: string,
  telegramId?: number,
): Promise<string> {
  try {
    const settings = await loadAISettings("names");
    const service = settings?.service || "protalk-text";
    const basePrompt =
      settings?.prompt ||
      "Сгенерируй одно уникальное, забавное имя для славянского кибернетического духа-Бабая. Пол: {gender}. Стиль: {style}. Имя должно состоять из одного или двух слов. Верни ТОЛЬКО само имя, без нумерации, без пояснений, без кавычек.";
    const prompt = applyMacros(basePrompt, { gender, style });
    console.log(`[AI] generateCharacterName: service=${service}, tgId=${telegramId}`);
    const { text } = await callAI(service, prompt, telegramId);
    // Clean up: take first line, remove numbering like "1. Name" or "- Name"
    const cleaned = text
      .split("\n")[0]
      .replace(/^[\d]+[.)]\s*/, "")
      .replace(/^[-*•]\s*/, "")
      .replace(/["""]/g, "")
      .trim();
    console.log(`[AI] name cleaned: "${cleaned}" (raw: "${text.substring(0, 80)}")`);
    return cleaned || "Безымянный";
  } catch (e) {
    console.error("[AI] Name gen error:", e);
    const names = ["Тьмарь", "Жуткий", "Скрежет", "Хладень", "Бурьян", "Крипень"];
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
  const basePrompt =
    settings?.prompt ||
    "Нарисуй портрет славянского кибернетического духа по имени {name} ({gender}). Наряд: пижама. Внешность: страшная и смешная, длинный язык больше метра. Стиль: {style}. Дополнительно: {wishes}. Высокое качество, детализированный, атмосферный.";
  const prompt = applyMacros(basePrompt, {
    gender,
    style,
    wishes: wishes.join(", "),
    name: extraData?.name || gender,
    ...extraData,
  });

  console.log(`[AI] generateAvatar: service=${service}, tgId=${telegramId}`);
  try {
    const { imageUrl } = await callAI(service, prompt, telegramId);
    const url = imageUrl && imageUrl.startsWith("http") ? imageUrl : null;
    console.log(`[AI] avatar url=${url}`);
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
    const basePrompt =
      settings?.prompt ||
      "Обнови внешность славянского духа по имени {name} ({gender}), стиль: {style}. Текущий аватар: {avatar_url}. Ранее купленные предметы: {inventory}. НОВЫЙ предмет: {new_item}. Нарисуй обновлённый портрет с новым предметом. Особые приметы: {wishes}. Высокое качество.";
    const prompt = applyMacros(basePrompt, {
      name: character.name || "",
      gender: character.gender || "",
      style: character.style || "",
      avatar_url: currentAvatar,
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
    const prompt = `Ты - ведущий текстовой ролевой игры "Бабай". Игрок - славянский кибер-дух (старик/старуха в пижаме с длинным языком и телекинезом).
Цель: выгнать жильцов из многоквартирного дома. Стиль игры: ${style}. Этап: ${stage}. Сложность: ${difficulty}.

Опиши текущую ситуацию (коротко, 2-3 предложения), где Бабай пугает очередного жильца.
Предложи 3 варианта действий для игрока. Только один правильный.
Напиши результат при успехе (successText) и провале (failureText).

Ответь строго в формате JSON:
{"text":"...","options":["...","...","..."],"correctAnswer":0,"successText":"...","failureText":"..."}`;

    const { text } = await callAI("protalk-text", prompt, telegramId);
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
        options: ["Явиться им в пижаме", "Выключить свет во всём доме", "Начать левитировать их телефоны"],
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
  const basePrompt =
    settings?.prompt ||
    "Нарисуй атмосферный фон для игры ужасов в стиле {style}. Без людей, без текста. Тёмный заброшенный дом, ночь, туман.";
  const prompt = applyMacros(basePrompt, {
    style,
    stage: String(stage),
    name: characterData?.name || "",
    gender: characterData?.gender || "",
    fear: characterData?.fear || "",
    telekinesis: characterData?.telekinesis || "",
    boss_level: characterData?.boss_level || "",
    watermelons: characterData?.watermelons || "",
    ...characterData,
  });

  try {
    const { imageUrl } = await callAI(service, prompt, telegramId);
    const url = imageUrl && imageUrl.startsWith("http") ? imageUrl : null;
    return { url: url || "https://picsum.photos/id/1015/1920/1080", prompt };
  } catch (e) {
    console.error("[AI] Background gen error:", e);
    return { url: "https://picsum.photos/id/1015/1920/1080", prompt };
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
  const basePrompt =
    settings?.prompt ||
    "Нарисуй огромного ужасающего босса для славянской игры ужасов. Стиль: {style}. Уровень босса: {boss_level}. Эпичный, детализированный.";
  const prompt = applyMacros(basePrompt, {
    style,
    stage: String(stage),
    boss_level: characterData?.boss_level || String(stage),
    name: characterData?.name || "",
    gender: characterData?.gender || "",
    fear: characterData?.fear || "",
    inventory: characterData?.inventory || "",
    ...characterData,
  });

  try {
    const { imageUrl } = await callAI(service, prompt, telegramId);
    const url = imageUrl && imageUrl.startsWith("http") ? imageUrl : null;
    return { url: url || "https://picsum.photos/id/718/1920/1080", prompt };
  } catch (e) {
    console.error("[AI] Boss gen error:", e);
    return { url: "https://picsum.photos/id/718/1920/1080", prompt };
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
    let historyText = "";
    if (chatHistory.length > 0) {
      historyText =
        "\nИстория последних сообщений:\n" +
        chatHistory
          .map((m) => `${m.sender === "user" ? character?.name || "Бабай" : m.sender}: ${m.text}`)
          .join("\n") +
        "\n";
    }

    let promptText = "";
    if (friendName === "ДанИИл") {
      const settings = await loadAISettings("chat");
      const service = settings?.service || "protalk-text";
      const basePrompt =
        settings?.prompt ||
        "Ты ДанИИл, дух-начальник (ИИ), который контролирует Бабаев. Стиль: строгий, саркастичный, требует отчётов о выселении жильцов.";
      promptText = `${basePrompt} Стиль мира: ${style}. Бабай по имени ${character?.name || "Неизвестный"} пишет: "${message}".${historyText} Ответь коротко (1-2 предложения).`;
      const { text } = await callAI(service, promptText, telegramId);
      return text.trim() || "Продолжай работать.";
    } else {
      promptText = `Ты - ИИ-заместитель друга по имени ${friendName}. Твой собеседник - Бабай ${character?.name || "Неизвестный"}. Стиль мира: ${style}. Игрок пишет: "${message}".${historyText} Ответь коротко (1-3 предложения).`;
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
        "Энергия не бесконечна. Поторопись с выселением.",
      ];
      return replies[Math.floor(Math.random() * replies.length)];
    }
    return "Связь прервалась. Попробуй позже.";
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
    const basePrompt =
      settings?.prompt ||
      "Напиши короткую (3-4 предложения) мистическую историю происхождения для Бабая по имени {name}, пол: {gender}, стиль: {style}. Сделай историю атмосферной и жуткой.";
    const prompt = applyMacros(basePrompt, { name, gender, style, ...extraData });
    console.log(`[AI] generateLore: service=${service}, tgId=${telegramId}`);
    const { text } = await callAI(service, prompt, telegramId);
    return text.trim() || "";
  } catch (e) {
    console.error("[AI] Lore gen error:", e);
    return "";
  }
}
