require("dotenv").config();
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const Razorpay = require("razorpay");

const root = __dirname;
const port = Number(process.env.PORT || 4174);

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
};

const upstreams = {
  freemodel: "https://api.freemodel.dev/v1/chat/completions",
  openrouter: "https://openrouter.ai/api/v1/chat/completions",
};
let openRouterModelCache = null;
let openRouterModelCacheTime = 0;
const openRouterPriorityModels = [
  "google/gemini-3.1-flash-lite",
  "deepseek/deepseek-v4-flash:free",
  "minimax/minimax-m2.5:free",
  "anthropic/claude-sonnet-4.6",
  "openai/gpt-5.2",
];

const PLANS = {
  free:  { amount: 0,      name: "Free",  currency: "INR" },
  pro:   { amount: 49900,  name: "Pro",   currency: "INR" }, // ₹499/mo in paise
  max:   { amount: 99900,  name: "Max",   currency: "INR" }, // ₹999/mo in paise
};

const server = http.createServer(async (req, res) => {
  try {
    // CORS preflight
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      });
      res.end();
      return;
    }

    if (req.method === "POST" && req.url === "/api/proxy/chat") {
      await handleChatProxy(req, res);
      return;
    }

    if (req.method === "GET" && req.url === "/api/openrouter/models") {
      await handleOpenRouterModels(res);
      return;
    }

    if (req.method === "POST" && req.url === "/api/create-order") {
      await handleCreateOrder(req, res);
      return;
    }

    if (req.method === "POST" && req.url === "/api/verify-payment") {
      await handleVerifyPayment(req, res);
      return;
    }

    if (req.method === "GET" && req.url === "/api/config") {
      sendJson(res, 200, {
        supabaseUrl: process.env.SUPABASE_URL,
        supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
        razorpayKeyId: process.env.RAZORPAY_KEY_ID,
      });
      return;
    }

    serveStatic(req, res);
  } catch (error) {
    console.error("Server error:", error);
    sendJson(res, 500, { error: error.message || "Server error" });
  }
});

server.listen(port, () => {
  console.log(`AIPlayground running at http://127.0.0.1:${port}`);
});

// ── Razorpay: Create Order ────────────────────────────────────────────────────
async function handleCreateOrder(req, res) {
  const body = await readJson(req);
  const { plan } = body;

  const planConfig = PLANS[plan];
  if (!planConfig) {
    sendJson(res, 400, { error: `Invalid plan. Choose: ${Object.keys(PLANS).join(", ")}` });
    return;
  }

  if (planConfig.amount === 0) {
    sendJson(res, 200, { free: true, plan: "free" });
    return;
  }

  if (planConfig.amount < 100) {
    sendJson(res, 400, { error: "Amount must be at least ₹1 (100 paise)." });
    return;
  }

  try {
    const order = await razorpay.orders.create({
      amount: planConfig.amount,
      currency: planConfig.currency,
      receipt: `rcpt_${plan}_${Date.now()}`,
      notes: { plan },
    });

    sendJson(res, 200, {
      order_id: order.id,

      amount: order.amount,
      currency: order.currency,
      plan,
      plan_name: planConfig.name,
    });
  } catch (error) {
    console.error("Razorpay create-order error:", JSON.stringify(error));
    const rzpDesc = error?.error?.description || error?.message || "Failed to create Razorpay order.";
    const statusCode = error?.statusCode || 500;
    const isAuth = statusCode === 401;

    if (isAuth) {
      // Return a mock order so the UI can be tested end-to-end
      // while the user fixes their Razorpay API keys
      console.warn("⚠️  Using MOCK order — Razorpay keys are invalid. Fix them in .env");
      sendJson(res, 200, {
        order_id: `mock_order_${Date.now()}`,
        amount: planConfig.amount,
        currency: planConfig.currency,
        plan,
        plan_name: planConfig.name,
        mock: true,
      });
    } else {
      sendJson(res, 500, { error: rzpDesc, statusCode });
    }
  }
}

// ── Razorpay: Verify Payment ──────────────────────────────────────────────────
async function handleVerifyPayment(req, res) {
  const body = await readJson(req);
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    sendJson(res, 400, { error: "Missing required fields: razorpay_order_id, razorpay_payment_id, razorpay_signature" });
    return;
  }

  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex");

  if (expectedSignature !== razorpay_signature) {
    sendJson(res, 400, { error: "Payment signature verification failed. Do not mark as paid." });
    return;
  }

  sendJson(res, 200, {
    success: true,
    payment_id: razorpay_payment_id,
    order_id: razorpay_order_id,
    message: "Payment verified successfully.",
  });
}

