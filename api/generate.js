import { Buffer } from 'buffer';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { prompt, pdfBase64 } = req.body;

    let text = '';

    // Si viene PDF en base64, extraerlo en el servidor
    if (pdfBase64) {
      const buf = Buffer.from(pdfBase64, 'base64');
      text = extractPdfText(buf);
    }

    // Si no se pudo extraer del PDF, usar el texto del prompt
    if (text.length < 50 && prompt) {
      const contentMatch = prompt.match(/CONTENIDO:\n([\s\S]*?)\n\nResponde/);
      text = contentMatch ? contentMatch[1] : prompt;
    }

    if (text.length < 50) {
      return res.status(400).json({ error: 'No se pudo extraer texto del documento' });
    }

    // Extraer parámetros
    const numMatch = prompt ? prompt.match(/EXACTAMENTE (\d+) preguntas/) : null;
    const numQ = numMatch ? parseInt(numMatch[1]) : 10;

    const questions = generateQuestions(text, numQ);

    if (questions.length < 2) {
      return res.status(400).json({ error: 'Texto insuficiente para generar preguntas. Prueba con un PDF con más contenido.' });
    }

    return res.status(200).json({
      content: [{ type: 'text', text: JSON.stringify({ questions }) }]
    });

  } catch (e) {
    return res.status(500).json({ error: 'Error: ' + e.message });
  }
}

function extractPdfText(buf) {
  let text = '';
  try {
    const raw = buf.toString('binary');

    // Extraer streams de texto
    const streamReg = /stream([\s\S]*?)endstream/g;
    let m;
    while ((m = streamReg.exec(raw)) !== null) {
      const chunk = m[1];
      // Buscar texto en paréntesis (formato PDF estándar)
      const parens = chunk.match(/\(([^)]{2,200})\)/g);
      if (parens) {
        parens.forEach(p => {
          const inner = p.slice(1,-1)
            .replace(/\\n/g, ' ')
            .replace(/\\r/g, ' ')
            .replace(/\\\d{3}/g, '')
            .replace(/\\[()\\]/g, '');
          if (/[a-zA-ZáéíóúñÁÉÍÓÚÑ]{3,}/.test(inner) && !/[\x00-\x08\x0E-\x1F]/.test(inner)) {
            text += inner + ' ';
          }
        });
      }
      // TJ operator
      const tjReg = /\[(.*?)\]\s*TJ/g;
      let tj;
      while ((tj = tjReg.exec(chunk)) !== null) {
        const parts = tj[1].match(/\(([^)]+)\)/g);
        if (parts) parts.forEach(p => { text += p.slice(1,-1) + ' '; });
      }
    }

    // Buscar texto UTF-16 (presentaciones)
    const utf16 = buf.toString('utf16le');
    const words = utf16.match(/[a-zA-ZáéíóúñÁÉÍÓÚÑ\s]{5,}/g);
    if (words) words.forEach(w => { if (w.trim().length > 4) text += w.trim() + ' '; });

    // Limpiar
    text = text
      .replace(/[^\x20-\x7EáéíóúñÁÉÍÓÚÑüÜ\s.,;:!?()]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  } catch(e) {}
  return text;
}

function generateQuestions(text, numQ) {
  const sentences = text
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 40 && s.length < 400 && /[a-zA-ZáéíóúñÁÉÍÓÚÑ]{4,}/.test(s) && s.split(' ').length > 5);

  const questions = [];
  const used = new Set();
  const shuffled = [...sentences].sort(() => Math.random() - 0.5);

  const qTemplates = [
    s => `¿Qué afirma el texto sobre "${extractKeyword(s)}"?`,
    s => `Según el contenido, ¿cuál es correcto respecto a "${extractKeyword(s)}"?`,
    s => `¿Cuál de las siguientes opciones describe mejor "${extractKeyword(s)}"?`,
    s => `De acuerdo con el material estudiado, ¿qué es "${extractKeyword(s)}"?`,
    s => `¿Qué característica tiene "${extractKeyword(s)}" según el texto?`,
  ];

  for (let i = 0; i < shuffled.length && questions.length < numQ; i++) {
    const sentence = shuffled[i];
    if (used.has(sentence)) continue;
    used.add(sentence);

    const correct = cleanAnswer(sentence);
    if (!correct || correct.length < 15) continue;

    const distractors = shuffled
      .filter(s => s !== sentence && !used.has(s))
      .slice(0, 10)
      .map(s => cleanAnswer(s))
      .filter(d => d && d !== correct && d.length > 10)
      .slice(0, 3);

    if (distractors.length < 3) continue;

    const tpl = qTemplates[Math.floor(Math.random() * qTemplates.length)];
    const options = [correct, ...distractors].sort(() => Math.random() - 0.5);
    const correctIndex = options.indexOf(correct);

    questions.push({
      question: tpl(sentence),
      options,
      correct: correctIndex,
      explanation: `La respuesta correcta aparece directamente en el contenido del documento estudiado.`
    });
  }

  return questions;
}

function extractKeyword(s) {
  const stopwords = new Set(['para','como','este','esta','estos','estas','tiene','pero','cuando','donde','según','también','puede','deben','será','están','cada','todo','toda','todos','todas','una','uno','sus','más','sin','sobre','entre','que','con','por','los','las','del']);
  const words = s.split(/\s+/).filter(w => w.length > 4 && !stopwords.has(w.toLowerCase()));
  return words[Math.floor(Math.random() * Math.min(3, words.length))] || 'este concepto';
}

function cleanAnswer(s) {
  const clean = s.trim().replace(/^[,;:\-–\s]+/, '').trim();
  const parts = clean.split(/[,;]/);
  return parts[0].trim().slice(0, 100);
}
