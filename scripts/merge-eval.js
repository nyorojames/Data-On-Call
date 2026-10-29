#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const sourceArg = process.argv[2] || 'eval/results-run2-retry2.csv';
const sourcePath = path.resolve(sourceArg);
const targetPath = path.resolve('eval/results-run2.csv');

if (!fs.existsSync(sourcePath)) {
  console.error(`Error: Source retry file not found at: ${sourcePath}`);
  console.error(`Please run the retry command first:\n  npm run eval -- --only 15,17,18,19 --out ${sourceArg}`);
  process.exit(1);
}

if (!fs.existsSync(targetPath)) {
  console.error(`Error: Target results file not found at: ${targetPath}`);
  process.exit(1);
}

function esc(v) {
  if (v === undefined || v === null) return '';
  const s = String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function parseCsv(content) {
  const allRows = [];
  let currentRow = [];
  let curField = '';
  let inQuotes = false;
  for (let i = 0; i < content.length; i++) {
    const c = content[i];
    if (c === '"') {
      if (inQuotes && content[i + 1] === '"') { curField += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (c === ',' && !inQuotes) {
      currentRow.push(curField); curField = '';
    } else if ((c === '\r' || c === '\n') && !inQuotes) {
      if (c === '\r' && content[i + 1] === '\n') i++;
      currentRow.push(curField); curField = '';
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

const targetParsed = parseCsv(fs.readFileSync(targetPath, 'utf-8'));
const targetHeaders = targetParsed[0];
const targetRows = targetParsed.slice(1);

const sourceParsed = parseCsv(fs.readFileSync(sourcePath, 'utf-8'));
const sourceHeaders = sourceParsed[0];
const sourceRows = sourceParsed.slice(1);

const sourceMap = new Map();
sourceRows.forEach((r) => {
  const obj = {};
  sourceHeaders.forEach((h, idx) => { obj[h] = r[idx] || ''; });
  sourceMap.set(parseInt(obj.number, 10), obj);
});

const mergedHeaders = targetHeaders.includes('source_file')
  ? targetHeaders
  : [...targetHeaders, 'source_file'];

let updatedCount = 0;
const mergedLines = [mergedHeaders.join(',')];

targetRows.forEach((r) => {
  const obj = {};
  targetHeaders.forEach((h, idx) => { obj[h] = r[idx] || ''; });
  const num = parseInt(obj.number, 10);

  if (sourceMap.has(num)) {
    const sObj = sourceMap.get(num);
    const updated = {
      ...obj,
      ...sObj,
      source_file: path.relative(process.cwd(), sourcePath).replace(/\\/g, '/'),
    };
    mergedLines.push(mergedHeaders.map((h) => esc(updated[h])).join(','));
    updatedCount++;
  } else {
    mergedLines.push(mergedHeaders.map((h) => esc(obj[h])).join(','));
  }
});

fs.writeFileSync(targetPath, mergedLines.join('\n') + '\n', 'utf-8');
console.log(`Successfully merged ${updatedCount} rows from ${path.basename(sourcePath)} into ${path.basename(targetPath)}.`);
