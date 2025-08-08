// ========== チャート機能 ==========================================================

function updateChart() {

  const chartPlaceholder = document.getElementById('chartPlaceholder');
  const chartCanvas = document.getElementById('trendChart');
  const chartLegend = document.getElementById('chartLegend');



  const activeKeywords = Object.values(keywordManager.keywords).filter(k => k.tweets && k.tweets.length > 0);



  if (activeKeywords.length === 0) {
    chartPlaceholder.style.display = 'block';
    chartCanvas.style.display = 'none';
    chartLegend.style.display = 'none';
    return;
  }

  addLogEntry('ツイートデータが見つかりました。チャートを表示します', 'success');
  chartPlaceholder.style.display = 'none';
  chartCanvas.style.display = 'block';
  chartLegend.style.display = 'flex';

  // 凡例を更新
  updateChartLegend(activeKeywords);

  // グラフデータを準備
  let chartType = document.getElementById('chartType').value;

  // 自動判定: 1日分のデータの場合は時間別を優先
  if (chartType === 'daily') {
    const allTweets = activeKeywords.flatMap(k => k.tweets || []);
    const uniqueDates = new Set();
    allTweets.forEach(tweet => {
      const timestamp = tweet.created_at || tweet.timestamp;
      if (timestamp) {
        const date = new Date(timestamp);
        if (!isNaN(date.getTime())) {
          const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
          uniqueDates.add(dateKey);
        }
      }
    });

    if (uniqueDates.size === 1) {
      chartType = 'hourly';
      document.getElementById('chartType').value = 'hourly';
    }
  }

  const chartData = prepareChartData(activeKeywords, chartType);

  // シンプルなCanvasグラフを描画

  drawSimpleChart(chartCanvas, chartData, activeKeywords);

}

function updateChartLegend(keywords) {
  const legend = document.getElementById('chartLegend');

  legend.innerHTML = keywords.map((keyword, index) => {
    const keywordNumber = Object.keys(keywordManager.keywords).indexOf(keyword.id) + 1;
    return `
      <div class="legend-item">
        <div class="legend-color legend-color-${keywordNumber}"></div>
        <span>キーワード ${keywordNumber}: ${keyword.text} (${keyword.stats.totalTweets}件)</span>
      </div>
    `;
  }).join('');
}

function refreshChart() {
  updateChart();
  addLogEntry('チャートを手動で更新しました', 'info');
}

function toggleChartValues() {
  showChartValues = !showChartValues;
  const btn = document.getElementById('toggleValuesBtn');
  if (showChartValues) {
    btn.innerHTML = '<span>🔢</span>数値表示';
    btn.style.background = '#1da1f2';
    btn.style.color = '#ffffff';
  } else {
    btn.innerHTML = '<span>🔢</span>数値非表示';
    btn.style.background = '#536471';
    btn.style.color = '#ffffff';
  }
  updateChart(); // グラフを再描画
  addLogEntry(`データポイント数値表示を${showChartValues ? '有効' : '無効'}にしました`, 'info');
}

