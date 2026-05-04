// ══════════════════════════════════════════
// SHARED STATE
// ══════════════════════════════════════════
var pdfText = '';
var pdfBase64 = '';
var filename = '';
var questions = [];
var currentQ = 0;
var score = 0;
var answered = false;
var timerSec = 30;
var timerInterval = null;
var results = [];
var wrongQuestions = [];
var wrongOnly = false;
var timeoutCount = 0;
var streak = 0;
var maxStreak = 0;
var sessionStart = 0;
var isRegister = false;

// ══════════════════════════════════════════
// VIEW NAVIGATION
// ══════════════════════════════════════════
function showView(id) {
  ['upload-view', 'loading-view', 'quiz-view', 'results-view'].forEach(function (v) {
    document.getElementById(v).style.display = 'none';
  });
  document.getElementById(id).style.display = 'block';
}
