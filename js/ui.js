// ══════════════════════════════════════════
// UI UTILITIES — Dark Mode, Toasts, Modal
// ══════════════════════════════════════════

// ── DARK MODE ──
function initTheme() {
  var saved = localStorage.getItem('studyai-theme');
  if (saved === 'dark') document.body.classList.add('dark');
  updateThemeIcons();
}

function toggleTheme() {
  document.body.classList.toggle('dark');
  var isDark = document.body.classList.contains('dark');
  localStorage.setItem('studyai-theme', isDark ? 'dark' : 'light');
  updateThemeIcons();
}

function updateThemeIcons() {
  var isDark = document.body.classList.contains('dark');
  var icon = isDark ? '☀️' : '🌙';
  document.querySelectorAll('.theme-toggle').forEach(function (btn) {
    btn.textContent = icon;
  });
}

// ── TOAST NOTIFICATIONS ──
function showToast(message, type, duration) {
  type = type || 'info';
  duration = duration || 3500;
  var container = document.getElementById('toast-container');
  var toast = document.createElement('div');
  toast.className = 'toast ' + type;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(function () {
    toast.classList.add('out');
    setTimeout(function () { toast.remove(); }, 250);
  }, duration);
}

// ── CUSTOM CONFIRM MODAL ──
function showConfirm(title, message, onConfirm) {
  var overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML =
    '<div class="modal-card">' +
    '<h3>' + title + '</h3>' +
    '<p>' + message + '</p>' +
    '<div class="modal-actions">' +
    '<button class="btn" id="modal-cancel">Cancelar</button>' +
    '<button class="btn danger" id="modal-ok">Confirmar</button>' +
    '</div></div>';
  document.body.appendChild(overlay);

  overlay.querySelector('#modal-cancel').onclick = function () { overlay.remove(); };
  overlay.querySelector('#modal-ok').onclick = function () { overlay.remove(); onConfirm(); };
  overlay.addEventListener('click', function (e) { if (e.target === overlay) overlay.remove(); });
}
