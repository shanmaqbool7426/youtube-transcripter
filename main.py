from flask import Flask, render_template, request, jsonify
from youtube_transcript_api import YouTubeTranscriptApi
import re

app = Flask(__name__)

ytt_api = YouTubeTranscriptApi()


def extract_video_id(url):
    patterns = [
        r'(?:v=|/v/|youtu\.be/|/embed/|/shorts/)([a-zA-Z0-9_-]{11})',
    ]
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    if re.match(r'^[a-zA-Z0-9_-]{11}$', url.strip()):
        return url.strip()
    return None


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/api/transcript', methods=['POST'])
def get_transcript():
    data = request.get_json()
    url = data.get('url', '').strip()

    if not url:
        return jsonify({'error': 'Please provide a YouTube URL or video ID.'}), 400

    video_id = extract_video_id(url)
    if not video_id:
        return jsonify({'error': 'Could not extract a valid video ID from the URL.'}), 400

    try:
        transcript_list = ytt_api.list(video_id)

        transcript = None
        language_used = None

        try:
            transcript = transcript_list.find_manually_created_transcript(['en'])
            language_used = 'English (manual)'
        except Exception:
            pass

        if not transcript:
            try:
                transcript = transcript_list.find_generated_transcript(['en'])
                language_used = 'English (auto-generated)'
            except Exception:
                pass

        if not transcript:
            for t in transcript_list:
                transcript = t
                language_used = t.language
                break

        if not transcript:
            return jsonify({'error': 'No transcripts available for this video.'}), 404

        fetched = transcript.fetch()
        snippets = list(fetched)

        full_text = ' '.join([s.text for s in snippets])
        segments = [
            {
                'start': round(s.start, 2),
                'duration': round(s.duration, 2),
                'text': s.text
            }
            for s in snippets
        ]

        return jsonify({
            'video_id': video_id,
            'language': language_used,
            'full_text': full_text,
            'segments': segments,
            'word_count': len(full_text.split()),
            'segment_count': len(segments)
        })

    except Exception as e:
        msg = str(e)
        if 'disabled' in msg.lower():
            return jsonify({'error': 'Transcripts are disabled for this video.'}), 403
        if 'Could not find' in msg or 'No transcripts' in msg:
            return jsonify({'error': 'No transcript found for this video.'}), 404
        return jsonify({'error': f'An error occurred: {msg}'}), 500


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
