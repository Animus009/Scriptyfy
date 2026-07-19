import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import { registerUser, loginUser, findUserByToken, deductCredits, addCredits, submitPaymentForReview, approvePayment, rejectPayment, getAllPaymentsForReview, decryptUserTransactions } from "./server-db";

// Load environment variables
dotenv.config();

const app = express();
const PORT = 3000;

// Set up JSON body parser with increased limit for larger base64 audio files
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Lazy-loaded Gemini client
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is missing. Please add your Gemini API key in the AI Studio Settings > Secrets panel.");
    }
    aiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// API endpoint to check configuration status
app.get("/api/config-status", (req, res) => {
  res.json({
    hasApiKey: !!process.env.GEMINI_API_KEY,
  });
});

// User Registration endpoint
app.post("/api/auth/register", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters long." });
    }
    const result = await registerUser(email, password);
    const decUser = decryptUserTransactions(result.user);
    return res.json({
      message: "Registration successful!",
      token: result.token,
      user: {
        email: decUser.email,
        credits: decUser.credits,
        transactions: decUser.transactions,
        createdAt: decUser.createdAt
      }
    });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

// User Login endpoint
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }
    const result = await loginUser(email, password);
    const decUser = decryptUserTransactions(result.user);
    return res.json({
      message: "Login successful!",
      token: result.token,
      user: {
        email: decUser.email,
        credits: decUser.credits,
        transactions: decUser.transactions,
        createdAt: decUser.createdAt
      }
    });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

// Fetch Current User Status endpoint
app.get("/api/auth/me", async (req, res) => {
  const user = await findUserByToken(req.headers.authorization);
  if (!user) {
    return res.status(401).json({ error: "Unauthorized. Please log in." });
  }
  const decUser = decryptUserTransactions(user);
  return res.json({
    user: {
      email: decUser.email,
      credits: decUser.credits,
      transactions: decUser.transactions,
      createdAt: decUser.createdAt
    }
  });
});

