import { GoogleGenAI, Type } from '@google/genai';
import { getLanguageLabel } from '../i18n.ts';
import type {
  AiMatchResponse,
  ChatMessage,
  ChatResponse,
  DoctorProfile,
  Language,
  MapsGroundedResponse,
  MapsGroundingPlace,
  MatchedDoctorResult,
} from '../types.ts';

const EMERGENCY_KEYWORDS = [
  'chest pain',
  'crushing chest',
  'heart attack',
  'shortness of breath',
  'difficulty breathing',
  'cant breathe',
  "can't breathe",
  'unconscious',
  'fainted',
  'seizure',
  'stroke',
  'slurred speech',
  'facial droop',
  'severe bleeding',
  'heavy bleeding',
  'suicidal',
  'self harm',
  'overdose',
  'நெஞ்சு வலி',
  'மூச்சுத் திணறல்',
  'மயக்கம்',
  'வலிப்பு',
  'அதிக இரத்தப்போக்கு',
];

const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  chennai: { lat: 13.0475, lng: 80.237 },
  adyar: { lat: 13.0067, lng: 80.2572 },
  't. nagar': { lat: 13.0418, lng: 80.2341 },
  't nagar': { lat: 13.0418, lng: 80.2341 },
  velachery: { lat: 12.9815, lng: 80.218 },
  'anna nagar': { lat: 13.085, lng: 80.2101 },
  coimbatore: { lat: 11.0168, lng: 76.9558 },
  'rs puram': { lat: 11.0089, lng: 76.951 },
  madurai: { lat: 9.9252, lng: 78.1198 },
  'kk nagar': { lat: 9.9391, lng: 78.145 },
};

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured on the server.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return Math.round(R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s)) * 10) / 10;
}

function inferUserCoords(locationText: string, coords?: { lat: number; lng: number }): { lat: number; lng: number } {
  if (coords && Number.isFinite(coords.lat) && Number.isFinite(coords.lng)) {
    return coords;
  }
  const normalized = locationText.toLowerCase();
  for (const [key, val] of Object.entries(CITY_COORDS)) {
    if (normalized.includes(key)) {
      return val;
    }
  }
  return CITY_COORDS.chennai;
}

export interface MatchInput {
  concern: string;
  budget: number;
  location: string;
  symptoms?: string;
  preferredTravelArea?: string;
  language: Language;
  coordinates?: { lat: number; lng: number };
  attachment?: {
    mimeType: string;
    base64Data: string;
    fileName: string;
  };
}

