const VACANCY_URL = "https://hotelcalendarstorage.blob.core.windows.net/results/vacancy.json";

// ページロード時
document.addEventListener("DOMContentLoaded", async () => {
  const res = await fetch(VACANCY_URL);
  const data = await res.json();

  // 今日から翌月末までの日付リスト
  const today = new Date();
  const end = new Date(today.getFullYear(), today.getMonth() + 2, 0); // 翌月末

  let dates = [];
  for (let d = new Date(today); d <= end; d.setDate(d.getDate() + 1)) {
    dates.push(d.toISOString().split("T")[0]);
  }

  // カレンダー描画
  const calEl = document.getElementById("calendar");
  dates.forEach(date => {
    const btn = document.createElement("button");
    btn.className = "date-btn";
    btn.textContent = date.slice(5); // MM-DD 表示
    btn.onclick = () => showPlans(data, date, btn);
    calEl.appendChild(btn);
  });

  // 最初は今日を表示
  showPlans(data, today.toISOString().split("T")[0], calEl.querySelector("button"));
});

// プラン描画
function showPlans(data, date, btn) {
  // ボタン選択状態更新
  document.querySelectorAll(".date-btn").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");

  const plansEl = document.getElementById("plans");
  plansEl.innerHTML = `<h2>${date} の空室</h2>`;

  for (const hotelNo in data) {
    const hotelPlans = data[hotelNo][date];
    if (!hotelPlans) continue;

    hotelPlans.forEach(p => {
      const div = document.createElement("div");
      div.className = "plan-card";
      div.innerHTML = `
        <h3>${p.hotelName}</h3>
        <p>${p.planName}</p>
        ${p.available ? `<a href="${p.url}" target="_blank">予約ページ</a>` : "満室"}
      `;
      plansEl.appendChild(div);
    });
  }
}
