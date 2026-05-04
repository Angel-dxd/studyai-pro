// ══════════════════════════════════════════
// HISTORY (Supabase DB)
// ══════════════════════════════════════════

async function loadHistory() {
  var res = await sb.auth.getUser();
  var user = res.data.user;
  if (!user) return;
  var q = await sb.from('quiz_history').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(8);
  renderHistory(q.data || []);
}

async function saveHistoryDB(entry) {
  var res = await sb.auth.getUser();
  var user = res.data.user;
  if (!user) return;
  await sb.from('quiz_history').insert({ user_id: user.id, ...entry });
}

function renderHistory(rows) {
  var hs = document.getElementById('hist-section');
  var hl = document.getElementById('hist-list');
  if (!rows.length) { hs.style.display = 'none'; return; }
  hs.style.display = 'block';
  hl.innerHTML = rows.map(function (h) {
    var cls = h.pct >= 70 ? 'pct-green' : h.pct >= 50 ? 'pct-amber' : 'pct-red';
    var d = new Date(h.created_at).toLocaleDateString('es-ES');
    return '<div class="hist-item">' +
      '<div><div class="hist-name">' + h.filename + '</div><div class="hist-meta">' + d + ' · ' + h.time_spent + ' · ' + h.correct + '/' + h.total + ' preguntas</div></div>' +
      '<div class="hist-pct ' + cls + '">' + h.pct + '%</div>' +
      '</div>';
  }).join('');
}
