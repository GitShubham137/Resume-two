import express from "express";
import multer from "multer";
import axios from "axios";
import { createRequire } from "module";
import callGemini from "../services/gemini.service.js";

const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");

const upload = multer({ storage: multer.memoryStorage() });


const router = express.Router();

//function to get response fro gemini
router.post("/res", async (req, res) => {
  try {
    const { prompt } = req.body;
    const geminiText = await callGemini(prompt);

    try {
      // Try to parse it in case Gemini actually returned JSON
      // We also clean up backticks just in case
      const cleanJson = geminiText.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(cleanJson);
      res.json(parsed);
    } catch (parseErr) {
      // If it's not JSON (like "Hello there"), just send it as a message
      res.json({ message: geminiText });
    }
  } catch (err) {
    console.error("Route Error:", err.message);
    res.status(500).json({ error: "Gemini request failed" });
  }
});

router.get("/models", async (req, res) => {
  try {
    const response = await axios.get(
      "https://generativelanguage.googleapis.com/v1beta/models",
      {
        params: { key: process.env.GEMINI_API_KEY }
      }
    );

    console.log("--- Available Models ---");
    response.data.models.forEach(model => {
      console.log(`Name: ${model.name} | Display: ${model.displayName}`);
      // return res.json(response.data.models);
    });
  } catch (error) {
    console.error("Error listing models:", error.response?.data || error.message);
  }
})

router.post("/extract-resume", upload.single("resume"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Resume PDF required" });
    }

    const data = await pdfParse(req.file.buffer);

    console.log(data.text);

    res.json({
      success: true,
      text: data.text
    });
  } catch (err) {
    console.error("Resume extraction error:", err);
    res.status(500).json({ error: "PDF parsing failed" });
  }
});

const extractTextFromBuffer = async (buffer) => {
  const data = await pdfParse(buffer);
  return data.text;
};


// Analyze resume
// router.post("/analyze-resume", upload.single("resume"), async (req, res) => {
//   try {
//     // console.log(11,"✅✅");
//     const resumeText = await extractTextFromBuffer(req.file.buffer);

//     const prompt = `
// You are an experienced technical recruiter and interviewer.

// Resume Text:
// """
// ${resumeText}
// """

// TASK:
// 1. Give clear, constructive feedback on this resume (strengths + improvements).
// 2. Generate 4 to 5 technical or role-based interview questions suited to the candidate's experience.

// IMPORTANT:
// - Respond ONLY in valid JSON
// - Do NOT include markdown or backticks
// - Follow this exact format:

// {
//   "feedback": "string",
//   "questions": ["q1", "q2", "q3", "q4", "q5"]
// }
// `;

//     const geminiText = await callGemini(prompt);

//     try {
//       const cleanJson = geminiText.replace(/```json|```/g, "").trim();
//       const parsed = JSON.parse(cleanJson);

//       return res.json(parsed);
//     } catch (parseErr) {
//       console.error("JSON parse error:", parseErr.message);

//       return res.status(500).json({
//         error: "Invalid response from Gemini",
//         raw: geminiText
//       });
//     }
//   } catch (err) {
//     console.error("Analyze Resume Error:", err.message);
//     res.status(500).json({ error: "Resume analysis failed" });
//   }
// });

