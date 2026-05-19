const providers = {
  openai: {
    name: "OpenAI",
    keyHint: "Usually starts with sk- or sk-proj-.",
    keyPattern: /^(sk-|sk-proj-).{20,}$/i,
    models: ["gpt-5.2", "gpt-5-mini", "gpt-5-nano", "gpt-4.1"],
    async send({ apiKey, model, messages, temperature, maxTokens, systemPrompt }) {
      const input = buildOpenAIInput(messages, systemPrompt);
      const data = await requestJson("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          input,
          temperature,
          max_output_tokens: maxTokens,
        }),
      });

      return {
        text: data.output_text || extractOpenAIText(data),
        tokens: data.usage?.total_tokens,
      };
    },
  },
  freemodel: {
    name: "FreeModel",
    keyHint: "Usually starts with fe_oa_. Use the API key from freemodel.dev dashboard.",
    keyPattern: /^fe_oa_[A-Za-z0-9]{24,}$/,
    models: ["gpt-5.4-mini", "gpt-5.5", "gpt-5.4", "gpt-5.3-codex"],
    async send(payload) {
      return sendOpenAICompatible("/api/proxy/chat", payload, "freemodel");
    },
  },
  openrouter: {
    name: "OpenRouter",
    keyHint: "Usually starts with sk-or-v1-. Use an OpenRouter API key.",
    keyPattern: /^sk-or-v1-[A-Za-z0-9_-]{20,}$/,
    modelsEndpoint: "/api/openrouter/models",
    models: [
      "google/gemini-3.1-flash-lite",
      "deepseek/deepseek-v4-flash:free",
      "minimax/minimax-m2.5:free",
      "anthropic/claude-sonnet-4.6",
      "openai/gpt-5.2",
    ],
    async send(payload) {
      return sendOpenAICompatible("/api/proxy/chat", payload, "openrouter");
    },
  },
  anthropic: {
    name: "Anthropic",
    keyHint: "Usually starts with sk-ant-.",
    keyPattern: /^sk-ant-.{20,}$/i,
    models: ["claude-sonnet-4-20250514", "claude-opus-4-1-20250805", "claude-3-5-haiku-20241022"],
    async send({ apiKey, model, messages, temperature, maxTokens, systemPrompt }) {
      const data = await requestJson("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens || 8192,
          temperature,
          system: systemPrompt || undefined,
          messages: messages.map(({ role, content }) => ({
            role: role === "assistant" ? "assistant" : "user",
            content,
          })),
        }),
      });

      return {
        text: data.content?.map((part) => part.text || "").join("").trim(),
        tokens: sumUsage(data.usage),
      };
    },
  },
  gemini: {
    name: "Google Gemini",
    keyHint: "Gemini keys are commonly long Google AI Studio keys.",
    keyPattern: /^AIza[0-9A-Za-z_-]{20,}$/i,
    models: ["gemini-3-flash-preview", "gemini-3-pro-preview", "gemini-2.0-flash-lite"],
    async send({ apiKey, model, messages, temperature, maxTokens, systemPrompt }) {
      const contents = messages.map(({ role, content }) => ({
        role: role === "assistant" ? "model" : "user",
        parts: [{ text: content }],
      }));

      const data = await requestJson(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: systemPrompt ? { parts: [{ text: systemPrompt }] } : undefined,
            contents,
            generationConfig: {
              temperature,
              maxOutputTokens: maxTokens,
            },
          }),
        },
      );

      return {
        text: data.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("").trim(),
        tokens: data.usageMetadata?.totalTokenCount,
      };
    },
  },
  groq: {
    name: "Groq",
    keyHint: "Usually starts with gsk_.",
    keyPattern: /^gsk_.{20,}$/i,
    models: ["llama-3.1-8b-instant", "llama-3.3-70b-versatile", "openai/gpt-oss-20b", "openai/gpt-oss-120b"],
    async send(payload) {
      return sendOpenAICompatible("https://api.groq.com/openai/v1/chat/completions", payload);
    },
  },
  mistral: {
    name: "Mistral",
    keyHint: "Paste a Mistral API key from La Plateforme.",
    keyPattern: /^[A-Za-z0-9_-]{20,}$/,
    models: ["mistral-medium-latest", "mistral-small-latest", "mistral-large-latest", "open-mistral-nemo"],
    async send(payload) {
      return sendOpenAICompatible("https://api.mistral.ai/v1/chat/completions", payload);
    },
  },
};