// Simulated Top-Up Payment endpoint (Credits) - Submits for manual review
app.post("/api/payment/topup", async (req, res) => {
  try {
    const user = await findUserByToken(req.headers.authorization);
    if (!user) {
      return res.status(401).json({ error: "Unauthorized. Please log in." });
    }
    
    const { referenceId, amountPaid, currency } = req.body;
    if (!referenceId) {
      return res.status(400).json({ error: "Payment reference / UTR ID is required." });
    }
    if (!/^\d+$/.test(referenceId.trim())) {
      return res.status(400).json({ error: "Invalid Transaction ID / UTR. Only numbers (digits 0-9) are allowed." });
    }

    // Submit for manual review instead of granting credits directly
    const updatedUser = await submitPaymentForReview(user.email, 2000, referenceId.trim(), currency, Number(amountPaid) || 0);
    const decUser = decryptUserTransactions(updatedUser);
    return res.json({
      message: "Payment transaction submitted successfully for manual review! Our admin team will verify it. Once verified, 2,000 credits will be credited to your account.",
      user: {
        email: decUser.email,
        credits: decUser.credits,
        transactions: decUser.transactions,
        createdAt: decUser.createdAt
      }
    });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

// Fetch all payments submitted for review across all users (Admin panel)
app.get("/api/payment/review-list", async (req, res) => {
  try {
    const user = await findUserByToken(req.headers.authorization);
    if (!user) {
      return res.status(401).json({ error: "Unauthorized. Please log in." });
    }
    if (user.email !== "garainpuja53@gmail.com") {
      return res.status(403).json({ error: "Access denied. You do not have administrator permissions." });
    }
    const list = await getAllPaymentsForReview();
    return res.json({ reviews: list });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

// Approve a pending payment
app.post("/api/payment/approve", async (req, res) => {
  try {
    const user = await findUserByToken(req.headers.authorization);
    if (!user) {
      return res.status(401).json({ error: "Unauthorized. Please log in." });
    }
    if (user.email !== "garainpuja53@gmail.com") {
      return res.status(403).json({ error: "Access denied. You do not have administrator permissions." });
    }
    const { userEmail, txId } = req.body;
    if (!userEmail || !txId) {
      return res.status(400).json({ error: "userEmail and txId are required." });
    }
    const updatedUser = await approvePayment(userEmail, txId);
    const list = await getAllPaymentsForReview();
    const decUser = decryptUserTransactions(updatedUser);
    return res.json({ 
      message: `Transaction ${txId} successfully approved! 2,000 credits have been added to ${userEmail}.`,
      reviews: list,
      user: user.email === userEmail.trim().toLowerCase() ? {
        email: decUser.email,
        credits: decUser.credits,
        transactions: decUser.transactions,
        createdAt: decUser.createdAt
      } : null
    });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

// Reject a pending payment
app.post("/api/payment/reject", async (req, res) => {
  try {
    const user = await findUserByToken(req.headers.authorization);
    if (!user) {
      return res.status(401).json({ error: "Unauthorized. Please log in." });
    }
    if (user.email !== "garainpuja53@gmail.com") {
      return res.status(403).json({ error: "Access denied. You do not have administrator permissions." });
    }
    const { userEmail, txId } = req.body;
    if (!userEmail || !txId) {
      return res.status(400).json({ error: "userEmail and txId are required." });
    }
    const updatedUser = await rejectPayment(userEmail, txId);
    const list = await getAllPaymentsForReview();
    const decUser = decryptUserTransactions(updatedUser);
    return res.json({ 
      message: `Transaction ${txId} has been rejected.`,
      reviews: list,
      user: user.email === userEmail.trim().toLowerCase() ? {
        email: decUser.email,
        credits: decUser.credits,
        transactions: decUser.transactions,
        createdAt: decUser.createdAt
      } : null
    });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

// API endpoint for audio transcription
app.post("/api/transcribe", async (req, res) => {
  try {
    const user = await findUserByToken(req.headers.authorization);
    if (!user) {
      return res.status(401).json({ error: "Unauthorized. Please log in to transcribe." });
    }

    if (user.credits < 100) {
      return res.status(402).json({ 
        error: `Insufficient credits. Transcription costs 100 credits, but you only have ${user.credits} remaining. Please scan the QR code to top up.` 
      });
    }

    const { audioData, mimeType, language, promptHint } = req.body;

    if (!audioData) {
      return res.status(400).json({ error: "Missing audioData (base64 string)" });
    }
    if (!mimeType) {
      return res.status(400).json({ error: "Missing mimeType (e.g., audio/mp3)" });
    }

    // Lazy load the Gemini client and catch missing API key errors
    let ai;
    try {
      ai = getGeminiClient();
    } catch (err: any) {
      return res.status(500).json({ error: err.message || "Gemini Client configuration error" });
    }

    // Construct the language and translation instructions
    const targetLangDesc = language && language !== "Auto-detect" 
      ? `Translate the spoken audio content and output it strictly in ${language}.` 
      : "Transcribe the spoken audio content verbatim in its native language.";

    const systemInstruction = `You are a professional audio transcriber and subtitling expert. 
Your task is to analyze the audio and transcribe it into high-quality, chronological, non-overlapping subtitle segments.

GUIDELINES:
1. ${targetLangDesc}
2. Split the speech into concise segments that are comfortable to read as subtitles on screen. Each segment should ideally be between 2 to 7 seconds long, and MUST NOT exceed 10 seconds.
3. Timestamps ('start' and 'end') must be in seconds as floating-point numbers (e.g., 1.52, 4.8) relative to the start of the audio.
4. The output must be completely accurate, matching the voice of the audio. Do not summarize unless the speech is repetitive or unintelligible.
5. Ensure that there are no overlapping timeframes and that they are sorted chronologically.
6. Optional context/spelling hint: ${promptHint || "None provided"}. If provided, use it to ensure spelling of names, brands, or jargon is correct.`;

    const contents = [
      {
        inlineData: {
          mimeType: mimeType,
          data: audioData,
        },
      },
      {
        text: "Generate subtitle segments for this audio following the specified JSON schema.",
      }
    ];

    console.log("Calling Gemini API for audio transcription...");
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: contents,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          description: "List of subtitle segments with precise timestamps and text",
          items: {
            type: Type.OBJECT,
            properties: {
              start: {
                type: Type.NUMBER,
                description: "Starting timestamp of the subtitle segment in seconds",
              },
              end: {
                type: Type.NUMBER,
                description: "Ending timestamp of the subtitle segment in seconds",
              },
              text: {
                type: Type.STRING,
                description: "The text spoken during this segment, in the target language.",
              },
            },
            required: ["start", "end", "text"],
          },
        },
      },
    });

    const responseText = response.text;
    if (!responseText) {
      throw new Error("Empty response from Gemini API.");
    }

    const segments = JSON.parse(responseText.trim());
    const updatedUser = await deductCredits(user.email, 100);
    const decUser = decryptUserTransactions(updatedUser);
    return res.json({
      segments,
      user: {
        email: decUser.email,
        credits: decUser.credits,
        transactions: decUser.transactions,
        createdAt: decUser.createdAt
      }
    });
  } catch (error: any) {
    console.error("Transcription error:", error);
    return res.status(500).json({ 
      error: error.message || "An error occurred during transcription." 
    });
  }
});

// Set up dev/prod routing
async function init() {
  if (process.env.NODE_ENV !== "production") {
    // In development mode, use Vite's middlewares
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // In production mode, serve built static assets
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT} (http://localhost:${PORT})`);
  });
}

init();
