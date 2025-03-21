const fs = require('fs');
const path = require('path');

function cleanSentence(sentence) {
  return sentence.trim().replace(/[,;.]+$/, '').trim();
}

function splitLongSentence(sentence) {
  // console.log(`\n準備分割句子: "${sentence}"`);
  
  const words = sentence.split(/\s+/);
  
  // 如果句子少於或等於 10 個詞，直接返回
  if (words.length <= 10) {
    // console.log(`句子較短（${words.length} 個詞），返回原句: "${sentence}"`);
    return [cleanSentence(sentence)];
  }

  // 尋找所有句號和逗號的位置
  const periodPositions = [];
  const commaPositions = [];
  
  for (let i = 0; i < sentence.length; i++) {
    if (sentence[i] === '.' && i < sentence.length - 1 && sentence[i + 1] === ' ') {
      periodPositions.push(i);
    }
    if (sentence[i] === ',' && i < sentence.length - 1 && sentence[i + 1] === ' ') {
      commaPositions.push(i);
    }
  }

  // 優先使用句號，如果沒有句號才使用逗號
  let splitPositions = periodPositions.length > 0 ? periodPositions : commaPositions;
  let punctuation = periodPositions.length > 0 ? '句號' : '逗號';

  // 如果沒有找到任何分割點，直接返回清理後的句子
  if (splitPositions.length === 0) {
    // console.log(`沒有找到合適的分割點，返回原句: "${sentence}"`);
    return [cleanSentence(sentence)];
  }

  // 找出最接近中間的分割點
  const middlePosition = sentence.length / 2;
  const nearestPosition = splitPositions.reduce((prev, curr) => 
    Math.abs(curr - middlePosition) < Math.abs(prev - middlePosition) ? curr : prev
  );

  // console.log(`最近的${punctuation}在位置: ${nearestPosition}`);

  // 在最接近中間的分割點處分割
  const firstPart = sentence.slice(0, nearestPosition + 1).trim();  // 包含標點
  const secondPart = sentence.slice(nearestPosition + 2).trim();    // 跳過標點和空格

  // console.log(`分割為: "${firstPart}" 和 "${secondPart}"`);

  // 確保不遞迴處理空字串
  const result = [];
  if (firstPart.length > 0) {
    result.push(...splitLongSentence(firstPart));
  }
  if (secondPart.length > 0) {
    result.push(...splitLongSentence(secondPart));
  }

  return result;
}

function splitSentence(sentence) {
  // 定義分割用的標點符號
  const separators = ['?', '!', ';', ':'];
  
  // 先在分隔符號處分割
  let parts = [sentence];
  for (const separator of separators) {
    parts = parts.flatMap(part => part.split(separator));
  }
  
  // 遞迴處理所有長句
  parts = parts.flatMap(splitLongSentence);

  // 過濾掉分割後仍然過長的句子，以及太短的句子
  return parts
    .map(cleanSentence)
    .filter(part => {
      const wordCount = part.split(/\s+/).length;
      return wordCount >= 3 && wordCount <= 10;  // 只保留 3-10 個詞的句子
    });
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

    let processedSentences = [];
    let shortSentences = [];
    let totalOriginalSentences = 0;
    let totalSplitSentences = 0;
    let totalShortSentences = 0;
    let totalDiscardedSentences = 0;

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
      
      // 檢查是否為短句
      const words = sentence.split(/\s+/);
      if (words.length <= 2) continue;
      
      if (words.length <= 10) {
        totalShortSentences++;
        shortSentences.push({
          reference: columns[0],
          text: cleanSentence(sentence)
        });
      } 
      else {
        // 只對長句進行分割
        const splitParts = splitSentence(sentence);
        
        if (splitParts.length === 0) {
          totalDiscardedSentences++;  // 如果分割後沒有合適的句子，計數加一
        } else {
          totalSplitSentences += splitParts.length;
          
          splitParts.forEach(part => {
            processedSentences.push({
              reference: columns[0],
              text: part
            });
          });
        }
      }
    }

    // 產生輸出檔案路徑
    const dir = path.dirname(inputPath);
    const filename = path.basename(inputPath);
    const splitOutputPath = path.join(dir, filename.replace('.tsv', '_split.tsv'));
    const shortOutputPath = path.join(dir, filename.replace('.tsv', '_short.tsv'));
    
    // 寫入處理後的句子
    const splitOutputContent = processedSentences
      .map(item => `${item.reference}\t${item.text}`)
      .join('\n');
    fs.writeFileSync(splitOutputPath, splitOutputContent);
    
    // 寫入短句
    const shortOutputContent = shortSentences
      .map(item => `${item.reference}\t${item.text}`)
      .join('\n');
    fs.writeFileSync(shortOutputPath, shortOutputContent);
    
    return {
      originalCount: totalOriginalSentences,
      splitCount: totalSplitSentences,
      shortCount: totalShortSentences,
      discardedCount: totalDiscardedSentences,
      splitOutputFile: splitOutputPath,
      shortOutputFile: shortOutputPath
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
    console.error('請提供 .tsv 檔案的路徑！');
    console.error('使用方式：node 4_split_tsv_sentences.js <檔案路徑>');
    process.exit(1);
  }
  
  const inputPath = args[0];

  console.log(`開始處理檔案：${inputPath}`);
  const result = processTSVFile(inputPath);
  
  if (result) {
    console.log('\n處理完成！');
    console.log(`原始句子數: ${result.originalCount}`);
    console.log(`分割後句子數: ${result.splitCount}`);
    console.log(`分割率: ${((result.splitCount / result.originalCount) * 100).toFixed(2)}%`);
    console.log(`過短被捨棄的句子數: ${result.discardedCount}`);
    console.log(`分割句子已儲存至: ${path.basename(result.splitOutputFile)}`);
    console.log(`短句數量: ${result.shortCount}`);
    console.log(`短句已儲存至: ${path.basename(result.shortOutputFile)}`);
  }
}

main(); 