const state = {
  messages: [],
  totalTokens: 0,
  isSending: false,
  modelLoadId: 0,
};

const els = {
  provider: document.querySelector("#provider"),
  model: document.querySelector("#model"),
  modelPicker: document.querySelector("#modelPicker"),
  modelPickerButton: document.querySelector("#modelPickerButton"),
  modelPickerText: document.querySelector("#modelPickerText"),
  modelPickerMenu: document.querySelector("#modelPickerMenu"),
  modelSearch: document.querySelector("#modelSearch"),
  modelOptions: document.querySelector("#modelOptions"),
  customModel: document.querySelector("#customModel"),
  apiKey: document.querySelector("#apiKey"),
  toggleKey: document.querySelector("#toggleKey"),
  clearKey: document.querySelector("#clearKey"),
  keyStatus: document.querySelector("#keyStatus"),
  keyHint: document.querySelector("#keyHint"),
  temperature: document.querySelector("#temperature"),
  temperatureValue: document.querySelector("#temperatureValue"),
  maxTokens: document.querySelector("#maxTokens"),
  maxTokensValue: document.querySelector("#maxTokensValue"),
  systemPrompt: document.querySelector("#systemPrompt"),
  tokenCounter: document.querySelector("#tokenCounter"),
  activeTitle: document.querySelector("#activeTitle"),
  messages: document.querySelector("#messages"),
  errorBox: document.querySelector("#errorBox"),
  clearChat: document.querySelector("#clearChat"),
  chatForm: document.querySelector("#chatForm"),
  prompt: document.querySelector("#prompt"),
  sendButton: document.querySelector("#sendButton"),
};

init();

function init() {
  Object.entries(providers).forEach(([id, provider]) => {
    els.provider.add(new Option(provider.name, id));
  });

  els.provider.value = "openai";
  populateModels();
  restoreKey();
  syncRanges();
  validateKey();

  els.provider.addEventListener("change", () => {
    populateModels();
    els.customModel.value = "";
    restoreKey();
    validateKey();
    els.activeTitle.textContent = `${currentProvider().name} Playground`;
    hideError();
  });

  els.apiKey.addEventListener("input", () => {
    autoSelectProviderForKey(els.apiKey.value.trim());
    sessionStorage.setItem(keyStorageName(), els.apiKey.value);
    validateKey();
  });

  els.toggleKey.addEventListener("click", () => {
    els.apiKey.type = els.apiKey.type === "password" ? "text" : "password";
  });

  els.clearKey.addEventListener("click", () => {
    els.apiKey.value = "";
    sessionStorage.removeItem(keyStorageName());
    validateKey();
  });

  els.temperature.addEventListener("input", syncRanges);
  els.maxTokens.addEventListener("input", syncRanges);
  els.clearChat.addEventListener("click", clearConversation);
  els.chatForm.addEventListener("submit", handleSubmit);
  els.prompt.addEventListener("keydown", handlePromptShortcut);
  els.modelPickerButton.addEventListener("click", toggleModelPicker);
  els.modelSearch.addEventListener("input", renderModelOptions);
  els.messages.addEventListener("click", handleMessageClick);
  document.addEventListener("click", closeModelPickerOnOutsideClick);
}

