
# vtt2gpt – Send Subtitles to ChatGPT

**vtt2gpt** is a simple browser extension that captures `.vtt` subtitle files from any tab, extracts the spoken text, and sends it to [ChatGPT](https://chat.openai.com) with a custom instruction prompt.

---

## 📦 Installation

### Firefox
1. Open `about:debugging`
2. Click "Load Temporary Add-on"
3. Select `manifest.json` in this folder

### Chrome
Not tested

---

## 📋 Usage

- Visit a page with `.vtt` subtitles (Won't work on YouTube as they don't use vtt pre-filled)
- Wait for subtitles to load (they’re captured automatically)
- Right-click anywhere on the page → click **"Send subtitles to ChatGPT"**
- ChatGPT opens with a pre-filled prompt like:
  > Summarize to English these subtitles: ...
- You can change the instruction using the menubar.

---

## 📜 License

MIT License — feel free to modify, fork, and share.

