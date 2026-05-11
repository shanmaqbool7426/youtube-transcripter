let currentData = null;
let showingSegments = false;

function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function setLoading(loading) {
    const btn = document.getElementById('fetchBtn');
    const btnText = btn.querySelector('.btn-text');
    const btnSpinner = btn.querySelector('.btn-spinner');
    btn.disabled = loading;
    btnText.style.display = loading ? 'none' : 'inline';
    btnSpinner.style.display = loading ? 'inline-flex' : 'none';
}

function showError(msg) {
    const box = document.getElementById('errorBox');
    box.textContent = msg;
    box.style.display = 'block';
    document.getElementById('resultSection').style.display = 'none';
}

function hideError() {
    document.getElementById('errorBox').style.display = 'none';
}

function showToast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.style.display = 'block';
    setTimeout(() => { t.style.display = 'none'; }, 2200);
}

async function fetchTranscript() {
    const url = document.getElementById('urlInput').value.trim();
    if (!url) {
        showError('Please enter a YouTube URL or video ID.');
        return;
    }

    hideError();
    setLoading(true);

    try {
        const res = await fetch('/api/transcript', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
        });

        const data = await res.json();

        if (!res.ok) {
            showError(data.error || 'Something went wrong.');
            return;
        }

        currentData = data;
        renderResult(data);
    } catch (err) {
        showError('Network error. Please try again.');
    } finally {
        setLoading(false);
    }
}

function renderResult(data) {
    document.getElementById('metaLanguage').textContent = data.language;
    document.getElementById('metaWords').textContent = `${data.word_count.toLocaleString()} words`;
    document.getElementById('metaSegments').textContent = `${data.segment_count} segments`;

    document.getElementById('fullText').textContent = data.full_text;

    const list = document.getElementById('segmentsList');
    list.innerHTML = '';
    for (const seg of data.segments) {
        const item = document.createElement('div');
        item.className = 'segment-item';
        item.innerHTML = `
            <span class="segment-time">${formatTime(seg.start)}</span>
            <span class="segment-text">${escapeHtml(seg.text)}</span>
        `;
        list.appendChild(item);
    }

    showingSegments = false;
    document.getElementById('fullTextView').style.display = 'block';
    document.getElementById('segmentsView').style.display = 'none';
    document.getElementById('viewToggleBtn').textContent = 'Show Segments';

    document.getElementById('resultSection').style.display = 'flex';
    document.getElementById('resultSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function toggleView() {
    showingSegments = !showingSegments;
    document.getElementById('fullTextView').style.display = showingSegments ? 'none' : 'block';
    document.getElementById('segmentsView').style.display = showingSegments ? 'block' : 'none';
    document.getElementById('viewToggleBtn').textContent = showingSegments ? 'Show Full Text' : 'Show Segments';
}

function copyText() {
    if (!currentData) return;
    navigator.clipboard.writeText(currentData.full_text).then(() => {
        showToast('Copied to clipboard!');
    }).catch(() => {
        showToast('Copy failed. Please select and copy manually.');
    });
}

function downloadText() {
    if (!currentData) return;
    const blob = new Blob([currentData.full_text], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `transcript-${currentData.video_id}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
}

function escapeHtml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

document.getElementById('urlInput').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') fetchTranscript();
});