async function populateModels() {
  const loadId = ++state.modelLoadId;
  const provider = currentProvider();
  els.model.replaceChildren();
  els.modelOptions.replaceChildren();
  setModelPickerText(`Loading ${provider.name} models...`);

  if (provider.modelsEndpoint) {
    // If running as a plain file:// (no server), skip the live fetch entirely.
    const isFileProtocol = window.location.protocol === "file:";
    if (isFileProtocol) {
      provider.models.forEach((model) => els.model.add(new Option(model, model)));
      syncModelPicker();
      return;
    }

    els.model.add(new Option(`Loading ${provider.name} models...`, ""));
    els.model.disabled = true;
    try {
      const response = await requestJson(provider.modelsEndpoint, { method: "GET" }, 20000);
      if (loadId !== state.modelLoadId) return;
      els.model.replaceChildren();
      response.data.forEach((model) => {
        const priceTag = model.isFree ? "Free" : "Paid";
        const contextTag = model.contextLength ? ` | ${Number(model.contextLength).toLocaleString()} ctx` : "";
        const option = new Option(`${model.id} | ${priceTag}${contextTag}`, model.id);
        option.dataset.price = priceTag;
        option.dataset.context = model.contextLength ? Number(model.contextLength).toLocaleString() : "";
        els.model.add(option);
      });
      syncModelPicker();
    } catch (error) {
      if (loadId !== state.modelLoadId) return;
      els.model.replaceChildren();
      provider.models.forEach((model) => els.model.add(new Option(model, model)));
      syncModelPicker();
      // Strip any HTML markup from error messages (e.g. Express/Node 404 pages).
      const cleanMessage = error.message?.replace(/<[^>]*>/g, "").trim() || "Unknown error";
      showError(`Could not load live ${provider.name} models. Showing fallback models. ${cleanMessage}`);
    } finally {
      if (loadId === state.modelLoadId) {
        els.model.disabled = false;
      }
    }
    return;
  }

  provider.models.forEach((model) => els.model.add(new Option(model, model)));
  syncModelPicker();
}

function restoreKey() {
  els.apiKey.value = sessionStorage.getItem(keyStorageName()) || "";
  els.keyHint.textContent = currentProvider().keyHint;
}

function keyStorageName() {
  return `aiplayground:${els.provider.value}:api-key`;
}

function currentProvider() {
  return providers[els.provider.value];
}

function autoSelectProviderForKey(key) {
  if (key.startsWith("fe_oa_") && els.provider.value !== "freemodel") {
    els.provider.value = "freemodel";
    populateModels();
    els.customModel.value = "";
    els.activeTitle.textContent = `${currentProvider().name} Playground`;
  } else if (key.startsWith("sk-or-v1-") && els.provider.value !== "openrouter") {
    els.provider.value = "openrouter";
    populateModels();
    els.customModel.value = "";
    els.activeTitle.textContent = `${currentProvider().name} Playground`;
  }
}

function validateKey() {
  const key = els.apiKey.value.trim();
  if (!key) {
    setKeyStatus("No key", "");
    els.keyHint.textContent = "Key stays in this browser session only.";
    return false;
  }

  const valid = currentProvider().keyPattern.test(key);
  setKeyStatus(valid ? "Looks valid" : "Check key", valid ? "valid" : "invalid");
  els.keyHint.textContent = valid ? currentProvider().keyHint : `Format check failed. ${currentProvider().keyHint}`;
  return valid;
}

function setKeyStatus(text, className) {
  els.keyStatus.textContent = text;
  els.keyStatus.className = `status-pill ${className}`.trim();
}

function syncRanges() {
  els.temperatureValue.textContent = Number(els.temperature.value).toFixed(1);
  const val = parseInt(els.maxTokens.value);
  if (val === 8192) {
    els.maxTokensValue.textContent = "Unlimited";
  } else {
    els.maxTokensValue.textContent = val;
  }
}

