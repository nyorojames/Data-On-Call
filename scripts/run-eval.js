import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
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

// Parse CLI arguments: --only (comma-separated message numbers), --out (output file path), --delay (ms between messages)
const args = process.argv.slice(2);
let onlyArg = null;
let outArg = null;
let delayArg = 0;

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg.startsWith('--only=')) {
    onlyArg = arg.slice(7);
  } else if (arg === '--only' && i + 1 < args.length) {
    onlyArg = args[++i];
  } else if (arg.startsWith('--out=')) {
    outArg = arg.slice(6);
  } else if (arg === '--out' && i + 1 < args.length) {
    outArg = args[++i];
  } else if (arg.startsWith('--delay=')) {
    delayArg = parseInt(arg.slice(8), 10) || 0;
  } else if (arg === '--delay' && i + 1 < args.length) {
    delayArg = parseInt(args[++i], 10) || 0;
  }
}

const outputPath = path.resolve(outArg || 'eval/results.csv');

// Never overwrite an existing results file on a full run
if (!onlyArg && fs.existsSync(outputPath)) {
  console.error(
    `Error: Output file "${outputPath}" already exists. Refusing to overwrite existing results file.`
  );
  process.exit(1);
}

// Compute short hash of tutor system prompt from server.ts
function getPromptHash() {
  try {
    const serverPath = path.resolve('server.ts');
    const serverContent = fs.readFileSync(serverPath, 'utf-8');
    const match = serverContent.match(/SYSTEM_INSTRUCTION\s*=\s*(['"`])([\s\S]*?)\1/);
    if (match) {
      const instruction = match[2].trim();
      return crypto.createHash('sha256').update(instruction).digest('hex').slice(0, 8);
    }
  } catch (err) {
    console.warn('Warning: Could not read server.ts for system prompt hash:', err.message);
  }
  return 'unknown';
}

const promptHash = getPromptHash();

// Read eval/messages.md
const messagesPath = path.resolve('eval/messages.md');
if (!fs.existsSync(messagesPath)) {
  console.error(`Error: Could not find messages file at ${messagesPath}`);
  process.exit(1);
}

const fileContent = fs.readFileSync(messagesPath, 'utf-8');
const lines = fileContent.split(/\r?\n/);

const allMessages = [];

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

  allMessages.push({
    number: num,
    level: cells[1],
    goal: cells[2],
    decision: cells[3],
    message: cells[4],
    type: cells[5],
  });
}

// Filter messages if --only is passed
let targetMessages = allMessages;
if (onlyArg) {
  const selectedNumbers = new Set(
    onlyArg
      .split(',')
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n))
  );

  if (selectedNumbers.size === 0) {
    console.error(`Error: --only specified but no valid numbers parsed from "${onlyArg}"`);
    process.exit(1);
  }

  targetMessages = allMessages.filter((m) => selectedNumbers.has(m.number));
  console.log(
    `Running evaluation for ${targetMessages.length} selected messages: ${Array.from(
      selectedNumbers
    ).join(', ')}`
  );
} else {
  console.log(`Parsed ${allMessages.length} student messages from eval/messages.md.`);
}

/**
 * Auto-flag heuristics (hint only, never replaces hand-labeling)
 * Flags "check" if:
 * 1. Contains phrases like "choose A" or "choose B"
 * 2. More than 2 sentences
 * 3. Does not end with a question mark "?"
 */
function computeAutoFlag(reply) {
  if (!reply) return '';

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

function parseCsv(content) {
  const allRows = [];
  let currentRow = [];
  let curField = '';
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const c = content[i];
    if (c === '"') {
      if (inQuotes && content[i + 1] === '"') {
        curField += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === ',' && !inQuotes) {
      currentRow.push(curField);
      curField = '';
    } else if ((c === '\r' || c === '\n') && !inQuotes) {
      if (c === '\r' && content[i + 1] === '\n') {
        i++;
      }
      currentRow.push(curField);
      curField = '';
      if (currentRow.length > 1 || (currentRow.length === 1 && currentRow[0].trim() !== '')) {
        allRows.push(currentRow);
      }
      currentRow = [];
    } else {
      curField += c;
    }
  }
  if (curField.length > 0 || currentRow.length > 0) {
    currentRow.push(curField);
    if (currentRow.length > 1 || (currentRow.length === 1 && currentRow[0].trim() !== '')) {
      allRows.push(currentRow);
    }
  }

  if (allRows.length === 0) return { headers: [], rows: [] };
  const headers = allRows[0];
  const parsedRows = [];
  for (let i = 1; i < allRows.length; i++) {
    const fields = allRows[i];
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = fields[idx] !== undefined ? fields[idx] : '';
    });
    if (obj.number && !isNaN(parseInt(obj.number, 10))) {
      obj.number = parseInt(obj.number, 10);
      parsedRows.push(obj);
    }
  }
  return { headers, rows: parsedRows };
}

