// ====== 設定（環境に合わせて必要なら修正） ======
const HOTELS_JSON_URL   = "https://hotelcalendarstorage.blob.core.windows.net/config/hotelNos.json";
const VACANCY_JSON_URL  = "https://hotelcalendarstorage.blob.core.windows.net/results/vacancy.json";

// 省略名（UIでチップに表示）
const HOTEL_ABBR_MAP = {
  "74732": "DLH", // ディズニーランドホテル
  "74733": "MIR", // ミラコスタ
  "183493": "TSH", // トイストーリーホテル
  "189000": "FSH", // ファンタジースプリングスホテル
  "181695": "APA"  // アパホテル〈品川戸越駅前〉
};

// 最終フォールバック（vacancy.json内に名前が見つからない時だけ使用）
const HOTEL_NAME_FALLBACK = {
  "181695": "アパホテル〈品川戸越駅前〉",
  "183493": "トイストーリーホテル",
  "74733":  "ミラコスタ",
  "189000": "ファンタジースプリングスホテル",
  "74732":  "ディズニーランドホテル"
};

// ====== ユーティリティ ======
function fmtJP(dateStr) {
  // "2025-08-21" -> "8/21(木)"
  const d = new Date(dateStr + "T09:00:00"); // JSTずれ対策
  const w = "日月火水木金土"[d.getDay()];
  return `${d.getMonth()+1}/${d.getDate()}(${w})`;
}

function sortDateKeys(keys) {
  return keys.slice().sort((a,b)=> new Date(a) - new Date(b));
}

// vacancy.json からホテル名を抽出（最優先の取得方法）
function deriveNameFromVacancy(hotelNo, vacancyObj) {
  const dayMap = vacancyObj[hotelNo];
  if (!dayMap || typeof dayMap !== "object") return null;

  // どれか1日の配列から hotelName を拾う
  for (const date of Object.keys(dayMap)) {
    const arr = dayMap[date];
    if (Array.isArray(arr)) {
      for (const rec of arr) {
        if (rec && typeof rec.hotelName === "string" && rec.hotelName.trim().length) {
          return rec.hotelName.trim();
        }
      }
    }
  }
  return null;
}

function getAvailableDates(hotelNo, vacancyObj) {
  const dayMap = vacancyObj[hotelNo] || {};
  const out = [];
  for (const [date, arr] of Object.entries(dayMap)) {
    if (Array.isArray(arr) && arr.some(x => x && x.available === true)) {
      out.push(date);
    }
  }
  return sortDateKeys(out);
}

function getFirstPlanUrl(hotelNo, vacancyObj) {
  const dayMap = vacancyObj[hotelNo] || {};
  const sortedDates = sortDateKeys(Object.keys(dayMap));
  for (const dt of sortedDates) {
    const arr = dayMap[dt];
    if (!Array.isArray(arr)) continue;
    const hit = arr.find(x => x && x.available === true && typeof x.url === "string" && x.url.length);
    if (hit) return hit.url;
  }
  return null;
}

// ====== 描画 ======
function render(hotelsList, vacancyObj) {
  const container = document.getElementById("hotel-list");
  container.innerHTML = "";

  hotelsList.forEach(hotelNo => {
    const realName = deriveNameFromVacancy(hotelNo, vacancyObj)
                  || HOTEL_NAME_FALLBACK[hotelNo]
                  || `ホテルNo.${hotelNo}`;
    const abbr = HOTEL_ABBR_MAP[hotelNo] || hotelNo;

    const availDates = getAvailableDates(hotelNo, vacancyObj);
    const plansUrl   = getFirstPlanUrl(hotelNo, vacancyObj) || `https://travel.rakuten.co.jp/HOTEL/${hotelNo}/`;

    // バッジ
    const badgeHTML = availDates.length > 0
      ? `<span class="badge ok">空室あり</span>`
      : `<span class="badge ng">満室</span>`;

    // 日付並び（長すぎる場合は先頭10件まで）
    const datesHTML = availDates.length
      ? availDates.slice(0, 10).map(fmtJP).join("、") + (availDates.length > 10 ? " ほか" : "")
      : `<span class="empty">現在、空室は見つかりませんでした。</span>`;

    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <div class="card-head">
        <span class="abbr">${abbr}</span>
        <div class="name">${realName}</div>
      </div>
      <div class="badges">${badgeHTML}</div>
      <div class="dates">${datesHTML}</div>
      <div class="actions">
        <a class="link" target="_blank" rel="noopener" href="${plansUrl}">楽天で空室を見る</a>
      </div>
    `;

    container.appendChild(card);
  });
}

// ====== 初期ロード ======
(async function init() {
  const updatedEl = document.getElementById("last-updated");
  try {
    // 並列取得（キャッシュ回避クエリ付き）
    const [hotelsRes, vacancyRes] = await Promise.all([
      fetch(HOTELS_JSON_URL + "?t=" + Date.now()),
      fetch(VACANCY_JSON_URL  + "?t=" + Date.now())
    ]);

    if (!hotelsRes.ok) throw new Error("hotels.json の取得に失敗: " + hotelsRes.status);
    if (!vacancyRes.ok) throw new Error("vacancy.json の取得に失敗: " + vacancyRes.status);

    const hotelsJson  = await hotelsRes.json();        // { "hotels": ["183493","74733", ...] }
    const vacancyJson = await vacancyRes.json();       // { "74732": { "2025-08-20": [ ... ] }, ... }

    // hotels.json の並び順に表示
    const hotelNos = Array.isArray(hotelsJson.hotels) ? hotelsJson.hotels.map(String) : Object.keys(vacancyJson);

    render(hotelNos, vacancyJson);
    updatedEl.textContent = "最終更新: " + new Date().toLocaleString("ja-JP");
  } catch (e) {
    console.error(e);
    updatedEl.textContent = "読み込みエラーが発生しました";
    document.getElementById("hotel-list").innerHTML =
      `<div class="card"><div class="empty">データの取得に失敗しました。時間をおいて再度お試しください。</div></div>`;
  }
})();