async function handleSubmit(event) {
  event.preventDefault();
  const content = els.prompt.value.trim();
  if (!content || state.isSending) return;

  const apiKey = els.apiKey.value.trim();
  if (!apiKey) {
    showError("Paste an API key first. It is stored only in this browser session.");
    els.apiKey.focus();
    return;
  }

  if (!validateKey()) {
    showError("The key format does not match this provider. You can still paste a fresh key and try again.");
    return;
  }

  hideError();
  addMessage("user", content);
  els.prompt.value = "";
  setSending(true);
  const pending = renderPendingMessage();
  const startedAt = performance.now();

  try {
    const provider = currentProvider();
    const result = await provider.send({
      apiKey,
      model: selectedModel(),
      messages: state.messages,
      temperature: Number(els.temperature.value),
      maxTokens: Number(els.maxTokens.value) === 8192 ? undefined : Number(els.maxTokens.value),
      systemPrompt: els.systemPrompt.value.trim(),
    });

    const elapsed = Math.round(performance.now() - startedAt);
    const text = result.text || emptyResponseMessage(result);
    addMessage("assistant", text, { elapsed, tokens: result.tokens });
    if (Number.isFinite(result.tokens)) {
      state.totalTokens += result.tokens;
      els.tokenCounter.textContent = `${state.totalTokens.toLocaleString()} tokens`;
    }
  } catch (error) {
    showError(normalizeProviderError(error));
  } finally {
    pending.remove();
    setSending(false);
    scrollToBottom();
  }
}

function handlePromptShortcut(event) {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    els.chatForm.requestSubmit();
  }
}

async function handleMessageClick(event) {
  const button = event.target.closest(".copy-code");
  if (!button) return;

  try {
    await navigator.clipboard.writeText(button.dataset.code || "");
    button.textContent = "Copied";
    window.setTimeout(() => {
      button.textContent = "Copy";
    }, 1400);
  } catch {
    button.textContent = "Failed";
    window.setTimeout(() => {
      button.textContent = "Copy";
    }, 1400);
  }
}

function selectedModel() {
  return els.customModel.value.trim() || els.model.value;
}

function syncModelPicker() {
  els.modelSearch.value = "";
  const selected = els.model.selectedOptions[0] || els.model.options[0];
  if (selected) {
    els.model.value = selected.value;
    setModelPickerText(selected.value || selected.textContent);
  } else {
    setModelPickerText("Select model");
  }
  renderModelOptions();
}

function setModelPickerText(text) {
  els.modelPickerText.textContent = text;
  els.modelPickerButton.title = text;
}

function toggleModelPicker() {
  const isOpen = !els.modelPickerMenu.hidden;
  if (isOpen) {
    closeModelPicker();
  } else {
    openModelPicker();
  }
}

function openModelPicker() {
  els.modelPicker.classList.add("open");
  els.modelPickerMenu.hidden = false;
  els.modelPickerButton.setAttribute("aria-expanded", "true");
  els.modelSearch.focus();
  renderModelOptions();
}

function closeModelPicker() {
  els.modelPicker.classList.remove("open");
  els.modelPickerMenu.hidden = true;
  els.modelPickerButton.setAttribute("aria-expanded", "false");
}

function closeModelPickerOnOutsideClick(event) {
  if (!els.modelPicker.contains(event.target)) {
    closeModelPicker();
  }
}

function renderModelOptions() {
  const query = els.modelSearch.value.trim().toLowerCase();
  const options = Array.from(els.model.options)
    .filter((option) => option.value && option.textContent.toLowerCase().includes(query))
    .slice(0, 160);

  els.modelOptions.replaceChildren();
  if (!options.length) {
    const empty = document.createElement("div");
    empty.className = "model-empty";
    empty.textContent = "No models found";
    els.modelOptions.append(empty);
    return;
  }

  options.forEach((option) => {
    const button = document.createElement("button");
    const isPaid = option.dataset.price === "Paid";
    button.type = "button";
    button.className = `model-option${option.value === els.model.value ? " active" : ""}`;
    button.setAttribute("role", "option");
    button.setAttribute("aria-selected", option.value === els.model.value ? "true" : "false");
    button.innerHTML = `
      <span class="model-option-name">${escapeHtml(option.value)}</span>
      <span class="model-option-meta">
        ${option.dataset.price ? `<span class="model-price${isPaid ? " paid" : ""}">${escapeHtml(option.dataset.price)}</span>` : ""}
        ${option.dataset.context ? `<span>${escapeHtml(option.dataset.context)} ctx</span>` : ""}
      </span>
    `;
    button.addEventListener("click", () => {
      els.model.value = option.value;
      setModelPickerText(option.value);
      closeModelPicker();
    });
    els.modelOptions.append(button);
  });
}

