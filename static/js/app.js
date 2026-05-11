'use strict';
// ─── STATE ────────────────────────────────────────────
let currentData = null;
let procTimer   = null;
let screenStack = ['scr-splash'];
let activeBottomTab = 'bn-home';
let obSlide = 0;
let darkMode = false;

// ─── SCREEN NAVIGATOR ─────────────────────────────────
function nav(to) {
    const current = screenStack[screenStack.length - 1];
    if (current === to) return;

    const fromEl = document.getElementById(current);
    const toEl   = document.getElementById(to);
    if (!toEl) return;

    // Push or replace
    screenStack.push(to);

    // Animate: from slides left, to slides in from right
    fromEl.classList.remove('active');
    fromEl.classList.add('prev');
    toEl.classList.add('active');

    // Show/hide bottom nav
    const hasNav = toEl.classList.contains('has-nav');
    document.getElementById('bottomNav').style.display = hasNav ? 'flex' : 'none';

    // Clean up prev after transition
    setTimeout(() => fromEl.classList.remove('prev'), 400);
}

function navBack() {
    if (screenStack.length < 2) return;
    const current = screenStack.pop();
    const prev    = screenStack[screenStack.length - 1];

    const fromEl = document.getElementById(current);
    const toEl   = document.getElementById(prev);
    if (!toEl) return;

    fromEl.classList.remove('active');
    toEl.classList.remove('prev');
    toEl.classList.add('active');

    const hasNav = toEl.classList.contains('has-nav');
    document.getElementById('bottomNav').style.display = hasNav ? 'flex' : 'none';
}

function tabNav(scrId, btnId) {
    // Always clear stack back to this tab screen
    screenStack = [scrId];
    const targets = ['scr-home','scr-search','scr-library','scr-profile'];
    targets.forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.classList.remove('active','prev'); }
    });
    document.getElementById(scrId).classList.add('active');
    document.getElementById('bottomNav').style.display = 'flex';

    // Active tab button
    document.querySelectorAll('.bn-item').forEach(b => b.classList.remove('active'));
    const btn = document.getElementById(btnId);
    if (btn) btn.classList.add('active');
    activeBottomTab = btnId;
}

// ─── ONBOARDING ───────────────────────────────────────
function goSlide(idx) {
    obSlide = idx;
    document.getElementById('onboardSlides').style.transform = `translateX(-${idx * 33.333}%)`;
    document.querySelectorAll('.od').forEach((d,i) => d.classList.toggle('active', i === idx));
    document.getElementById('obNextBtn').textContent = idx === 2 ? 'Get Started' : 'Next';
}

function obNext() {
    if (obSlide < 2) { goSlide(obSlide + 1); }
    else { nav('scr-home'); }
}

// ─── UTILS ────────────────────────────────────────────
function fmt(sec) {
    const h = Math.floor(sec/3600), m = Math.floor((sec%3600)/60), s = Math.floor(sec%60);
    return h > 0 ? `${h}:${p(m)}:${p(s)}` : `${p(m)}:${p(s)}`;
}
function p(n) { return String(n).padStart(2,'0'); }
function fmtDur(s) {
    const h=Math.floor(s/3600),m=Math.floor((s%3600)/60);
    return h ? `${h}h ${m}m` : m ? `${m}m` : `${Math.floor(s)}s`;
}
function esc(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function showToast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg; t.style.display = 'block';
    clearTimeout(t._t);
    t._t = setTimeout(() => t.style.display = 'none', 2200);
}
function showErr(msg) {
    const box = document.getElementById('homeError');
    document.getElementById('homeErrorMsg').textContent = msg;
    box.style.display = 'flex';
}
function hideErr() { document.getElementById('homeError').style.display = 'none'; }

// ─── PROCESSING ───────────────────────────────────────
const CI_STEPS = [
    {id:'ci0',pct:18},{id:'ci1',pct:36},{id:'ci2',pct:54},
    {id:'ci3',pct:72},{id:'ci4',pct:88},{id:'ci5',pct:100}
];

function setRing(pct) {
    const circ = 2*Math.PI*76;
    const bar = document.querySelector('.ring-bar');
    if (bar) bar.style.strokeDashoffset = circ*(1-pct/100);
    const el = document.getElementById('procPct');
    if (el) el.textContent = Math.round(pct)+'%';
}

function setCIState(el, state) {
    el.classList.remove('ci-done','ci-active');
    const ball = el.querySelector('.ci-ball');
    ball.classList.remove('ball-active','ball-done');
    if (state==='active') { el.classList.add('ci-active'); ball.classList.add('ball-active'); }
    if (state==='done')   { el.classList.add('ci-done');  ball.classList.add('ball-done'); }
}

