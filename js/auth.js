// ══════════════════════════════════════════
// AUTH
// ══════════════════════════════════════════

function initAuth() {
  sb.auth.getSession().then(function (res) {
    if (res.data.session) showApp(res.data.session.user);
  });
  sb.auth.onAuthStateChange(function (_e, sess) {
    if (sess) showApp(sess.user);
    else showAuthScreen();
  });
}

function showApp(user) {
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  document.getElementById('user-email').textContent = user.email;
  loadHistory();
}

function showAuthScreen() {
  document.getElementById('auth-screen').style.display = 'flex';
  document.getElementById('app').style.display = 'none';
}

function toggleMode() {
  isRegister = !isRegister;
  document.getElementById('auth-title').textContent = isRegister ? 'Crear cuenta' : 'Iniciar sesión';
  document.getElementById('auth-sub').textContent = isRegister ? 'Únete a StudyAI Pro' : 'Accede a tu academia personal';
  document.getElementById('auth-btn').textContent = isRegister ? 'Registrarme' : 'Entrar';
  document.getElementById('pass2-field').style.display = isRegister ? 'block' : 'none';
  document.getElementById('auth-switch').innerHTML = isRegister
    ? '¿Ya tienes cuenta? <a onclick="toggleMode()">Inicia sesión</a>'
    : '¿No tienes cuenta? <a onclick="toggleMode()">Regístrate</a>';
  clearAuthMsg();
}

async function authSubmit() {
  var email = document.getElementById('auth-email').value.trim();
  var pass = document.getElementById('auth-pass').value;
  var pass2 = document.getElementById('auth-pass2').value;
  var btn = document.getElementById('auth-btn');
  clearAuthMsg();
  if (!email || !pass) { showErr('Rellena todos los campos.'); return; }
  if (isRegister && pass !== pass2) { showErr('Las contraseñas no coinciden.'); return; }
  if (pass.length < 6) { showErr('La contraseña debe tener al menos 6 caracteres.'); return; }
  btn.disabled = true; btn.textContent = '...';
  try {
    if (isRegister) {
      var res = await sb.auth.signUp({ email: email, password: pass });
      if (res.error) throw res.error;
      showOk('¡Cuenta creada! Revisa tu email para confirmarla.');
    } else {
      var res2 = await sb.auth.signInWithPassword({ email: email, password: pass });
      if (res2.error) throw res2.error;
    }
  } catch (e) {
    showErr(translateError(e.message));
  }
  btn.disabled = false;
  btn.textContent = isRegister ? 'Registrarme' : 'Entrar';
}

async function forgotPass() {
  var email = document.getElementById('auth-email').value.trim();
  if (!email) { showErr('Escribe tu email primero.'); return; }
  var res = await sb.auth.resetPasswordForEmail(email);
  if (res.error) showErr(translateError(res.error.message));
  else showOk('Te hemos enviado un enlace para restablecer tu contraseña.');
}

async function logout() {
  await sb.auth.signOut();
  goUpload();
}

function translateError(msg) {
  if (msg.includes('Invalid login')) return 'Email o contraseña incorrectos.';
  if (msg.includes('already registered')) return 'Este email ya está registrado.';
  if (msg.includes('Email not confirmed')) return 'Confirma tu email antes de entrar.';
  return msg;
}

function showErr(m) { var e = document.getElementById('auth-err'); e.textContent = m; e.style.display = 'block'; }
function showOk(m) { var o = document.getElementById('auth-ok'); o.textContent = m; o.style.display = 'block'; }
function clearAuthMsg() { document.getElementById('auth-err').style.display = 'none'; document.getElementById('auth-ok').style.display = 'none'; }
