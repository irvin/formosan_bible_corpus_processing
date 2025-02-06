/*
網址範例： 
https://cb.fhl.net/read1.php?VERSION13=rcuv&VERSION24=bunun&VERSION16=amis2&VERSION4=ams&VERSION15=sed&VERSION3=rukai&VERSION14=tru&VERSION23=tay&TABFLAG=0&chineses=%E8%A9%A9&chap=1&submit1=%E9%96%B1%E8%AE%80
https://cb.fhl.net/read1.php?chineses=%E8%A9%A9&chap=1&VERSION5=rcuv&VERSION10=sed&VERSION11=amis2&VERSION12=ams&VERSION22=bunun&VERSION24=tay&VERSION26=tru&sub1=%E7%89%88%E6%9C%AC%E5%B0%8D%E7%85%A7
https://cb.fhl.net/read1.php?chineses=%E5%BC%97&chap=3&VERSION27=rukai&sub1=%E7%89%88%E6%9C%AC%E5%B0%8D%E7%85%A7
以弗所書 https://cb.fhl.net/read1.php?VERSION24=bunun&chineses=弗&chap=3

網址結構： https://cb.fhl.net/read1.php?chineses={bookCode}&chap={chapter}&{langCode}&sub1=閱讀

 chapList 的第一個數字是 chapter，第二個數字是 verse

 網頁中的表現方式是： 
 <b>3:2</b> <span class="nor"> 因為它們( [ 3.2] 「它們」指「教誨」和「命令」。)必加給你長久的日子，
  <br/>生命的年數與平安。
  <br/></span><br/>
  <b>3:3</b> <span class="nor"> 不可使慈愛和誠信離開你，
  <br/>要繫在你頸項上，刻在你心版上。
  <br/></span><br/>
  <b>3:4</b> <span class="nor"> 這樣，你必在上帝和世人眼前
  <br/>蒙恩惠，有美好的見識。
  <br/></span><br/>
  <b>3:5</b> <span class="nor"> 你要專心仰賴耶和華，
  <br/>不可倚靠自己的聰明，
  <br/></span><br/>
  <b>3:6</b> <span class="nor"> 在你一切所行的路上都要認定他，
  <br/>他必使你的道路平直。
  <br/></span><br/>

  要抓取的是本 chapter:verse 到下一個 chapter:verse 的文本內容
*/


const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const { langCode, bookCode, chapList } = require('./0_聖經選句.js');

// 設定基本參數
const BASE_URL = 'https://cb.fhl.net/read1.php';
const DELAY = 1000;  // 請求間隔時間（毫秒）

// 添加緩存相關函數
function getCacheDir() {
    const cacheDir = path.join(__dirname, 'cache');
    if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir);
    }
    return cacheDir;
}

function getCacheKey(language, book, chapter) {
    return `${language}_${book}_${chapter}`;
}

function getCachePath(cacheKey) {
    return path.join(getCacheDir(), `${cacheKey}.html`);
}

function getFromCache(language, book, chapter) {
    const cacheKey = getCacheKey(language, book, chapter);
    const cachePath = getCachePath(cacheKey);
    
    if (fs.existsSync(cachePath)) {
        return fs.readFileSync(cachePath, 'utf-8');
    }
    return null;
}

function saveToCache(language, book, chapter, content) {
    const cacheKey = getCacheKey(language, book, chapter);
    const cachePath = getCachePath(cacheKey);
    fs.writeFileSync(cachePath, content);
}

// 延遲函數
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// 將章節資料轉換為結構化資料
function parseVerse(verseStr) {
    const [bookName, chapterVerse] = verseStr.split(/(\d+:\d+)$/);
    const [chapter, verse] = chapterVerse.split(':');
    return {
        bookName: bookName.trim(),
        bookCode: bookCode[bookName.trim()],
        chapter: parseInt(chapter),
        verse: parseInt(verse)
    };
}

// 建立 URL 並返回參數信息
function buildUrl(bookCode, chapter, langVersion) {
    const [langKey, langValue] = langVersion.split('=');
    const params = new URLSearchParams({
        chineses: bookCode,
        chap: chapter,
        [langKey]: langValue,
        sub1: '閱讀'
    });

    return {
        url: `${BASE_URL}?${params.toString()}`,
        language: langVersion,
        book: bookCode,
        chapter: chapter
    };
}