function resetProc() {
    setRing(0);
    CI_STEPS.forEach(s => { const el=document.getElementById(s.id); if(el) setCIState(el,''); });
}

function startProc() {
    resetProc();
    let i=0;
    setCIState(document.getElementById(CI_STEPS[0].id),'active');
    setRing(CI_STEPS[0].pct);
    procTimer = setInterval(() => {
        setCIState(document.getElementById(CI_STEPS[i].id),'done');
        i++;
        if (i < CI_STEPS.length) {
            setCIState(document.getElementById(CI_STEPS[i].id),'active');
            setRing(CI_STEPS[i].pct);
        } else { clearInterval(procTimer); }
    }, 650);
}

function stopProc() {
    clearInterval(procTimer);
    CI_STEPS.forEach(s => { const el=document.getElementById(s.id); if(el) setCIState(el,'done'); });
    setRing(100);
}

// ─── FETCH TRANSCRIPT ─────────────────────────────────
async function fetchTranscript() {
    const url = document.getElementById('urlInput').value.trim();
    if (!url) { showErr('Please enter a YouTube URL or video ID.'); return; }
    hideErr();

    const btn = document.getElementById('analyzeBtn');
    btn.disabled = true;
    document.getElementById('aText').style.display = 'none';
    document.getElementById('aSpinner').style.display = 'block';

    nav('scr-processing');
    startProc();

    try {
        const res  = await fetch('/api/transcript', {
            method:'POST', headers:{'Content-Type':'application/json'},
            body: JSON.stringify({url})
        });
        const data = await res.json();

        if (!res.ok) {
            stopProc();
            navBack();
            showErr(data.error || 'Something went wrong.');
            return;
        }

        currentData = data;
        stopProc();
        await new Promise(r => setTimeout(r, 500));
        buildResults(data);
        nav('scr-results');

    } catch(e) {
        stopProc(); navBack();
        showErr('Network error. Please try again.');
    } finally {
        btn.disabled = false;
        document.getElementById('aText').style.display = 'inline';
        document.getElementById('aSpinner').style.display = 'none';
    }
}

// ─── BUILD RESULTS ────────────────────────────────────
function buildResults(data) {
    const segs = data.segments;
    const last = segs[segs.length-1];
    const dur  = last ? last.start + last.duration : 0;
    const lang = (data.language||'EN').replace('English (manual)','EN').replace('English (auto-generated)','EN Auto');

    // Stats
    document.getElementById('rWords').textContent   = data.word_count.toLocaleString();
    document.getElementById('rSegs').textContent    = data.segment_count;
    document.getElementById('rDur').textContent     = fmtDur(dur);
    document.getElementById('rLang').textContent    = lang;
    document.getElementById('resTitle').textContent = `Transcript · ${lang}`;

    // Full text
    document.getElementById('fullText').textContent = data.full_text;

    // Build sub-sections
    buildTimeline(segs);
    buildNotes(data, dur);
    buildCode(data);
    buildExport(data, dur);

    // Reset to first tab
    switchMTab(document.querySelector('.mtab[data-t="timeline"]'), 'rp-timeline');
}

// ─── TIMELINE ─────────────────────────────────────────
let selectedSeg = null; // { start, text }

function buildTimeline(segs) {
    const list = document.getElementById('tlList');
    list.innerHTML = '';
    selectedSeg = null;
    document.getElementById('jumpBar').style.display = 'none';

    segs.forEach((seg, i) => {
        const d = document.createElement('div');
        d.className = 'tl-card';
        d.dataset.start = seg.start;
        d.style.animationDelay = `${Math.min(i * 12, 280)}ms`;
        d.innerHTML = `
            <span class="tl-num">#${p(i+1)}</span>
            <span class="tl-time">${fmt(seg.start)}</span>
            <span class="tl-text">${esc(seg.text)}</span>
        `;
        d.addEventListener('click', () => selectSegment(d, seg.start, seg.text));
        list.appendChild(d);
    });
}

function selectSegment(card, startSec, text) {
    // Deselect previous
    document.querySelectorAll('.tl-card.selected').forEach(c => c.classList.remove('selected'));

    // Select this card
    card.classList.add('selected');
    selectedSeg = { start: startSec, text };

    // Smooth-scroll the card to the vertical center of the list
    const list = document.getElementById('tlList');
    const cardTop    = card.offsetTop;
    const cardHeight = card.offsetHeight;
    const listHeight = list.clientHeight;
    list.scrollTo({
        top: cardTop - (listHeight / 2) + (cardHeight / 2),
        behavior: 'smooth'
    });

    // Show jump bar with timestamp
    const bar = document.getElementById('jumpBar');
    document.getElementById('jbTime').textContent = fmt(startSec);
    bar.style.display = 'flex';
    // Re-trigger animation
    bar.style.animation = 'none';
    bar.offsetHeight; // force reflow
    bar.style.animation = '';
}

