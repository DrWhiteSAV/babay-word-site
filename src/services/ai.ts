import { GoogleGenAI, Type, Modality } from "@google/genai";
import { compressImage } from "../utils/imageUtils";

let _ai: GoogleGenAI | null = null;

function getAI(): GoogleGenAI {
  if (!_ai) {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY || "AIzaSyCUCb8uYbhPOJSqKw4TtZrCkdLyVlDDbiE";
    _ai = new GoogleGenAI({ apiKey });
  }
  return _ai;
}

// Helper for exponential backoff retry
async function withRetry<T>(fn: () => Promise<T>, retries = 2, delay = 1000): Promise<T> {
  try {
    return await fn();
  } catch (e: any) {
    const isRetryableError = e?.status === 429 || e?.status === 500 || e?.status === 503 || e?.message?.includes("429") || e?.message?.includes("500") || e?.message?.includes("503") || e?.message?.includes("quota") || e?.message?.includes("Internal error");
    if (isRetryableError && retries > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
      return withRetry(fn, retries - 1, delay * 2);
    }
    throw e;
  }
}

export async function generateSpookyVoice(text: string): Promise<string> {
  try {
    const response = await withRetry(() => getAI().models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: `Произнеси жутким, пугающим голосом: ${text}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: "Charon" },
          },
        },
      },
    }));
    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    return base64Audio ? `data:audio/mp3;base64,${base64Audio}` : "";
  } catch (e: any) {
    console.warn("TTS Error or Rate limit, falling back to browser TTS.");
    return "";
  }
}

export async function generateCharacterName(
  gender: string,
  style: string,
): Promise<string> {
  try {
    const response = await withRetry(() => getAI().models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Сгенерируй уникальное, забавное имя для славянского кибернетического духа.
      Пол: ${gender}. Стиль: ${style}. 
      Имя должно состоять из одного или двух слов. Верни только имя, без лишних слов.`,
    }));
    return response.text?.trim() || "Безымянный";
  } catch (e) {
    console.error("Name gen error:", e);
    const names = ["Бабай", "Бука", "Жмых", "Кибер-Леший", "Яга-Бот", "Скрежет"];
    return names[Math.floor(Math.random() * names.length)] + " " + Math.floor(Math.random() * 100);
  }
}

export async function generateAvatar(
  gender: string,
  style: string,
  wishes: string[],
): Promise<string> {
  try {
    const prompt = `A portrait of a Slavic cybernetic spirit named ${gender === "Бабай" ? "Babay (old man)" : "Babayka (old woman)"}. 
    They wear pajamas and have a spooky but funny appearance with a long tongue. 
    Style: ${style}. Additional wishes: ${wishes.join(", ")}. 
    High quality, detailed, atmospheric, slightly comical.`;

    const response = await withRetry(() => getAI().models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: { parts: [{ text: prompt }] },
      config: {
        imageConfig: {
          aspectRatio: "1:1",
        },
      },
    }));

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        const base64 = `data:image/png;base64,${part.inlineData.data}`;
        return await compressImage(base64, 512, 512);
      }
    }
    return "https://i.ibb.co/BVgY7XrT/babai.png";
  } catch (e) {
    console.error("Avatar gen error:", e);
    return "https://i.ibb.co/BVgY7XrT/babai.png"; 
  }
}

