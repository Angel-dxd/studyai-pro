// ══════════════════════════════════════════
// QUIZ GENERATION & LOGIC
// ══════════════════════════════════════════

async function startGen() {
  if (!pdfText) return;
  showView('loading-view');
  var steps = ['ls1', 'ls2', 'ls3', 'ls4'];
  var si = 0;
  function nextStep() {
    if (si < steps.length) {
      document.getElementById(steps[si]).classList.add('active');
      if (si > 0) document.getElementById(steps[si - 1]).classList.add('done');
      si++;
    }
  }
  nextStep();
  var stepInt = setInterval(nextStep, 1400);
  timerSec = parseInt(document.getElementById('timer-sel').value);
  var numQ = parseInt(document.getElementById('num-q').value);
  var diff = document.getElementById('diff').value;
  var chunk = pdfText.slice(0, 8000);
  var prompt = 'Eres un profesor experto. Analiza este contenido y genera EXACTAMENTE ' + numQ + ' preguntas de opción múltiple con dificultad ' + diff + '.\n\nCONTENIDO:\n' + chunk + '\n\nResponde SOLO con JSON válido, sin texto extra:\n{"questions":[{"question":"texto","options":["A","B","C","D"],"correct":0,"explanation":"explicación breve"}]}\n\n"correct" es el índice 0-3. Preguntas relevantes y desafiantes.';
  try {
    var res = await fetch('/api/generate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: prompt, pdfBase64: pdfBase64 })
    });
    var data = await res.json();
    clearInterval(stepInt);
    steps.forEach(function (s) { document.getElementById(s).classList.remove('active'); document.getElementById(s).classList.add('done'); });
    if (data.error) throw new Error('API: ' + (data.error.message || data.error));
    if (!data.content) throw new Error('Sin respuesta: ' + JSON.stringify(data));
    var tc = data.content.find(function (c) { return c.type === 'text'; });
    var jm = (tc ? tc.text : '').match(/\{[\s\S]*\}/);
    if (!jm) throw new Error('JSON no encontrado en: ' + (tc ? tc.text.slice(0, 200) : 'vacio'));
    var parsed = JSON.parse(jm[0]);
    questions = parsed.questions;
    if (!questions || !questions.length) throw new Error('Sin preguntas en JSON');
    currentQ = 0; score = 0; answered = false; results = []; timeoutCount = 0; streak = 0; maxStreak = 0; wrongOnly = false;
    sessionStart = Date.now();
    renderQ();
    showView('quiz-view');
  } catch (e) {
    clearInterval(stepInt);
    alert('Error: ' + (e.message || 'desconocido'));
    showView('upload-view');
  }
}

// ══════════════════════════════════════════
// QUIZ RENDERING & INTERACTION
// ══════════════════════════════════════════

function renderQ() {
  var q = questions[currentQ];
  var total = questions.length;
  answered = false;
  document.getElementById('qh-name').textContent = filename;
  document.getElementById('qh-prog').textContent = (currentQ + 1) + ' de ' + total + (wrongOnly ? ' · modo repaso' : '');
  document.getElementById('q-label').textContent = 'Pregunta ' + (currentQ + 1);
  document.getElementById('q-text').textContent = q.question;
  document.getElementById('prog-fill').style.width = (((currentQ + 1) / total) * 100) + '%';
  var ans = document.getElementById('answers');
  ans.innerHTML = '';
  q.options.forEach(function (opt, i) {
    var b = document.createElement('button');
    b.className = 'ans';
    b.textContent = ['A', 'B', 'C', 'D'][i] + '. ' + opt;
    b.onclick = function () { selectAns(i, q.correct, q.explanation); };
    ans.appendChild(b);
  });
  document.getElementById('expl-box').className = 'expl-box';
  document.getElementById('expl-box').textContent = '';
  document.getElementById('timeout-box').style.display = 'none';
  document.getElementById('next-btn').style.display = 'none';
  document.getElementById('next-btn').textContent = currentQ < questions.length - 1 ? 'Siguiente →' : 'Ver resultados →';
  if (timerSec > 0) { document.getElementById('timer-box').style.display = 'block'; startTimer(timerSec); }
  else document.getElementById('timer-box').style.display = 'none';
}

function startTimer(s) {
  clearInterval(timerInterval);
  var left = s;
  updateTimer(left, s);
  timerInterval = setInterval(function () {
    left--;
    updateTimer(left, s);
    if (left <= 0) { clearInterval(timerInterval); timeoutQ(); }
  }, 1000);
}

function updateTimer(left, total) {
  var el = document.getElementById('timer-val');
  el.textContent = Math.floor(left / 60) + ':' + String(left % 60).padStart(2, '0');
  el.className = 'timer-val' + (left <= 5 ? ' danger' : left <= Math.ceil(total * .33) ? ' warn' : '');
}

function timeoutQ() {
  if (answered) return;
  answered = true; timeoutCount++; streak = 0;
  var q = questions[currentQ];
  document.querySelectorAll('.ans').forEach(function (b, i) { b.disabled = true; if (i === q.correct) b.classList.add('correct'); });
  document.getElementById('timeout-box').style.display = 'block';
  document.getElementById('expl-box').textContent = q.explanation;
  document.getElementById('expl-box').classList.add('show');
  document.getElementById('next-btn').style.display = 'block';
  results.push({ q: q, chosen: -1, correct: false, timeout: true });
}

function selectAns(chosen, correct, expl) {
  if (answered) return;
  answered = true; clearInterval(timerInterval);
  var isOk = chosen === correct;
  if (isOk) { score++; streak++; if (streak > maxStreak) maxStreak = streak; } else streak = 0;
  document.querySelectorAll('.ans').forEach(function (b, i) {
    b.disabled = true;
    if (i === correct) b.classList.add('correct');
    else if (i === chosen && !isOk) b.classList.add('wrong');
  });
  document.getElementById('expl-box').textContent = expl;
  document.getElementById('expl-box').classList.add('show');
  document.getElementById('next-btn').style.display = 'block';
  results.push({ q: questions[currentQ], chosen: chosen, correct: isOk, timeout: false });
}

function nextQ() {
  currentQ++;
  if (currentQ >= questions.length) showResults();
  else renderQ();
}

function confirmAbort() {
  if (confirm('¿Abandonar el test?')) { clearInterval(timerInterval); showView('upload-view'); }
}
