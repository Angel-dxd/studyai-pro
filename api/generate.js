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
      } catch(e) {
        text = extractManual(buf);
      }
    }

    if (text.length < 50 && prompt) {
      const m = prompt.match(/CONTENIDO:\n([\s\S]*?)\n\nResponde/);
      text = m ? m[1] : '';
    }

    if (text.length < 50) {
      return res.status(400).json({ error: 'No se pudo leer el PDF.' });
    }

    const numMatch = prompt ? prompt.match(/EXACTAMENTE (\d+) preguntas/) : null;
    const numQ = numMatch ? parseInt(numMatch[1]) : 10;
    const questions = generateQuestions(text, numQ);

    if (questions.length < 2) {
      return res.status(400).json({ error: 'Texto insuficiente para generar preguntas.' });
    }

    return res.status(200).json({
      content: [{ type: 'text', text: JSON.stringify({ questions }) }]
    });

  } catch (e) {
    return res.status(500).json({ error: 'Error: ' + e.message });
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
  // Limpiar texto
  const clean = text.replace(/\s+/g, ' ').trim();

  // Extraer definiciones (patrón: "X es Y" o "X: Y")
  const definitions = [];
  const defPatterns = [
    /([A-ZÁÉÍÓÚÑ][^.]{5,40})(?:\s+es\s+|\s+son\s+|\:\s+)([^.]{20,150})\./g,
    /([A-ZÁÉÍÓÚÑ][^.]{3,30})(?:\s+se\s+define\s+como\s+)([^.]{20,150})\./g,
    /([A-ZÁÉÍÓÚÑ][^.]{3,30})(?:\s+consiste\s+en\s+)([^.]{20,150})\./g,
    /([A-ZÁÉÍÓÚÑ][^.]{3,30})(?:\s+permite\s+)([^.]{20,150})\./g,
    /([A-ZÁÉÍÓÚÑ][^.]{3,30})(?:\s+requiere\s+)([^.]{20,150})\./g,
  ];

  defPatterns.forEach(pattern => {
    let m;
    const reg = new RegExp(pattern.source, 'g');
    while ((m = reg.exec(clean)) !== null) {
      const term = m[1].trim();
      const def = m[2].trim();
      if (term.length > 3 && def.length > 15 && term.split(' ').length <= 6) {
        definitions.push({ term, def, full: m[0] });
      }
    }
  });

  // Extraer frases con números/datos concretos (capital mínimo, porcentajes, etc.)
  const dataFacts = [];
  const dataPattern = /([^.]{10,60}(?:\d[\d.,€%]+)[^.]{5,80})\./g;
  let dm;
  while ((dm = dataPattern.exec(clean)) !== null) {
    if (dm[1].length > 20 && /[a-zA-ZáéíóúñÁÉÍÓÚÑ]{4,}/.test(dm[1])) {
      dataFacts.push(dm[1].trim());
    }
  }

  // Frases generales como fallback
  const sentences = clean
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 50 && s.length < 300 && /[a-zA-ZáéíóúñÁÉÍÓÚÑ]{4,}/.test(s) && s.split(' ').length >= 8);

  const questions = [];
  const usedTerms = new Set();

  // 1. Preguntas de definición (las mejores)
  const shuffledDefs = [...definitions].sort(() => Math.random() - 0.5);
  for (const def of shuffledDefs) {
    if (questions.length >= numQ) break;
    if (usedTerms.has(def.term.toLowerCase())) continue;
    usedTerms.add(def.term.toLowerCase());

    const correctAnswer = def.def.slice(0, 100);
    const wrongAnswers = sentences
      .filter(s => !s.includes(def.term) && !s.includes(def.def.slice(0,20)))
      .sort(() => Math.random() - 0.5)
      .slice(0, 5)
      .map(s => s.split(/[,;]/)[0].trim().slice(0, 100))
      .filter(s => s.length > 15 && s !== correctAnswer)
      .slice(0, 3);

    if (wrongAnswers.length < 3) continue;

    const options = [correctAnswer, ...wrongAnswers].sort(() => Math.random() - 0.5);
    questions.push({
      question: `¿Qué es o qué define "${def.term}"?`,
      options,
      correct: options.indexOf(correctAnswer),
      explanation: `"${def.term}" ${def.full.includes(' es ') ? 'es' : def.full.includes(' son ') ? 'son' : 'se refiere a'} ${def.def.slice(0,120)}.`
    });
  }

  // 2. Preguntas de datos concretos
  const shuffledData = [...dataFacts].sort(() => Math.random() - 0.5);
  for (const fact of shuffledData) {
    if (questions.length >= numQ) break;
    if (usedTerms.has(fact.slice(0,30))) continue;
    usedTerms.add(fact.slice(0,30));

    const correctAnswer = fact.slice(0, 100);
    const wrongAnswers = dataFacts
      .filter(f => f !== fact)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3)
      .map(f => f.slice(0, 100))
      .filter(f => f !== correctAnswer && f.length > 15);

    // Si no hay suficientes datos numéricos, usar frases generales
    while (wrongAnswers.length < 3 && sentences.length > 0) {
      const s = sentences[Math.floor(Math.random() * sentences.length)];
      const candidate = s.split(/[,;]/)[0].trim().slice(0, 100);
      if (!wrongAnswers.includes(candidate) && candidate !== correctAnswer && candidate.length > 15) {
        wrongAnswers.push(candidate);
      }
    }

    if (wrongAnswers.length < 3) continue;

    const options = [correctAnswer, ...wrongAnswers.slice(0,3)].sort(() => Math.random() - 0.5);
    questions.push({
      question: `Según el contenido estudiado, ¿cuál de estas afirmaciones es correcta?`,
      options,
      correct: options.indexOf(correctAnswer),
      explanation: `La información correcta aparece directamente en el documento: "${correctAnswer.slice(0,100)}".`
    });
  }

  // 3. Completar con preguntas de frases generales
  const shuffledSentences = [...sentences].sort(() => Math.random() - 0.5);
  for (const sentence of shuffledSentences) {
    if (questions.length >= numQ) break;
    const key = sentence.slice(0, 30);
    if (usedTerms.has(key)) continue;
    usedTerms.add(key);

    const correctAnswer = sentence.split(/[,;]/)[0].trim().slice(0, 100);
    if (correctAnswer.length < 20) continue;

    const wrongAnswers = shuffledSentences
      .filter(s => s !== sentence)
      .slice(0, 8)
      .map(s => s.split(/[,;]/)[0].trim().slice(0, 100))
      .filter(s => s !== correctAnswer && s.length > 15)
      .slice(0, 3);

    if (wrongAnswers.length < 3) continue;

    // Extraer palabra clave para la pregunta
    const stopwords = new Set(['para','como','este','esta','tiene','pero','cuando','donde','según','también','puede','deben','será','están','cada','todo','toda','una','uno','sus','más','sin','sobre','entre','que','con','por','los','las','del','sin','está','hay']);
    const importantWords = sentence.split(/\s+/)
      .filter(w => w.length > 5 && !stopwords.has(w.toLowerCase()) && /[a-zA-ZáéíóúñÁÉÍÓÚÑ]/.test(w));
    const keyword = importantWords[0] || 'este concepto';

    const options = [correctAnswer, ...wrongAnswers].sort(() => Math.random() - 0.5);
    questions.push({
      question: `¿Qué afirma el documento sobre "${keyword}"?`,
      options,
      correct: options.indexOf(correctAnswer),
      explanation: `Esta información aparece en el contenido del documento estudiado.`
    });
  }

  return questions.slice(0, numQ);
}
