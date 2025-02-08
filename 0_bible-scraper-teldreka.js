const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

// 設定基本參數
const BASE_URL = 'https://cb.fhl.net/read1.php';
const DELAY = 1000;  // 請求間隔時間（毫秒）

// 定義語言版本
const langCode = {
    "VERSION28=wanshandia": "萬山魯凱語馬可福音",
    "VERSION29=maolindia": "茂林魯凱語馬可福音",
    "VERSION30=tonadia": "多納魯凱語馬可福音"
};

// 緩存相關函數
function getCacheDir() {
    const cacheDir = path.join(__dirname, 'cache');
    if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir);
    }
    return cacheDir;
}

function getCacheKey(language, chapter) {
    return `${language}_可_${chapter}`;
}

function getCachePath(cacheKey) {
    return path.join(getCacheDir(), `${cacheKey}.html`);
}

function getFromCache(language, chapter) {
    const cacheKey = getCacheKey(language, chapter);
    const cachePath = getCachePath(cacheKey);
    
    if (fs.existsSync(cachePath)) {
        return fs.readFileSync(cachePath, 'utf-8');
    }
    return null;
}

function saveToCache(language, chapter, content) {
    const cacheKey = getCacheKey(language, chapter);
    const cachePath = getCachePath(cacheKey);
    fs.writeFileSync(cachePath, content);
}

// 延遲函數
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// 建立 URL 並返回參數信息
function buildUrl(chapter, langVersion) {
    const [langKey, langValue] = langVersion.split('=');
    const params = new URLSearchParams({
        chineses: '可',  // 馬可福音的代碼
        chap: chapter,
        [langKey]: langValue,
        sub1: '閱讀'
    });

    return {
        url: `${BASE_URL}?${params.toString()}`,
        language: langVersion,
        chapter: chapter
    };
}

// 抓取頁面內容
async function fetchPage(urlInfo) {
    try {
        // 檢查緩存
        const cachedContent = getFromCache(urlInfo.language, urlInfo.chapter);
        if (cachedContent) {
            console.log(`使用緩存: ${urlInfo.language} 第 ${urlInfo.chapter} 章`);
            return cachedContent;
        }

        // 如果沒有緩存，則抓取頁面
        console.log(`抓取頁面: ${urlInfo.language} 第 ${urlInfo.chapter} 章`);
        const response = await axios.get(urlInfo.url);
        const content = response.data;

        // 儲存到緩存
        saveToCache(urlInfo.language, urlInfo.chapter, content);
        return content;
    } catch (error) {
        console.error('抓取頁面失敗：', error.message);
        return null;
    }
}

// 解析 HTML 取得所有經文內容
function parseHtml(html) {
    const $ = cheerio.load(html);
    const verses = {};
    let currentVerse = null;
    let verseContent = '';

    // 遍歷所有經文區塊
    $('b, span.nor, span.bstwre').each((_, element) => {
        const el = $(element);
        
        if (el.is('b')) {
            // 如果有前一節的內容，先儲存
            if (currentVerse) {
                verses[currentVerse] = verseContent.trim();
            }
            
            // 開始新的一節
            currentVerse = el.text();
            verseContent = '';
        } else if (el.is('span.nor') || el.is('span.bstwre')) {
            // 收集經文內容
            verseContent += el.text().trim().replace(/\s+/g, ' ') + ' ';
        }
    });

    // 儲存最後一節
    if (currentVerse) {
        verses[currentVerse] = verseContent.trim();
    }

    return verses;
}

// 抓取單一章節的所有語言版本
async function fetchChapter(chapter) {
    const verses = [];
    
    // 取得該章所有經節
    for (let verse = 1; verse <= 45; verse++) { // 馬可福音最長的章節有45節
        const reference = `馬可福音${chapter}:${verse}`;
        const verseResult = {
            reference: reference,
            translations: {}
        };

        for (const [langKey, langName] of Object.entries(langCode)) {
            // 建立 URL 和參數信息
            const urlInfo = buildUrl(chapter, langKey);
            
            // 等待延遲
            await delay(DELAY);
            
            // 抓取頁面
            console.log(`正在抓取 ${reference} - ${langName}`);
            const pageContent = await fetchPage(urlInfo);
            
            if (pageContent) {
                const allVerses = parseHtml(pageContent);
                const verseKey = `${chapter}:${verse}`;
                if (allVerses[verseKey]) {
                    verseResult.translations[langName] = allVerses[verseKey];
                }
            } else {
                console.error(`錯誤：無法抓取 ${reference} - ${langName}`);
            }
        }

        // 只有當有經文內容時才加入結果
        if (Object.keys(verseResult.translations).length > 0) {
            verses.push(verseResult);
        }
    }

    return verses;
}

// 主程式
async function main() {
    const results = [];
    const totalChapters = 16; // 馬可福音共16章
    
    for (let chapter = 1; chapter <= totalChapters; chapter++) {
        const chapterVerses = await fetchChapter(chapter);
        results.push(...chapterVerses);
        console.log(`完成第 ${chapter} 章\n`);
    }

    // 所有章節處理完後才儲存一次
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    await fs.promises.writeFile(
      `bible-verses-teldreka-${timestamp}.json`,
      JSON.stringify(results, null, 2),
        'utf8'
    );

    console.log('\n=== 完整結果已儲存 ===\n');
}

// 執行主程式
if (require.main === module) {
    main().catch(console.error);
} 