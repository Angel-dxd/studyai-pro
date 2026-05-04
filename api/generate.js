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
      // Usar pdf-parse para extraer texto
      try {
        const pdfParse = (await import('pdf-parse/lib/pdf-parse.js')).default;
        const data = await pdfParse(buf);
        text = data.text || '';
      } catch(e) {
        // Fallback manual si pdf-parse falla
        text = extractManual(buf);
      }
    }

    if (text.length < 50 && prompt) {
      const m = prompt.match(/CONTENIDO:\n([\s\S]*?)\n\nResponde/);
      text = m ? m[1] : '';
    }

    if (text.length < 50) {
      return res.status(400).json({ error: 'No se pudo leer el PDF. Asegúrate de que el PDF tiene texto seleccionable.' });
    }

    const numMatch = prompt ? prompt.match(/EXACTAMENTE (\d+) preguntas/) : null;
    const numQ = numMatch ? parseInt(numMatch[1]) : 10;
    const questions = generateQuestions(text, numQ);

    if (questions.length < 2) {
      return res.status(400).json({ error: 'Texto insuficiente. El PDF tiene poco texto legible.' });
    }

    return res.status(200).json({
      content: [{ type: 'text', text: JSON.stringify({ questions }) }]
    });

  } catch (e) {
    return res.status(500).json({ error: 'Error del servidor: ' + e.message });
  }
}

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
        const inner = p.slice(1,-1).replace(/\\n/g,' ').replace(/\\\d{3}/g,'').replace(/\\[()\\]/g,'');
        if (/[a-zA-ZáéíóúñÁÉÍÓÚÑ]{3,}/.test(inner) && !/[\x00-\x08]/.test(inner)) t += inner + ' ';
      });
    }
  } catch(e) {}
  return t.replace(/\s+/g,' ').trim();
}

function generateQuestions(text, numQ) {
  const sentences = text
    .split(/[.!?\n]+/)
    .map(s => s.trim())
    .filter(s => s.length > 40 && s.length < 400 && /[a-zA-ZáéíóúñÁÉÍÓÚÑ]{4,}/.test(s) && s.split(' ').length >= 6);

  const questions = [];
  const used = new Set();
  const shuffled = [...sentences].sort(() => Math.random() - 0.5);

  const qTemplates = [
    s => `¿Qué afirma el texto sobre "${kw(s)}"?`,
    s => `Según el contenido, ¿cuál es correcto respecto a "${kw(s)}"?`,
    s => `¿Cuál de las siguientes opciones describe mejor "${kw(s)}"?`,
    s => `De acuerdo con el material, ¿qué es "${kw(s)}"?`,
    s => `¿Qué característica tiene "${kw(s)}" según el texto?`,
  ];

  for (let i = 0; i < shuffled.length && questions.length < numQ; i++) {
    const sentence = shuffled[i];
    if (used.has(sentence)) continue;
    used.add(sentence);

    const correct = clean(sentence);
    if (!correct || correct.length < 15) continue;

    const distractors = shuffled
      .filter(s => s !== sentence)
      .slice(0, 15)
      .map(s => clean(s))
      .filter(d => d && d !== correct && d.length > 10)
      .slice(0, 3);

    if (distractors.length < 3) continue;

    const tpl = qTemplates[i % qTemplates.length];
    const options = [correct, ...distractors].sort(() => Math.random() - 0.5);

    questions.push({
      question: tpl(sentence),
      options,
      correct: options.indexOf(correct),
      explanation: 'Esta información aparece directamente en el contenido del documento.'
    });
  }
  return questions;
}

function kw(s) {
  const stop = new Set(['para','como','este','esta','tiene','pero','cuando','donde','según','también','puede','deben','será','están','cada','todo','toda','una','uno','sus','más','sin','sobre','entre','que','con','por','los','las','del']);
  const words = s.split(/\s+/).filter(w => w.length > 4 && !stop.has(w.toLowerCase()));
  return words[Math.floor(Math.random() * Math.min(3, words.length))] || 'este tema';
}

function clean(s) {
  return s.trim().replace(/^[,;:\-–\s]+/, '').split(/[,;]/)[0].trim().slice(0, 100);
}
