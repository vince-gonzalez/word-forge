// ═══════════════════════════════════════════════
//  WordForge — Core Game Logic
// ═══════════════════════════════════════════════

'use strict';

const GAME_DURATION = 90; // seconds
const MIN_WORD_LEN = 3;

class WordForgeGame {
  constructor(renderer) {
    this.renderer = renderer;

    // Puzzle state
    this.puzzle = null;
    this.grid = [];

    // Game state
    this.phase = 'idle'; // idle | playing | ended
    this.timeLeft = GAME_DURATION;
    this.timerInterval = null;
    this.score = 0;
    this.wordsFound = new Set();
    this.wordsFoundData = [];

    // Input state
    this.isDragging = false;
    this.currentPath = [];
    this.currentWord = '';
    this.typedWord = '';
    this.inputMode = 'drag'; // drag | type

    // Callbacks (set by UI)
    this.onWordFound = null;
    this.onWordInvalid = null;
    this.onGameEnd = null;
    this.onTimerTick = null;
    this.onScoreUpdate = null;
    this.onCurrentWordChange = null;

    this._bindInput();
  }

  // ── Puzzle loading ──
  loadPuzzle(seed) {
    this.puzzle = WordForgePuzzle.generatePuzzle(seed);
    this.grid = this.puzzle.grid;
    this.renderer.grid = this.grid;
    this.renderer.targetWords = this.puzzle.targetWords;
    return this.puzzle;
  }

  // ── Game flow ──
  start() {
    this.phase = 'playing';
    this.timeLeft = GAME_DURATION;
    this.score = 0;
    this.wordsFound = new Set();
    this.wordsFoundData = [];
    this.currentPath = [];
    this.currentWord = '';
    this.typedWord = '';
    this.renderer.currentPath = [];
    this.renderer.particles = [];
    this.renderer.victoryParticles = [];

    this.timerInterval = setInterval(() => {
      this.timeLeft = Math.max(0, this.timeLeft - 1);
      this.onTimerTick?.(this.timeLeft);
      if (this.timeLeft === 0) this.endGame();
    }, 1000);
  }

  endGame() {
    if (this.phase === 'ended') return;
    this.phase = 'ended';
    clearInterval(this.timerInterval);
    this.currentPath = [];
    this.renderer.currentPath = [];
    this.onGameEnd?.(this._buildResult());
  }

  _buildResult() {
    const target = this.puzzle.targetWords;
    const total = target.length;
    // The grade is about the targets; other words still add to the score
    const found = target.filter(tw => this.wordsFound.has(tw.word)).length;
    const pct = found / Math.max(total, 1);
    // Seconds left only pay when every target was found
    const speedBonus = found === total ? Math.floor(this.timeLeft * 20) : 0;
    const finalScore = this.score + speedBonus;

    // With 12 targets these bands are A 11-12, B 9-10, C 6-8, D 3-5
    const grade = pct >= 0.9 ? 'A' : pct >= 0.75 ? 'B' : pct >= 0.5 ? 'C' : pct >= 0.25 ? 'D' : 'F';
    const gradeColor = { A:'#00FF88', B:'#00D4FF', C:'#FFD700', D:'#FF8C42', F:'#FF6B9D' };

    return {
      score: finalScore,
      baseScore: this.score,
      speedBonus,
      found,
      total,
      pct: Math.round(pct * 100),
      grade,
      gradeColor: gradeColor[grade],
      wordsFound: this.wordsFoundData,
      missed: target.filter(tw => !this.wordsFound.has(tw.word)).map(tw => tw.word),
      timeLeft: this.timeLeft,
    };
  }

  isTarget(word) {
    return this.puzzle.targetWords.some(tw => tw.word === word);
  }

  // ── Word submission ──
  submitCurrentWord() {
    const word = (this.inputMode === 'type' ? this.typedWord : this.currentWord).toLowerCase().trim();
    if (word.length < MIN_WORD_LEN) return;

    if (this.wordsFound.has(word)) {
      this.onWordInvalid?.(word, 'Already found');
      this.renderer.triggerErrorShake();
      this._clearInput();
      return;
    }

    // Check if word is in target list
    const targetEntry = this.puzzle.allWords.get(word);

    // Also allow any valid dictionary word that can be formed in grid
    const gridPath = this.inputMode === 'type'
      ? WordForgePuzzle.validateWordPath(word, this.grid)
      : (targetEntry ? null : WordForgePuzzle.validateWordPath(word, this.grid));

    const pathToUse = this.inputMode === 'drag' ? this.currentPath : gridPath;

    if (!WordForgePuzzle.TRIE.isWord(word)) {
      this.onWordInvalid?.(word, 'Not a word');
      this.renderer.triggerErrorShake();
      this._clearInput();
      return;
    }

    // A word only counts if it can be traced on the board, typed or dragged
    if (!pathToUse || pathToUse.length < word.length) {
      this.onWordInvalid?.(word, 'Not on the board');
      this.renderer.triggerErrorShake();
      this._clearInput();
      return;
    }

    // Valid!
    const pts = WordForgePuzzle.scoreWord(word);
    const rarity = WordForgePuzzle.getRarity(word);
    this.score += pts;
    this.wordsFound.add(word);
    this.wordsFoundData.push({ word, pts, rarity, path: pathToUse || this.currentPath });

    // Visual feedback
    const finalPath = pathToUse || this.currentPath;
    if (finalPath.length) this.renderer.spawnWordBurst(finalPath);

    this.onWordFound?.(word, pts, rarity);
    this.onScoreUpdate?.(this.score);

    this._clearInput();

    // Check completion
    const allTargetFound = this.puzzle.targetWords.every(tw => this.wordsFound.has(tw.word));
    if (allTargetFound) {
      setTimeout(() => this.endGame(), 400);
    }
  }

