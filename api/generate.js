export const config = { api: { bodyParser: { sizeLimit: '10mb' } } };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { prompt, pdfBase64 } = req.body;
    let text = '';

    if (pdfBase64) {
      const buf = Buffer.from(pdfBase64, 'base64');
      try {
        const pdfParse = (await import('pdf-parse/lib/pdf-parse.js')).default;
        const data = await pdfParse(buf);
        text = data.text || '';
      } catch (e) {
        text = extractManual(buf);
      }
    }

    text = cleanTextHard(text);

    if (text.split(' ').length < 200) {
      return res.status(400).json({ error: 'PDF con poco contenido útil.' });
    }

    const numMatch = prompt ? prompt.match(/EXACTAMENTE (\d+) preguntas/) : null;
    const numQ = numMatch ? parseInt(numMatch[1]) : 10;

    const rawQuestions = generateQuestions(text, numQ * 3);

    const questions = rawQuestions
      .map(q => ({ ...q, score: scoreQuestion(q) }))
      .filter(isValidQuestion)
      .sort((a, b) => b.score - a.score)
      .slice(0, numQ);

    if (questions.length < 3) {
      return res.status(400).json({ error: 'No se pudo generar contenido suficiente.' });
    }

    return res.status(200).json({
      content: [{ type: 'text', text: JSON.stringify({ questions }) }]
    });

  } catch (e) {
    return res.status(500).json({ error: 'Error: ' + e.message });
  }
}

// ─────────────────────────────
// LIMPIEZA FUERTE DEL TEXTO
// ─────────────────────────────
function cleanTextHard(text) {
  return text
    .replace(/([a-záéíóúñ])([A-ZÁÉÍÓÚÑ])/g, '$1 $2') // separa palabras pegadas
    .replace(/\b(página|figura|tabla|capítulo|unidad|tema)\b/gi, '')
    .replace(/\d+\s*\/\s*\d+/g, '')
    .replace(/[^\w\sáéíóúñÁÉÍÓÚ.,;:()%-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ─────────────────────────────
// FALLBACK PDF
// ─────────────────────────────
function extractManual(buf) {
  let t = '';
  try {
    const raw = buf.toString('latin1');
    const sr = /stream([\s\S]*?)endstream/g;
    let m;
    while ((m = sr.exec(raw)) !== null) {
      const chunk = m[1];
      const parens = chunk.match(/\(([^)]{3,150})\)/g);
      if (parens) parens.forEach(p => {
        const inner = p.slice(1, -1)
          .replace(/\\n/g, ' ')
          .replace(/\\\d{3}/g, '')
          .replace(/\\[()\\]/g, '');
        if (/[a-zA-ZáéíóúñÁÉÍÓÚÑ]{3,}/.test(inner)) t += inner + ' ';
      });
    }
  } catch (e) {}
  return t.replace(/\s+/g, ' ').trim();
}

// ─────────────────────────────
// GENERACIÓN DE PREGUNTAS
// ─────────────────────────────
function generateQuestions(text, numQ) {
  const paragraphs = text.split(/\n{2,}/).filter(p => p.length > 150);
  const questions = [];

  for (const p of paragraphs) {
    const sentences = p.split(/[.!?]+/)
      .map(s => s.trim())
      .filter(isStrongSentence);

    for (const s of sentences) {
      if (questions.length >= numQ) break;

      if (looksLikeTitle(s)) continue;

      const correct = s.slice(0, 120);
      if (!isValidOption(correct)) continue;

      const distractors = smartDistractors(correct, sentences);

      if (distractors.length < 3) continue;

      const options = shuffle([correct, ...distractors])
        .filter(isValidOption)
        .slice(0, 4);

      if (options.length < 4) continue;

      const isTrap = Math.random() < 0.25;

      const correctIndex = isTrap
        ? options.findIndex(o => o !== correct)
        : options.indexOf(correct);

      const question = isTrap
        ? `¿Cuál de las siguientes afirmaciones es INCORRECTA?`
        : `¿Cuál de las siguientes afirmaciones es correcta?`;

      questions.push({
        question,
        options: normalizeOptions(options),
        correct: correctIndex,
        explanation: correct
      });
    }
  }

  return questions;
}

// ─────────────────────────────
// FILTROS INTELIGENTES
// ─────────────────────────────
function isStrongSentence(s) {
  return (
    s.length > 50 &&
    s.length < 180 &&
    s.includes(' ') &&
    /[a-záéíóúñ]/i.test(s) &&
    !/[A-Z]{5,}/.test(s) &&
    !/\d{3,}/.test(s) &&
    s.split(' ').length >= 8
  );
}

function looksLikeTitle(s) {
  return s.split(' ').length < 6;
}

function isValidOption(o) {
  return (
    o &&
    o.length > 20 &&
    o.length < 150 &&
    o.includes(' ') &&
    !/[A-Z]{6,}/.test(o) &&
    !/\d{3,}/.test(o) &&
    !o.includes('http')
  );
}

// ─────────────────────────────
// DISTRACCIONES INTELIGENTES
// ─────────────────────────────
function smartDistractors(correct, pool) {
  return pool
    .filter(p => p !== correct && isValidOption(p))
    .map(p => ({
      text: p,
      score: Math.abs(p.length - correct.length)
    }))
    .sort((a, b) => a.score - b.score)
    .slice(0, 3)
    .map(x => x.text);
}

// ─────────────────────────────
// NORMALIZAR OPCIONES
// ─────────────────────────────
function normalizeOptions(options) {
  const avg = options.reduce((a, b) => a + b.length, 0) / options.length;
  return options.map(o => o.length > avg * 1.5 ? o.slice(0, avg) : o);
}

// ─────────────────────────────
// VALIDACIÓN Y SCORE
// ─────────────────────────────
function isValidQuestion(q) {
  if (!q.question || q.question.length < 10) return false;
  if (!q.options || q.options.length !== 4) return false;

  const unique = new Set(q.options.map(o => o.toLowerCase()));
  if (unique.size < 4) return false;

  if (q.options.some(o => o.length < 10)) return false;

  return true;
}

function scoreQuestion(q) {
  let score = 0;

  if (q.question.length > 30) score += 2;

  const lengths = q.options.map(o => o.length);
  if (Math.max(...lengths) - Math.min(...lengths) < 50) score += 2;

  const unique = new Set(q.options);
  if (unique.size === 4) score += 2;

  return score;
}

// ─────────────────────────────
// UTIL
// ─────────────────────────────
function shuffle(arr) {
  return arr.sort(() => Math.random() - 0.5);
}