export async function runAiDoctorMatch(input: MatchInput, doctors: DoctorProfile[]): Promise<AiMatchResponse> {
  const combinedText = `${input.concern} ${input.symptoms || ''}`.toLowerCase();
  const keywordEmergency = EMERGENCY_KEYWORDS.some((kw) => combinedText.includes(kw));

  const ai = getAiClient();

  const doctorCatalogSummary = doctors.map((d) => ({
    id: d.id,
    name: input.language === 'ta' ? d.nameTa : d.name,
    specialties: d.specialties,
    city: d.city,
    area: d.area,
    fee: d.consultationFee,
    yearsExperience: d.yearsExperience,
    verified: d.verificationStatus === 'verified',
    caseTopics: d.caseStudies.filter((c) => c.status === 'verified').map((c) => c.title),
    nextSlot: d.availableSlots[0] ? `${d.availableSlots[0].date} ${d.availableSlots[0].times[0] || ''}`.trim() : 'Contact clinic',
    waitMins: d.expectedWaitMinutes,
  }));

  const targetLangLabel = getLanguageLabel(input.language);

  const systemInstruction = `You are First Cure's empathetic, accessible healthcare navigation assistant.
CRITICAL RULES:
1. Respond ONLY in ${targetLangLabel}.
2. NEVER present yourself as a doctor, NEVER provide a confirmed medical diagnosis, and NEVER prescribe medications.
3. Explicitly frame all guidance as informational care navigation and encourage consulting a qualified healthcare professional.
4. Detect possible emergencies (severe chest pain, shortness of breath, stroke signs, heavy bleeding, loss of consciousness, severe allergic swelling, self-harm). If detected, set isEmergency=true and direct immediately to emergency services (108 / 112).
5. Rank and explain the best matching doctors from the provided catalog based ONLY on clinical specialty alignment, verified case experience, consultation fee vs budget, location/travel preference, and availability. NEVER consider ethnicity or protected attributes.
6. Keep medical language plain, warm, and understandable for someone with any level of health literacy.`;

  const promptText = `Patient Care Request:
- Health Concern: ${input.concern}
- Symptoms: ${input.symptoms || 'Not specified'}
- Budget (INR): ₹${input.budget}
- Current Location: ${input.location}
- Preferred Travel Area: ${input.preferredTravelArea || 'Flexible'}
- Preferred Language: ${targetLangLabel}
${input.attachment ? `- Uploaded file (${input.attachment.fileName}): attached for informational context.` : ''}

Available Verified & Registered Doctors Catalog:
${JSON.stringify(doctorCatalogSummary, null, 2)}

Return JSON matching the schema with:
- isEmergency (boolean)
- emergencyMessage (string, clear urgent guidance in ${targetLangLabel} if isEmergency is true)
- guidanceSummary (string, 2-3 clear sentences of informational care navigation in ${targetLangLabel}, non-diagnostic)
- suggestedSpecialties (array of 1-3 relevant medical specialty strings)
- reportAnalysis (string, brief plain-language summary of uploaded photo/report if attached, or empty string)
- rankedDoctors (array of up to 4 doctor recommendations ordered best-first with doctorId, matchScore 1-100, and whyRecommended array of 3 concise plain-language reasons in ${targetLangLabel} covering specialty/experience, budget fit, and location/availability).`;

  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];
  if (input.attachment && input.attachment.base64Data) {
    parts.push({
      inlineData: {
        mimeType: input.attachment.mimeType,
        data: input.attachment.base64Data,
      },
    });
  }
  parts.push({ text: promptText });

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: { parts },
    config: {
      systemInstruction,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          isEmergency: { type: Type.BOOLEAN },
          emergencyMessage: { type: Type.STRING },
          guidanceSummary: { type: Type.STRING },
          suggestedSpecialties: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          reportAnalysis: { type: Type.STRING },
          rankedDoctors: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                doctorId: { type: Type.STRING },
                matchScore: { type: Type.NUMBER },
                whyRecommended: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
              },
              required: ['doctorId', 'matchScore', 'whyRecommended'],
            },
          },
        },
        required: ['isEmergency', 'guidanceSummary', 'suggestedSpecialties', 'rankedDoctors'],
      },
    },
  });

  const rawText = (response.text ?? '{}')
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '');

  const parsed = JSON.parse(rawText) as {
    isEmergency: boolean;
    emergencyMessage?: string;
    guidanceSummary: string;
    suggestedSpecialties: string[];
    reportAnalysis?: string;
    rankedDoctors: Array<{
      doctorId: string;
      matchScore: number;
      whyRecommended: string[];
    }>;
  };

  const isEmergency = Boolean(parsed.isEmergency || keywordEmergency);
  const userCoords = inferUserCoords(input.location, input.coordinates);

  const matches: MatchedDoctorResult[] = [];
  for (const item of parsed.rankedDoctors || []) {
    const doc = doctors.find((d) => d.id === item.doctorId);
    if (!doc) continue;
    const distanceKm = haversineKm(userCoords, doc.coordinates);
    const firstSlot = doc.availableSlots[0];
    const nextSlot = firstSlot && firstSlot.times[0] ? `${firstSlot.date} · ${firstSlot.times[0]}` : 'By request';
    matches.push({
      doctor: doc,
      matchScore: Math.max(1, Math.min(100, Math.round(item.matchScore))),
      distanceKm,
      withinBudget: doc.consultationFee <= input.budget,
      nextAvailableSlot: nextSlot,
      whyRecommended: item.whyRecommended.slice(0, 4),
    });
  }

  if (matches.length === 0) {
    for (const doc of doctors.slice(0, 3)) {
      const distanceKm = haversineKm(userCoords, doc.coordinates);
      const firstSlot = doc.availableSlots[0];
      const nextSlot = firstSlot && firstSlot.times[0] ? `${firstSlot.date} · ${firstSlot.times[0]}` : 'By request';
      matches.push({
        doctor: doc,
        matchScore: doc.consultationFee <= input.budget ? 82 : 68,
        distanceKm,
        withinBudget: doc.consultationFee <= input.budget,
        nextAvailableSlot: nextSlot,
        whyRecommended:
          input.language === 'ta'
            ? [
                `${doc.specialtiesTa[0] || doc.specialties[0]} நிபுணர் (${doc.yearsExperience} ஆண்டுகள் அனுபவம்)`,
                `ஆலோசனைக் கட்டணம் ₹${doc.consultationFee}`,
                `${doc.area}, ${doc.city} (${distanceKm} கி.மீ)`,
              ]
            : [
                `${doc.specialties[0]} specialist with ${doc.yearsExperience} yrs experience`,
                `Consultation fee ₹${doc.consultationFee} vs your ₹${input.budget} budget`,
                `Located in ${doc.area}, ${doc.city} (${distanceKm} km away)`,
              ],
      });
    }
  }

  const disclaimer =
    input.language === 'ta'
      ? 'First Cure AI ஒரு மருத்துவ வழிகாட்டி மட்டுமே — மருத்துவர் அல்ல. இது உறுதியான நோயறிதல் வழங்காது; தகுதிவாய்ந்த மருத்துவரை நேரில் அணுகவும்.'
      : 'First Cure AI is an informational care guide, not a doctor. It does not provide a confirmed diagnosis. Please consult a qualified healthcare professional.';

  const emergencyFallback =
    input.language === 'ta'
      ? 'உங்கள் அறிகுறிகளுக்கு உடனடி அவசர மருத்துவ உதவி தேவைப்படலாம். தயவுசெய்து உடனே 108 அல்லது 112 ஐ அழைக்கவும் அல்லது அருகிலுள்ள அவசர சிகிச்சைப் பிரிவுக்குச் செல்லவும்.'
      : 'Your description may require urgent medical attention. Please call local emergency services (108 / 112) or go to the nearest emergency department immediately.';

  return {
    isEmergency,
    emergencyMessage: isEmergency ? parsed.emergencyMessage || emergencyFallback : undefined,
    guidanceSummary: parsed.guidanceSummary,
    suggestedSpecialties: parsed.suggestedSpecialties || [],
    disclaimer,
    reportAnalysis: parsed.reportAnalysis || undefined,
    matches,
  };
}

