import { GoogleGenAI } from "@google/genai";
import { H3Cluster } from "../types";

const apiKey = "AIzaSyAYx_CTPNPpm_Nimi81ouLZTh0FoEq1OwE";
const ai = new GoogleGenAI({ apiKey: apiKey || '' });

export const getPacingStrategy = async (
  topClusters: H3Cluster[],
  totalDemand: number,
  totalSupplyNeeded: number
): Promise<string> => {

  if (!apiKey) {
    console.warn("Gemini API Key is missing. AI insights will not be generated.");
    return "AI insights are unavailable. Please configure the GEMINI_API_KEY in your environment.";
  }

  const clusterSummary = topClusters.slice(0, 8).map(c =>
    `- Hex ${c.hexId}: Demand ${c.demand}, Need ${c.requiredSupply} Autos (Lat: ${c.lat.toFixed(3)}, Lng: ${c.lng.toFixed(3)})`
  ).join('\n');

  const prompt = `
    Act as a Fleet Operations Manager. I have processed ride data for a city.
    
    **Data Summary:**
    - Total Demand (Sample Period): ${totalDemand} rides
    - Total Calculated Supply Needed for 5-min SLA: ${totalSupplyNeeded} autos
    - Top Demand Hotspots (H3 Hexagons):
    ${clusterSummary}

    **Task:**
    Provide a concise "Pacing Strategy" to achieve the 5-minute SLA. 
    1. Analyze the spatial distribution based on the coordinates (e.g., are they clustered or dispersed?).
    2. Suggest how to position drivers during idle times.
    3. Provide 3 actionable bullet points for field operations.
    
    Keep the response professional, strategic, and under 200 words.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: prompt,
    });
    return response.text || "No insight generated.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Unable to generate AI insights at this time. Please check API configuration.";
  }
};