function addMessage(role, content, meta = {}) {
  state.messages.push({ role, content });
  removeEmptyState();

  const node = document.createElement("article");
  node.className = `message ${role}`;
  const providerName = role === "assistant" ? `${currentProvider().name} / ${selectedModel()}` : "You";
  const stats = [
    new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    meta.elapsed ? `${meta.elapsed} ms` : "",
    Number.isFinite(meta.tokens) ? `${meta.tokens} tokens` : "",
  ].filter(Boolean);

  node.innerHTML = `
    <div class="message-meta">
      <span class="message-role">${escapeHtml(providerName)}</span>
      <span class="message-time">${escapeHtml(stats.join(" | "))}</span>
    </div>
    <div class="message-content">${formatMessageContent(content)}</div>
  `;
  els.messages.append(node);
  scrollToBottom();
}

function formatMessageContent(content) {
  const parts = String(content).split(/```([\w+-]*)\n([\s\S]*?)```/g);
  return parts
    .map((part, index) => {
      if (index % 3 === 0) return formatPlainText(part);
      if (index % 3 === 1) return "";
      return renderCodeBlock(part, parts[index - 1] || "code");
    })
    .join("");
}

function formatPlainText(text) {
  const trimmed = text.trim();
  if (!trimmed) return "";
  return trimmed
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function renderCodeBlock(code, language) {
  const cleanCode = code.replace(/\n$/, "");
  const label = (language || "code").trim() || "code";
  return `
    <div class="code-card">
      <div class="code-card-header">
        <span class="code-lang">${escapeHtml(label.toUpperCase())}</span>
        <button class="copy-code" type="button" data-code="${escapeHtml(cleanCode)}">Copy</button>
      </div>
      <pre><code>${escapeHtml(cleanCode)}</code></pre>
    </div>
  `;
}

function renderPendingMessage() {
  removeEmptyState();
  const node = document.createElement("article");
  node.className = "message assistant pending";
  node.innerHTML = `
    <div class="message-meta">
      <span class="message-role">${escapeHtml(currentProvider().name)}</span>
      <span class="message-time">thinking</span>
    </div>
    <div class="typing" aria-label="Typing indicator">
      <span></span><span></span><span></span>
    </div>
  `;
  els.messages.append(node);
  scrollToBottom();
  return node;
}

function removeEmptyState() {
  els.messages.querySelector(".empty-state")?.remove();
}

function clearConversation() {
  state.messages = [];
  state.totalTokens = 0;
  els.tokenCounter.textContent = "0 tokens";
  els.messages.innerHTML = `
    <div class="empty-state">
      <div class="empty-node"></div>
      <h3>Fresh conversation ready.</h3>
      <p>Send a prompt to test the selected provider and model with your current parameters.</p>
    </div>
  `;
  hideError();
}

function setSending(isSending) {
  state.isSending = isSending;
  els.sendButton.disabled = isSending;
  const span = els.sendButton.querySelector("span");
  if (span) {
    span.textContent = isSending ? "Sending" : "Send";
  } else {
    els.sendButton.textContent = isSending ? "Sending" : "Send";
  }
}

async function sendOpenAICompatible(url, { apiKey, model, messages, temperature, maxTokens, systemPrompt }, proxyProvider) {
  const requestBody = {
    model,
    messages: buildChatMessages(messages, systemPrompt),
    temperature,
    max_tokens: maxTokens,
  };
  const data = await requestJson(url, {
    method: "POST",
    headers: {
      ...(proxyProvider ? {} : { Authorization: `Bearer ${apiKey}` }),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(
      proxyProvider
        ? {
            provider: proxyProvider,
            apiKey,
            body: requestBody,
          }
        : requestBody,
    ),
  });

  return {
    text: extractChatCompletionText(data),
    tokens: data.usage?.total_tokens,
    finishReason: data.choices?.[0]?.finish_reason,
  };
}

function extractChatCompletionText(data) {
  const choice = data.choices?.[0];
  const message = choice?.message || {};
  const candidates = [
    message.content,
    message.reasoning,
    message.refusal,
    choice?.text,
    data.output_text,
  ];

  for (const candidate of candidates) {
    const text = normalizeTextContent(candidate);
    if (text) return text;
  }

  return "";
}

function normalizeTextContent(content) {
  if (typeof content === "string") return content.trim();
  if (!Array.isArray(content)) return "";

  return content
    .map((part) => {
      if (typeof part === "string") return part;
      return part?.text || part?.content || part?.value || "";
    })
    .join("")
    .trim();
}

function emptyResponseMessage(result) {
  const reason = result.finishReason ? ` Finish reason: ${result.finishReason}.` : "";
  return `This model returned no visible text.${reason} Try another OpenRouter model such as google/gemini-3.1-flash-lite, lower max tokens, or send the prompt again.`;
}

function buildChatMessages(messages, systemPrompt) {
  return [
    { role: "system", content: buildSystemPrompt(systemPrompt) },
    ...messages.map(({ role, content }) => ({ role, content })),
  ];
}

function buildSystemPrompt(systemPrompt) {
  const codeInstruction = "When you include code, always wrap it in fenced Markdown code blocks with the language name, for example ```html.";
  return systemPrompt ? `${systemPrompt}\n\n${codeInstruction}` : codeInstruction;
}

function buildOpenAIInput(messages, systemPrompt) {
  return buildChatMessages(messages, systemPrompt).map(({ role, content }) => ({
    role,
    content: [{ type: role === "assistant" ? "output_text" : "input_text", text: content }],
  }));
}

async function requestJson(url, options = {}, timeoutMs = 45000) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    response = await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("Request timed out after 45 seconds. Try a faster model, lower max tokens, or send a shorter prompt.");
    }
    throw new Error(`Network request failed. Browser CORS restrictions or connection issues may be blocking this provider. ${error.message}`);
  } finally {
    window.clearTimeout(timeoutId);
  }

  const text = await response.text();
  const data = text ? parseJson(text) : {};

  if (!response.ok) {
    const message = data?.error?.message || data?.message || text || `${response.status} ${response.statusText}`;
    throw new Error(message);
  }

  return data;
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

function extractOpenAIText(data) {
  return data.output
    ?.flatMap((item) => item.content || [])
    .map((part) => part.text || "")
    .join("")
    .trim();
}

function sumUsage(usage = {}) {
  const total = Number(usage.input_tokens || 0) + Number(usage.output_tokens || 0);
  return total || undefined;
}

function showError(message) {
  els.errorBox.hidden = false;
  els.errorBox.textContent = message;
}

function hideError() {
  els.errorBox.hidden = true;
  els.errorBox.textContent = "";
}

function normalizeProviderError(error) {
  const message = error?.message || "Unknown provider error.";
  if (/cors|failed to fetch|network request failed/i.test(message)) {
    return "The browser could not complete the direct API call. Some providers block browser-origin requests with CORS. Try another provider, confirm HTTPS hosting, or add a tiny proxy in v2.";
  }

  if (/api key|auth|unauthorized|forbidden|401|403/i.test(message)) {
    return `Authentication failed: ${message}`;
  }

  if (/rate|quota|limit/i.test(message)) {
    return `Provider quota or rate limit hit: ${message}`;
  }

  return message;
}

function scrollToBottom() {
  els.messages.scrollTop = els.messages.scrollHeight;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
