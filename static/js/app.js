// ─── STATE ──────────────────────────────────
let currentData = null;
let procTimer = null;

// ─── UTILS ──────────────────────────────────
function fmt(sec) {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
    return `${pad(m)}:${pad(s)}`;
}
function pad(n) { return String(n).padStart(2, '0'); }

function fmtDur(s) {
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
    if (h) return `${h}h ${m}m`;
    if (m) return `${m}m`;
    return `${Math.floor(s)}s`;
}

function esc(str) {
    return String(str)
        .replace(/&/g,'&amp;').replace(/</g,'&lt;')
        .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function showToast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.style.display = 'block';
    clearTimeout(t._t);
    t._t = setTimeout(() => t.style.display = 'none', 2200);
}

// ─── NAV ────────────────────────────────────
function goToHome() {
    document.getElementById('splashScreen').style.animation = 'fadeIn 0.3s reverse both';
    setTimeout(() => {
        document.getElementById('splashScreen').style.display = 'none';
        document.getElementById('appShell').style.display = 'flex';
        document.getElementById('appShell').style.flexDirection = 'column';
        showScreen('homeScreen');
    }, 280);
}

function showScreen(id) {
    ['homeScreen','processingScreen','resultsScreen'].forEach(s => {
        document.getElementById(s).style.display = 'none';
    });
    document.getElementById(id).style.display = 'block';
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showHome() {
    showScreen('homeScreen');
    document.querySelectorAll('.bnav-item').forEach((b,i) => b.classList.toggle('active', i === 0));
}

function resetApp() {
    currentData = null;
    document.getElementById('urlInput').value = '';
    hideError();
    showHome();
}

// ─── ERRORS ─────────────────────────────────
function showError(msg) {
    const box = document.getElementById('errorBox');
    document.getElementById('errorMsg').textContent = msg;
    box.style.display = 'flex';
}
function hideError() {
    document.getElementById('errorBox').style.display = 'none';
}

// ─── PROCESSING ANIMATION ───────────────────
const STEPS = [
    { id: 'pci1', pct: 18 },
    { id: 'pci2', pct: 36 },
    { id: 'pci3', pct: 54 },
    { id: 'pci4', pct: 72 },
    { id: 'pci5', pct: 88 },
    { id: 'pci6', pct: 100 },
];

function setProgress(pct) {
    const circ = 2 * Math.PI * 68; // 427
    const bar = document.querySelector('.proc-progress');
    if (bar) bar.style.strokeDashoffset = circ * (1 - pct / 100);
    const pctEl = document.getElementById('procPct');
    if (pctEl) pctEl.textContent = Math.round(pct) + '%';
}

function setStepState(el, state) {
    el.classList.remove('active','done');
    const icon = el.querySelector('.pci-icon');
    icon.classList.remove('active-icon','done-icon');
    if (state === 'active') {
        el.classList.add('active');
        icon.classList.add('active-icon');
    } else if (state === 'done') {
        el.classList.add('done');
        icon.classList.add('done-icon');
    }
}

function resetProcessing() {
    setProgress(0);
    STEPS.forEach(s => {
        const el = document.getElementById(s.id);
        if (el) setStepState(el, 'pending');
    });
}

function startProcessingAnimation() {
    resetProcessing();
    let i = 0;
    setStepState(document.getElementById(STEPS[0].id), 'active');
    procTimer = setInterval(() => {
        if (i < STEPS.length) {
            setStepState(document.getElementById(STEPS[i].id), 'done');
            i++;
            if (i < STEPS.length) {
                setStepState(document.getElementById(STEPS[i].id), 'active');
                setProgress(STEPS[i].pct);
            }
        } else {
            clearInterval(procTimer);
        }
    }, 650);
}

function stopProcessingAnimation() {
    clearInterval(procTimer);
    STEPS.forEach(s => setStepState(document.getElementById(s.id), 'done'));
    setProgress(100);
}

// ─── FETCH ──────────────────────────────────
async function fetchTranscript() {
    const url = document.getElementById('urlInput').value.trim();
    if (!url) { showError('Please enter a YouTube URL or video ID.'); return; }
    hideError();

    // UI: loading
    const btn = document.getElementById('analyzeBtn');
    btn.disabled = true;
    document.getElementById('analyzeBtnText').style.display = 'none';
    document.getElementById('analyzeBtnSpinner').style.display = 'flex';

    showScreen('processingScreen');
    startProcessingAnimation();

    try {
        const res = await fetch('/api/transcript', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
        });
        const data = await res.json();

        if (!res.ok) {
            stopProcessingAnimation();
            showScreen('homeScreen');
            showError(data.error || 'Something went wrong.');
            return;
        }

        currentData = data;
        stopProcessingAnimation();
        await new Promise(r => setTimeout(r, 500));
        renderResults(data);

    } catch (e) {
        stopProcessingAnimation();
        showScreen('homeScreen');
        showError('Network error. Please try again.');
    } finally {
        btn.disabled = false;
        document.getElementById('analyzeBtnText').style.display = 'inline';
        document.getElementById('analyzeBtnSpinner').style.display = 'none';
    }
}

