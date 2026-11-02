// ═══════════════════════════════════════════════
//  WordForge — Canvas Renderer
// ═══════════════════════════════════════════════

'use strict';

class WordForgeRenderer {
  constructor(canvas, overlayCanvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.overlay = overlayCanvas;
    this.octx = overlayCanvas.getContext('2d');

    this.particles = [];
    this.laserPoints = [];
    this.cellFlashes = new Map(); // cellIdx -> {t, color}
    this.victoryParticles = [];
    this.shakeX = 0;
    this.shakeY = 0;
    this.shakeDecay = 0;

    this.raf = null;
    this.lastTime = 0;

    // Grid geometry (set by layout())
    this.cellSize = 0;
    this.gap = 4;
    this.gridX = 0;
    this.gridY = 0;

    // State refs (set externally)
    this.grid = [];
    this.currentPath = [];
    this.hoveredCell = -1;
    this.foundWords = new Set();
    this.targetWords = [];
  }

  layout(containerW, containerH) {
    const maxCell = Math.min(Math.floor((containerW - 20) / 5), 82);
    this.cellSize = maxCell;
    this.gap = Math.max(4, Math.floor(maxCell * 0.05));
    const gridW = 5 * this.cellSize + 4 * this.gap;
    const gridH = 5 * this.cellSize + 4 * this.gap;
    this.gridX = Math.floor((containerW - gridW) / 2);
    this.gridY = Math.floor((containerH - gridH) / 2);
    this.canvas.width = containerW;
    this.canvas.height = containerH;
    this.overlay.width = containerW;
    this.overlay.height = containerH;
  }

  cellCenter(idx) {
    const r = Math.floor(idx / 5);
    const c = idx % 5;
    return {
      x: this.gridX + c * (this.cellSize + this.gap) + this.cellSize / 2,
      y: this.gridY + r * (this.cellSize + this.gap) + this.cellSize / 2,
    };
  }

  cellRect(idx) {
    const r = Math.floor(idx / 5);
    const c = idx % 5;
    return {
      x: this.gridX + c * (this.cellSize + this.gap),
      y: this.gridY + r * (this.cellSize + this.gap),
      w: this.cellSize,
      h: this.cellSize,
    };
  }

  // reach < 1: the point must be within that share of the cell's half-width of its middle.
  // While dragging, that keeps a diagonal from clipping the corners of the cells beside it.
  hitTest(px, py, reach = 1) {
    for (let i = 0; i < 25; i++) {
      const { x, y, w, h } = this.cellRect(i);
      if (reach < 1) {
        const dx = px - (x + w / 2), dy = py - (y + h / 2), r = (Math.min(w, h) / 2) * reach;
        if (dx * dx + dy * dy <= r * r) return i;
      } else if (px >= x && px <= x + w && py >= y && py <= y + h) {
        return i;
      }
    }
    return -1;
  }