  _clearInput() {
    this.currentPath = [];
    this.currentWord = '';
    this.typedWord = '';
    this.isDragging = false;
    this.renderer.currentPath = [];
    this.onCurrentWordChange?.('');
  }

  _updateCurrentWord() {
    this.currentWord = this.currentPath.map(i => this.grid[i]).join('');
    this.renderer.currentPath = [...this.currentPath];
    this.onCurrentWordChange?.(this.currentWord);
  }

  // ── Input binding ──
  _bindInput() {
    const canvas = this.renderer.canvas;
    const overlay = this.renderer.overlay;

    // Touch/mouse on canvas
    const getPos = (e) => {
      const rect = overlay.getBoundingClientRect();
      const scaleX = overlay.width / rect.width;
      const scaleY = overlay.height / rect.height;
      const src = e.touches ? e.touches[0] : e;
      return {
        x: (src.clientX - rect.left) * scaleX,
        y: (src.clientY - rect.top) * scaleY,
      };
    };

    const onStart = (e) => {
      if (this.phase !== 'playing') return;
      e.preventDefault();
      this.inputMode = 'drag';
      this._clearInput();
      this.isDragging = true;
      const pos = getPos(e);
      const hit = this.renderer.hitTest(pos.x, pos.y);
      if (hit >= 0) {
        this.currentPath = [hit];
        this._updateCurrentWord();
        this.renderer.spawnSpark(
          this.renderer.cellCenter(hit).x,
          this.renderer.cellCenter(hit).y,
          '#00D4FF', 4
        );
      }
    };

    const onMove = (e) => {
      if (!this.isDragging || this.phase !== 'playing') return;
      e.preventDefault();
      const pos = getPos(e);
      const hit = this.renderer.hitTest(pos.x, pos.y);
      this.renderer.hoveredCell = hit;

      if (hit >= 0 && hit !== this.currentPath[this.currentPath.length - 1]) {
        // Check adjacency to last cell
        if (this.currentPath.length > 0) {
          const last = this.currentPath[this.currentPath.length - 1];
          const lr = Math.floor(last / 5), lc = last % 5;
          const hr = Math.floor(hit / 5), hc = hit % 5;
          if (Math.abs(lr - hr) > 1 || Math.abs(lc - hc) > 1) return;
        }
        // No re-use
        if (this.currentPath.includes(hit)) {
          // Allow backtrack (remove last cell)
          const prev = this.currentPath[this.currentPath.length - 2];
          if (prev === hit) {
            this.currentPath.pop();
            this._updateCurrentWord();
          }
          return;
        }
        this.currentPath.push(hit);
        this._updateCurrentWord();
        const c = this.renderer.cellCenter(hit);
        this.renderer.spawnSpark(c.x, c.y, '#00D4FF', 3);
      }
    };

    const onEnd = (e) => {
      if (!this.isDragging) return;
      e.preventDefault();
      this.isDragging = false;
      this.renderer.hoveredCell = -1;
      if (this.currentPath.length >= MIN_WORD_LEN) {
        this.submitCurrentWord();
      } else {
        this._clearInput();
      }
    };

    overlay.addEventListener('mousedown', onStart);
    overlay.addEventListener('mousemove', onMove);
    overlay.addEventListener('mouseup', onEnd);
    overlay.addEventListener('mouseleave', () => { this.renderer.hoveredCell = -1; });
    overlay.addEventListener('touchstart', onStart, { passive: false });
    overlay.addEventListener('touchmove', onMove, { passive: false });
    overlay.addEventListener('touchend', onEnd, { passive: false });

    // Keyboard input
    document.addEventListener('keydown', (e) => {
      if (this.phase !== 'playing') return;

      if (e.key === 'Enter') {
        // In play, Enter submits a word; it must not also press whatever button still has focus
        e.preventDefault();
        if (this.typedWord.length >= MIN_WORD_LEN) {
          this.inputMode = 'type';
          this.submitCurrentWord();
        }
        return;
      }
      if (e.key === 'Backspace') {
        if (this.typedWord.length > 0) {
          this.typedWord = this.typedWord.slice(0, -1);
          this.inputMode = 'type';
          this._highlightTypedPath();
          this.onCurrentWordChange?.(this.typedWord);
        }
        return;
      }
      if (e.key === 'Escape') {
        this._clearInput();
        return;
      }
      if (/^[a-zA-Z]$/.test(e.key)) {
        this.inputMode = 'type';
        this.isDragging = false;
        this.typedWord += e.key.toUpperCase();
        this._highlightTypedPath();
        this.onCurrentWordChange?.(this.typedWord);
      }
    });
  }

  _highlightTypedPath() {
    const word = this.typedWord.toLowerCase();
    const path = WordForgePuzzle.validateWordPath(word, this.grid);
    if (path) {
      this.renderer.currentPath = path;
    } else {
      this.renderer.currentPath = [];
    }
  }

  // ── Accessors ──
  getStats() {
    return {
      score: this.score,
      found: this.wordsFound.size,
      total: this.puzzle?.targetWords.length || 0,
      timeLeft: this.timeLeft,
    };
  }
}

window.WordForgeGame = WordForgeGame;