// 抓取頁面內容
async function fetchPage(url) {
    try {
        const urlInfo = url;  // 現在 url 參數實際上是包含所有信息的對象

        // 檢查緩存
        const cachedContent = getFromCache(urlInfo.language, urlInfo.book, urlInfo.chapter);
        if (cachedContent) {
            console.log(`使用緩存: ${urlInfo.language} ${urlInfo.book} ${urlInfo.chapter}`);
            return cachedContent;
        }

        // 如果沒有緩存，則抓取頁面
        console.log(`抓取頁面: ${urlInfo.language} ${urlInfo.book} ${urlInfo.chapter}`);
        const response = await axios.get(urlInfo.url);
        const content = response.data;

        // 儲存到緩存
        saveToCache(urlInfo.language, urlInfo.book, urlInfo.chapter, content);
        return content;
    } catch (error) {
        console.error('抓取頁面失敗：', error.message);
        return null;
    }
}

// 解析 HTML 取得經文內容
function parseHtml(html, targetVerse) {
    const $ = cheerio.load(html);
    let verses = [];
    let isTargetFound = false;
    let verseContent = '';

    // 遍歷所有經文區塊
    $('b, span.nor, span.bstwre').each((_, element) => {
        const el = $(element);
        
        if (el.is('b')) {
            // 找到章節標記
            const verseNum = el.text();
            if (verseNum === `${targetVerse.chapter}:${targetVerse.verse}`) {
                isTargetFound = true;
            } else if (isTargetFound) {
                // 找到下一個章節，結束收集
                return false;
            }
        } else if (isTargetFound && (el.is('span.nor') || el.is('span.bstwre'))) {
            // 收集經文內容
            verseContent += el.text().trim().replace(/\s+/g, ' ');
        }
    });

    return verseContent;
}

// 抓取單一章節的所有語言版本
async function fetchVerse(verseStr) {
    const verseInfo = parseVerse(verseStr);
    const results = {
        reference: verseStr,
        translations: {}
    };

    // 定義只有馬可福音的語言版本
    const markOnlyVersions = [
        'VERSION28=wanshandia',  // 萬山魯凱語馬可福音
        'VERSION29=maolindia',   // 茂林魯凱語馬可福音
        'VERSION30=tonadia'      // 多納魯凱語馬可福音
    ];

    for (const [langKey, langName] of Object.entries(langCode)) {
        // 如果是只有馬可福音的版本，且不是馬可福音，則跳過
        if (markOnlyVersions.includes(langKey) && verseInfo.bookName !== '馬可福音') {
            console.log(`跳過 ${langName}，因為只有馬可福音`);
            continue;
        }

        // 建立 URL 和參數信息
        const urlInfo = buildUrl(verseInfo.bookCode, verseInfo.chapter, langKey);
        
        // 等待延遲
        await delay(DELAY);
        
        // 抓取頁面
        console.log(`正在抓取 ${verseStr} - ${langName}`);
        const pageContent = await fetchPage(urlInfo);
        
        if (pageContent) {
            const verseContent = parseHtml(pageContent, verseInfo);
            if (verseContent) {
                results.translations[langName] = verseContent;
            }
        } else {
            console.error(`錯誤：無法抓取 ${verseStr} - ${langName}`);
            console.error(`URL: ${urlInfo.url}`);
        }
    }

    return results;
}

// 主程式
async function main() {
    const results = [];
    
    for (const verse of chapList) {
        const verseResult = await fetchVerse(verse);
        results.push(verseResult);
        console.log(`完成 ${verse}\n`);

        // 每次抓取完一節就儲存一次
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        await fs.promises.writeFile(
            `bible-verses-${timestamp}.json`,
            JSON.stringify(results, null, 2),
            'utf8'
        );
    }

    console.log('\n=== 完整結果已儲存 ===\n');
}

// 執行主程式
if (require.main === module) {
    main().catch(console.error);
}
