/* ========================================
   DF Quiz Application
   ======================================== */

(function () {
  'use strict';

  // ---- State ----
  const state = {
    currentScreen: 'home',
    selectedChapter: null,
    selectedSection: 'all',
    quizQuestions: [],
    quizIndex: 0,
    quizAnswers: {},    // { questionId: selectedLetter }
    quizRevealed: {},   // { questionId: true }
    quizCorrect: 0,
    quizWrong: 0,
    readSearch: '',
    readSection: 'all',
    isReviewMode: false,
  };

  // ---- DOM References ----
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  // ---- Navigation ----
  function showScreen(name) {
    $$('.screen').forEach(s => s.classList.remove('active'));
    const screen = $(`#screen-${name}`);
    if (screen) {
      screen.classList.add('active');
      // Re-trigger animation
      screen.style.animation = 'none';
      screen.offsetHeight; // reflow
      screen.style.animation = '';
    }
    state.currentScreen = name;

    // Header controls
    const nav = $('#header-nav');
    const badge = $('#header-badge');

    if (name === 'home') {
      nav.style.display = 'none';
      badge.style.display = 'none';
    } else {
      nav.style.display = 'block';
      badge.style.display = 'block';
      if (state.selectedChapter) {
        $('#badge-text').textContent = state.selectedChapter.shortTitle;
      }
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function goBack() {
    switch (state.currentScreen) {
      case 'chapter':
        showScreen('home');
        break;
      case 'quiz':
        showScreen('chapter');
        break;
      case 'results':
        showScreen('home');
        break;
      default:
        showScreen('home');
    }
  }

  // ---- Home Screen ----
  function renderHome() {
    const grid = $('#chapter-grid');
    grid.innerHTML = '';

    QUIZ_DATA.forEach((chapter, idx) => {
      const sections = [...new Set(chapter.questions.map(q => q.section).filter(Boolean))];
      const card = document.createElement('div');
      card.className = 'chapter-card';
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      card.setAttribute('aria-label', `${chapter.title}`);
      card.style.animationDelay = `${idx * 0.1}s`;

      card.innerHTML = `
        <div class="chapter-card-content">
          <div class="chapter-card-num">Chapter ${chapter.id}</div>
          <div class="chapter-card-title">${chapter.shortTitle}</div>
          <div class="chapter-card-meta">${chapter.questionCount} MCQs · ${sections.length} sections</div>
          <div class="chapter-card-sections">
            ${sections.slice(0, 4).map(s => `<span class="chapter-section-tag">${s}</span>`).join('')}
            ${sections.length > 4 ? `<span class="chapter-section-tag">+${sections.length - 4} more</span>` : ''}
          </div>
        </div>
        <div class="chapter-card-arrow">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </div>
      `;

      card.addEventListener('click', () => selectChapter(chapter));
      card.addEventListener('keydown', (e) => { if (e.key === 'Enter') selectChapter(chapter); });
      grid.appendChild(card);
    });

    // Stats
    const totalQ = QUIZ_DATA.reduce((s, c) => s + c.questionCount, 0);
    const totalSections = QUIZ_DATA.reduce((s, c) => s + new Set(c.questions.map(q => q.section).filter(Boolean)).size, 0);
    const stats = $('#home-stats');
    stats.innerHTML = `
      <div class="home-stat">
        <div class="home-stat-value">${totalQ}</div>
        <div class="home-stat-label">Total Questions</div>
      </div>
      <div class="home-stat">
        <div class="home-stat-value">${QUIZ_DATA.length}</div>
        <div class="home-stat-label">Chapters</div>
      </div>
      <div class="home-stat">
        <div class="home-stat-value">${totalSections}</div>
        <div class="home-stat-label">Sections</div>
      </div>
    `;
  }

  // ---- Chapter Screen ----
  function selectChapter(chapter) {
    state.selectedChapter = chapter;
    state.readSection = 'all';
    state.readSearch = '';

    $('#chapter-screen-title').textContent = chapter.title;
    $('#chapter-screen-subtitle').textContent = `${chapter.questionCount} multiple choice questions with explanations`;

    // Reset search input
    const searchInput = $('#read-search');
    if (searchInput) {
      searchInput.value = '';
    }

    showScreen('chapter');
    renderReadTabs();
    renderReadList();
  }

  // ---- Quiz Mode ----
  function startQuiz() {
    const chapter = state.selectedChapter;
    if (!chapter) return;

    let questions = [...chapter.questions];
    if (state.readSection !== 'all') {
      questions = questions.filter(q => q.section === state.readSection);
    }

    // Shuffle questions
    for (let i = questions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [questions[i], questions[j]] = [questions[j], questions[i]];
    }

    state.quizQuestions = questions;
    state.quizIndex = 0;
    state.quizAnswers = {};
    state.quizRevealed = {};
    state.quizCorrect = 0;
    state.quizWrong = 0;
    state.isReviewMode = false;

    showScreen('quiz');
    renderQuizQuestion();
  }

  function renderQuizQuestion() {
    const q = state.quizQuestions[state.quizIndex];
    if (!q) return;

    const total = state.quizQuestions.length;
    const idx = state.quizIndex;
    const answered = Object.keys(state.quizAnswers).length;

    // Progress
    const pct = ((idx + 1) / total) * 100;
    $('#quiz-progress-fill').style.width = `${pct}%`;
    $('#quiz-progress-text').textContent = `Question ${idx + 1} / ${total}`;
    $('#quiz-score-text').textContent = `Score: ${state.quizCorrect}/${answered}`;

    // Badge & number
    if (q.section) {
      $('#quiz-section-badge').textContent = q.section;
      $('#quiz-section-badge').style.display = 'inline-block';
    } else {
      $('#quiz-section-badge').style.display = 'none';
    }
    $('#quiz-question-num').textContent = `Q${q.id}`;

    // Question text
    $('#quiz-question-text').textContent = q.question;

    // Options
    const optionsContainer = $('#quiz-options');
    optionsContainer.innerHTML = '';

    const isRevealed = !!state.quizRevealed[q.id];
    const selectedAnswer = state.quizAnswers[q.id];

    q.options.forEach(opt => {
      const btn = document.createElement('button');
      btn.className = 'quiz-option';

      if (isRevealed) {
        btn.classList.add('disabled');
        if (opt.letter === q.correctAnswer) btn.classList.add('correct');
        if (opt.letter === selectedAnswer && selectedAnswer !== q.correctAnswer) btn.classList.add('incorrect');
      } else if (selectedAnswer === opt.letter) {
        btn.classList.add('selected');
      }

      btn.innerHTML = `
        <span class="quiz-option-letter">${opt.letter}</span>
        <span class="quiz-option-text">${opt.text}</span>
      `;

      if (!isRevealed) {
        btn.addEventListener('click', () => selectAnswer(q, opt.letter));
      }

      optionsContainer.appendChild(btn);
    });

    // Feedback
    const feedback = $('#quiz-feedback');
    if (isRevealed) {
      const isCorrect = selectedAnswer === q.correctAnswer;
      feedback.style.display = 'block';
      feedback.className = `quiz-feedback ${isCorrect ? 'correct' : 'incorrect'}`;

      const icon = isCorrect
        ? `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`
        : `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;

      $('#quiz-feedback-header').innerHTML = `${icon} ${isCorrect ? 'Correct!' : `Incorrect — Answer is ${q.correctAnswer}`}`;
      $('#quiz-feedback-explanation').textContent = q.explanation;
    } else {
      feedback.style.display = 'none';
    }

    // Navigation buttons
    const prevBtn = $('#quiz-prev');
    const nextBtn = $('#quiz-next');
    const finishBtn = $('#quiz-finish');

    prevBtn.style.display = idx > 0 ? 'inline-flex' : 'none';

    if (isRevealed) {
      if (idx < total - 1) {
        nextBtn.style.display = 'inline-flex';
        finishBtn.style.display = 'none';
      } else {
        nextBtn.style.display = 'none';
        finishBtn.style.display = 'inline-flex';
      }
    } else {
      nextBtn.style.display = 'none';
      finishBtn.style.display = 'none';
    }

    // Animate card
    const card = $('#quiz-card');
    card.style.animation = 'none';
    card.offsetHeight;
    card.style.animation = 'scaleIn 0.3s ease-out';
  }

  function selectAnswer(q, letter) {
    if (state.quizRevealed[q.id]) return;

    state.quizAnswers[q.id] = letter;
    state.quizRevealed[q.id] = true;

    if (letter === q.correctAnswer) {
      state.quizCorrect++;
    } else {
      state.quizWrong++;
    }

    renderQuizQuestion();
  }

  function quizNext() {
    if (state.quizIndex < state.quizQuestions.length - 1) {
      state.quizIndex++;
      renderQuizQuestion();
    }
  }

  function quizPrev() {
    if (state.quizIndex > 0) {
      state.quizIndex--;
      renderQuizQuestion();
    }
  }

  function quizFinish() {
    showResults();
  }

  // ---- Results ----
  function showResults() {
    const total = state.quizQuestions.length;
    const correct = state.quizCorrect;
    const wrong = state.quizWrong;
    const pct = Math.round((correct / total) * 100);

    // Add SVG gradient def
    const ring = $('#results-score-ring');
    const svg = ring.querySelector('svg');
    if (!svg.querySelector('defs')) {
      const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
      defs.innerHTML = `
        <linearGradient id="ringGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" style="stop-color:#6366f1"/>
          <stop offset="50%" style="stop-color:#8b5cf6"/>
          <stop offset="100%" style="stop-color:#06b6d4"/>
        </linearGradient>
      `;
      svg.prepend(defs);
    }

    showScreen('results');

    // Animate ring
    const ringFill = $('#ring-fill');
    const circumference = 2 * Math.PI * 52; // r=52
    ringFill.style.strokeDasharray = circumference;
    ringFill.style.strokeDashoffset = circumference;

    requestAnimationFrame(() => {
      setTimeout(() => {
        const offset = circumference - (circumference * pct / 100);
        ringFill.style.strokeDashoffset = offset;
      }, 100);
    });

    // Animate percentage counter
    let currentPct = 0;
    const interval = setInterval(() => {
      currentPct += Math.ceil(pct / 40);
      if (currentPct >= pct) {
        currentPct = pct;
        clearInterval(interval);
      }
      $('#ring-percent').textContent = `${currentPct}%`;
    }, 30);

    // Title & summary
    let title, summary;
    if (pct >= 90) { title = 'Outstanding! 🎉'; summary = 'Excellent mastery of the material!'; }
    else if (pct >= 75) { title = 'Great Job! 🌟'; summary = 'Strong understanding with minor gaps.'; }
    else if (pct >= 60) { title = 'Good Effort! 👍'; summary = 'Solid foundation, but review weak areas.'; }
    else if (pct >= 40) { title = 'Keep Practicing! 📚'; summary = 'More revision needed. Focus on the explanations.'; }
    else { title = 'More Work Needed 💪'; summary = 'Re-read the chapter material and try again.'; }

    $('#results-title').textContent = title;
    $('#results-summary').textContent = `You got ${correct} out of ${total} questions correct. ${summary}`;

    // Stats
    $('#results-stats').innerHTML = `
      <div class="results-stat">
        <div class="results-stat-value stat-correct">${correct}</div>
        <div class="results-stat-label">Correct</div>
      </div>
      <div class="results-stat">
        <div class="results-stat-value stat-wrong">${wrong}</div>
        <div class="results-stat-label">Incorrect</div>
      </div>
      <div class="results-stat">
        <div class="results-stat-value stat-total">${total}</div>
        <div class="results-stat-label">Total</div>
      </div>
    `;
  }

  function retryQuiz() {
    startQuiz();
  }

  function reviewAnswers() {
    state.isReviewMode = true;
    state.quizIndex = 0;
    showScreen('quiz');
    renderQuizQuestion();
  }

  // ---- Reading Mode ----

  function renderReadTabs() {
    const chapter = state.selectedChapter;
    const sections = [...new Set(chapter.questions.map(q => q.section).filter(Boolean))];
    const tabs = $('#read-section-tabs');

    tabs.innerHTML = `
      <button class="read-tab active" data-section="all">All</button>
      ${sections.map(s => `<button class="read-tab" data-section="${s}">${s}</button>`).join('')}
    `;

    tabs.querySelectorAll('.read-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.querySelectorAll('.read-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        state.readSection = tab.dataset.section;
        renderReadList();
      });
    });
  }

  function renderReadList() {
    const chapter = state.selectedChapter;
    if (!chapter) return;

    let questions = [...chapter.questions];

    // Section filter
    if (state.readSection !== 'all') {
      questions = questions.filter(q => q.section === state.readSection);
    }

    // Search filter
    if (state.readSearch) {
      const term = state.readSearch;
      questions = questions.filter(q =>
        q.question.toLowerCase().includes(term) ||
        q.explanation.toLowerCase().includes(term) ||
        q.options.some(o => o.text.toLowerCase().includes(term))
      );
    }

    const list = $('#read-list');

    if (questions.length === 0) {
      list.innerHTML = `
        <div style="text-align:center; padding:3rem; color:var(--text-muted);">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom:1rem; opacity:0.5;">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <p>No questions found matching your criteria.</p>
        </div>
      `;
      return;
    }

    list.innerHTML = questions.map(q => `
      <div class="read-item">
        <div class="read-item-header">
          <span class="read-item-num">Q${q.id}</span>
          ${q.section ? `<span class="read-item-section">${q.section}</span>` : ''}
        </div>
        <div class="read-item-question">${q.question}</div>
        <div class="read-item-options">
          ${q.options.map(o => `
            <div class="read-option ${o.letter === q.correctAnswer ? 'correct-option' : ''}">
              <span class="read-option-letter">${o.letter}</span>
              <span>${o.text}</span>
            </div>
          `).join('')}
        </div>
        <div class="read-item-explanation">
          <strong>Explanation:</strong> ${q.explanation}
        </div>
      </div>
    `).join('');
  }

  // ---- Event Bindings ----
  function bindEvents() {
    // Logo -> home
    $('#logo-home').addEventListener('click', () => showScreen('home'));
    $('#logo-home').addEventListener('keydown', (e) => { if (e.key === 'Enter') showScreen('home'); });

    // Back button
    $('#nav-back').addEventListener('click', goBack);

    // Mode selection
    $('#mode-quiz').addEventListener('click', startQuiz);

    // Wire search
    const searchInput = $('#read-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        state.readSearch = e.target.value.toLowerCase();
        renderReadList();
      });
    }

    // Quiz navigation
    $('#quiz-next').addEventListener('click', quizNext);
    $('#quiz-prev').addEventListener('click', quizPrev);
    $('#quiz-finish').addEventListener('click', quizFinish);

    // Results
    $('#results-retry').addEventListener('click', retryQuiz);
    $('#results-review').addEventListener('click', reviewAnswers);
    $('#results-home').addEventListener('click', () => showScreen('home'));

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
      if (state.currentScreen === 'quiz') {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        const q = state.quizQuestions[state.quizIndex];
        if (!q) return;

        const isRevealed = !!state.quizRevealed[q.id];
        const isLast = state.quizIndex === state.quizQuestions.length - 1;

        // Next / Finish on ArrowRight, N, or Enter (when revealed)
        if (e.key === 'ArrowRight' || e.key === 'n' || e.key === 'N' || (e.key === 'Enter' && isRevealed)) {
          if (isRevealed) {
            if (isLast) {
              quizFinish();
            } else {
              quizNext();
            }
          }
        }

        // Previous on ArrowLeft or P
        if (e.key === 'ArrowLeft' || e.key === 'p' || e.key === 'P') {
          quizPrev();
        }

        // Select answer option using 1-4 or A-D
        if (!isRevealed) {
          const keyMap = {
            '1': 'A', '2': 'B', '3': 'C', '4': 'D',
            'a': 'A', 'b': 'B', 'c': 'C', 'd': 'D',
            'A': 'A', 'B': 'B', 'C': 'C', 'D': 'D'
          };
          if (keyMap[e.key]) {
            selectAnswer(q, keyMap[e.key]);
          }
        }
      }
    });
  }

  // ---- Initialize ----
  function init() {
    renderHome();
    bindEvents();
    showScreen('home');
  }

  // Run
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
