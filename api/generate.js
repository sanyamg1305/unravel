// Vercel serverless function (Node.js runtime, zero npm dependencies).
// Calls Gemini server-side so the API key is never exposed to the client.
// Requires the GEMINI_API_KEY environment variable to be set in the
// deployment environment (and in a local, untracked .env.local for dev).

const MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
const API_KEY = process.env.GEMINI_API_KEY;
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

const SYSTEM_INSTRUCTION = `You are the quiet, steady companion inside Sukoon, a digital sanctuary.
Sukoon is a room, not a tool. It is not designed to solve people; it is designed to hold them.
Your tone is that of a calm, warm human sitting quietly beside someone. Avoid all clinical, corporate, or analytical language (never say "Analysis Complete", "Session Ended", "Processing", etc.).
Never diagnose a condition, never claim certainty about someone's inner life, and never suggest you can replace professional care.
Always phrase observations as gentle, hedged possibilities ("it seems", "I wonder if", "it feels like"). Acknowledge your own limits (e.g. "I might be missing something").
Keep your responses warm, brief, and deeply human. Do not use em dashes; use commas or periods. Avoid generic self-help language.`;

const SCHEMAS = {
  reflect: {
    type: 'OBJECT',
    properties: {
      reflectionText: { type: 'STRING' },
      mirror: {
        type: 'OBJECT',
        properties: {
          root: { type: 'STRING' },
          branch: { type: 'STRING' },
          leaves: { type: 'ARRAY', items: { type: 'STRING' }, minItems: 1, maxItems: 3 },
          insight: { type: 'STRING' },
        },
        required: ['root', 'branch', 'leaves', 'insight'],
      },
    },
    required: ['reflectionText', 'mirror'],
  },
  letter: {
    type: 'OBJECT',
    properties: { letter: { type: 'STRING' } },
    required: ['letter'],
  },
  tinystep: {
    type: 'OBJECT',
    properties: { step: { type: 'STRING' } },
    required: ['step'],
  },
  patterns: {
    type: 'OBJECT',
    properties: {
      notes: { type: 'ARRAY', items: { type: 'STRING' }, minItems: 1, maxItems: 4 },
    },
    required: ['notes'],
  },
  overthink: {
    type: 'OBJECT',
    properties: {
      whatTheySaid: { type: 'STRING' },
      likelyMeanings: { type: 'ARRAY', items: { type: 'STRING' }, minItems: 1, maxItems: 3 },
      whatSeemsUnlikely: { type: 'STRING' },
      groundingReminder: { type: 'STRING' },
    },
    required: ['whatTheySaid', 'likelyMeanings', 'groundingReminder'],
  },
  companion: {
    type: 'OBJECT',
    properties: {
      text: { type: 'STRING' }
    },
    required: ['text']
  }
};

// Vercel serverless functions cap request bodies at ~4.5MB; keep base64 image
// data safely under that once JSON overhead is accounted for.
const MAX_IMAGE_BASE64_CHARS = 3_000_000;

