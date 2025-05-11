/* global browser */

// waits for a prompt from background, injects it, clicks Send.

(() => {
  console.log("[vtt2gpt] content‑script loaded on", location.href);

  // retry until ack received
  function notifyReady(retries = 10) {
    browser.runtime.sendMessage({ action: "vtt2gpt_ready" }, response => {
      if (browser.runtime.lastError || !response?.ack) {
        if (retries > 0) setTimeout(() => notifyReady(retries - 1), 250);
      }
    });
  }

  // Tell the background page this document (after all redirects) is ready
  notifyReady();

  /* =============== helpers ====================== */
  function waitForSelectors(selectors, timeout = 60000) {
    return new Promise(resolve => {
      const deadline = Date.now() + timeout;
      const timer = setInterval(() => {
        for (const sel of selectors) {
          const el = document.querySelector(sel);
          if (el && el.offsetParent) {
            clearInterval(timer);
            return resolve(el);
          }
        }
        if (Date.now() > deadline) {
          clearInterval(timer);
          resolve(null);
        }
      }, 250);
    });
  }

  function simulateClick(el) {
    ["pointerdown","mousedown","pointerup","mouseup","click"].forEach(t =>
      el.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true }))
    );
  }

  /* ========== injector ======================= */
  async function doInject(prompt) {
    console.log("[vtt2gpt] injecting chunk len", prompt.length);

    const input = await waitForSelectors([
      'textarea[data-testid="prompt-textarea"]',
      'textarea#prompt-textarea',
      'div[role="textbox"][contenteditable="true"]',
      'div.ProseMirror'
    ]);
    if (!input) return console.warn("[vtt2gpt] no input found");

    // fill
    input.focus();
    if (input.tagName.toLowerCase() === "textarea") {
      input.value = prompt;
      input.dispatchEvent(new Event("input", { bubbles: true }));
    } else {
      input.textContent = prompt;
      input.dispatchEvent(new InputEvent("input", { bubbles: true }));
    }

    // wait for send button then click (or hit Enter)
    const btn = await waitForSelectors([
      'button[data-testid="send-button"]',
      'button[aria-label="Send message"]',
      'button[aria-label="Send"]',
      'div[role="button"][aria-label*="Send"]',
      'button#composer-submit-button',
      'button[type="submit"]'
    ], 10000);

    if (btn) {
      console.log("[vtt2gpt] clicking send button");
      simulateClick(btn);
    } else {
      console.log("[vtt2gpt] no button → pressing Enter");
      ["keydown","keypress","keyup"].forEach(t =>
        input.dispatchEvent(new KeyboardEvent(t, {
          key: "Enter", code: "Enter", keyCode: 13, which: 13,
          bubbles: true, cancelable: true
        }))
      );
    }
  }

  /* =============== receive prompt from background ================== */
  browser.runtime.onMessage.addListener((msg) => {
    if (msg.action === "vtt2gpt_inject" && typeof msg.prompt === "string") {
      doInject(msg.prompt);
    }
  });
})();
