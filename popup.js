import browser from "webextension-polyfill";

const textarea = document.getElementById("prompt");
const status   = document.getElementById("status");
const sendBtn  = document.getElementById("send");
const resetBtn = document.getElementById("reset");

const STORAGE_KEY = "vtt2gpt_instruction";
const DEFAULT_INSTRUCTION = "Summarize to english the following transcript:";

// Populate instruction on load
browser.storage.local.get(STORAGE_KEY, data => {
  textarea.value = data[STORAGE_KEY] || DEFAULT_INSTRUCTION;
});

// "Send" clicked → save & send message
sendBtn.addEventListener("click", () => {
  const instruction = textarea.value.trim();
  if (!instruction) {
    status.textContent = "Please enter an instruction.";
    return;
  }

  browser.storage.local.set({ [STORAGE_KEY]: instruction }, () => {
    browser.runtime.sendMessage({ action: "sendToChatGPT", instruction }, (response) => {
      if (response.status === "empty") {
        status.textContent = "No subtitles found on this page.";
      } else if (response.status === "ok") {
        status.textContent = "Message sent!";
        setTimeout(() => window.close(), 500);
      } else {
        status.textContent = "Oops, something went wrong.";
      }
    });
  });
});

// Reset to default
resetBtn.addEventListener("click", () => {
  textarea.value = DEFAULT_INSTRUCTION;
  browser.storage.local.set({ [STORAGE_KEY]: DEFAULT_INSTRUCTION }, () => {
    status.textContent = "Reset to default.";
    setTimeout(() => status.textContent = "", 2000);
  });
});
