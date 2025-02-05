const fs = require('fs');
const path = require('path');

function processBununBible(inputPath) {
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

    let normalSentences = [];
    let specialPunctuationSentences = [];
    let totalSentences = 0;

    // 處理每一行
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      // 分割 TSV 行，取得第二欄
      const columns = line.split('\t');
      if (columns.length < 2) continue;
      
      const sentence = columns[1].trim();
      if (!sentence) continue;

      totalSentences++;
      
      // 檢查是否包含除了 , . ; - ? : ʼ 以外的標點
      if (/[^\w\s,\.\;\-\?\:\ʼ]/.test(sentence)) {
        specialPunctuationSentences.push({
          reference: columns[0],
          text: sentence
        });
      } else {
        normalSentences.push({
          reference: columns[0],
          text: sentence
        });
      }
    }

    // 產生輸出檔案路徑
    const dir = path.dirname(inputPath);
    const filename = path.basename(inputPath, '.tsv');
    const normalPath = path.join(dir, `${filename}_normal.tsv`);
    const specialPath = path.join(dir, `${filename}_special.tsv`);
    
    // 寫入正常句子檔案
    const normalContent = normalSentences
      .map(item => `${item.reference}\t${item.text}`)
      .join('\n');
    fs.writeFileSync(normalPath, normalContent);
    
    // 寫入特殊標點句子檔案
    const specialContent = specialPunctuationSentences
      .map(item => `${item.reference}\t${item.text}`)
      .join('\n');
    fs.writeFileSync(specialPath, specialContent);
    
    return {
      totalSentences,
      normalCount: normalSentences.length,
      specialCount: specialPunctuationSentences.length,
      normalFile: normalPath,
      specialFile: specialPath
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
    console.error('請提供布農語聖經 TSV 檔案的路徑！');
    console.error('使用方式：node process_bunun_bible.js <檔案路徑>');
    process.exit(1);
  }
  
  const inputPath = args[0];

  console.log(`開始處理檔案：${inputPath}`);
  const result = processBununBible(inputPath);
  
  if (result) {
    console.log('\n處理完成！');
    console.log(`總句子數: ${result.totalSentences}`);
    console.log(`一般句子數: ${result.normalCount}`);
    console.log(`特殊標點句子數: ${result.specialCount}`);
    console.log(`一般句子已儲存至: ${path.basename(result.normalFile)}`);
    console.log(`特殊標點句子已儲存至: ${path.basename(result.specialFile)}`);
    console.log(`特殊標點句子比例: ${((result.specialCount / result.totalSentences) * 100).toFixed(2)}%`);
  }
}

main(); 