router.post("/analyze-resume", upload.single("resume"), async (req, res) => {
  console.log("📥 /analyze-resume hit");

  try {
    console.log("👉 Headers received:", req.headers["content-type"]);

    // 1️⃣ Check file
    if (!req.file) {
      console.error("❌ No file received in request");
      return res.status(400).json({ error: "Resume PDF required" });
    }

    console.log("✅ File received:");
    console.log("   - Original name:", req.file.originalname);
    console.log("   - Size (bytes):", req.file.size);

    // 2️⃣ Check environment variable
    if (!process.env.GEMINI_API_KEY) {
      console.error("❌ GEMINI_API_KEY is missing");
      return res.status(500).json({ error: "Server misconfiguration: Missing API key" });
    }

    console.log("🔑 GEMINI_API_KEY exists");

    // 3️⃣ Extract text
    console.log("📄 Extracting text from PDF...");
    const resumeText = await extractTextFromBuffer(req.file.buffer);

    if (!resumeText || resumeText.trim().length === 0) {
      console.error("❌ Extracted text is empty");
      return res.status(400).json({ error: "Failed to extract text from PDF" });
    }

    console.log("✅ Text extracted successfully");
    console.log("   - Extracted length:", resumeText.length);

    // 4️⃣ Build prompt
    console.log("🧠 Building Gemini prompt...");

    const prompt = `
You are an experienced technical recruiter and interviewer.

Resume Text:
"""
${resumeText}
"""

TASK:
1. Give clear, constructive feedback on this resume (strengths + improvements).
2. Generate 4 to 5 technical or role-based interview questions suited to the candidate's experience.

IMPORTANT:
- Respond ONLY in valid JSON
- Do NOT include markdown or backticks
- Follow this exact format:

{
  "feedback": "string",
  "questions": ["q1", "q2", "q3", "q4", "q5"]
}
`;

    // 5️⃣ Call Gemini
    console.log("🚀 Calling Gemini...");
    const geminiText = await callGemini(prompt);

    if (!geminiText) {
      console.error("❌ Gemini returned empty response");
      return res.status(500).json({ error: "Empty response from Gemini" });
    }

    console.log("✅ Gemini response received");
    console.log("📝 Raw Gemini output (first 500 chars):");
    console.log(geminiText.substring(0, 500));

    // 6️⃣ Parse JSON
    try {
      const cleanJson = geminiText.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(cleanJson);

      console.log("✅ JSON parsed successfully");

      return res.json(parsed);

    } catch (parseErr) {
      console.error("❌ JSON parse error:", parseErr.message);
      console.error("📝 Raw Gemini output:");
      console.error(geminiText);

      return res.status(500).json({
        error: "Invalid response from Gemini",
        raw: geminiText
      });
    }

  } catch (err) {
    console.error("🔥 Analyze Resume Fatal Error:");
    console.error("Message:", err.message);
    console.error("Stack:", err.stack);

    res.status(500).json({ error: "Resume analysis failed" });
  }
});


// Optimized for small models (Feedback Only)
router.post("/analyze", upload.single("resume"), async (req, res) => {
  try {
    console.log(77, "✅✅");
    // 2. Extract text from PDF
    const resume_text = await extractTextFromBuffer(req.file.buffer);

    // 3. Simple prompt for the 0.6B model
    const prompt = `
Analyze this resume text and provide a score (0-100) and brief feedback.
Respond ONLY with a JSON object.

Resume:
${resume_text}

JSON Format:
{
  "score": number,
  "feedback": "string"
}
`;

    // 4. Call Ollama
    const response = await axios.post("http://localhost:11434/api/generate", {
      model: "qwen3:0.6b-q4_K_M",
      prompt: prompt,
      stream: false,
      temperature: 0.1 // Lower temperature = more stable JSON
    });

    const aiRawText = response.data.response.trim();
    console.log("AI Raw Output:", aiRawText);

    try {
      // 5. Clean and Parse
      const cleanJson = aiRawText.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(cleanJson);

      // 6. Map to Frontend (Keep 'questions' empty so it doesn't crash)
      return res.status(200).json({
        feedback: `Overall Score: ${parsed.score}/100\n\n${parsed.feedback}`,
        questions: ["Question generation disabled for this model."] 
      });

    } catch (parseErr) {
      // Fallback if the model outputs text instead of JSON
      return res.status(200).json({
        feedback: aiRawText,
        questions: []
      });
    }

  } catch (error) {
    console.error("Route Error:", error.message);
    res.status(500).json({ error: "Analysis failed" });
  }
});

export default router;

