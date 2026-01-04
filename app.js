// ====== 設定（ここを書き換えてください） ======
const CONFIG = {
  VACANCY_JSON_URL: 'https://hotelcalendarstorage.blob.core.windows.net/results/vacancy.json',
  HOTELS_JSON_URL: 'https://hotelcalendarstorage.blob.core.windows.net/config/hotelNos.json',
  FALLBACK_LOCAL: true,
  MONTHS_AHEAD: 5, // 表示する月数（今月含む）
};

// （任意）クエリで上書き：?vacancy=...&hotels=...
(() => {
  const u = new URL(location.href);
  if (u.searchParams.get('vacancy')) CONFIG.VACANCY_JSON_URL = u.searchParams.get('vacancy');
  if (u.searchParams.get('hotels'))  CONFIG.HOTELS_JSON_URL   = u.searchParams.get('hotels');
})();

// 名前と略称のフォールバック（hotels.jsonに無い場合に使用）
const HOTEL_NAME_MAP = {
  "189000": "ファンタジースプリングスホテル",
  "74733":  "ミラコスタ",
  "183493": "トイストーリーホテル",
  "74732":  "ディズニーランドホテル",
  "72737":  "アンバサダーホテル",
  "151431":  "セレブレーションホテル",
};
const HOTEL_ABBR_MAP = {
  "181695":"APA","183493":"TSH","74733":"MIR","189000":"FSH","74732":"DLH"
};

// ユーティリティ
const fmt = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};
const addDays = (d, n) => { const x=new Date(d); x.setDate(x.getDate()+n); return x; };
const addMonths = (d, n) => {
  const x = new Date(d);
  x.setMonth(x.getMonth() + n);
  return x;
};
const lastDayOfMonth = (d) => {
  const x = new Date(d);
  x.setMonth(x.getMonth() + 1, 0);
  return x;
};
const weekday = ["日","月","火","水","木","金","土"];
const isWeekend = (d) => d.getDay()===0 || d.getDay()===6;

// 状態
let hotels = [];
let vacancy = {};
let dateList = [];
let selectedDate = null;

