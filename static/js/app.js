// ─── STATE ──────────────────────────────────────────────
let currentData = null;
let activeTab = 'timeline';
let procInterval = null;

// ─── UTILS ──────────────────────────────────────────────
function formatTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function formatDuration(totalSeconds) {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = Math.floor(totalSeconds % 60);
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
}

function escapeHtml(str) {
    return str
        .replace(/&/g,'&amp;')
        .replace(/</g,'&lt;')
        .replace(/>/g,'&gt;')
        .replace(/"/g,'&quot;');
}

function showToast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.style.display = 'block';
    clearTimeout(t._timer);
    t._timer = setTimeout(() => { t.style.display = 'none'; }, 2400);
}

function showError(msg) {
    const box = document.getElementById('errorBox');
    document.getElementById('errorMsg').textContent = msg;
    box.style.display = 'flex';
}

function hideError() {
    document.getElementById('errorBox').style.display = 'none';
}

// ─── SECTIONS ───────────────────────────────────────────
function showSection(id) {
    ['heroSection','processingSection','resultSection'].forEach(s => {
        const el = document.getElementById(s);
        if (el) el.style.display = 'none';
    });
    const target = document.getElementById(id);
    if (target) target.style.display = (id === 'heroSection') ? 'flex' : (id === 'resultSection' ? 'flex' : 'flex');
    // override per element
    if (id === 'heroSection') target.style.display = '';
    if (id === 'processingSection') target.style.display = 'flex';
    if (id === 'resultSection') target.style.display = 'flex';
}

// ─── PROCESSING ANIMATION ───────────────────────────────
const STEPS = [
    { id: 'step1', label: 'Fetching transcript data',          pct: 25 },
    { id: 'step2', label: 'Parsing segments & timestamps',     pct: 55 },
    { id: 'step3', label: 'Building smart timeline',           pct: 80 },
    { id: 'step4', label: 'Generating summary',                pct: 100 },
];

function setRingProgress(pct) {
    const bar = document.querySelector('.proc-bar');
    if (!bar) return;
    const circ = 2 * Math.PI * 50;
    bar.style.strokeDashoffset = circ - (circ * pct / 100);
}

function animateStep(index) {
    // mark previous as done
    if (index > 0) {
        const prev = document.getElementById(STEPS[index-1].id);
        prev.classList.remove('active');
        prev.classList.add('done');
        prev.querySelector('.step-check').style.display = 'block';
    }
    if (index >= STEPS.length) return;
    const step = STEPS[index];
    const el = document.getElementById(step.id);
    el.classList.add('active');
    document.getElementById('procStatus').textContent = step.label + '...';
    setRingProgress(step.pct);
}

function startProcessingAnimation() {
    // Reset steps
    STEPS.forEach(s => {
        const el = document.getElementById(s.id);
        el.classList.remove('active','done');
        el.querySelector('.step-check').style.display = 'none';
    });
    setRingProgress(0);
    document.getElementById('procStatus').textContent = 'Connecting to YouTube...';

    let i = 0;
    animateStep(i);
    procInterval = setInterval(() => {
        i++;
        if (i >= STEPS.length) { clearInterval(procInterval); return; }
        animateStep(i);
    }, 700);
}

function stopProcessingAnimation() {
    clearInterval(procInterval);
    // mark all done
    STEPS.forEach(s => {
        const el = document.getElementById(s.id);
        el.classList.remove('active');
        el.classList.add('done');
        el.querySelector('.step-check').style.display = 'block';
    });
    setRingProgress(100);
    document.getElementById('procStatus').textContent = 'Complete!';
}

// ─── FETCH ──────────────────────────────────────────────
async function fetchTranscript() {
    const url = document.getElementById('urlInput').value.trim();
    if (!url) {
        showError('Please enter a YouTube URL or video ID.');
        return;
    }
    hideError();

    // Switch to processing
    showSection('processingSection');
    startProcessingAnimation();

    // Disable button
    const btn = document.getElementById('analyzeBtn');
    btn.disabled = true;
    btn.querySelector('.analyze-btn-text').style.display = 'none';
    btn.querySelector('.analyze-btn-loading').style.display = 'flex';

    try {
        const res = await fetch('/api/transcript', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
        });
        const data = await res.json();

        if (!res.ok) {
            stopProcessingAnimation();
            showSection('heroSection');
            showError(data.error || 'Something went wrong.');
            return;
        }

        currentData = data;
        stopProcessingAnimation();

        // Brief pause so user sees 100% complete
        await new Promise(r => setTimeout(r, 600));
        renderResult(data);

    } catch (err) {
        stopProcessingAnimation();
        showSection('heroSection');
        showError('Network error. Please try again.');
    } finally {
        btn.disabled = false;
        btn.querySelector('.analyze-btn-text').style.display = 'flex';
        btn.querySelector('.analyze-btn-loading').style.display = 'none';
    }
}

