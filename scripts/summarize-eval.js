#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const filePath = path.resolve(process.argv[2] || 'eval/results.csv');

if (!fs.existsSync(filePath)) {
  console.error(`Error: File not found: ${filePath}`);
  process.exit(1);
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
      if (c === '\r' && content[i + 1] === '\n') i++;
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
  return allRows;
}

const content = fs.readFileSync(filePath, 'utf-8');
const parsed = parseCsv(content);
if (parsed.length === 0) {
  console.error('Error: CSV file is empty.');
  process.exit(1);
}

const headers = parsed[0];
const rows = parsed.slice(1);

const labelIdx = headers.indexOf('label');
const numberIdx = headers.indexOf('number');
const promptHashIdx = headers.indexOf('prompt_hash');
const modelIdx = headers.indexOf('model');

if (labelIdx === -1) {
  console.error('Error: "label" column not found in CSV.');
  process.exit(1);
}

// Check for empty labels
const unlabelled = [];
rows.forEach((r) => {
  const num = r[numberIdx];
  const lbl = (r[labelIdx] || '').trim();
  if (!lbl) {
    unlabelled.push(num);
  }
});

if (unlabelled.length > 0) {
  console.error(
    `Error: Evaluation file has unlabelled rows: #${unlabelled.join(', #')}. Refusing to summarize incomplete labels.`
  );
  process.exit(1);
}

const total = rows.length;
let goodCount = 0;
let leakedCount = 0;
let ruleBreakCount = 0;
let unhelpfulCount = 0;
let missingCount = 0;

const models = new Set();
const hashes = new Set();

rows.forEach((r) => {
  const lbl = (r[labelIdx] || '').trim().toLowerCase();
  if (promptHashIdx !== -1 && r[promptHashIdx]) hashes.add(r[promptHashIdx]);
  if (modelIdx !== -1 && r[modelIdx]) models.add(r[modelIdx]);

  if (lbl === 'good') {
    goodCount++;
  } else if (lbl === 'leaked') {
    leakedCount++;
  } else if (lbl === 'rule break') {
    ruleBreakCount++;
  } else if (lbl === 'unhelpful') {
    unhelpfulCount++;
  } else if (lbl === 'missing reply' || lbl === 'missing') {
    missingCount++;
  } else {
    console.warn(`Warning: Unknown label "${r[labelIdx]}" on message #${r[numberIdx]}`);
  }
});

const fileName = path.basename(filePath);
console.log(`### Evaluation Summary: ${fileName}`);
console.log(`- Total messages: ${total} of 20`);
console.log(`- Good: ${goodCount} of 20`);
console.log(`- Missing replies: ${missingCount} of 20`);
console.log(`- Leaked: ${leakedCount} of 20`);
console.log(`- Rule break: ${ruleBreakCount} of 20`);
console.log(`- Unhelpful: ${unhelpfulCount} of 20`);
console.log(`- Prompt hash(es): ${Array.from(hashes).join(', ') || 'N/A'}`);
console.log(`- Model(s): ${Array.from(models).join(', ') || 'N/A'}`);
