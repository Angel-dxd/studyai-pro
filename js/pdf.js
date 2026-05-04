// ══════════════════════════════════════════
// PDF HANDLING
// ══════════════════════════════════════════

function initDropZone() {
  var dz = document.getElementById('drop-zone');
  var fi = document.getElementById('file-in');

  dz.addEventListener('dragover', function (e) { e.preventDefault(); dz.classList.add('drag'); });
  dz.addEventListener('dragleave', function () { dz.classList.remove('drag'); });
  dz.addEventListener('drop', function (e) { e.preventDefault(); dz.classList.remove('drag'); handleFile(e.dataTransfer.files[0]); });
  fi.addEventListener('change', function (e) { handleFile(e.target.files[0]); });
}

async function handleFile(file) {
  if (!file || file.type !== 'application/pdf') return;
  filename = file.name.replace('.pdf', '');
  var st = document.getElementById('file-status');
  st.className = 'file-status'; st.style.display = 'block'; st.textContent = 'Cargando ' + file.name + '...';
  try {
    var ab = await file.arrayBuffer();
    var u8 = new Uint8Array(ab);
    var binary = '';
    u8.forEach(function (b) { binary += String.fromCharCode(b); });
    pdfBase64 = btoa(binary);
    pdfText = 'pdf:' + filename;
    st.className = 'file-status file-ok-s';
    st.textContent = '✓ ' + file.name + ' — ' + Math.round(file.size / 1024) + ' KB cargado';
    document.getElementById('gen-btn').classList.add('on');
  } catch (e) {
    st.className = 'file-status file-err-s';
    st.textContent = 'Error al cargar el PDF.';
  }
}

function extractText(u8) {
  var t = '';
  try {
    var utf8 = new TextDecoder('utf-8', { fatal: false }).decode(u8);
    var xmlMatches = utf8.match(/<a:t[^>]*>([^<]+)<\/a:t>/g);
    if (xmlMatches && xmlMatches.length > 5) {
      xmlMatches.forEach(function (x) { t += x.replace(/<[^>]+>/g, '') + ' '; });
    }
    if (t.length < 100) {
      var lines = utf8.split('\n');
      lines.forEach(function (line) {
        var clean = line.replace(/[^\x20-\x7EáéíóúñÁÉÍÓÚÑüÜ\s]/g, ' ').trim();
        if (clean.length > 20 && /[a-zA-ZáéíóúñÁÉÍÓÚÑ]{4,}/.test(clean) && !/^[\d\s\.,;:]+$/.test(clean)) {
          t += clean + ' ';
        }
      });
    }
    if (t.length < 100) {
      var s = new TextDecoder('latin1').decode(u8);
      var sr = /stream([\s\S]*?)endstream/g; var m;
      while ((m = sr.exec(s)) !== null) {
        var w = m[1].match(/\(([^)]{3,120})\)/g);
        if (w) w.forEach(function (x) {
          var i = x.slice(1, -1).replace(/\\n/g, ' ').replace(/\\\d{3}/g, '').replace(/\\[()\\]/g, '');
          if (/[a-zA-ZáéíóúñÁÉÍÓÚÑ]{4,}/.test(i) && !/[\x00-\x1F]/.test(i)) t += i + ' ';
        });
      }
    }
  } catch (e) { }
  t = t.replace(/[^\x20-\x7EáéíóúñÁÉÍÓÚÑüÜ\s\.,;:!?\-()]/g, ' ');
  t = t.replace(/\b\w{1,2}\b/g, ' ').replace(/\s+/g, ' ').trim();
  return t;
}