async function safeFetch(url){
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function loadJSON(){
  // hotels.json
  let hotelsData;
  try {
    hotelsData = await safeFetch(CONFIG.HOTELS_JSON_URL);
  } catch (e) {
    if (CONFIG.FALLBACK_LOCAL) {
      try { hotelsData = await safeFetch('./hotels.json'); } catch(e2){ throw e; }
    } else { throw e; }
  }

  const list = [];
  if (Array.isArray(hotelsData.hotels)) {
    for (const no of hotelsData.hotels) {
      const s = String(no);
      list.push({ no:s, name:HOTEL_NAME_MAP[s]||s, abbr:HOTEL_ABBR_MAP[s]||s });
    }
  } else if (hotelsData.hotels && typeof hotelsData.hotels === 'object') {
    for (const [no, info] of Object.entries(hotelsData.hotels)) {
      list.push({
        no: String(no),
        name: info.name || HOTEL_NAME_MAP[no] || String(no),
        abbr: info.abbr || HOTEL_ABBR_MAP[no] || String(no)
      });
    }
  } else {
    for (const no of Object.keys(HOTEL_NAME_MAP)) {
      list.push({ no, name: HOTEL_NAME_MAP[no], abbr: HOTEL_ABBR_MAP[no]||no });
    }
  }
  hotels = list;

  // vacancy.json
  try {
    vacancy = await safeFetch(CONFIG.VACANCY_JSON_URL);
  } catch (e) {
    if (CONFIG.FALLBACK_LOCAL) {
      try { vacancy = await safeFetch('./vacancy.json'); } catch(e2){ throw e; }
    } else { throw e; }
  }
}

function buildDates(){
  const today = new Date(); 
  today.setHours(0,0,0,0);
  
  // 今月の最終日から5ヶ月先の月末まで
  const endMonth = addMonths(today, CONFIG.MONTHS_AHEAD);
  const end = lastDayOfMonth(endMonth);
  
  const out = [];
  for (let d=new Date(today); d<=end; d=addDays(d,1)) {
    out.push(new Date(d));
  }
  dateList = out;
  selectedDate = fmt(today);
}

function renderCalendar(){
  const headerRow = document.getElementById('calHeaderRow');
  const body = document.getElementById('calBody');
  headerRow.innerHTML = '<th class="sticky first empty" aria-hidden="true"></th>';
  
  // ヘッダに月と日を追加
  let currentMonth = null;
  let monthColspan = 0;
  const monthHeaders = [];
  
  for (let i = 0; i < dateList.length; i++) {
    const d = dateList[i];
    const month = `${d.getFullYear()}/${d.getMonth() + 1}`;
    
    if (month !== currentMonth) {
      if (currentMonth !== null) {
        monthHeaders.push({ month: currentMonth, colspan: monthColspan });
      }
      currentMonth = month;
      monthColspan = 1;
    } else {
      monthColspan++;
    }
  }
  if (currentMonth !== null) {
    monthHeaders.push({ month: currentMonth, colspan: monthColspan });
  }
  
  // 月行を作成
  const monthRow = document.createElement('tr');
  monthRow.className = 'month-row';
  const emptyTh = document.createElement('th');
  emptyTh.className = 'sticky first empty';
  emptyTh.rowSpan = 2;
  monthRow.appendChild(emptyTh);
  
  for (const mh of monthHeaders) {
    const th = document.createElement('th');
    th.colSpan = mh.colspan;
    th.className = 'month-header';
    th.textContent = mh.month;
    monthRow.appendChild(th);
  }
  
  // 日行を作成
  const dayRow = document.createElement('tr');
  dayRow.className = 'day-row';
  
  for (const d of dateList) {
    const th = document.createElement('th');
    const day = d.getDate();
    const w = weekday[d.getDay()];
    th.textContent = `${day}(${w})`;
    if (d.getDay()===6) th.classList.add('weekend-sat');
    if (d.getDay()===0) th.classList.add('weekend-sun');
    if (fmt(d) === selectedDate) th.classList.add('today');
    dayRow.appendChild(th);
  }
  
  // ヘッダを追加
  const thead = headerRow.parentElement;
  thead.innerHTML = '';
  thead.appendChild(monthRow);
  thead.appendChild(dayRow);
  
  // 本体
  body.innerHTML = '';
  for (const h of hotels) {
    const tr = document.createElement('tr');
    const th = document.createElement('th');
    th.className = 'first sticky';
    th.innerHTML = `${h.abbr}<small>${h.name}</small>`;
    tr.appendChild(th);

    for (const d of dateList) {
      const td = document.createElement('td');
      if (d.getDay()===6) td.classList.add('weekend-sat');
      if (d.getDay()===0) td.classList.add('weekend-sun');
      if (fmt(d) === selectedDate) td.classList.add('today');

      const btn = document.createElement('button');
      btn.className = 'cell-btn';
      const has = hasAvail(h.no, fmt(d));
      btn.textContent = has ? '○' : '×';
      btn.classList.add(has ? 'ok':'ng');
      if (!has) btn.disabled = false;
      btn.addEventListener('click', () => {
        selectDate(fmt(d));
        document.getElementById('plans').scrollIntoView({ behavior:'smooth', block:'start' });
      });
      td.appendChild(btn);
      tr.appendChild(td);
    }
    body.appendChild(tr);
  }

  scrollToToday();
}

function scrollToToday(){
  const wrap = document.querySelector('.calendar-wrap');
  const idx = dateList.findIndex(d => fmt(d)===selectedDate);
  if (idx <= 0) return;
  const colWidth = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--cell'),10) || 44;
  wrap.scrollLeft = idx * (colWidth+1);
}

function hasAvail(hotelNo, ymd){
  const d = vacancy?.[hotelNo]?.[ymd];
  if (!Array.isArray(d)) return false;
  return d.some(x => x && x.available === true);
}

function collectPlansFor(ymd) {
  const list = [];
  for (const h of hotels) {
    const items = vacancy?.[h.no]?.[ymd];
    if (!Array.isArray(items)) continue;

    const plans = items
      .filter(it => it.available)
      .map(it => ({
        hotelNo: h.no,
        hotelName: it.hotelName || h.name,
        planName: it.planName || '(プラン名不明)',
        url: it.url || '',
      }));

    if (plans.length) {
      list.push({ hotel: h, plans });
    }
  }
  return list;
}

function renderPlans() {
  const elTitle = document.getElementById('plansTitle');
  const elList = document.getElementById('plansList');
  elTitle.textContent = `選択日：${selectedDate}`;

  const hotelPlans = collectPlansFor(selectedDate);
  elList.innerHTML = '';

  if (!hotelPlans.length) {
    const div = document.createElement('div');
    div.className = 'empty';
    div.textContent = 'この日は空室が見つかりませんでした。';
    elList.appendChild(div);
    return;
  }

  for (const hp of hotelPlans) {
    const section = document.createElement('section');
    section.className = 'hotel-section';
    section.innerHTML = `<h3>${hp.hotel.name} - ${selectedDate}</h3>`;

    const scroll = document.createElement('div');
    scroll.className = 'plan-scroll';

    for (const p of hp.plans) {
      const card = document.createElement('div');
      card.className = 'plan-card';
      card.innerHTML = `
        <div class="pn">${escapeHTML(p.planName)}</div>
        <div class="actions">
          <a class="link" href="${p.url}" target="_blank" rel="noopener">楽天で予約</a>
        </div>
      `;
      scroll.appendChild(card);
    }

    section.appendChild(scroll);
    elList.appendChild(section);
  }
}

function escapeHTML(s){
  return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

function moveDay(delta){
  const idx = dateList.findIndex(d => fmt(d)===selectedDate);
  if (idx < 0) return;
  const next = dateList[idx + delta];
  if (!next) return;
  selectDate(fmt(next));
  document.getElementById('calendar-section').scrollIntoView({ behavior:'smooth' });
  document.getElementById('plans').scrollIntoView({ behavior:'smooth' });
}

function selectDate(ymd){
  selectedDate = ymd;
  document.querySelectorAll('th.today, td.today').forEach(el => el.classList.remove('today'));
  const dayRow = document.querySelector('.day-row');
  const idx = dateList.findIndex(d => fmt(d)===ymd);
  if (idx >= 0 && dayRow) dayRow.children[idx]?.classList.add('today');
  
  document.querySelectorAll('#calBody tr').forEach(tr => {
    const td = tr.children[idx+1];
    if (td) td.classList.add('today');
  });
  renderPlans();
  scrollToToday();
}

document.getElementById('btnToday').addEventListener('click', () => {
  const today = fmt(new Date());
  selectDate(today);
  document.getElementById('calendar-section').scrollIntoView({ behavior:'smooth' });
});
document.getElementById('btnPrevDay').addEventListener('click', () => moveDay(-1));
document.getElementById('btnNextDay').addEventListener('click', () => moveDay(1));

(async function init(){
  try{
    await loadJSON();
    buildDates();
    renderCalendar();
    renderPlans();
  }catch(e){
    console.error(e);
    alert('データの読み込みに失敗しました。JSONのURLまたはCORS設定をご確認ください。');
  }
})();