export async function generateScenario(
  stage: number,
  difficulty: string,
  style: string,
): Promise<{ text: string; options: string[]; correctAnswer: number; successText: string; failureText: string }> {
  try {
    const response = await withRetry(() => getAI().models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Ты - ведущий текстовой ролевой игры "Бабай". Игрок - славянский кибер-дух (старик/старуха в пижаме с длинным языком и телекинезом).
      Цель: выгнать жильцов из многоквартирного дома.
      Стиль игры: ${style}. Этап: ${stage}. Сложность: ${difficulty}.
      
      Опиши текущую ситуацию (коротко, 2-3 предложения), где Бабай пугает очередного жильца (или группу).
      Затем предложи 3 варианта действий для игрока. Только один вариант должен быть правильным (успешным) для выселения, остальные ведут к провалу.
      Также напиши текст результата: что произошло при успехе (successText) и что произошло при провале (failureText).`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            text: { type: Type.STRING, description: "Описание ситуации" },
            options: { type: Type.ARRAY, items: { type: Type.STRING }, description: "3 варианта действий" },
            correctAnswer: { type: Type.INTEGER, description: "Индекс правильного варианта (0, 1 или 2)" },
            successText: { type: Type.STRING, description: "Текст при правильном выборе" },
            failureText: { type: Type.STRING, description: "Текст при неправильном выборе" }
          },
          required: ["text", "options", "correctAnswer", "successText", "failureText"]
        }
      },
    }));

    const text = response.text?.trim() || "{}";
    return JSON.parse(text);
  } catch (e) {
    console.error("Scenario gen error:", e);
    const fallbacks = [
      {
        text: `Этаж ${stage}. Жилец заперся в ванной и поет песни. Что будешь делать?`,
        options: ["Просунуть длинный язык под дверь", "Использовать телекинез на кран", "Громко завыть"],
        correctAnswer: 1,
        successText: "Вода внезапно стала ледяной, а потом закипела! Жилец выскочил из ванной в ужасе.",
        failureText: "Жилец просто начал петь громче, игнорируя твои попытки."
      },
      {
        text: `Этаж ${stage}. Группа подростков вызывает духов в подъезде.`,
        options: ["Явиться им в пижаме", "Выключить свет во всем доме", "Начать левитировать их телефоны"],
        correctAnswer: 2,
        successText: "Телефоны взмыли в воздух и начали транслировать помехи. Подростки разбежались, роняя кепки.",
        failureText: "Они приняли тебя за косплеера и начали делать селфи. Какой позор."
      }
    ];
    return fallbacks[stage % fallbacks.length];
  }
}

export async function generateBackgroundImage(
  stage: number,
  style: string,
): Promise<string> {
  try {
    const prompt = `A beautiful, atmospheric background image for a video game. It shows an empty hallway or room in a futuristic apartment building. The style is ${style}. Stage ${stage}. No text, no people, just the environment, highly detailed.`;
    const response = await withRetry(() => getAI().models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: { parts: [{ text: prompt }] },
      config: {
        imageConfig: {
          aspectRatio: "16:9",
        },
      },
    }));

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        const base64 = `data:image/png;base64,${part.inlineData.data}`;
        return await compressImage(base64, 1280, 720);
      }
    }
    return "https://picsum.photos/id/1015/1920/1080";
  } catch (e) {
    console.error("Background image gen error:", e);
    return "https://picsum.photos/id/1015/1920/1080";
  }
}

export async function generateBossImage(
  stage: number,
  style: string,
): Promise<string> {
  try {
    const prompt = `A massive boss character for a Slavic cyberpunk game. It is a corrupted version of a building manager or a giant mechanical spider-like spirit. Style: ${style}. Epic, detailed, high quality.`;
    const response = await withRetry(() => getAI().models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: { parts: [{ text: prompt }] },
      config: {
        imageConfig: {
          aspectRatio: "1:1",
        },
      },
    }));

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        const base64 = `data:image/png;base64,${part.inlineData.data}`;
        return await compressImage(base64, 512, 512);
      }
    }
    return "https://picsum.photos/id/718/1920/1080";
  } catch (e) {
    console.error("Boss image gen error:", e);
    return "https://picsum.photos/id/718/1920/1080";
  }
}

export async function generateFriendChat(
  message: string,
  friendName: string,
  character: any,
  style: string,
  chatHistory: { sender: string, text: string }[] = [],
  imageUrl?: string
): Promise<string> {
  try {
    const parts: any[] = [];
    if (imageUrl) {
      const base64Data = imageUrl.split(',')[1];
      const mimeType = imageUrl.split(';')[0].split(':')[1];
      parts.push({
        inlineData: {
          data: base64Data,
          mimeType: mimeType,
        }
      });
    }
    
    let historyText = "";
    if (chatHistory.length > 0) {
      historyText = `\nИстория последних сообщений:\n` + chatHistory.map(m => `${m.sender === 'user' ? (character?.name || 'Бабай') : m.sender}: ${m.text}`).join('\n') + `\n`;
    }

    let promptText = "";
    if (friendName === "ДанИИл") {
      promptText = `Ты - ДанИИл, дух-начальник (ИИ), который контролирует Бабаев. 
      Стиль общения: строгий, саркастичный, требует отчетов о выселении жильцов. Учитывай стиль мира: ${style}.
      Игрок (Бабай по имени ${character?.name || 'Неизвестный'}) пишет тебе: "${message}".${historyText}
      ${imageUrl ? "Игрок также прислал изображение. Прокомментируй его, если оно относится к делу." : ""}
      Ответь коротко (1-2 предложения), оцени работу и дай добро на следующий этап, если игрок убедителен.`;
    } else {
      promptText = `Ты - ИИ-заместитель друга по имени ${friendName}. 
      Твой собеседник - Бабай по имени ${character?.name || 'Неизвестный'} (описание: ${character?.description || 'нет описания'}).
      Стиль мира: ${style}.
      Веди себя как другой Бабай-коллега, который тоже пугает людей, но сейчас общается в чате.
      Игрок пишет тебе: "${message}".${historyText}
      ${imageUrl ? "Игрок также прислал изображение. Прокомментируй его." : ""}
      Ответь коротко (1-3 предложения), поддерживая атмосферу мира Бабаев и характер собеседника.`;
    }

    parts.push({ text: promptText });

    const response = await withRetry(() => getAI().models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { parts },
    }));
    return response.text?.trim() || "Продолжай работать.";
  } catch (e) {
    console.error("Friend chat error:", e);
    if (friendName === "ДанИИл") {
      const replies = [
        "Слишком много разговоров, Бабай. Иди работай.",
        "Твои отчеты полны ошибок. Исправь это на следующем этаже.",
        "Я слежу за тобой. Не разочаруй систему.",
        "Энергия не бесконечна. Поторопись с выселением."
      ];
      return replies[Math.floor(Math.random() * replies.length)];
    } else {
      return "Связь прервалась. Попробуй позже.";
    }
  }
}
