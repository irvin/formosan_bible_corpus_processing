const fs = require('fs');
const path = require('path');
const { bookCode } = require('./0_聖經選句.js');

// 建立書卷順序對照表
const bookOrder = Object.fromEntries(
    Object.entries(bookCode).map(([book, code], index) => [book, index])
);

function readTSVFile(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n').filter(line => line.trim());
        return lines.map(line => {
            const [reference, text] = line.split('\t');
            return { reference, text };
        });
    } catch (error) {
        console.error(`讀取檔案 ${filePath} 時發生錯誤:`, error.message);
        return [];
    }
}

function getRandomElements(array, count) {
    const shuffled = [...array].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
}

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

function combineSentences(prefix) {
    const baseDir = __dirname;
    
    // 讀取所有檔案
    const normalShort = readTSVFile(path.join(baseDir, `${prefix}_normal_short.tsv`));
    const quotesShort = readTSVFile(path.join(baseDir, `${prefix}_quotes_short.tsv`));
    const normalSplit = readTSVFile(path.join(baseDir, `${prefix}_normal_split.tsv`));
    const quotesSplit = readTSVFile(path.join(baseDir, `${prefix}_quotes_split.tsv`));

    // 檢查必要檔案是否存在且有內容
    if (!normalShort.length || !quotesShort.length) {
        console.error(`錯誤：必要的短句檔案不存在或是空的`);
        process.exit(1);
    }

    // 檢查分割句檔案
    if (!normalSplit.length && !quotesSplit.length) {
        console.log(`警告：找不到分割句檔案或檔案為空`);
    }

    // 合併所有短句
    const allShortSentences = [...normalShort, ...quotesShort];

    // 合併所有分割句並隨機選擇100句（如果有的話）
    const allSplitSentences = [...normalSplit, ...quotesSplit];
    const randomSplitSentences = allSplitSentences.length > 0 
        ? getRandomElements(allSplitSentences, 100)
        : [];

    // 合併最終結果並按章節順序排序
    const finalSentences = [...allShortSentences, ...randomSplitSentences]
        .sort(compareReferences);

    // 建立輸出檔案路徑
    const outputPath = path.join(baseDir, `${prefix}_final.tsv`);

    // 寫入檔案
    const outputContent = finalSentences
        .map(item => `${item.reference}\t${item.text}`)
        .join('\n');
    
    fs.writeFileSync(outputPath, outputContent);

    return {
        shortCount: allShortSentences.length,
        splitCount: randomSplitSentences.length,
        totalCount: finalSentences.length,
        outputFile: outputPath
    };
}

// 主程式
function main() {
    const args = process.argv.slice(2);
    
    if (args.length < 1) {
        console.error('請提供檔名前綴！');
        console.error('使用方式：node 5_combine_sentences.js <檔名前綴>');
        console.error('例如：node 5_combine_sentences.js 布農語聖經');
        process.exit(1);
    }

    const prefix = args[0];
    
    console.log(`開始處理 ${prefix} 的句子...`);
    const result = combineSentences(prefix);
    
    console.log('\n處理完成！');
    console.log(`短句數量: ${result.shortCount}`);
    console.log(`隨機選擇的分割句數量: ${result.splitCount}`);
    console.log(`總句子數: ${result.totalCount}`);
    console.log(`結果已儲存至: ${path.basename(result.outputFile)}`);
}

main(); 