function jumpToVideo() {
    if (!currentData || selectedSeg === null) return;
    const videoId = currentData.video_id;
    const t = Math.floor(selectedSeg.start);
    const url = `https://www.youtube.com/watch?v=${videoId}&t=${t}s`;
    window.open(url, '_blank', 'noopener,noreferrer');
    showToast(`▶ Opening at ${fmt(selectedSeg.start)}`);
}

// ─── TIMELINE SEARCH ──────────────────────────────────
function filterTimeline(query) {
    const q = query.trim().toLowerCase();
    const cards  = document.querySelectorAll('#tlList .tl-card');
    const clearBtn   = document.getElementById('tlClearBtn');
    const badge      = document.getElementById('tlMatchBadge');
    const noResults  = document.getElementById('tlNoResults');
    const jumpBar    = document.getElementById('jumpBar');

    // Show/hide clear button
    clearBtn.style.display = q ? 'flex' : 'none';

    if (!q) {
        // Reset: show all, remove highlights
        cards.forEach(card => {
            card.classList.remove('tl-hidden');
            const textEl = card.querySelector('.tl-text');
            if (textEl) textEl.innerHTML = esc(textEl.dataset.raw || textEl.textContent);
        });
        badge.style.display = 'none';
        noResults.style.display = 'none';

        // Re-trigger badge pop animation on next show
        badge.style.animation = 'none';
        return;
    }

    // Deselect any selected card & hide jump bar while filtering
    document.querySelectorAll('.tl-card.selected').forEach(c => c.classList.remove('selected'));
    selectedSeg = null;
    jumpBar.style.display = 'none';

    let matchCount = 0;
    cards.forEach(card => {
        const textEl = card.querySelector('.tl-text');
        if (!textEl) return;

        // Store original text once
        if (!textEl.dataset.raw) textEl.dataset.raw = textEl.textContent;
        const raw = textEl.dataset.raw;
        const lc  = raw.toLowerCase();

        if (lc.includes(q)) {
            card.classList.remove('tl-hidden');
            textEl.innerHTML = highlightMatch(raw, q);
            matchCount++;
        } else {
            card.classList.add('tl-hidden');
            textEl.innerHTML = esc(raw);
        }
    });

    // Show count badge
    document.getElementById('tlMatchCount').textContent = matchCount;
    badge.style.animation = 'none';
    badge.offsetHeight;
    badge.style.animation = '';
    badge.style.display = matchCount > 0 ? 'flex' : 'none';

    // Show/hide no-results
    noResults.style.display = matchCount === 0 ? 'flex' : 'none';
    document.getElementById('tlNoResultsQuery').textContent = `"${query.trim()}"`;

    // Auto-scroll to first match
    if (matchCount > 0) {
        const firstMatch = document.querySelector('#tlList .tl-card:not(.tl-hidden)');
        if (firstMatch) {
            firstMatch.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }
}

function highlightMatch(raw, q) {
    // Escape HTML first, then wrap matches
    const escaped = esc(raw);
    const escapedQ = esc(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return escaped.replace(new RegExp(`(${escapedQ})`, 'gi'), '<mark>$1</mark>');
}

function clearTlSearch() {
    const input = document.getElementById('tlSearchInput');
    input.value = '';
    filterTimeline('');
    input.focus();
}

// ─── NOTES ────────────────────────────────────────────
function buildNotes(data, dur) {
    const segs = data.segments;
    const step = Math.max(1, Math.floor(segs.length/7));

    // Summary
    const words = data.full_text.split(' ');
    document.getElementById('noteSummary').textContent =
        words.slice(0,65).join(' ') + (words.length>65?' …':'');

    // What you'll build (last few segs)
    const tail = segs.slice(-5).map(s=>s.text).join(' ');
    document.getElementById('noteWYB').textContent = tail.slice(0,150) + (tail.length>150?' …':'');

    // Key concepts
    const kc = document.getElementById('noteKC');
    kc.innerHTML = '';
    pickPoints(segs, step, 6).forEach(pt => {
        const li = document.createElement('li');
        li.textContent = pt;
        kc.appendChild(li);
    });

    // All concepts
    const ac = document.getElementById('noteConcepts');
    ac.innerHTML = '';
    pickPoints(segs, Math.max(1,Math.floor(segs.length/10)), 10).forEach(pt => {
        const li = document.createElement('li');
        li.textContent = pt;
        ac.appendChild(li);
    });

    // Steps
    const sl = document.getElementById('noteSteps');
    sl.innerHTML = '';
    let n = 1;
    for (let i=0; i<segs.length && n<=8; i+=step) {
        const txt = segs[i].text.trim();
        if (txt.length < 10) continue;
        const d = document.createElement('div');
        d.className = 'step-item';
        d.innerHTML = `<div class="step-num">${n}</div><div class="step-text">${esc(txt.slice(0,100))}</div>`;
        sl.appendChild(d);
        n++;
    }
}

function pickPoints(segs, step, max) {
    const out = [];
    for (let i=0; i<segs.length && out.length<max; i+=step) {
        const t = segs[i].text.trim();
        if (t.length > 12) out.push(t.slice(0,90));
    }
    return out;
}

// ─── CODE ─────────────────────────────────────────────
function buildCode(data) {
    // Code block — show trimmed transcript as raw text
    const cb = document.getElementById('codeBlock');
    cb.textContent = data.full_text.slice(0, 800) + (data.full_text.length>800 ? '\n…' : '');

    // Commands — derive from video ID
    const id = data.video_id;
    const cmds = [
        `yt-dlp https://youtu.be/${id}`,
        `whisper audio.mp4 --language en`,
        `python summarize.py transcript.txt`,
        `python export.py --format pdf`,
    ];
    const cl = document.getElementById('cmdList');
    cl.innerHTML = '';
    cmds.forEach(cmd => {
        const d = document.createElement('div');
        d.className = 'cmd-item';
        d.innerHTML = `<span class="cmd-prompt">$</span><span class="cmd-text">${esc(cmd)}</span><button class="cmd-copy" onclick="navigator.clipboard.writeText('${esc(cmd)}');showToast('Copied!')">Copy</button>`;
        cl.appendChild(d);
    });

    // Tree
    document.getElementById('treeView').innerHTML = `<div class="folder">📁 project/</div>
<div style="padding-left:16px">
  <div class="folder">📁 src/</div>
  <div style="padding-left:16px">
    <div class="file">📄 transcript.txt</div>
    <div class="file">📄 summary.md</div>
    <div class="file">📄 timeline.json</div>
  </div>
  <div class="folder">📁 exports/</div>
  <div style="padding-left:16px">
    <div class="file">📄 notes.pdf</div>
    <div class="file">📄 steps.txt</div>
  </div>
  <div class="file">📄 README.md</div>
</div>`;
}

// ─── EXPORT ───────────────────────────────────────────
function buildExport(data, dur) {
    document.getElementById('expTitle').textContent = `Video Transcript · ${data.video_id}`;
    const preview = data.full_text.split(' ').slice(0,50).join(' ') + ' …';
    document.getElementById('expBody').textContent = preview;
}

// ─── TAB SWITCHING ────────────────────────────────────
function switchMTab(btn, panelId) {
    document.querySelectorAll('.mtab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.res-panel').forEach(p => p.classList.remove('active'));
    if (btn) btn.classList.add('active');
    const panel = document.getElementById(panelId);
    if (panel) panel.classList.add('active');
}

function switchSTab(btn, panelId) {
    const parent = btn.closest('.res-panel') || btn.closest('.sp');
    const sibBtns = btn.closest('.sub-tab-bar').querySelectorAll('.stab');
    sibBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    // Find sibling panels
    const grandparent = btn.closest('.res-panel');
    if (grandparent) {
        grandparent.querySelectorAll('.sp').forEach(p => p.classList.remove('active'));
    }
    const target = document.getElementById(panelId);
    if (target) target.classList.add('active');
}

function switchLibTab(btn, panelId) {
    document.querySelectorAll('.ltab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.lt-panel').forEach(p => p.classList.remove('active'));
    document.getElementById(panelId).classList.add('active');
}

// ─── COPY / DOWNLOAD ──────────────────────────────────
function copyText() {
    if (!currentData) { showToast('No transcript loaded'); return; }
    navigator.clipboard.writeText(currentData.full_text)
        .then(() => showToast('✓ Copied to clipboard'))
        .catch(() => showToast('Copy failed'));
}

function downloadText() {
    if (!currentData) { showToast('No transcript loaded'); return; }
    const blob = new Blob([currentData.full_text], {type:'text/plain'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `transcript-${currentData.video_id}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
    showToast('✓ Download started');
}

// ─── DARK MODE ────────────────────────────────────────
function toggleDarkMode() {
    darkMode = !darkMode;
    document.getElementById('darkToggle').classList.toggle('on', darkMode);
    // For now just a toggle animation; full dark mode is a future feature
    showToast(darkMode ? 'Dark mode on' : 'Dark mode off');
}

// ─── KEYBOARD ─────────────────────────────────────────
document.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
        const active = document.querySelector('.scr.active');
        if (active && active.id === 'scr-home') fetchTranscript();
    }
});