  // ── Particle factory ──
  spawnSpark(x, y, color, count = 6) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.5 + Math.random() * 4;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.6 + Math.random() * 0.4,
        maxLife: 1.0,
        r: 1.5 + Math.random() * 3,
        color,
        type: 'spark',
      });
    }
  }

  // With the system's reduce-motion setting on, no confetti and no shake
  get calm() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  spawnConfetti(x, y, count = 24) {
    if (this.calm) return;
    const colors = ['#00D4FF','#FF6B9D','#FFD700','#00FF88','#FF8C42','#B44FFF'];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 3 + Math.random() * 6;
      this.victoryParticles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 4,
        life: 1.2 + Math.random() * 0.8,
        maxLife: 2.0,
        r: 3 + Math.random() * 5,
        color: colors[Math.floor(Math.random() * colors.length)],
        rot: Math.random() * Math.PI * 2,
        rotV: (Math.random() - 0.5) * 0.3,
        w: 4 + Math.random() * 8,
        h: 3 + Math.random() * 4,
      });
    }
  }

  spawnWordBurst(pathIndices) {
    for (const idx of pathIndices) {
      const c = this.cellCenter(idx);
      this.spawnConfetti(c.x, c.y, 10);
      this.spawnSpark(c.x, c.y, '#00D4FF', 8);
    }
    this.cellFlashes.set('burst', { t: 0.8, cells: pathIndices, color: '#00D4FF' });
  }

  triggerShake(intensity = 6) {
    if (this.calm) return;
    this.shakeX = (Math.random() - 0.5) * intensity * 2;
    this.shakeY = (Math.random() - 0.5) * intensity * 2;
    this.shakeDecay = 0.8;
  }

  triggerErrorShake() {
    this.triggerShake(4);
  }

  // ── Main draw ──
  draw(dt) {
    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;

    ctx.clearRect(0, 0, W, H);

    // Screen shake
    if (this.shakeDecay > 0.01) {
      ctx.save();
      ctx.translate(this.shakeX, this.shakeY);
      this.shakeX *= this.shakeDecay;
      this.shakeY *= this.shakeDecay;
    }

    // Draw grid cells
    this.drawGrid(ctx);

    if (this.shakeDecay > 0.01) {
      ctx.restore();
      this.shakeDecay *= 0.85;
    }

    // Draw overlay (particles, laser on top)
    this.drawOverlay(dt);
  }

  drawGrid(ctx) {
    if (!this.grid.length) return;

    for (let i = 0; i < 25; i++) {
      const { x, y, w, h } = this.cellRect(i);
      const inPath = this.currentPath.includes(i);
      const isHovered = this.hoveredCell === i;
      const letter = this.grid[i];

      this.drawCell(ctx, x, y, w, h, letter, inPath, isHovered, i);
    }
  }

  drawCell(ctx, x, y, w, h, letter, inPath, isHovered, idx) {
    const r = Math.min(10, w * 0.12);
    const t = Date.now() / 1000;

    // ── Theme detection: only trust the explicit body class ──
    const isDark = document.body.classList.contains('dark-mode');

    // Palette — entirely different for light vs dark so letters are always visible
    const pal = isDark ? {
      cellBase:    ['#1e2d3d', '#162435', '#0e1a28'],
      cellHover:   ['#1a3a4d', '#0d2535'],
      cellActive:  ['#0a2a3d', '#0d3a52', '#0a2a3d'],
      letterNorm:  '#e8f8ff',   // bright on dark bg
      letterHover: '#c8f0ff',
      letterActive:'#7fffff',
      border:       'rgba(100,150,200,0.2)',
      bevelAlpha:   0.12,
      specAlpha:    0.18,
    } : {
      cellBase:    ['#f4f8fc', '#eaf0f7', '#dde6f0'],
      cellHover:   ['#daeffe', '#c8e8fc'],
      cellActive:  ['#b8e0ff', '#98ccf4', '#b8e0ff'],
      letterNorm:  '#1a2b3c',   // dark on light bg
      letterHover: '#004477',
      letterActive:'#003366',
      border:       'rgba(100,140,180,0.35)',
      bevelAlpha:   0.55,
      specAlpha:    0.45,
    };

    ctx.save();

    // ── Shadow / depth ──
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = inPath ? 0 : 3;
    ctx.shadowBlur = inPath ? 20 : (isDark ? 8 : 6);
    ctx.shadowColor = inPath ? 'rgba(0,212,255,0.8)' : (isDark ? 'rgba(0,0,0,0.4)' : 'rgba(0,80,160,0.18)');

    // ── Base fill ──
    const bgGrad = ctx.createLinearGradient(x, y, x + w, y + h);
    const cols = inPath ? pal.cellActive : isHovered ? pal.cellHover : pal.cellBase;
    cols.forEach((c, i) => bgGrad.addColorStop(i / (cols.length - 1), c));

    ctx.fillStyle = bgGrad;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    // ── Chrome bevel top highlight ──
    const bevelGrad = ctx.createLinearGradient(x, y, x, y + h * 0.35);
    bevelGrad.addColorStop(0, inPath ? `rgba(0,212,255,0.25)` : `rgba(255,255,255,${pal.bevelAlpha})`);
    bevelGrad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = bevelGrad;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.fill();

    // ── Border ──
    if (inPath) {
      const pulse = 0.7 + 0.3 * Math.sin(t * 6 + idx * 0.5);
      ctx.strokeStyle = `rgba(0,212,255,${pulse})`;
      ctx.lineWidth = 2.5;
      ctx.shadowColor = '#00D4FF';
      ctx.shadowBlur = 15 * pulse;
    } else if (isHovered) {
      ctx.strokeStyle = 'rgba(0,180,255,0.6)';
      ctx.lineWidth = 1.5;
    } else {
      ctx.strokeStyle = pal.border;
      ctx.lineWidth = 1;
    }
    ctx.beginPath();
    ctx.roundRect(x + 0.5, y + 0.5, w - 1, h - 1, r);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // ── Specular highlight dot (top-left) ──
    if (!inPath) {
      const specGrad = ctx.createRadialGradient(x + w * 0.28, y + h * 0.22, 0, x + w * 0.28, y + h * 0.22, w * 0.22);
      specGrad.addColorStop(0, `rgba(255,255,255,${pal.specAlpha})`);
      specGrad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = specGrad;
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, r);
      ctx.fill();
    }

    // ── Letter — always high-contrast against its background ──
    const fontSize = Math.floor(w * 0.44);
    ctx.font = `700 ${fontSize}px 'Orbitron', 'Rajdhani', monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (inPath) {
      ctx.shadowColor = '#00D4FF';
      ctx.shadowBlur = isDark ? 18 : 10;
      ctx.fillStyle = isDark ? '#7fffff' : pal.letterActive;
    } else if (isHovered) {
      ctx.shadowColor = '#00D4FF';
      ctx.shadowBlur = isDark ? 8 : 4;
      ctx.fillStyle = isDark ? pal.letterHover : pal.letterHover;
    } else {
      ctx.shadowBlur = 0;
      ctx.fillStyle = pal.letterNorm;
    }

    ctx.fillText(letter, x + w / 2, y + h / 2 + fontSize * 0.05);
    ctx.shadowBlur = 0;

    ctx.restore();
  }

  drawOverlay(dt) {
    const ctx = this.octx;
    const W = this.overlay.width;
    const H = this.overlay.height;
    ctx.clearRect(0, 0, W, H);

    // ── Laser path trace ──
    if (this.currentPath.length >= 2) {
      this.drawLaser(ctx);
    }

    // ── Single-cell drag dot ──
    if (this.currentPath.length === 1) {
      const c = this.cellCenter(this.currentPath[0]);
      ctx.beginPath();
      ctx.arc(c.x, c.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#00D4FF';
      ctx.shadowColor = '#00D4FF';
      ctx.shadowBlur = 12;
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // ── Particles ──
    this.updateParticles(ctx, dt);
    this.updateVictoryParticles(ctx, dt);
  }

  drawLaser(ctx) {
    const path = this.currentPath;
    if (path.length < 2) return;
    const t = Date.now() / 1000;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Outer glow
    ctx.globalAlpha = 0.3;
    ctx.strokeStyle = '#00D4FF';
    ctx.lineWidth = 10;
    ctx.shadowColor = '#00D4FF';
    ctx.shadowBlur = 20;
    ctx.beginPath();
    const first = this.cellCenter(path[0]);
    ctx.moveTo(first.x, first.y);
    for (let i = 1; i < path.length; i++) {
      const c = this.cellCenter(path[i]);
      ctx.lineTo(c.x, c.y);
    }
    ctx.stroke();

    // Core beam
    ctx.globalAlpha = 0.9;
    ctx.strokeStyle = '#00FAFF';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#AAFFFF';
    ctx.shadowBlur = 8;
    ctx.stroke();

    // Animated dashes traveling along path
    ctx.globalAlpha = 0.6;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 8]);
    ctx.lineDashOffset = -t * 40;
    ctx.stroke();
    ctx.setLineDash([]);

    // Node dots
    ctx.globalAlpha = 1;
    for (const idx of path) {
      const c = this.cellCenter(idx);
      ctx.beginPath();
      ctx.arc(c.x, c.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#00FAFF';
      ctx.shadowColor = '#00D4FF';
      ctx.shadowBlur = 12;
      ctx.fill();
    }

    // Spark at tip
    const tip = this.cellCenter(path[path.length - 1]);
    const sparkR = 6 + 2 * Math.sin(t * 12);
    const sparkGrad = ctx.createRadialGradient(tip.x, tip.y, 0, tip.x, tip.y, sparkR * 2);
    sparkGrad.addColorStop(0, 'rgba(255,255,255,1)');
    sparkGrad.addColorStop(0.3, 'rgba(0,212,255,0.8)');
    sparkGrad.addColorStop(1, 'rgba(0,212,255,0)');
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = sparkGrad;
    ctx.beginPath();
    ctx.arc(tip.x, tip.y, sparkR * 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    ctx.restore();

    // Emit sparks occasionally
    if (Math.random() < 0.25) {
      this.spawnSpark(tip.x, tip.y, '#00D4FF', 2);
    }
  }

  updateParticles(ctx, dt) {
    ctx.save();
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) { this.particles.splice(i, 1); continue; }
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.08;
      const alpha = p.life / p.maxLife;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * alpha + 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  updateVictoryParticles(ctx, dt) {
    ctx.save();
    for (let i = this.victoryParticles.length - 1; i >= 0; i--) {
      const p = this.victoryParticles[i];
      p.life -= dt;
      if (p.life <= 0) { this.victoryParticles.splice(i, 1); continue; }
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.15;
      p.vx *= 0.98;
      p.rot += p.rotV;
      const alpha = Math.min(1, p.life / 0.4);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 4;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  startLoop() {
    const loop = (ts) => {
      const dt = Math.min((ts - this.lastTime) / 1000, 0.05);
      this.lastTime = ts;
      this.draw(dt);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stopLoop() {
    if (this.raf) cancelAnimationFrame(this.raf);
  }
}

window.WordForgeRenderer = WordForgeRenderer;
