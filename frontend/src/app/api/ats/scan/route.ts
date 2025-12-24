import { NextRequest, NextResponse } from "next/server";
import PDFParser from "pdf2json";

// --- CONFIGURATION ---
const TIER_1_KEYWORDS = new Set([
  "react", "node", "aws", "python", "sql", "docker", "typescript", "nextjs",
  "java", "figma", "kubernetes", "terraform", "go", "rust", "c++", "c#", ".net",
  "javascript", "angular", "vue", "graphql", "mongodb", "postgresql", "redis",
  "kafka", "spark", "hadoop", "azure", "gcp", "linux", "git", "ci/cd", "jenkins"
]);

const STOP_WORDS = new Set([
  "and", "the", "for", "with", "from", "that", "this", "have", "are", "will",
  "can", "you", "your", "work", "team", "year", "years", "experience", "role",
  "skills", "job", "description", "requirements", "qualifications", "looking",
  "must", "should", "ability", "knowledge", "using", "development", "software",
  "engineering", "engineer", "system", "systems", "design", "good", "strong"
]);

// --- HELPER FUNC ---
function cleanAndTokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s\+\-\.]/g, " ") // Keep +, -, . for things like C++, Node.js
    .split(/\s+/)
    .filter(w => w.length > 2) // Ignore very short words
    .filter(w => !STOP_WORDS.has(w));
}

// --- ALGIORITHM ---
function weightedScoring(resumeText: string, jdText: string) {
  const resumeTokens = new Set(cleanAndTokenize(resumeText));
  const jdTokens = cleanAndTokenize(jdText);

  // Weights
  const W_TIER_1 = 10;
  const W_TIER_2 = 1;

  let totalPossibleScore = 0;
  let earnedScore = 0;
  const missingKeywords: Set<string> = new Set();
  const matchedKeywords: Set<string> = new Set();

  // Track unique JD words to avoid double counting same word multiple times for "Total" 
  // (or deciding if frequency matters - for now, let's treat existence as the metric)
  const uniqueJdTokens = new Set(jdTokens);

  uniqueJdTokens.forEach(token => {
    const isTier1 = TIER_1_KEYWORDS.has(token);
    const weight = isTier1 ? W_TIER_1 : W_TIER_2;

    totalPossibleScore += weight;

    if (resumeTokens.has(token)) {
      earnedScore += weight;
      // Also track general matches if needed, but for display Tier 1 is prioritized. 
      // User asked for "successfully matched keywords", implies ALL matches.
      // Let's add all matches to matchedKeywords if they are in JD.
      matchedKeywords.add(token);
    } else {
      if (isTier1) missingKeywords.add(token);
    }
  });

  // Calculate Percentage
  const finalScore = totalPossibleScore > 0
    ? Math.round((earnedScore / totalPossibleScore) * 100)
    : 0;

  // Cap at 100 just in case logic drifts, though math above implies <= 100
  const cappedScore = Math.min(100, finalScore);

  // Determine Match Level
  let matchLevel = "Low";
  if (cappedScore >= 80) matchLevel = "High";
  else if (cappedScore >= 50) matchLevel = "Medium";

  const matchedList = Array.from(matchedKeywords).slice(0, 15); // Top 15 matches

  return {
    score: cappedScore,
    match_level: matchLevel,
    matched_keywords: matchedList,
    missing_keywords: Array.from(missingKeywords).slice(0, 10), // Top 10 missing
    summary: `Found ${matchedKeywords.size} matching skills and keywords.`,
    debug_mode: "📊 ALGO_WEIGHTED"
  };
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("resume") as File;
    const jobDescription = formData.get("jobDescription") as string;

    if (!file || !jobDescription) {
      return NextResponse.json(
        { error: "Resume and Job Description are required." },
        { status: 400 }
      );
    }

    // 1. Parse PDF using pdf2json
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const resumeText = await new Promise<string>((resolve, reject) => {
      const pdfParser = new PDFParser(null, true); // true = text content only

      pdfParser.on("pdfParser_dataError", (errData: any) => {
        reject(errData.parserError);
      });

      pdfParser.on("pdfParser_dataReady", (pdfData: any) => {
        // Raw text content
        const rawText = pdfParser.getRawTextContent();
        resolve(rawText);
      });

      pdfParser.parseBuffer(buffer);
    });

    if (!resumeText.trim()) {
      return NextResponse.json(
        { error: "Could not extract text from PDF." },
        { status: 422 }
      );
    }

    // 2. Run Weighted Algorithm
    const analysis = weightedScoring(resumeText, jobDescription);

    return NextResponse.json(analysis);

  } catch (error) {
    console.error("ATS Scan Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
