const fs = require('fs');
const { bookCode } = require('./0_聖經選句.js');

// 建立書卷順序對照表
const bookOrder = Object.fromEntries(
  Object.entries(bookCode).map(([book, code], index) => [book, index])
);

// 解析聖經章節參考
function parseReference(reference) {
  // 分離書卷名稱和章節
  const match = reference.match(/^(.+?)(\d+):(\d+)$/);
  if (!match) return { book: reference, chapter: 0, verse: 0 };
  
  const [, book, chapter, verse] = match;
  return {
    book,
    chapter: parseInt(chapter),
    verse: parseInt(verse)
  };
}

// 比較兩個章節的順序
function compareReferences(a, b) {
  const refA = parseReference(a.reference);
  const refB = parseReference(b.reference);
  
  // 先比較書卷名稱（使用 bookOrder 的順序）
  const orderA = bookOrder[refA.book] ?? Number.MAX_SAFE_INTEGER;
  const orderB = bookOrder[refB.book] ?? Number.MAX_SAFE_INTEGER;
  if (orderA !== orderB) return orderA - orderB;
  
  // 再比較章
  if (refA.chapter !== refB.chapter) return refA.chapter - refB.chapter;
  
  // 最後比較節
  return refA.verse - refB.verse;
}

function processVerses(inputFile) {
  // 讀取 JSON 檔案
  const data = JSON.parse(fs.readFileSync(inputFile, 'utf-8'));
  
  // 建立語言對應的資料結構
  const languageData = {};
  
  // 處理每一個經文
  data.forEach(verse => {
    const reference = verse.reference;
    const translations = verse.translations;
    
    // 處理每種語言的翻譯
    Object.entries(translations).forEach(([language, text]) => {
      if (!languageData[language]) {
        languageData[language] = [];
      }
      
      // 移除句尾的句點和逗點
      const cleanText = text.replace(/[。，,\.]+$/, '');
      
      // 儲存參考編號和經文內容
      languageData[language].push({
        reference,
        text: cleanText
      });
    });
  });
  
  // 為每種語言建立 TSV 檔案
  Object.entries(languageData).forEach(([language, verses]) => {
    // 先對經文進行排序
    verses.sort(compareReferences);
    
    // 建立 TSV 內容（參考編號 \t 經文內容）
    const tsvContent = verses
      .map(verse => `${verse.reference}\t${verse.text}`)
      .join('\n');
    
    // 建立檔案名稱（移除可能的特殊字元）
    const fileName = `${language.replace(/[\/\\?%*:|"<>]/g, '_')}.tsv`;
    
    // 寫入檔案
    fs.writeFileSync(fileName, tsvContent);
    console.log(`已建立 ${fileName}`);
  });
}

// 取得命令列參數
const inputFile = process.argv[2];

// 檢查是否提供檔案路徑
if (!inputFile) {
  console.error('請提供輸入檔案路徑！');
  console.error('使用方式: node process-verses.js <輸入JSON檔案路徑>');
  process.exit(1);
}

// 檢查檔案是否存在
if (!fs.existsSync(inputFile)) {
  console.error('找不到指定的檔案：', inputFile);
  process.exit(1);
}

try {
  processVerses(inputFile);
  console.log('處理完成！');
} catch (error) {
  console.error('處理檔案時發生錯誤：', error.message);
  process.exit(1);
} 