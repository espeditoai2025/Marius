/**
 * judge.ts — Valutazione delle risposte (LLM-as-judge) con Claude via OpenRouter.
 * Misura quanto la risposta è ancorata al contesto (groundedness) e corretta.
 */
import { chatCompletion, JUDGE_MODEL } from './openrouter';

export interface JudgeResult {
  score: number;          // 0-100 complessivo
  groundedness: number;   // 0-100: supportata dal contesto, senza invenzioni
  correctness: number;    // 0-100: corretta rispetto a contesto/risposta attesa
  feedback: string;       // 1-2 frasi
}

const SYSTEM = `Sei un valutatore rigoroso di risposte di un assistente AI finanziario basato su RAG.
Valuta la RISPOSTA DELL'AGENTE rispetto a:
- la DOMANDA,
- il CONTESTO recuperato dai documenti (unica fonte di verità ammessa),
- la RISPOSTA ATTESA, se fornita.

Assegna tre punteggi interi 0-100:
- "groundedness": quanto la risposta è supportata dal CONTESTO senza inventare dati. Se afferma numeri/fatti non presenti nel contesto, abbassa molto.
- "correctness": quanto è corretta nei fatti (rispetto alla risposta attesa, se c'è, altrimenti al contesto).
- "score": valutazione complessiva.
Aggiungi "feedback": 1-2 frasi concise in italiano sul punto debole principale.

Rispondi ESCLUSIVAMENTE con un oggetto JSON valido, senza testo aggiuntivo:
{"score": <int>, "groundedness": <int>, "correctness": <int>, "feedback": "<string>"}`;

function clamp(n: unknown): number {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(100, v));
}

function parseJudge(text: string): JudgeResult {
  try {
    const match = text.match(/\{[\s\S]*\}/);
    const j = JSON.parse(match ? match[0] : text);
    return {
      score: clamp(j.score),
      groundedness: clamp(j.groundedness),
      correctness: clamp(j.correctness),
      feedback: String(j.feedback ?? '').slice(0, 500),
    };
  } catch {
    return { score: 0, groundedness: 0, correctness: 0, feedback: 'Valutazione non interpretabile.' };
  }
}

export async function judgeAnswer(params: {
  question: string;
  answer: string;
  context: string;
  expected?: string;
}): Promise<JudgeResult> {
  const { question, answer, context, expected } = params;

  const user = [
    `DOMANDA:\n${question}`,
    `CONTESTO RECUPERATO:\n${context || '(nessun contesto recuperato)'}`,
    expected ? `RISPOSTA ATTESA:\n${expected}` : null,
    `RISPOSTA DELL'AGENTE:\n${answer}`,
  ].filter(Boolean).join('\n\n---\n\n');

  const { content } = await chatCompletion(
    [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: user },
    ],
    { model: JUDGE_MODEL, temperature: 0, maxTokens: 700 }
  );

  return parseJudge(content);
}
