export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: 'Missing prompt' });

    // Extraer parámetros del prompt
    const numMatch = prompt.match(/EXACTAMENTE (\d+) preguntas/);
    const numQ = numMatch ? parseInt(numMatch[1]) : 10;
    const diffMatch = prompt.match(/dificultad (\w+)/);
    const diff = diffMatch ? diffMatch[1] : 'media';
    const contentMatch = prompt.match(/CONTENIDO:\n([\s\S]*?)\n\nResponde/);
    const content = contentMatch ? contentMatch[1] : prompt;

    // Extraer frases y conceptos clave del contenido
    const sentences = content
      .replace(/[^\w\s\.,;:áéíóúñÁÉÍÓÚÑüÜ\-]/g, ' ')
      .split(/[.!?]+/)
      .map(s => s.trim())
      .filter(s => s.length > 30 && s.length < 300 && /[a-zA-ZáéíóúñÁÉÍÓÚÑ]{4,}/.test(s));

    if (sentences.length < 3) {
      return res.status(400).json({ error: 'Texto insuficiente para generar preguntas' });
    }

    const questions = [];
    const used = new Set();

    // Tipos de pregunta
    const questionTypes = [
      (s) => ({ q: `¿Qué afirma el texto sobre: "${s.slice(0,60)}..."?`, type: 'affirmation' }),
      (s) => ({ q: `Según el contenido estudiado, ¿cuál de las siguientes afirmaciones es correcta respecto a "${extractKeyword(s)}"?`, type: 'concept' }),
      (s) => ({ q: `¿Cuál es la característica principal mencionada en: "${s.slice(0,50)}..."?`, type: 'feature' }),
      (s) => ({ q: `De acuerdo con el material, ¿qué describe mejor "${extractKeyword(s)}"?`, type: 'description' }),
      (s) => ({ q: `Según el texto, ¿qué es correcto sobre "${extractKeyword(s)}"?`, type: 'correct' }),
    ];

    // Barajar frases
    const shuffled = [...sentences].sort(() => Math.random() - 0.5);

    for (let i = 0; i < shuffled.length && questions.length < numQ; i++) {
      const sentence = shuffled[i].trim();
      if (used.has(sentence) || sentence.length < 40) continue;
      used.add(sentence);

      const typeIdx = Math.floor(Math.random() * questionTypes.length);
      const { q } = questionTypes[typeIdx](sentence);

      // Generar respuesta correcta y distractores
      const correct = summarizeSentence(sentence);
      const distractors = generateDistractors(correct, shuffled.filter(s => s !== sentence), 3);

      if (distractors.length < 3) continue;

      const options = [correct, ...distractors].sort(() => Math.random() - 0.5);
      const correctIndex = options.indexOf(correct);

      const explanations = [
        `La respuesta correcta se basa directamente en el contenido del texto estudiado.`,
        `Según el material, esta es la afirmación correcta sobre el tema.`,
        `El texto indica claramente esta información en el apartado correspondiente.`,
        `Esta opción refleja fielmente lo que el documento expresa sobre el tema.`,
      ];

      questions.push({
        question: q,
        options,
        correct: correctIndex,
        explanation: explanations[Math.floor(Math.random() * explanations.length)]
      });
    }

    if (questions.length < Math.min(numQ, 3)) {
      return res.status(400).json({ error: 'No se pudieron generar suficientes preguntas del PDF' });
    }

    const responseText = JSON.stringify({ questions: questions.slice(0, numQ) });
    return res.status(200).json({ content: [{ type: 'text', text: responseText }] });

  } catch (e) {
    return res.status(500).json({ error: 'Error: ' + e.message });
  }
}

function extractKeyword(sentence) {
  const words = sentence.split(/\s+/).filter(w => w.length > 4);
  const stopwords = ['para','como','este','esta','estos','estas','que','con','por','los','las','del','una','uno','sus','más','pero','sin','sobre','entre','cuando','donde','según','también','puede','tiene','deben','será','están','cada','todo','toda','todos','todas'];
  const keywords = words.filter(w => !stopwords.includes(w.toLowerCase()));
  if (keywords.length === 0) return words[0] || 'este concepto';
  return keywords[Math.floor(Math.random() * Math.min(3, keywords.length))];
}

function summarizeSentence(sentence) {
  const clean = sentence.trim().replace(/^[,;:\-–]+/, '').trim();
  if (clean.length <= 80) return clean;
  const parts = clean.split(/[,;]/);
  return parts[0].trim().slice(0, 90);
}

function generateDistractors(correct, otherSentences, count) {
  const distractors = [];
  const shuffled = [...otherSentences].sort(() => Math.random() - 0.5);
  
  for (const s of shuffled) {
    if (distractors.length >= count) break;
    const d = summarizeSentence(s);
    if (d && d !== correct && d.length > 10 && !distractors.includes(d)) {
      distractors.push(d);
    }
  }
  return distractors;
}
