#!/usr/bin/env node
// 一次性前置工具：把英文原文 txt（PyMuPDF 從 PDF 擷取，含 "PAGE N" / "CHAPTER N" 頁碼與章節標記）
// 依「章節設定檔」切成一段一段，對應到 Firebase modules 的 id，輸出 JSON 給「中英規則比對小幫手」使用。
//
// 用法：node scripts/split-en-reference.mjs <英文txt路徑> <章節設定檔.mjs> [輸出路徑]
// 章節設定檔範例見 scripts/chapter-configs/c3-paths.mjs
//
// 切割邏輯：
//   1. 每個小節從自己的英文標題行開始（例如 "Rogue Cultivation"），到下一個小節標題行前結束
//   2. 因為同名標題可能也出現在目錄(TOC)裡，用「標題行之後幾行內是否出現 anchorAfter（預設 "Philosophy"）」
//      來判斷這是不是真正的內文小節開頭，藉此跳過 TOC 裡的同名項目
//   3. 最後一個小節的結尾用 nextChapterAnchor（下一章第一個小節的標題＋anchorAfter）來界定
//   4. 切出來的區塊會濾掉 "PAGE N"、"CHAPTER N ..." 這類重複的頁首/頁碼雜訊行，並壓縮多餘空行
//
// 這只是「大致對應」的切割，不要求逐句對齊 —— 中文內容是重寫過的，不是逐句翻譯。

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const PAGE_LINE_RE = /^PAGE\s+\d+$/i;
const CHAPTER_LINE_RE = /^CHAPTER\s+\d+(:|\s|$)/i;

function findAnchoredHeadingLine(lines, heading, anchorAfter, searchFrom = 0) {
  const matches = [];
  for (let i = searchFrom; i < lines.length; i++) {
    if (lines[i].trim() !== heading) continue;
    const windowLines = lines.slice(i + 1, i + 6).map(l => l.trim());
    if (windowLines.includes(anchorAfter)) matches.push(i);
  }
  return matches;
}

function cleanBlock(lines) {
  const filtered = lines.filter(l => {
    const t = l.trim();
    if (PAGE_LINE_RE.test(t)) return false;
    if (CHAPTER_LINE_RE.test(t)) return false;
    return true;
  });
  // 壓縮連續空行成單一空行，並去頭尾空白行
  const collapsed = [];
  for (const l of filtered) {
    if (l.trim() === "" && collapsed.length && collapsed[collapsed.length - 1].trim() === "") continue;
    collapsed.push(l);
  }
  while (collapsed.length && collapsed[0].trim() === "") collapsed.shift();
  while (collapsed.length && collapsed[collapsed.length - 1].trim() === "") collapsed.pop();
  return collapsed.join("\n");
}

async function main() {
  const [, , txtPathArg, configPathArg, outPathArg] = process.argv;
  if (!txtPathArg || !configPathArg) {
    console.error("用法：node scripts/split-en-reference.mjs <英文txt路徑> <章節設定檔.mjs> [輸出路徑]");
    process.exit(1);
  }

  const txtPath = path.resolve(txtPathArg);
  const configPath = path.resolve(configPathArg);
  const config = (await import(pathToFileURL(configPath).href)).default;

  const raw = readFileSync(txtPath, "utf8");
  const lines = raw.split(/\r?\n/);

  const anchorAfter = config.anchorAfter || "Philosophy";
  const headingIndices = [];
  let searchFrom = 0;

  for (const entry of config.entries) {
    const found = findAnchoredHeadingLine(lines, entry.enHeading, anchorAfter, searchFrom);
    if (found.length === 0) {
      throw new Error(`找不到小節標題「${entry.enHeading}」（緊跟著「${anchorAfter}」的那一次出現），請確認英文原文或設定檔`);
    }
    if (found.length > 1) {
      console.warn(`⚠ 小節標題「${entry.enHeading}」找到 ${found.length} 個符合的位置，取第一個（行號 ${found[0] + 1}）`);
    }
    const lineIdx = found[0];
    headingIndices.push(lineIdx);
    searchFrom = lineIdx + 1; // 下一個小節一定要在這之後，避免重複比對到同一行
  }

  // 界定最後一個小節的結尾
  let endOfLastIdx;
  if (config.nextChapterAnchor) {
    const found = findAnchoredHeadingLine(lines, config.nextChapterAnchor.enHeading, config.nextChapterAnchor.anchorAfter || anchorAfter, searchFrom);
    if (found.length === 0) {
      throw new Error(`找不到下一章節的邊界標記「${config.nextChapterAnchor.enHeading}」，請確認設定檔`);
    }
    endOfLastIdx = found[0];
  } else {
    endOfLastIdx = lines.length;
  }

  const result = {};
  const preview = [];
  for (let i = 0; i < config.entries.length; i++) {
    const entry = config.entries[i];
    const start = headingIndices[i];
    const end = (i + 1 < headingIndices.length) ? headingIndices[i + 1] : endOfLastIdx;
    const block = cleanBlock(lines.slice(start, end));
    result[entry.moduleId] = block;
    preview.push({
      moduleId: entry.moduleId,
      zhTitle: entry.zhTitle || "",
      enHeading: entry.enHeading,
      lineRange: [start + 1, end],
      charLength: block.length,
      head: block.slice(0, 120).replace(/\n/g, " ⏎ "),
    });
  }

  const outPath = path.resolve(outPathArg || `scripts/en_reference_${config.chapterId || "output"}.json`);
  writeFileSync(outPath, JSON.stringify(result, null, 2), "utf8");

  console.log(`已寫出 ${Object.keys(result).length} 筆到 ${outPath}\n`);
  console.table(preview.map(p => ({
    moduleId: p.moduleId, 中文標題: p.zhTitle, 英文標題: p.enHeading,
    原文行範圍: `${p.lineRange[0]}~${p.lineRange[1]}`, 字元數: p.charLength,
  })));
  console.log("\n各段開頭預覽：");
  preview.forEach(p => console.log(`  [${p.moduleId}] ${p.head}...`));
}

main().catch(err => { console.error(err.message || err); process.exit(1); });