// ─── RENDER RESULTS ─────────────────────────
function renderResults(data) {
    const segs = data.segments;
    const lastSeg = segs[segs.length - 1];
    const totalSec = lastSeg ? lastSeg.start + lastSeg.duration : 0;

    // Header stats
    document.getElementById('resultVideoTitle').textContent =
        `Video · ${data.language || 'Transcript'}`;
    document.getElementById('statWords').textContent = data.word_count.toLocaleString();
    document.getElementById('statSegments').textContent = data.segment_count;
    document.getElementById('statDuration').textContent = fmtDur(totalSec);

    // Full text
    document.getElementById('fullText').textContent = data.full_text;

    // Timeline
    buildTimeline(segs);

    // Notes
    buildNotes(data, totalSec);

    // Switch to results
    switchMainTab('timeline');
    showScreen('resultsScreen');
}

// ─── TIMELINE ───────────────────────────────
function buildTimeline(segs) {
    const list = document.getElementById('timelineList');
    list.innerHTML = '';
    segs.forEach((seg, i) => {
        const card = document.createElement('div');
        card.className = 'tl-card';
        card.style.animationDelay = `${Math.min(i * 15, 300)}ms`;
        card.innerHTML = `
            <span class="tl-num">#${pad(i+1)}</span>
            <span class="tl-time">${fmt(seg.start)}</span>
            <span class="tl-text">${esc(seg.text)}</span>
        `;
        list.appendChild(card);
    });
}

// ─── NOTES ──────────────────────────────────
function buildNotes(data, totalSec) {
    const segs = data.segments;

    // Summary
    const summaryWords = data.full_text.split(' ');
    const summary = summaryWords.slice(0, 60).join(' ') + (summaryWords.length > 60 ? '...' : '');
    document.getElementById('notesSummary').textContent = summary;

    // What You'll Build
    const closing = segs.slice(-4).map(s => s.text).join(' ');
    document.getElementById('notesWhatBuild').textContent =
        closing.slice(0, 160) + (closing.length > 160 ? '...' : '');

    // Key Concepts (from spread of segments)
    const kc = document.getElementById('notesConceptsList');
    kc.innerHTML = '';
    const step = Math.max(1, Math.floor(segs.length / 6));
    for (let i = 0; i < segs.length && kc.children.length < 6; i += step) {
        const text = segs[i].text.trim();
        if (text.length > 12) {
            const li = document.createElement('li');
            li.textContent = text.slice(0, 80);
            kc.appendChild(li);
        }
    }

    // Concepts full list
    const cf = document.getElementById('conceptsFullList');
    cf.innerHTML = '';
    const step2 = Math.max(1, Math.floor(segs.length / 10));
    for (let i = 0; i < segs.length && cf.children.length < 10; i += step2) {
        const text = segs[i].text.trim();
        if (text.length > 8) {
            const li = document.createElement('li');
            li.textContent = `[${fmt(segs[i].start)}] ${text.slice(0, 90)}`;
            cf.appendChild(li);
        }
    }

    // Steps
    const sl = document.getElementById('stepsList');
    sl.innerHTML = '';
    const stepSeg = Math.max(1, Math.floor(segs.length / 8));
    let stepNum = 1;
    for (let i = 0; i < segs.length && stepNum <= 8; i += stepSeg) {
        const text = segs[i].text.trim();
        if (text.length > 12) {
            const div = document.createElement('div');
            div.className = 'step-item';
            div.innerHTML = `
                <div class="step-num">${stepNum}</div>
                <div class="step-text">${esc(text.slice(0, 100))}</div>
            `;
            sl.appendChild(div);
            stepNum++;
        }
    }
}

// ─── TABS ───────────────────────────────────
function switchMainTab(tab) {
    document.querySelectorAll('.main-tab').forEach(b =>
        b.classList.toggle('active', b.dataset.tab === tab));
    document.querySelectorAll('.panel').forEach(p =>
        p.classList.toggle('active', p.id === `panel-${tab}`));
}

function switchSubTab(stab) {
    document.querySelectorAll('.sub-tab').forEach(b =>
        b.classList.toggle('active', b.dataset.stab === stab));
    document.querySelectorAll('.stab-panel').forEach(p =>
        p.classList.toggle('active', p.id === `stab-${stab}`));
}

// ─── COPY / DOWNLOAD ────────────────────────
function copyText() {
    if (!currentData) return;
    navigator.clipboard.writeText(currentData.full_text)
        .then(() => showToast('✓ Copied to clipboard'))
        .catch(() => showToast('Copy failed'));
}

function downloadText() {
    if (!currentData) return;
    const blob = new Blob([currentData.full_text], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `transcript-${currentData.video_id}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
    showToast('✓ Download started');
}

// ─── KEYBOARD ───────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('urlInput').addEventListener('keydown', e => {
        if (e.key === 'Enter') fetchTranscript();
    });
});
