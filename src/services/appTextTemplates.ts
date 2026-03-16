import { supabase } from "../integrations/supabase/client";

type MacroValue = string | number | null | undefined;

const cache = new Map<string, string>();

function replaceMacros(template: string, macros: Record<string, MacroValue>) {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = macros[key];
    return value === null || value === undefined ? "" : String(value);
  });
}

export async function loadAppTexts(keys: string[]) {
  const missing = keys.filter((k) => !cache.has(k));
  if (missing.length === 0) return;

  const { data } = await supabase
    .from("app_texts")
    .select("key, value")
    .in("key", missing);

  (data || []).forEach((row) => {
    cache.set(row.key, row.value);
  });
}

export async function renderGenderedText(params: {
  gender?: string;
  maleKey: string;
  femaleKey: string;
  maleFallback: string;
  femaleFallback: string;
  macros: Record<string, MacroValue>;
}) {
  const { gender, maleKey, femaleKey, maleFallback, femaleFallback, macros } = params;
  await loadAppTexts([maleKey, femaleKey]);

  const isFemale = gender === "Бабайка";
  const key = isFemale ? femaleKey : maleKey;
  const fallback = isFemale ? femaleFallback : maleFallback;
  const template = cache.get(key) || fallback;

  return replaceMacros(template, macros);
}
