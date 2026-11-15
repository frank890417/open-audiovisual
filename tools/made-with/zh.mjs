// /zh/made-with/ 的字串，繁體中文。結構要跟 en.mjs 一個鍵對一個鍵（不一樣 tools/build-made-with.mjs 不會建置）。
// 作品本身是資料：made-with/works.json。

export default {
  meta: {
    title: '用 open-audiovisual 做的｜跑在它上面的作品、工具與課程',
    description: '用 open-audiovisual 做的演出、裝置、工具與課程，每一筆都是作者自己加上來的。怎麼加上你的、徽章，以及一個頁面怎麼在不送出任何東西的情況下說出自己用了什麼。',
    ogDescription: '跑在 open-audiovisual 上的作品、工具與課程，還有怎麼把你的加進來。',
    crumb: '用它做的',
  },
  hero: {
    eyebrow: '用它做的',
    title: '跑在它上面的',
    lede: '用 open-audiovisual 做的演出、裝置、工具與課程。每一筆都是作者自己加上來的。清單從框架的出處開始：它是從這幾件作品裡抽出來的。',
    count: { one: '{n} 筆', many: '{n} 筆' },
  },
  kinds: { performance: '演出', installation: '裝置', sketch: '草圖', tool: '工具', teaching: '課程', other: '作品' },
  by: '作者',
  usesLabel: '用到',
  add: {
    title: '加上你的',
    lede: 'OpenProcessing 上貼了那一行的草圖算。只用了一個套件的演出也算。',
    steps: [
      '到 GitHub 開 <a href="{issue}">「我做了這個」表單</a>，填標題、你的名字、一個連結和一兩句話，我們把它加上來。',
      '或是自己改 <a href="{file}"><code>made-with/works.json</code></a> 再開 pull request：一件作品一個物件，欄位就是檔案裡看到的那些。',
    ],
    note: '一筆就是一個連結加幾句話。我們不存放你的任何檔案，作品還是你的。要改、要拿掉，隨時用同樣的方式說一聲。',
  },
  badge: {
    title: '徽章',
    lede: '想讓你的頁面說出來，把這段貼在放致謝的地方：',
    alt: 'Built with open-audiovisual',
  },
  tell: {
    title: '一個頁面怎麼說出自己用了什麼',
    body: [
      '用 <code>createShow()</code> 開演的頁面，會在頁面裡放一個標籤：<code>&lt;meta name="generator" content="open-audiovisual {version}"&gt;</code>。WordPress 和 Hugo 留的也是這種標籤。它不會把任何東西送到任何地方，是給檢視原始碼的人看的，也讓公開網頁的搜尋與普查認得出來。<code>createShow({ signature: false })</code> 就不放。',
      '另外，一場演出和嵌入的控制器各會送出一筆匿名紀錄，裡面只有所在網站的網址，沒有別的，<code>telemetry: false</code> 可以關掉。p5.js 的那一行預設什麼都不送，要你自己打開才會。<a href="{docs}">送什麼、絕對不送什麼、每一個開關</a>。',
    ],
  },
  links: { examples: '範例', docs: '文件', controllers: '控制器圖鑑' },
};