async function callTutorWithRetry(messageObj, maxRetries = 4) {
  const decId = parseInt(messageObj.decision.replace('D', ''), 10) || 1;
  const delays = [20000, 40000, 60000, 90000];

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
        throw new Error(`Transient API response: HTTP ${res.status}`);
      }

      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}`);
      }

      const data = await res.json();
      if (!data.reply) {
        throw new Error(data.error || 'No reply in tutor response');
      }

      const model = data.model || process.env.GEMINI_MODEL || 'gemini-3.5-flash';
      const raw_model_reply = data.raw_model_reply !== undefined ? data.raw_model_reply : data.reply;
      const filter_triggered = data.filter_triggered !== undefined ? String(data.filter_triggered) : 'false';

      return {
        reply: data.reply,
        raw_model_reply,
        filter_triggered,
        model,
        isApiFailure: false,
      };
    } catch (err) {
      console.warn(
        `[Message #${messageObj.number}] Attempt ${attempt + 1} failed: ${err.message}`
      );
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, delays[attempt] || 20000));
      } else {
        return {
          reply: '',
          raw_model_reply: '',
          filter_triggered: '',
          model: process.env.GEMINI_MODEL || 'gemini-3.5-flash',
          isApiFailure: true,
          error: err.message,
        };
      }
    }
  }
  return {
    reply: '',
    raw_model_reply: '',
    filter_triggered: '',
    model: process.env.GEMINI_MODEL || 'gemini-3.5-flash',
    isApiFailure: true,
    error: 'All retry attempts exhausted',
  };
}

async function run() {
  const evalResults = [];
  let apiFailuresCount = 0;
  console.log(`Sending messages to tutor endpoint: ${TUTOR_URL}... (Prompt Hash: ${promptHash})`);

  for (let idx = 0; idx < targetMessages.length; idx++) {
    const msg = targetMessages[idx];
    if (idx > 0 && delayArg > 0) {
      console.log(`Waiting ${delayArg / 1000}s between calls to respect API limits...`);
      await new Promise((resolve) => setTimeout(resolve, delayArg));
    }

    process.stdout.write(`Evaluating #${msg.number} (${msg.level}, ${msg.goal}, ${msg.decision})... `);
    const result = await callTutorWithRetry(msg);

    if (result.isApiFailure) {
      apiFailuresCount++;
      console.log(`API FAILURE [left blank, error: ${result.error}]`);
      evalResults.push({
        number: msg.number,
        level: msg.level,
        goal: msg.goal,
        decision: msg.decision,
        message: msg.message,
        reply: '', // Left blank on API failure, never filled with fallback
        raw_model_reply: '',
        filter_triggered: '',
        auto_flag: '',
        label: '',
        error_type: '',
        notes: '',
        prompt_hash: promptHash,
        model: result.model,
      });
    } else {
      const autoFlag = computeAutoFlag(result.reply);
      console.log(`Done [auto_flag: "${autoFlag || 'ok'}"]`);
      evalResults.push({
        number: msg.number,
        level: msg.level,
        goal: msg.goal,
        decision: msg.decision,
        message: msg.message,
        reply: result.reply,
        raw_model_reply: result.raw_model_reply,
        filter_triggered: result.filter_triggered,
        auto_flag: autoFlag,
        label: '',
        error_type: '',
        notes: '',
        prompt_hash: promptHash,
        model: result.model,
      });
    }
  }

  const csvHeaders = [
    'number',
    'level',
    'goal',
    'decision',
    'message',
    'reply',
    'raw_model_reply',
    'filter_triggered',
    'auto_flag',
    'label',
    'error_type',
    'notes',
    'prompt_hash',
    'model',
  ];

  let finalRows = evalResults;

  // If running with --only and target file already exists, update rows in place
  if (onlyArg && fs.existsSync(outputPath)) {
    try {
      const existing = parseCsv(fs.readFileSync(outputPath, 'utf-8'));
      const existingMap = new Map();
      existing.rows.forEach((r) => existingMap.set(r.number, r));

      for (const updated of evalResults) {
        existingMap.set(updated.number, {
          ...(existingMap.get(updated.number) || {}),
          ...updated,
        });
      }

      finalRows = Array.from(existingMap.values()).sort((a, b) => a.number - b.number);
      console.log(`Updated ${evalResults.length} rows in existing file: ${outputPath}`);
    } catch (err) {
      console.warn(`Warning: Could not parse existing CSV, writing fresh: ${err.message}`);
    }
  }

  const csvOutputLines = [csvHeaders.join(',')];
  for (const r of finalRows) {
    const row = [
      r.number,
      escapeCsvField(r.level),
      escapeCsvField(r.goal),
      escapeCsvField(r.decision),
      escapeCsvField(r.message),
      escapeCsvField(r.reply),
      escapeCsvField(r.raw_model_reply !== undefined ? r.raw_model_reply : r.reply),
      escapeCsvField(r.filter_triggered !== undefined ? r.filter_triggered : 'false'),
      escapeCsvField(r.auto_flag),
      escapeCsvField(r.label),
      escapeCsvField(r.error_type),
      escapeCsvField(r.notes),
      escapeCsvField(r.prompt_hash || promptHash),
      escapeCsvField(r.model || process.env.GEMINI_MODEL || 'gemini-3.5-flash'),
    ];
    csvOutputLines.push(row.join(','));
  }

  // Ensure parent directory exists
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, csvOutputLines.join('\n'), 'utf-8');

  console.log(`\nEvaluation complete!`);
  console.log(`Output saved to: ${outputPath}`);
  console.log(`Total messages processed: ${evalResults.length}`);
  console.log(`API failures (left blank): ${apiFailuresCount}`);
}

run().catch((err) => {
  console.error('Eval harness failed:', err.message);
  process.exit(1);
});
