import axios from "axios";

async function callGemini(prompt) {
  try {
    const response = await axios.post(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
      {
        contents: [{ parts: [{ text: prompt }] }]
      },
      {
        params: { key: process.env.GEMINI_API_KEY }
      }
    );

    return response.data.candidates[0].content.parts[0].text;
  } catch (error) {
  console.error("🔥 Gemini API Error:");
  console.error("Status:", error.response?.status);
  console.error("Data:", error.response?.data);
  throw error;
}
}

export default callGemini;