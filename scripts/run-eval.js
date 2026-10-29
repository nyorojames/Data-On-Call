import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

// Ensure GEMINI_API_KEY is present
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey || apiKey === 'your-key-here' || apiKey === 'MY_GEMINI_API_KEY') {
  console.error(
    'Error: GEMINI_API_KEY environment variable is missing or placeholder.\n' +
      'Please set a valid GEMINI_API_KEY in your environment or in a .env file.\n' +
      'In PowerShell: $env:GEMINI_API_KEY="your-actual-api-key"'
  );
  process.exit(1);
}

const PORT = process.env.PORT || 3000;
const TUTOR_URL = `http://localhost:${PORT}/api/tutor`;

// Read eval/messages.md
const messagesPath = path.resolve('eval/messages.md');
if (!fs.existsSync(messagesPath)) {
  console.error(`Error: Could not find messages file at ${messagesPath}`);
  process.exit(1);
}

const fileContent = fs.readFileSync(messagesPath, 'utf-8');
const lines = fileContent.split(/\r?\n/);

const messages = [];

for (const line of lines) {
  const trimmed = line.trim();
  if (!trimmed.startsWith('|')) continue;
  const cells = trimmed
    .split('|')
    .slice(1, -1)
    .map((c) => c.trim());

  if (cells.length < 6) continue;
  const num = parseInt(cells[0], 10);
  if (isNaN(num)) continue; // Header row

  messages.push({
    number: num,
    level: cells[1],
    goal: cells[2],
    decision: cells[3],
    message: cells[4],
    type: cells[5],
  });
}

console.log(`Parsed ${messages.length} student messages from eval/messages.md.`);

/**
 * Auto-flag heuristics (hint only, never replaces hand-labeling)
 * Flags "check" if:
 * 1. Contains phrases like "choose A" or "choose B"
 * 2. More than 2 sentences
 * 3. Does not end with a question mark "?"
 */
function computeAutoFlag(reply) {
  if (!reply) return 'check';

  // Check 1: Leaking option phrases
  const leakRegex = /\b(choose\s+[AB]|option\s+[AB]\s+is\s+(correct|better|right)|pick\s+[AB]|select\s+[AB])\b/i;
  if (leakRegex.test(reply)) return 'check';

  // Check 2: Ends with question mark
  const trimmed = reply.trim();
  if (!trimmed.endsWith('?')) return 'check';

  // Check 3: Sentence count (max 2 sentences)
  // Split on sentence terminators (.!?) followed by space or end
  const sentences = trimmed
    .split(/(?<=[.!?])\s+/)
    .filter((s) => s.trim().length > 0);

  if (sentences.length > 2) return 'check';

  return '';
}

function escapeCsvField(val) {
  if (val === undefined || val === null) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

async function callTutorWithRetry(messageObj, maxRetries = 3) {
  const decId = parseInt(messageObj.decision.replace('D', ''), 10) || 1;
  const delays = [1000, 2000, 4000];

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(TUTOR_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: messageObj.message,
          decisionId: decId,
          goal: messageObj.goal,
          level: messageObj.level,
        }),
      });

      if (res.status === 503 || res.status === 429) {
        throw new Error(`Transient API response: ${res.status}`);
      }

      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}`);
      }

      const data = await res.json();
      if (!data.reply) {
        throw new Error(data.error || 'No reply in tutor response');
      }

      return data.reply;
    } catch (err) {
      console.warn(
        `[Message #${messageObj.number}] Attempt ${attempt + 1} failed: ${err.message}`
      );
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, delays[attempt] || 4000));
      } else {
        throw err;
      }
    }
  }
  throw new Error('All retry attempts exhausted');
}

async function run() {
  const results = [];
  console.log(`Sending messages to tutor endpoint: ${TUTOR_URL}...`);

  for (const msg of messages) {
    process.stdout.write(`Evaluating #${msg.number} (${msg.level}, ${msg.goal}, ${msg.decision})... `);
    try {
      const reply = await callTutorWithRetry(msg);
      const autoFlag = computeAutoFlag(reply);
      console.log(`Done [auto_flag: "${autoFlag || 'ok'}"]`);

      results.push({
        number: msg.number,
        level: msg.level,
        goal: msg.goal,
        decision: msg.decision,
        message: msg.message,
        reply,
        auto_flag: autoFlag,
        label: '',
        error_type: '',
        notes: '',
      });
    } catch (err) {
      console.error(`FAILED: ${err.message}`);
      throw new Error(`Failed to evaluate message #${msg.number}: ${err.message}`);
    }
  }

  // Write eval/results.csv
  const csvHeaders = [
    'number',
    'level',
    'goal',
    'decision',
    'message',
    'reply',
    'auto_flag',
    'label',
    'error_type',
    'notes',
  ];

  const csvRows = [csvHeaders.join(',')];
  for (const r of results) {
    const row = [
      r.number,
      escapeCsvField(r.level),
      escapeCsvField(r.goal),
      escapeCsvField(r.decision),
      escapeCsvField(r.message),
      escapeCsvField(r.reply),
      escapeCsvField(r.auto_flag),
      escapeCsvField(r.label),
      escapeCsvField(r.error_type),
      escapeCsvField(r.notes),
    ];
    csvRows.push(row.join(','));
  }

  const outputPath = path.resolve('eval/results.csv');
  fs.writeFileSync(outputPath, csvRows.join('\n'), 'utf-8');
  console.log(`\nEvaluation complete! Output saved to: ${outputPath}`);
}

run().catch((err) => {
  console.error('Eval harness failed:', err.message);
  process.exit(1);
});
