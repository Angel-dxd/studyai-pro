// ══════════════════════════════════════════
// RESULTS & EXPORT
// ══════════════════════════════════════════

async function showResults() {
  clearInterval(timerInterval);
  var total = questions.length;
  var pct = Math.round(score / total * 100);
  var secs = Math.round((Date.now() - sessionStart) / 1000);
  var timeStr = Math.floor(secs / 60) + 'm ' + (secs % 60) + 's';
  wrongQuestions = results.filter(function (r) { return !r.correct; }).map(function (r) { return r.q; });

  document.getElementById('r-pct').textContent = pct + '%';
  document.getElementById('r-ok').textContent = score;
  document.getElementById('r-bad').textContent = results.filter(function (r) { return !r.correct && !r.timeout; }).length;
  document.getElementById('r-tout').textContent = timeoutCount;
  document.getElementById('r-streak').textContent = maxStreak;
  document.getElementById('r-time').textContent = 'Tiempo total: ' + timeStr;

  var titles = pct >= 90 ? ['¡Excelente!', 'Dominas este contenido.']
    : pct >= 70 ? ['¡Buen trabajo!', 'Estás en buen camino.']
    : pct >= 50 ? ['Casi lo tienes', 'Repasa y vuelve a intentarlo.']
    : ['Necesitas repasar', 'Estudia el material y practica más.'];
  document.getElementById('r-title').textContent = titles[0];
  document.getElementById('r-sub').textContent = titles[1];

  var circ = 283;
  setTimeout(function () { document.getElementById('ring-fill').style.strokeDashoffset = circ - (circ * pct / 100); }, 100);

  document.getElementById('retry-btn').style.display = wrongQuestions.length ? 'inline-block' : 'none';

  var rl = document.getElementById('review-list');
  rl.innerHTML = results.map(function (r, i) {
    var cls = r.correct ? 'ok' : 'bad';
    var badge = r.timeout ? '<span class="rev-badge timeout">⏱ Sin tiempo</span>'
      : r.correct ? '<span class="rev-badge ok">✓ Correcta</span>'
      : '<span class="rev-badge bad">✗ Incorrecta</span>';
    var opts = r.q.options.map(function (o, oi) {
      var c = 'rev-opt';
      if (oi === r.q.correct) c += ' correct';
      if (oi === r.chosen && !r.correct && !r.timeout) c += ' wrong-pick';
      return '<div class="' + c + '">' + ['A', 'B', 'C', 'D'][oi] + '. ' + o + '</div>';
    }).join('');
    return '<div class="rev-item ' + cls + '">' + badge + '<div class="rev-q ' + cls + '">' + (i + 1) + '. ' + r.q.question + '</div><div class="rev-opts">' + opts + '</div><div class="rev-expl">' + r.q.explanation + '</div></div>';
  }).join('');

  showView('results-view');

  await saveHistoryDB({ filename: filename, pct: pct, correct: score, total: total, time_spent: timeStr });
  loadHistory();
}

function restartSame() {
  currentQ = 0; score = 0; answered = false; results = []; timeoutCount = 0; streak = 0; maxStreak = 0; wrongOnly = false;
  sessionStart = Date.now(); renderQ(); showView('quiz-view');
}

function startRetry() {
  if (!wrongQuestions.length) return;
  questions = wrongQuestions.slice();
  currentQ = 0; score = 0; answered = false; results = [];
  timeoutCount = 0; streak = 0; maxStreak = 0; wrongOnly = true;
  sessionStart = Date.now(); renderQ(); showView('quiz-view');
}

function goUpload() {
  clearInterval(timerInterval); pdfText = ''; questions = [];
  document.getElementById('gen-btn').classList.remove('on');
  document.getElementById('file-status').style.display = 'none';
  document.getElementById('file-in').value = '';
  showView('upload-view');
}

// ══════════════════════════════════════════
// EXPORT PDF
// ══════════════════════════════════════════

function exportPDF() {
  try {
    var jsPDF = window.jspdf.jsPDF;
    var doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
    var pw = doc.internal.pageSize.getWidth();
    var y = 20;
    doc.setFontSize(18); doc.setFont(undefined, 'bold');
    doc.text('Test: ' + filename, 15, y); y += 8;
    doc.setFontSize(10); doc.setFont(undefined, 'normal'); doc.setTextColor(100);
    doc.text('StudyAI Pro — ' + new Date().toLocaleDateString('es-ES'), 15, y); y += 5;
    doc.text('Resultado: ' + score + '/' + questions.length + ' (' + Math.round(score / questions.length * 100) + '%)', 15, y); y += 8;
    doc.setDrawColor(200); doc.line(15, y, pw - 15, y); y += 8;
    doc.setTextColor(0);
    results.forEach(function (r, i) {
      if (y > 265) { doc.addPage(); y = 20; }
      doc.setFontSize(10); doc.setFont(undefined, 'bold');
      doc.setTextColor(r.correct ? [39, 80, 10] : r.timeout ? [99, 56, 6] : [160, 45, 45]);
      var mark = r.timeout ? '[TIEMPO]' : r.correct ? '[✓]' : '[✗]';
      var qlines = doc.splitTextToSize((i + 1) + '. ' + mark + ' ' + r.q.question, pw - 30);
      doc.text(qlines, 15, y); y += qlines.length * 5 + 2;
      doc.setFont(undefined, 'normal');
      r.q.options.forEach(function (opt, oi) {
        if (y > 270) { doc.addPage(); y = 20; }
        var prefix = oi === r.q.correct ? '→ ' : oi === r.chosen && !r.correct ? '✗ ' : '  ';
        if (oi === r.q.correct) doc.setTextColor(39, 80, 10);
        else if (oi === r.chosen && !r.correct) doc.setTextColor(160, 45, 45);
        else doc.setTextColor(80);
        var olines = doc.splitTextToSize('  ' + prefix + ['A', 'B', 'C', 'D'][oi] + '. ' + opt, pw - 35);
        doc.text(olines, 15, y); y += olines.length * 4.5;
      });
      doc.setTextColor(80, 80, 130);
      var elines = doc.splitTextToSize('  Explicación: ' + r.q.explanation, pw - 35);
      doc.text(elines, 15, y); y += elines.length * 4.5 + 7;
      doc.setDrawColor(220); doc.line(15, y - 2, pw - 15, y - 2); y += 4;
    });
    doc.save('test-' + filename.replace(/\s/g, '_') + '.pdf');
  } catch (e) { alert('Error al exportar el PDF.'); }
}