// ── Chat Proxy ────────────────────────────────────────────────────────────────
async function handleChatProxy(req, res) {
  const payload = await readJson(req);
  const provider = payload.provider;
  const apiKey = payload.apiKey;
  const body = payload.body;
  const upstream = upstreams[provider];

  if (!upstream) {
    sendJson(res, 400, { error: "Unsupported proxy provider." });
    return;
  }

  if (!apiKey || typeof apiKey !== "string") {
    sendJson(res, 400, { error: "Missing API key." });
    return;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45000);
  let upstreamResponse;

  try {
    upstreamResponse = await fetch(upstream, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://127.0.0.1:4174",
        "X-OpenRouter-Title": "AIPlayground",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (error) {
    if (error.name === "AbortError") {
      sendJson(res, 504, { error: `${providerName(provider)} request timed out after 45 seconds.` });
      return;
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  const text = await upstreamResponse.text();
  res.writeHead(upstreamResponse.status, {
    "Content-Type": upstreamResponse.headers.get("content-type") || "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(text);
}

function providerName(provider) {
  return provider === "openrouter" ? "OpenRouter" : "FreeModel";
}

// ── OpenRouter Models ─────────────────────────────────────────────────────────
async function handleOpenRouterModels(res) {
  const now = Date.now();
  if (openRouterModelCache && now - openRouterModelCacheTime < 5 * 60 * 1000) {
    sendJson(res, 200, { data: openRouterModelCache });
    return;
  }

  const response = await fetch("https://openrouter.ai/api/v1/models", {
    headers: {
      "HTTP-Referer": "http://127.0.0.1:4174",
      "X-OpenRouter-Title": "AIPlayground",
    },
  });
  const body = await response.json();

  if (!response.ok) {
    sendJson(res, response.status, { error: body.error?.message || body.error || "Could not load OpenRouter models." });
    return;
  }

  openRouterModelCache = body.data
    .map((model) => {
      const promptPrice = Number(model.pricing?.prompt || 0);
      const completionPrice = Number(model.pricing?.completion || 0);
      const isFree = model.id.endsWith(":free") || (promptPrice === 0 && completionPrice === 0);
      return {
        id: model.id,
        name: model.name || model.id,
        contextLength: model.context_length || null,
        isFree,
      };
    })
    .sort((a, b) => {
      const priorityA = openRouterPriorityModels.indexOf(a.id);
      const priorityB = openRouterPriorityModels.indexOf(b.id);
      if (priorityA !== -1 || priorityB !== -1) {
        if (priorityA === -1) return 1;
        if (priorityB === -1) return -1;
        return priorityA - priorityB;
      }
      if (a.isFree !== b.isFree) return a.isFree ? -1 : 1;
      return a.id.localeCompare(b.id);
    });
  openRouterModelCacheTime = now;

  sendJson(res, 200, { data: openRouterModelCache });
}

// ── Static File Server ────────────────────────────────────────────────────────
function serveStatic(req, res) {
  const requestUrl = new URL(req.url, `http://${req.headers.host}`);
  const cleanPath = requestUrl.pathname === "/" ? "/home.html" : requestUrl.pathname;
  const filePath = path.normalize(path.join(root, cleanPath));

  if (!filePath.startsWith(root)) {
    sendJson(res, 403, { error: "Forbidden" });
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      // fallback to home.html for SPA-style routing
      fs.readFile(path.join(root, "home.html"), (err2, fallback) => {
        if (err2) {
          sendJson(res, 404, { error: "Not found" });
          return;
        }
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(fallback);
      });
      return;
    }

    const ext = path.extname(filePath);
    res.writeHead(200, { "Content-Type": mimeTypes[ext] || "application/octet-stream" });
    res.end(data);
  });
}

// ── Utilities ─────────────────────────────────────────────────────────────────
function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 2_000_000) {
        req.destroy();
        reject(new Error("Request body too large."));
      }
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch {
        reject(new Error("Invalid JSON body."));
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(JSON.stringify(body));
}
