import browser from "webextension-polyfill";

// Map every tabId → its parsed transcript
const transcriptsByTab = new Map();
const pendingTabs = new Map();

/* ================= vtt files =================== */

// intercept and parse .vtt subtitle files
browser.webRequest.onCompleted.addListener(
  async (details) => {
    if (!details.url.endsWith(".vtt") || details.tabId < 0) return;

    try {
      const response = await fetch(details.url);
      const text = await response.text();
      const transcript = text
        .split("\n")
        .filter(l =>
          !l.match(/^(\d{2}:)?\d{2}:\d{2}\.\d{3}/) &&
          l.trim() !== "" &&
          !l.includes("-->")
        )
        .join(" ");

      // limit to 200k chars
      transcriptsByTab.set(details.tabId, transcript.slice(0, 200000));
      console.log(`[vtt2gpt] Tab ${details.tabId} transcript stored:`, transcript.slice(0,300));
    } catch (err) {
      console.warn("[vtt2gpt] Parse error:", err);
    }
  },
  { urls: ["<all_urls>"] }
);

/* ================ Listener: communication with other js ===================== */

// handle popup UI "Send to ChatGPT" button click (menubar)
browser.runtime.onMessage.addListener((msg, sender, sendResponse) => {

  if (msg.action === "vtt2gpt_ready" && sender.tab?.id) {
    const tabId = sender.tab.id;
    const pending = pendingTabs.get(tabId);

    if (!pending) {
      // silently ignore any ready from a tab we didn't open
      return sendResponse({ ack: false });
    }

    browser.tabs.sendMessage(tabId, { action: "vtt2gpt_inject", prompt: pending.prompt });
    pending.resolve();
    pendingTabs.delete(tabId);
    sendResponse({ ack: true });
  }
  else if (msg.action === "sendToChatGPT") {
    browser.tabs.query({ active: true, currentWindow: true }, tabs => {
      const tabId = tabs[0]?.id;
      const transcript = transcriptsByTab.get(tabId);

      if (!transcript?.trim()) {
        console.warn(`[vtt2gpt] No transcript for tab ${tabId}`);
        sendResponse({ status: "empty" });
        return false;
      }

      openChatGptChunks(msg.instruction, transcript);
      sendResponse({ status: "ok" });
    });

  }
  else {
    return false;
  }

  return true;
});

/* ====================  Context menu setup ================== */

browser.runtime.onInstalled.addListener(() => {
  browser.contextMenus.create({
    id: "sendToGpt",
    title: "Send subtitles to ChatGPT",
    contexts: ["all"]
  });
});

browser.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== "sendToGpt") return;

  browser.storage.local.get("vtt2gpt_instruction", ({ vtt2gpt_instruction }) => {
    const userPrompt = vtt2gpt_instruction || "Summarize these subtitles:";
    const transcript = transcriptsByTab.get(tab.id);

    if (!transcript?.trim()) {
      console.warn(`[vtt2gpt] No transcript found for tab ${tab.id}`);
      return;
    }

    openChatGptChunks(userPrompt, transcript);
  });
});

/* ================= chatgpt ================================= */

function splitTranscript(transcript, maxLength = 20000) {
  const chunks = [];
  for (let i = 0; i < transcript.length; i += maxLength) {
    chunks.push(transcript.slice(i, i + maxLength));
  }
  return chunks;
}

// Open a new ChatGPT tab, wait until it finishes loading, then send it the prompt.
// Returns a Promise that resolves when the message has been sent.
function openChatGpt(prompt) {
  return new Promise(resolve => {
    browser.tabs.create({ url: "https://chat.openai.com/chat" }, tab => {
    pendingTabs.set(tab.id, { prompt, resolve });
    });
  });
}

async function openChatGptChunks(prompt, transcript) {
  const chunks = splitTranscript(transcript);
  for (let i = 0; i < chunks.length; i++) {
    const chunkPrompt = `${prompt}\n\n(Part ${i+1}/${chunks.length})\n${chunks[i]}`;
    await openChatGpt(chunkPrompt);
  }
}