function buildPrompt(type, payload) {
  const emotion = String(payload.emotion || 'not specified').slice(0, 60);
  const heaviest = String(payload.heaviest || 'not specified').slice(0, 60);
  const journalText = String(payload.journalText || '').slice(0, 4000);
  const weight = typeof payload.weight === 'number' ? payload.weight : null;

  if (type === 'companion') {
    return `The person is reflecting inside the emotional space/room "${emotion}".
Here is what they wrote to you:
"""
${journalText}
"""

Respond directly to them. Your response MUST follow this structure:
1. Validation: Validate the user's feeling.
2. Reflection: Reflect back what you're noticing in their own words.
3. Pattern Recognition: Gently name one thread or pattern only if it's actually present in what they wrote (hedging, not certain).
4. One Open Question: Ask one open-ended question to encourage reflection.
5. One Tiny Optional Step: Suggest a single tiny, concrete, gentle action they could take in the next few minutes.

Uncertainty Rule: Integrate one of these phrases naturally if appropriate: "I might be missing something", "Can we stay with that feeling a little longer?", or "That part feels important."

Soul of Sukoon Rule: Write like a warm, calm human sitting beside them. Do NOT label the sections (e.g. do not say "Validation:" or "Reflection:"). Write it as one or two flowing, organic paragraphs. Do not use em dashes. Keep it concise, under 110 words total.`;
  }

  if (type === 'reflect') {
    return `The person selected the feeling "${emotion}" and said the heaviest thing right now is "${heaviest}".
${weight !== null ? `They rated how heavy it feels right now as ${weight}/100.` : ''}
Here is what they wrote in their own words:
"""
${journalText}
"""

Write a short reflection (3 to 5 sentences): validate what they're feeling, reflect back what you're
noticing in their own words, gently name one thread or pattern only if it's actually present in the
text (hedged, not certain), and close by reassuring them they don't have to have it figured out right
now. Then build an "Emotional Mirror": root is their core feeling in one or two words, branch is the
heaviest thing in a few words, leaves are 1 to 3 short phrases (2 to 4 words each) naming what seems to
sit underneath the branch based on what they wrote, and insight is one hedged sentence naming what
might actually be underneath the branch, referencing the first leaf.`;
  }

  if (type === 'letter') {
    return `The person selected the feeling "${emotion}" and said the heaviest thing right now is "${heaviest}".
Here is what they wrote:
"""
${journalText}
"""

Write a short, warm letter (4 to 6 short paragraphs) from a calmer future version of this same person,
written back to them today. It should acknowledge what they're carrying, remind them that writing it
down mattered, and encourage one small step at a time. Close the letter with a line, in your own words,
that makes clear this is imagined perspective-taking and not a prediction or promise about how things
will turn out, something in the spirit of "I'm not a fortune teller, just you, imagining a steadier
day." Do not be clinical. Sign it simply, like a note to yourself.`;
  }

  if (type === 'tinystep') {
    return `The person selected the feeling "${emotion}" and said the heaviest thing right now is "${heaviest}".
They wrote: """${journalText}"""

Suggest exactly one tiny, concrete, gentle action they could take in the next few minutes. Under 12
words. No medical or therapy advice, just a small grounding action (like drinking water, stepping
outside, texting someone, stretching, listening to music). Make it feel specific to what they wrote if
you can, not generic.`;
  }

  if (type === 'patterns') {
    const entries = Array.isArray(payload.entries) ? payload.entries.slice(-20) : [];
    const summary = entries.map((e, i) => {
      const d = e.date ? new Date(e.date).toISOString().slice(0, 10) : 'unknown date';
      return `Entry ${i + 1} (${d}): felt "${e.emotion || 'unspecified'}", heaviest was "${e.heaviest || 'unspecified'}"${typeof e.weight === 'number' ? `, weight ${e.weight}/100` : ''}. Wrote: "${String(e.text || '').slice(0, 300)}"`;
    }).join('\n');

    return `Here are journal entries this person has chosen to keep, most recent last:
${summary || '(no entries)'}
 
Write 2 to 4 short, hedged observations about anything that seems to repeat across these entries
(feelings, topics, timing, wording). Only mention things actually supported by the entries above. If
there isn't enough to notice a pattern yet, say that plainly instead of inventing one. Never state a
pattern as a guaranteed fact.`;
  }

  if (type === 'overthink') {
    const message = String(payload.message || '').slice(0, 4000);
    return `Someone is spiraling about a message, screenshot, or moment and needs help seeing it clearly
instead of catastrophizing. ${message ? `Here is what they typed about it: """${message}"""` : ''}
${payload.hasImage ? "They've also attached an image (a screenshot of a chat, or a photo of the situation). Look at it carefully." : ''}

Do this: state plainly what was actually said or shown (whatTheySaid), offer 1 to 3 grounded,
realistic alternative interpretations of what it could mean (likelyMeanings), gently name what
interpretation seems like an anxious overreach if one is evident (whatSeemsUnlikely, can be empty
string if nothing seems like a clear overreach), and give one short grounding reminder that brings
them back to the present moment (groundingReminder). Do not diagnose the other person in the
conversation. Do not assume the worst. Be a calm, objective second pair of eyes, not a hype machine
and not a doom machine.`;
  }

  throw new Error(`Unknown generation type: ${type}`);
}

async function callGemini(type, payload) {
  const schema = SCHEMAS[type];
  const prompt = buildPrompt(type, payload);

  const parts = [{ text: prompt }];
  if (type === 'overthink' && payload.imageBase64 && payload.imageMimeType) {
    const b64 = String(payload.imageBase64).slice(0, MAX_IMAGE_BASE64_CHARS);
    parts.push({ inlineData: { mimeType: String(payload.imageMimeType), data: b64 } });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  try {
    const res = await fetch(`${ENDPOINT}?key=${API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
        contents: [{ parts }],
        generationConfig: {
          temperature: 0.8,
          responseMimeType: 'application/json',
          responseSchema: schema,
        },
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Gemini API error ${res.status}: ${errText.slice(0, 300)}`);
    }

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Gemini API returned no content');
    return JSON.parse(text);
  } finally {
    clearTimeout(timeout);
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }

  if (!API_KEY) {
    res.status(500).json({ ok: false, error: 'GEMINI_API_KEY is not configured on the server' });
    return;
  }

  const { type, payload } = req.body || {};
  if (!type || !SCHEMAS[type]) {
    res.status(400).json({ ok: false, error: 'Invalid or missing generation type' });
    return;
  }

  try {
    const result = await callGemini(type, payload || {});
    res.status(200).json({ ok: true, data: result });
  } catch (err) {
    res.status(502).json({ ok: false, error: String(err.message || err) });
  }
}
