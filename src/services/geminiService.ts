import { GoogleGenAI, Modality, Type } from "@google/genai";
import { compressImage } from "../utils/imageUtils";

let _ai: GoogleGenAI | null = null;

function getAI(): GoogleGenAI {
  if (!_ai) {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY || "AIzaSyCUCb8uYbhPOJSqKw4TtZrCkdLyVlDDbiE";
    _ai = new GoogleGenAI({ apiKey });
  }
  return _ai;
}

export const generateLore = async (name: string, gender: string, style: string) => {
  try {
    const response = await getAI().models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Придумай мрачную, но интересную предысторию (лор) для славянского кибернетического духа по имени ${name}. Пол: ${gender}. Стиль: ${style}. Дух выглядит как страшный старик или старуха в пижаме с длинным языком более 1 метра, которым он хватает предметы, и обладает телекинезом. Напиши 3-4 абзаца.`,
    });
    return response.text || "Лор скрыт во мраке...";
  } catch (e: any) {
    if (e?.status === 429 || e?.message?.includes("429") || e?.message?.includes("quota")) {
      console.warn("Lore generation Rate limit exceeded.");
    } else {
      console.error("Lore generation failed", e);
    }
    return "Не удалось вспомнить прошлое из-за тумана (лимит запросов)...";
  }
};

export const generateAiChatResponse = async (friendName: string, userMessage: string, style: string, imageBase64?: string) => {
  try {
    const parts: any[] = [{ text: `Ты ИИ-заместитель кибер-славянского духа по имени ${friendName}. Твой стиль общения: ${style}. Ответь на сообщение пользователя коротко (1-2 предложения), вжившись в роль страшного, но забавного бабая с длинным языком. Сообщение пользователя: "${userMessage}"` }];
    
    if (imageBase64) {
      parts.push({
        inlineData: {
          data: imageBase64.split(',')[1],
          mimeType: imageBase64.split(';')[0].split(':')[1],
        }
      });
      parts[0].text += " Пользователь также прислал картинку. Прокомментируй её.";
    }

    const response = await getAI().models.generateContent({
      model: "gemini-2.5-flash-lite-latest",
      contents: { parts },
    });
    return response.text || "Мррр... язык заплелся.";
  } catch (e) {
    console.error("AI Chat failed", e);
    return "Связь с духом потеряна...";
  }
};

export const generateAudio = async (text: string) => {
  try {
    const response = await getAI().models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Charon' },
          },
        },
      },
    });
    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
      return `data:audio/pcm;rate=24000;base64,${base64Audio}`;
    }
  } catch (e) {
    console.error("TTS failed", e);
  }
  return null;
};

export const generateBossImage = async (style: string) => {
  try {
    const response = await getAI().models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            text: `Огромный, ужасающий босс-жилец многоквартирного дома, кибер-славянский стиль, ${style}, мрачная атмосфера, высокое качество.`,
          },
        ],
      },
      config: {
        imageConfig: {
          aspectRatio: "1:1",
        }
      }
    });
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        const base64 = `data:image/png;base64,${part.inlineData.data}`;
        return await compressImage(base64, 512, 512);
      }
    }
  } catch (e: any) {
    if (e?.status === 429 || e?.message?.includes("429") || e?.message?.includes("quota")) {
      console.warn("Boss image generation Rate limit exceeded.");
    } else {
      console.error("Boss image generation failed", e);
    }
  }
  return "https://fastly.picsum.photos/id/433/1920/1080";
};

export const editAvatarWithItem = async (currentAvatar: string, character: any, allOwnedItems: string[], newItemName: string) => {
  try {
    const itemsDescription = allOwnedItems.length > 0 ? `На нем надето: ${allOwnedItems.join(", ")}.` : "";
    const wishesDescription = character.wishes && character.wishes.length > 0 ? `Особые приметы: ${character.wishes.join(", ")}.` : "";
    const prompt = `Кибер-славянский бабай по имени ${character.name}. Пол: ${character.gender}. Стиль: ${character.style}. Уровень телекинеза: ${character.telekinesisLevel}. Выглядит как страшный старик или старуха в пижаме с длинным языком более 1 метра, которым он хватает предметы. ${wishesDescription} ${itemsDescription} Особое внимание удели новому предмету: ${newItemName}. Мрачная атмосфера, высокое качество, портретное фото.`;

    const response = await getAI().models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            text: prompt,
          },
        ],
      },
      config: {
        imageConfig: {
          aspectRatio: "1:1",
        }
      }
    });
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        const base64 = `data:image/png;base64,${part.inlineData.data}`;
        return await compressImage(base64, 512, 512);
      }
    }
  } catch (e: any) {
    if (e?.status === 429 || e?.message?.includes("429") || e?.message?.includes("quota")) {
      console.warn("Avatar edit Rate limit exceeded.");
    } else {
      console.error("Avatar edit failed", e);
    }
  }
  return currentAvatar;
};