export async function runGeminiCareChat(params: {
  history: ChatMessage[];
  message: string;
  language: Language;
  speedMode?: 'fast' | 'balanced';
  doctors: DoctorProfile[];
}): Promise<ChatResponse> {
  const ai = getAiClient();
  const isEmergency = EMERGENCY_KEYWORDS.some((kw) => params.message.toLowerCase().includes(kw));
  const targetLang = getLanguageLabel(params.language);
  const model = params.speedMode === 'fast' ? 'gemini-3.1-flash-lite' : 'gemini-4-hydrogen';

  const specialtiesList = Array.from(new Set(params.doctors.flatMap((d) => d.specialties))).join(', ');

  const systemInstruction = `You are First Cure's friendly bilingual healthcare navigation chatbot.
- Respond strictly in ${targetLang}.
- Explain medical terms simply for everyday patients.
- Help users understand which medical specialist fits their questions (available specialties on First Cure: ${specialtiesList}), how to prepare for a clinic visit, and how fees/records work.
- NEVER diagnose conditions or prescribe treatments; remind users gently to consult a qualified doctor.
- If the user mentions chest pain, breathing difficulty, stroke signs, fainting, heavy bleeding, or self-harm, tell them immediately to call 108 / 112 emergency services.`;

  const contents = [
    ...params.history.slice(-12).map((m) => ({
      role: m.role,
      parts: [{ text: m.text }],
    })),
    {
      role: 'user' as const,
      parts: [{ text: params.message }],
    },
  ];

  const response = await ai.models.generateContent({
    model,
    contents,
    config: {
      systemInstruction,
    },
  });

  const reply = (response.text ?? '').trim() || (
    params.language === 'ta'
      ? 'மன்னிக்கவும், இப்போது பதில் அளிக்க முடியவில்லை. மீண்டும் முயற்சிக்கவும்.'
      : 'I could not generate a reply right now. Please try asking again.'
  );

  return {
    reply,
    isEmergency,
    emergencyMessage: isEmergency
      ? params.language === 'ta'
        ? 'உடனடி அவசர உதவிக்கு 108 அல்லது 112 ஐ அழைக்கவும்.'
        : 'For urgent symptoms, please call 108 / 112 or visit the nearest emergency department immediately.'
      : undefined,
    modelUsed: model,
  };
}

export async function runMapsGroundedCareSearch(params: {
  query: string;
  location: string;
  language: Language;
  coordinates?: { lat: number; lng: number };
}): Promise<MapsGroundedResponse> {
  const ai = getAiClient();
  const coords = inferUserCoords(params.location, params.coordinates);
  const targetLang = getLanguageLabel(params.language);

  const prompt = `In ${targetLang}, help a patient near ${params.location} with: ${params.query}. List real nearby clinics, pharmacies, diagnostic labs, or emergency hospitals with practical details.`;

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: prompt,
    config: {
      tools: [{ googleMaps: {} }],
      toolConfig: {
        retrievalConfig: {
          latLng: {
            latitude: coords.lat,
            longitude: coords.lng,
          },
        },
      },
    },
  });

  const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
  const places: MapsGroundingPlace[] = [];

  for (const chunk of chunks) {
    const mapsInfo = (chunk as {
      maps?: {
        title?: string;
        uri?: string;
        placeAnswerSources?: { reviewSnippets?: Array<{ content?: string }> };
      };
    }).maps;
    if (mapsInfo?.uri) {
      const snippets = (mapsInfo.placeAnswerSources?.reviewSnippets || [])
        .map((s) => s.content)
        .filter((s): s is string => Boolean(s));
      places.push({
        title: mapsInfo.title || 'Google Maps Place',
        uri: mapsInfo.uri,
        reviewSnippets: snippets.length > 0 ? snippets : undefined,
      });
    }
  }

  return {
    answer: (response.text ?? '').trim(),
    places,
  };
}
