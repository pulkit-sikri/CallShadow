/**
 * LiveTrustGraph — Real-time Canvas 2D trust score graph for Live Recognition.
 * Plots a rolling line graph of trust score over time as chunk results arrive.
 * Matches the dark cybersecurity aesthetic of the existing audioVisualizer.js.
 */
class LiveTrustGraph {
    constructor() {
        this.canvas   = null;
        this.ctx      = null;
        this.points   = []; // Array of { timeSec, trustScore, classification }
        this.maxPoints = 30; // Rolling window — shows last N data points
        this.animId   = null;
        this.needsRedraw = false;
        this._initialized = false;
    }

    /**
     * Initializes the graph on a given canvas element.
     * @param {string} canvasId
     */
    init(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext('2d');
        this.points = [];
        this._initialized = true;
        this._resizeCanvas();
        this._drawEmpty();
    }

    _resizeCanvas() {
        if (!this.canvas) return;
        const dpr = window.devicePixelRatio || 1;
        const rect = this.canvas.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
            this.canvas.width  = rect.width  * dpr;
            this.canvas.height = rect.height * dpr;
            this.ctx.scale(dpr, dpr);
        }
    }

    /**
     * Adds a data point from a chunk_result WebSocket message.
     * @param {object} chunkResult - { ai_probability, human_probability, classification, start_time, confidence }
     */
    addPoint(chunkResult) {
        if (!this._initialized) return;

        const ai_prob      = chunkResult.ai_probability   || 0;
        const human_prob   = chunkResult.human_probability || (1 - ai_prob);
        const classification = chunkResult.classification || 'UNCERTAIN';
        const timeSec      = chunkResult.start_time || (this.points.length * 2);

        // Derive trust score from this chunk only (Layer 1 component: 40% weight of final)
        // We show a running AI authenticity score = human_probability * 100
        const chunkTrustApprox = Math.round(human_prob * 100);

        this.points.push({
            timeSec,
            timeLabel: `${timeSec.toFixed(1)}s–${(chunkResult.end_time || timeSec + 3).toFixed(1)}s`,
            trustScore: chunkTrustApprox,
            score: chunkTrustApprox,
            label: classification.toUpperCase().includes('AI') || classification.toUpperCase().includes('GENERATED') ? 'AI Generated'
                 : classification.toUpperCase().includes('HUMAN') || classification.toUpperCase().includes('GENUINE') ? 'Human'
                 : 'Uncertain',
            classification
        });

        // Keep rolling window
        if (this.points.length > this.maxPoints) {
            this.points.shift();
        }

        this.needsRedraw = true;
        if (!this.animId) {
            this._scheduleRedraw();
        }
    }

    /**
     * Updates the final trust score after session summary arrives.
     * Replaces the last point with the true final trust score.
     * @param {number} finalTrustScore - 0–100
     */
    setFinalScore(finalTrustScore) {
        if (!this._initialized || this.points.length === 0) return;
        this.points[this.points.length - 1].trustScore = finalTrustScore;
        this.points[this.points.length - 1].isFinal = true;
        this.needsRedraw = true;
        this._scheduleRedraw();
    }

    _scheduleRedraw() {
        if (this.animId) return;
        this.animId = requestAnimationFrame(() => {
            this.animId = null;
            if (this.needsRedraw) {
                this._draw();
                this.needsRedraw = false;
            }
        });
    }

    /**
     * Returns a copy of all recorded data points for export / display.
     */
    getPoints() {
        return this.points.slice();
    }

    /**
     * Clears the graph and resets state.
     */
    clear() {
        this.points = [];
        this._initialized = false;
        if (this.animId) {
            cancelAnimationFrame(this.animId);
            this.animId = null;
        }
        if (this.canvas && this.ctx) {
            this._drawEmpty();
        }
    }

    _drawEmpty() {
        if (!this.canvas || !this.ctx) return;
        const dpr    = window.devicePixelRatio || 1;
        const width  = this.canvas.width  / dpr;
        const height = this.canvas.height / dpr;
        const ctx    = this.ctx;

        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(dpr, dpr);

        // Background
        ctx.fillStyle = '#080b11';
        ctx.fillRect(0, 0, width, height);

        // Draw empty axes + placeholder text
        this._drawAxes(ctx, width, height);

        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.font = '12px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Collecting audio — results appear after first 3s', width / 2, height / 2);

        ctx.restore();
    }

    _draw() {
        if (!this.canvas || !this.ctx || this.points.length === 0) return;

        const dpr    = window.devicePixelRatio || 1;
        const width  = this.canvas.width  / dpr;
        const height = this.canvas.height / dpr;
        const ctx    = this.ctx;

        // Layout constants
        const PAD_LEFT   = 42;
        const PAD_RIGHT  = 16;
        const PAD_TOP    = 14;
        const PAD_BOTTOM = 28;
        const plotW = width  - PAD_LEFT - PAD_RIGHT;
        const plotH = height - PAD_TOP  - PAD_BOTTOM;

        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(dpr, dpr);

        // ── Background ──────────────────────────────────────────────────────
        ctx.fillStyle = '#080b11';
        ctx.fillRect(0, 0, width, height);

        // ── Colour zone fills (risk zones) ──────────────────────────────────
        // Red zone: 0–40
        const redTop    = PAD_TOP + plotH - (40 / 100) * plotH;
        const redH      = (40 / 100) * plotH;
        ctx.fillStyle   = 'rgba(220,38,38,0.08)';
        ctx.fillRect(PAD_LEFT, redTop, plotW, redH);

        // Amber zone: 40–65
        const amberTop  = PAD_TOP + plotH - (65 / 100) * plotH;
        const amberH    = (25 / 100) * plotH;
        ctx.fillStyle   = 'rgba(217,119,6,0.07)';
        ctx.fillRect(PAD_LEFT, amberTop, plotW, amberH);

        // Green zone: 65–100
        const greenTop  = PAD_TOP;
        const greenH    = (35 / 100) * plotH;
        ctx.fillStyle   = 'rgba(22,163,74,0.07)';
        ctx.fillRect(PAD_LEFT, greenTop, plotW, greenH);

        // ── Axes + grid ──────────────────────────────────────────────────────
        this._drawAxes(ctx, width, height, PAD_LEFT, PAD_RIGHT, PAD_TOP, PAD_BOTTOM, plotW, plotH);

        // ── Line + dots ─────────────────────────────────────────────────────
        const n = this.points.length;
        const xStep = n > 1 ? plotW / (n - 1) : plotW;

        const toX = (i) => PAD_LEFT + (n > 1 ? i * xStep : plotW / 2);
        const toY = (score) => PAD_TOP + plotH - (Math.min(100, Math.max(0, score)) / 100) * plotH;

        // Glow
        ctx.shadowBlur  = 10;
        ctx.shadowColor = 'rgba(249,115,22,0.5)';

        // Line
        ctx.beginPath();
        ctx.lineWidth   = 2.5;
        ctx.lineJoin    = 'round';
        ctx.lineCap     = 'round';

        this.points.forEach((pt, i) => {
            const x = toX(i);
            const y = toY(pt.trustScore);
            if (i === 0) ctx.moveTo(x, y);
            else         ctx.lineTo(x, y);
        });

        // Gradient stroke along the line
        const lineGrad = ctx.createLinearGradient(PAD_LEFT, 0, PAD_LEFT + plotW, 0);
        lineGrad.addColorStop(0, '#ea580c');
        lineGrad.addColorStop(0.5, '#fb923c');
        lineGrad.addColorStop(1, '#ea580c');
        ctx.strokeStyle = lineGrad;
        ctx.stroke();

        ctx.shadowBlur = 0;

        // Area fill under line
        ctx.beginPath();
        this.points.forEach((pt, i) => {
            const x = toX(i);
            const y = toY(pt.trustScore);
            if (i === 0) ctx.moveTo(x, y);
            else         ctx.lineTo(x, y);
        });
        ctx.lineTo(toX(n - 1), PAD_TOP + plotH);
        ctx.lineTo(PAD_LEFT, PAD_TOP + plotH);
        ctx.closePath();
        const areaGrad = ctx.createLinearGradient(0, PAD_TOP, 0, PAD_TOP + plotH);
        areaGrad.addColorStop(0, 'rgba(249,115,22,0.18)');
        areaGrad.addColorStop(1, 'rgba(249,115,22,0)');
        ctx.fillStyle = areaGrad;
        ctx.fill();

        // Dots on each data point
        this.points.forEach((pt, i) => {
            const x = toX(i);
            const y = toY(pt.trustScore);

            // Dot color by classification
            const dotColor = this._classColor(pt.classification);

            ctx.beginPath();
            ctx.arc(x, y, i === n - 1 ? 5 : 3.5, 0, Math.PI * 2);
            ctx.fillStyle = dotColor;
            ctx.shadowBlur  = i === n - 1 ? 8 : 0;
            ctx.shadowColor = dotColor;
            ctx.fill();
            ctx.shadowBlur = 0;
        });

        // Latest score label
        if (n > 0) {
            const last = this.points[n - 1];
            const lx   = toX(n - 1) + 8;
            const ly   = toY(last.trustScore);
            ctx.font      = 'bold 11px Inter, sans-serif';
            ctx.fillStyle = this._classColor(last.classification);
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            const labelText = `${last.trustScore}`;
            if (lx + 24 < PAD_LEFT + plotW) {
                ctx.fillText(labelText, lx, ly);
            }
        }

        ctx.restore();
    }

    _drawAxes(ctx, width, height, padL=42, padR=16, padT=14, padB=28, plotW=null, plotH=null) {
        plotW = plotW || (width  - padL - padR);
        plotH = plotH || (height - padT - padB);

        // Y-axis labels + grid lines
        const yTicks = [0, 25, 40, 65, 80, 100];
        ctx.font = '9px Inter, sans-serif';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';

        yTicks.forEach(val => {
            const y = padT + plotH - (val / 100) * plotH;

            ctx.strokeStyle = 'rgba(255,255,255,0.07)';
            ctx.lineWidth   = 1;
            ctx.beginPath();
            ctx.moveTo(padL, y);
            ctx.lineTo(padL + plotW, y);
            ctx.stroke();

            ctx.fillStyle = val === 0 ? '#dc2626' : val === 40 ? '#d97706' : val === 65 ? '#16a34a' : 'rgba(255,255,255,0.35)';
            ctx.fillText(String(val), padL - 5, y);
        });

        // Y-axis label
        ctx.save();
        ctx.translate(11, padT + plotH / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.font = '9px Inter, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Trust Score', 0, 0);
        ctx.restore();

        // X-axis label
        ctx.font = '9px Inter, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText('Time (seconds)', padL + plotW / 2, height - padB + 10);
    }

    _classColor(classification) {
        if (!classification) return '#fb923c';
        const c = classification.toUpperCase();
        if (c.includes('AI') || c.includes('GENERATED') || c.includes('SPOOF')) return '#ef4444';
        if (c.includes('UNCERTAIN') || c.includes('UNCERTAIN')) return '#f97316';
        return '#22c55e';
    }
}

window.liveGraph = new LiveTrustGraph();
