# YouTube Transcripter

A web application that extracts and displays transcripts from YouTube videos.

## Overview

This app lets users paste any YouTube URL or video ID and instantly retrieve the full transcript, with support for:
- Manual and auto-generated captions
- Multiple languages (falls back to available languages)
- Full text view and timestamped segment view
- Copy to clipboard and download as .txt

## Tech Stack

- **Backend**: Python 3.11 + Flask
- **Transcript API**: youtube-transcript-api
- **Frontend**: Vanilla HTML/CSS/JS (dark theme)

## Project Structure

```
main.py              # Flask app with /api/transcript endpoint
templates/index.html # Main page
static/css/style.css # Styles
static/js/app.js     # Frontend logic
```

## Running

```
python main.py
```

The app runs on port 5000.

## User Preferences

- Dark-themed UI
- No external JS frameworks (vanilla JS only)