// ─── RENDER RESULT ───────────────────────────────────────
function renderResult(data) {
    // Stats
    document.getElementById('statWords').textContent = data.word_count.toLocaleString();
    document.getElementById('statSegments').textContent = data.segment_count.toLocaleString();

    const lastSeg = data.segments[data.segments.length - 1];
    const totalSec = lastSeg ? lastSeg.start + lastSeg.duration : 0;
    document.getElementById('statDuration').textContent = formatDuration(totalSec);

    const langShort = (data.language || 'Unknown').replace('English (manual)', 'EN').replace('English (auto-generated)', 'EN Auto');
    document.getElementById('statLang').textContent = langShort;

    // Full text
    document.getElementById('fullText').textContent = data.full_text;

    // Timeline
    renderTimeline(data.segments);

    // Notes
    renderNotes(data);

    // Switch tab to timeline
    switchTab('timeline');
    showSection('resultSection');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ─── TIMELINE ────────────────────────────────────────────
function renderTimeline(segments) {
    const list = document.getElementById('timelineList');
    list.innerHTML = '';
    segments.forEach((seg, i) => {
        const card = document.createElement('div');
        card.className = 'timeline-card';
        card.style.animationDelay = `${Math.min(i * 18, 400)}ms`;
        card.innerHTML = `
            <span class="tl-num">#${String(i+1).padStart(2,'0')}</span>
            <span class="tl-time">${formatTime(seg.start)}</span>
            <span class="tl-text">${escapeHtml(seg.text)}</span>
        `;
        list.appendChild(card);
    });
}

// ─── NOTES ───────────────────────────────────────────────
function renderNotes(data) {
    const grid = document.getElementById('notesGrid');
    grid.innerHTML = '';

    // Build key sentences (every Nth segment as "key points")
    const segs = data.segments;
    const step = Math.max(1, Math.floor(segs.length / 8));
    const keyPoints = [];
    for (let i = 0; i < segs.length; i += step) {
        if (keyPoints.length >= 8) break;
        const text = segs[i].text.trim();
        if (text.length > 15) {
            keyPoints.push({ time: formatTime(segs[i].start), text });
        }
    }

    // Overview card
    const wordCount = data.word_count;
    const lastSeg = segs[segs.length - 1];
    const totalSec = lastSeg ? lastSeg.start + lastSeg.duration : 0;
    grid.appendChild(makeNoteCard({
        icon: '📋', iconBg: 'rgba(255,0,0,0.1)', iconBorder: 'rgba(255,0,0,0.2)',
        title: 'Overview',
        lines: [
            `${wordCount.toLocaleString()} words across ${data.segment_count} segments`,
            `Estimated read time: ~${Math.ceil(wordCount / 200)} min`,
            `Video duration: ${formatDuration(totalSec)}`,
            `Language: ${data.language || 'Unknown'}`,
        ]
    }));

    // Key moments card
    if (keyPoints.length > 0) {
        grid.appendChild(makeNoteCard({
            icon: '⚡', iconBg: 'rgba(59,130,246,0.1)', iconBorder: 'rgba(59,130,246,0.2)',
            title: 'Key Moments',
            lines: keyPoints.map(k => `[${k.time}] ${k.text}`)
        }));
    }

    // Opening & closing
    if (segs.length >= 4) {
        const openLines = segs.slice(0,3).map(s => s.text.trim()).filter(t => t.length > 5);
        const closeLines = segs.slice(-3).map(s => s.text.trim()).filter(t => t.length > 5);
        if (openLines.length) {
            grid.appendChild(makeNoteCard({
                icon: '🚀', iconBg: 'rgba(34,197,94,0.1)', iconBorder: 'rgba(34,197,94,0.2)',
                title: 'Opening',
                lines: openLines
            }));
        }
        if (closeLines.length) {
            grid.appendChild(makeNoteCard({
                icon: '🏁', iconBg: 'rgba(168,85,247,0.1)', iconBorder: 'rgba(168,85,247,0.2)',
                title: 'Closing',
                lines: closeLines
            }));
        }
    }

    // Full summary
    const summary = data.full_text.split(' ').slice(0, 80).join(' ') + (data.word_count > 80 ? '…' : '');
    const summaryCard = document.createElement('div');
    summaryCard.className = 'note-card';
    summaryCard.innerHTML = `
        <div class="note-card-header">
            <div class="note-icon" style="background:rgba(255,165,0,0.1);border:1px solid rgba(255,165,0,0.2);">✍️</div>
            <span class="note-title">Auto Summary</span>
        </div>
        <p class="note-body">${escapeHtml(summary)}</p>
    `;
    grid.appendChild(summaryCard);
}

function makeNoteCard({ icon, iconBg, iconBorder, title, lines }) {
    const card = document.createElement('div');
    card.className = 'note-card';
    const bulletsHtml = lines.map(l =>
        `<div class="note-bullet"><div class="note-bullet-dot"></div><span>${escapeHtml(l)}</span></div>`
    ).join('');
    card.innerHTML = `
        <div class="note-card-header">
            <div class="note-icon" style="background:${iconBg};border:1px solid ${iconBorder};">${icon}</div>
            <span class="note-title">${escapeHtml(title)}</span>
        </div>
        <div>${bulletsHtml}</div>
    `;
    return card;
}

// ─── TABS ────────────────────────────────────────────────
function switchTab(tab) {
    activeTab = tab;
    document.querySelectorAll('.tab-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.tab === tab);
    });
    document.querySelectorAll('.tab-panel').forEach(p => {
        p.classList.toggle('active', p.id === `tab-${tab}`);
    });
}

// ─── COPY / DOWNLOAD ─────────────────────────────────────
function copyText() {
    if (!currentData) return;
    navigator.clipboard.writeText(currentData.full_text)
        .then(() => showToast('✓ Copied to clipboard'))
        .catch(() => showToast('Copy failed — please select manually'));
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

// ─── RESET ───────────────────────────────────────────────
function resetApp() {
    currentData = null;
    document.getElementById('urlInput').value = '';
    hideError();
    showSection('heroSection');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ─── KEYBOARD ────────────────────────────────────────────
document.getElementById('urlInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') fetchTranscript();
});
