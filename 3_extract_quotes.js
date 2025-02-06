const fs = require('fs');
const path = require('path');

function extractQuotes(sentence) {
  const quotes = [];
  
  // 處理 << >> 格式的引用
  function extractAngleQuotes() {
    let currentQuote = '';
    let isInQuote = false;

    for (let i = 0; i < sentence.length; i++) {
      if (sentence.slice(i, i + 2) === '<<') {
        isInQuote = true;
        i++; // 跳過第二個 <
        continue;
      }
      if (sentence.slice(i, i + 2) === '>>' && isInQuote) {
        isInQuote = false;
        // 只有當引用內容不包含單獨的 < 或 > 時才添加
        if (currentQuote.trim() && !/<|>/g.test(currentQuote)) {
          quotes.push(currentQuote.trim());
        }
        currentQuote = '';
        i++; // 跳過第二個 >
        continue;
      }
      if (isInQuote) {
        currentQuote += sentence[i];
      }
    }
  }

  // 處理 "" 格式的引用
  function extractDoubleQuotes() {
    let currentQuote = '';
    let isInQuote = false;

    for (let i = 0; i < sentence.length; i++) {
      // 檢查開引號 "
      if (sentence[i] === '“') {
        isInQuote = true;
        continue;
      }
      // 檢查閉引號 "
      if (sentence[i] === '”' && isInQuote) {
        isInQuote = false;
        if (currentQuote.trim()) {
          quotes.push(currentQuote.trim());
        }
        currentQuote = '';
        continue;
      }
      if (isInQuote) {
        currentQuote += sentence[i];
      }
    }
  }

  // 執行兩種引用格式的提取
  extractAngleQuotes();
  extractDoubleQuotes();

  // 去除重複的引用
  return [...new Set(quotes)];
}

function processTSVFile(inputPath) {
  try {
    // 檢查檔案是否存在
    if (!fs.existsSync(inputPath)) {
      console.error(`錯誤：檔案 ${inputPath} 不存在！`);
      return null;
    }

    // 讀取 TSV 檔案
    const content = fs.readFileSync(inputPath, 'utf-8');
    const lines = content.split('\n');
    
    if (lines.length < 2) {
      console.error(`檔案 ${inputPath} 內容過少`);
      return null;
    }

    let processedQuotes = [];
    let totalOriginalSentences = 0;
    let totalQuotes = 0;
    let angleQuotesCount = 0;
    let doubleQuotesCount = 0;

    // 處理每一行
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      // 分割 TSV 行，取得第二欄
      const columns = line.split('\t');
      if (columns.length < 2) continue;
      
      const sentence = columns[1].trim();
      if (!sentence) continue;

      totalOriginalSentences++;
      
      // 計算不同類型的引用數量
      const hasAngleQuotes = sentence.includes('<<');
      const hasDoubleQuotes = sentence.includes('“') || sentence.includes('”');
      if (hasAngleQuotes) angleQuotesCount++;
      if (hasDoubleQuotes) doubleQuotesCount++;
      
      // 提取引用句
      const quotes = extractQuotes(sentence);
      totalQuotes += quotes.length;
      
      // 為每個引用句保留原始參考
      quotes.forEach(quote => {
        processedQuotes.push({
          reference: columns[0],
          text: quote
        });
      });
    }

    // 在寫入檔案前去除重複的引用句
    const uniqueQuotes = [];
    const seen = new Set();
    
    processedQuotes.forEach(item => {
      // 使用引用文字作為唯一標識
      if (!seen.has(item.text)) {
        seen.add(item.text);
        uniqueQuotes.push(item);
      }
    });
    
    // 產生輸出檔案路徑
    const dir = path.dirname(inputPath);
    const filename = path.basename(inputPath, '_special.tsv');
    const outputPath = path.join(dir, `${filename}_quotes.tsv`);
    
    // 寫入處理後的引用句
    const outputContent = uniqueQuotes
      .map(item => `${item.reference}\t${item.text}`)
      .join('\n');
    fs.writeFileSync(outputPath, outputContent);
    
    return {
      originalCount: totalOriginalSentences,
      quotesCount: totalQuotes,
      uniqueQuotesCount: uniqueQuotes.length,
      angleQuotesCount,
      doubleQuotesCount,
      outputFile: outputPath
    };
    
  } catch (error) {
    console.error(`處理檔案時發生錯誤:`, error.message);
    return null;
  }
}

// 主程式
function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 1) {
    console.error('請提供 _special.tsv 檔案的路徑！');
    console.error('使用方式：node extract_quotes.js <檔案路徑>');
    process.exit(1);
  }
  
  const inputPath = args[0];

  console.log(`開始處理檔案：${inputPath}`);
  const result = processTSVFile(inputPath);
  
  if (result) {
    console.log('\n處理完成！');
    console.log(`原始句子數: ${result.originalCount}`);
    console.log(`包含 << >> 引用的句子數: ${result.angleQuotesCount}`);
    console.log(`包含 "" 引用的句子數: ${result.doubleQuotesCount}`);
    console.log(`提取引用句數: ${result.quotesCount}`);
    console.log(`去重後引用句數: ${result.uniqueQuotesCount}`);
    console.log(`已儲存至: ${path.basename(result.outputFile)}`);
  }
}

main(); 