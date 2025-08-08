// ========== 影響力分析機能 ==========================================================

// レーダーチャートのスケールモード（'log' または 'linear'）
window.radarScaleMode = 'log';

// レーダーチャートの数値表示モード（true: 表示, false: 非表示）
window.radarShowValues = false;

// レーダーチャートのズームレベル（1.0 = 100%）
window.radarZoomLevel = 1.0;

// デバウンス用のタイマー
window.radarZoomDebounceTimer = null;

// レーダーチャートのズーム設定関数
window.setRadarZoom = function(level) {
  window.radarZoomLevel = Math.max(0.01, Math.min(100, level)); // 1%～10000%の範囲
  
  // ズームレベル表示を更新（比較モードと単一モード両方）
  const zoomDisplay = document.getElementById('radarZoomLevel');
  const zoomDisplaySingle = document.getElementById('radarZoomLevelSingle');
  const zoomPercentage = Math.round(window.radarZoomLevel * 100) + '%';
  
  if (zoomDisplay) {
    zoomDisplay.textContent = zoomPercentage;
  }
  if (zoomDisplaySingle) {
    zoomDisplaySingle.textContent = zoomPercentage;
  }
  
  // デバウンス処理：連続的なズーム操作を間引く
  if (window.radarZoomDebounceTimer) {
    clearTimeout(window.radarZoomDebounceTimer);
  }
  
  window.radarZoomDebounceTimer = setTimeout(() => {
    // 比較モードの場合は比較チャートを再描画
    if (window.influenceAnalysisState?.compareMode && window.influenceAnalysisState?.selectedUsers?.length > 0) {
      const userData = window.influenceAnalysisState.selectedUsers.map(username => ({
        username,
        tweets: window.influenceAnalysisState.userTweets[username] || [],
        stats: null
      }));
      updateComparisonRadarChart(userData);
      // エンゲージメントグラフの更新は重いので省略
    } else {
      // 単一モードの場合は単一チャートを再描画
      const singleUserSelector = document.getElementById('singleUserSelector');
      if (singleUserSelector && singleUserSelector.value && window.influenceAnalysisState?.userTweets) {
        const username = singleUserSelector.value;
        const tweets = window.influenceAnalysisState.userTweets[username];
        if (tweets) {
          // キャッシュされた統計があれば使用
          if (window.influenceAnalysisState.cachedStats && window.influenceAnalysisState.cachedUsername === username) {
            drawInfluenceRadarChart(window.influenceAnalysisState.cachedStats);
          } else {
            const stats = calculateInfluenceStats(tweets);
            window.influenceAnalysisState.cachedStats = stats;
            window.influenceAnalysisState.cachedUsername = username;
            drawInfluenceRadarChart(stats);
          }
        }
      }
    }
  }, 50); // 50ms の遅延でデバウンス
};

// レーダーチャート基準値（デフォルト値）
const radarChartBenchmarks = {
  likes: 100,        // いいねの基準値
  retweets: 50,      // リツイートの基準値  
  views: 10000,      // 閲覧数の基準値
  frequency: 5,      // 投稿頻度の基準値（投稿/日）
  volume: 100        // 投稿数の基準値
};

// レーダーチャートスケール切り替え関数
window.setRadarScale = function(mode) {
  window.radarScaleMode = mode;
  
  // ボタンのスタイルを更新
  const logBtn = document.getElementById('radarScaleLog');
  const linearBtn = document.getElementById('radarScaleLinear');
  
  if (mode === 'log') {
    if (logBtn) {
      logBtn.style.background = '#1da1f2';
      logBtn.style.color = '#ffffff';
    }
    if (linearBtn) {
      linearBtn.style.background = 'transparent';
      linearBtn.style.color = '#8b98a5';
    }
  } else {
    if (logBtn) {
      logBtn.style.background = 'transparent';
      logBtn.style.color = '#8b98a5';
    }
    if (linearBtn) {
      linearBtn.style.background = '#1da1f2';
      linearBtn.style.color = '#ffffff';
    }
  }
  
  // 現在選択中のユーザーがいれば再描画
  const singleUserSelector = document.getElementById('singleUserSelector');
  if (singleUserSelector && singleUserSelector.value && window.influenceAnalysisState?.userTweets) {
    const username = singleUserSelector.value;
    const tweets = window.influenceAnalysisState.userTweets[username];
    if (tweets) {
      // 統計を再計算して再描画
      const stats = calculateInfluenceStats(tweets);
      drawInfluenceRadarChart(stats);
    }
  }
  
  // 比較モードの場合も再描画
  if (window.influenceAnalysisState?.compareMode && window.influenceAnalysisState?.selectedUsers?.length > 0) {
    const userData = window.influenceAnalysisState.selectedUsers.map(username => ({
      username,
      tweets: window.influenceAnalysisState.userTweets[username] || [],
      stats: null // 関数内で再計算される
    }));
    updateComparisonRadarChart(userData);
    updateComparisonEngagementChart(userData); // エンゲージメントグラフも更新
  }
};

// レーダーチャート数値表示切り替え関数
window.setRadarValues = function(show) {
  window.radarShowValues = show;
  
  // ボタンのスタイルを更新
  const showBtn = document.getElementById('radarValuesShow');
  const hideBtn = document.getElementById('radarValuesHide');
  
  if (show) {
    if (showBtn) {
      showBtn.style.background = '#1da1f2';
      showBtn.style.color = '#ffffff';
    }
    if (hideBtn) {
      hideBtn.style.background = 'transparent';
      hideBtn.style.color = '#8b98a5';
    }
  } else {
    if (showBtn) {
      showBtn.style.background = 'transparent';
      showBtn.style.color = '#8b98a5';
    }
    if (hideBtn) {
      hideBtn.style.background = '#1da1f2';
      hideBtn.style.color = '#ffffff';
    }
  }
  
  // 現在選択中のユーザーがいれば再描画
  const singleUserSelector = document.getElementById('singleUserSelector');
  if (singleUserSelector && singleUserSelector.value && window.influenceAnalysisState?.userTweets) {
    const username = singleUserSelector.value;
    const tweets = window.influenceAnalysisState.userTweets[username];
    if (tweets) {
      analyzeUserInfluence(username, tweets);
    }
  }
  
  // 比較モードの場合も再描画
  if (window.influenceAnalysisState?.compareMode && window.influenceAnalysisState?.selectedUsers?.length > 0) {
    const userData = window.influenceAnalysisState.selectedUsers.map(username => ({
      username,
      tweets: window.influenceAnalysisState.userTweets[username] || [],
      stats: null // 関数内で再計算される
    }));
    updateComparisonRadarChart(userData);
    updateComparisonEngagementChart(userData); // エンゲージメントグラフも更新
  }
};

// 比較モード用のボタンスタイル更新関数
function updateCompareButtonStyles() {
  // スケールボタンのスタイル更新
  const logBtnCompare = document.getElementById('radarScaleLogCompare');
  const linearBtnCompare = document.getElementById('radarScaleLinearCompare');
  
  if (logBtnCompare && linearBtnCompare) {
    if (window.radarScaleMode === 'log') {
      logBtnCompare.style.background = '#1da1f2';
      logBtnCompare.style.color = '#ffffff';
      linearBtnCompare.style.background = 'transparent';
      linearBtnCompare.style.color = '#8b98a5';
    } else {
      linearBtnCompare.style.background = '#1da1f2';
      linearBtnCompare.style.color = '#ffffff';
      logBtnCompare.style.background = 'transparent';
      logBtnCompare.style.color = '#8b98a5';
    }
  }
  
  // 数値表示ボタンのスタイル更新
  const showBtnCompare = document.getElementById('radarValuesShowCompare');
  const hideBtnCompare = document.getElementById('radarValuesHideCompare');
  
  if (showBtnCompare && hideBtnCompare) {
    if (window.radarShowValues) {
      showBtnCompare.style.background = '#1da1f2';
      showBtnCompare.style.color = '#ffffff';
      hideBtnCompare.style.background = 'transparent';
      hideBtnCompare.style.color = '#8b98a5';
    } else {
      hideBtnCompare.style.background = '#1da1f2';
      hideBtnCompare.style.color = '#ffffff';
      showBtnCompare.style.background = 'transparent';
      showBtnCompare.style.color = '#8b98a5';
    }
  }
}

// 基準値を保存/読み込み
function saveRadarBenchmarks() {
  localStorage.setItem('radarChartBenchmarks', JSON.stringify(radarChartBenchmarks));
}

function loadRadarBenchmarks() {
  const saved = localStorage.getItem('radarChartBenchmarks');
  if (saved) {
    Object.assign(radarChartBenchmarks, JSON.parse(saved));
  }
}

// 影響力分析のためのツイート取得関数
function getAllTweetsFromKeywords() {
  const allTweets = [];
  Object.values(keywordManager.keywords).forEach(keyword => {
    if (keyword.tweets) {
      allTweets.push(...keyword.tweets);
    }
  });
  return allTweets;
}

function updateInfluenceAnalysis() {
  const addLog = window.addLogEntry;
  
  // 基準値を読み込み
  loadRadarBenchmarks();
  
  // 基準値設定のイベントリスナーを設定（初回のみ）
  setupBenchmarkModal();
  
  // 総合スコアのツールチップ設定
  setupTotalScoreTooltip();
  
  const tweets = getAllTweetsFromKeywords();
  
  addLog(`影響力分析 - 総ツイート数: ${tweets.length}`, 'info');
  
  if (tweets.length === 0) {
    // データがない場合はデフォルト値を表示
    updateNewInfluenceDisplay({
      accountScore: 0, totalTweets: 0, analysisWeeks: 0,
      maxLikes: 0, topAvgLikes: 0, maxRetweets: 0, topAvgRetweets: 0,
      maxViews: 0, topAvgViews: 0, postFrequencyWeek: 0, stabilityMedianLikes: 0,
      radarValues: {
        maxLikes: 0, topAvgLikes: 0, maxRetweets: 0, topAvgRetweets: 0,
        maxViews: 0, topAvgViews: 0, postFrequencyWeek: 0, stabilityMedianLikes: 0
      }
    });
    
    // プルダウンも空に
    const selector = document.getElementById('influenceUserSelector');
    if (selector) {
      selector.innerHTML = `
        <select style="background: #253341; border: 1px solid #38444d; color: #ffffff; padding: 6px 12px; border-radius: 8px; font-size: 13px; min-width: 200px;">
          <option value="">データがありません</option>
        </select>
      `;
    }
    return;
  }
  
  addLog(`影響力分析の処理を継続します...`, 'info');
  
  // 既存のコードの続き
  if (tweets.length > 0) {
    const sampleTweet = tweets[0];
    addLog(`サンプルツイートのフィールド: ${Object.keys(sampleTweet).join(', ')}`, 'info');
    
    // ユーザー名候補をログ出力
    const usernameCandidates = {
      username: sampleTweet.username,
      user: sampleTweet.user,
      handle: sampleTweet.handle,
      author: sampleTweet.author,
      screen_name: sampleTweet.screen_name
    };
    addLog(`ユーザー名候補: ${JSON.stringify(usernameCandidates)}`, 'info');
  }
  
  // ユーザーごとにツイートをグループ化
  const userTweets = {};
  tweets.forEach((tweet, index) => {
    let username = null;
    
    // userオブジェクトから取得
    if (tweet.user && typeof tweet.user === 'object') {
      username = tweet.user.screen_name || tweet.user.username;
    } else {
      username = tweet.username || tweet.handle || tweet.author || tweet.screen_name;
    }
    
    if (!username) {
      addLog(`ツイート ${index} にユーザー名がありません`, 'warning');
      return;
    }
    
    // usernameが文字列でない場合の処理
    if (typeof username !== 'string') {
      addLog(`ツイート ${index} のユーザー名が文字列ではありません: ${JSON.stringify(username)}`, 'warning');
      username = String(username);
    }
    
    if (!userTweets[username]) {
      userTweets[username] = [];
    }
    userTweets[username].push(tweet);
  });
  
  addLog(`グループ化完了: ${Object.keys(userTweets).length}人のユーザー`, 'info');
  
  // ユーザー選択UI状態を管理（タブ切り替え時は常にリセット）
  window.influenceAnalysisState = {
    userTweets,
    compareMode: false,
    selectedUsers: []
  };
  
  // ユーザー選択UIを更新
  updateUserSelector(userTweets);
  
  // 比較モードボタンのイベントリスナー
  const compareModeBtn = document.getElementById('influenceCompareMode');
  if (compareModeBtn && !compareModeBtn.hasAttribute('data-listener')) {
    compareModeBtn.addEventListener('click', toggleCompareMode);
    compareModeBtn.setAttribute('data-listener', 'true');
  }
  
  // 比較モードボタンを初期状態にリセット
  if (compareModeBtn) {
    compareModeBtn.classList.remove('btn-primary');
    compareModeBtn.classList.add('btn-secondary');
    compareModeBtn.innerHTML = '<span>⚖️</span> 比較モード';
  }
  
  // 表示モードを単一モードにリセット
  const singleMode = document.getElementById('influenceContentSingle');
  const compareMode = document.getElementById('influenceContentCompare');
  if (singleMode) singleMode.style.display = 'block';
  if (compareMode) compareMode.style.display = 'none';
  
  // 初期表示（未選択状態）
  showEmptyInfluenceState();
}

/**
 * 詳細統計を計算
 */
/**
 * 新仕様：影響力スコア＆レーダーチャート統計を計算
 */
function calculateInfluenceStats(tweets) {
  const addLog = window.addLogEntry;
  
  if (tweets.length === 0) {
    return {
      // スコア関連
      accountScore: 0,
      totalTweets: 0,
      analysisWeeks: 0,
      
      // レーダーチャート用指標
      maxLikes: 0,
      topAvgLikes: 0,
      maxRetweets: 0,
      topAvgRetweets: 0,
      maxViews: 0,
      topAvgViews: 0,
      postFrequencyWeek: 0,
      stabilityMedianLikes: 0,
      
      // 全体平均
      allAvgLikes: 0,
      allAvgRetweets: 0,
      allAvgViews: 0,
      
      // 正規化されたレーダー値（0-100）
      radarValues: {
        maxLikes: 0,
        topAvgLikes: 0,
        maxRetweets: 0,
        topAvgRetweets: 0,
        maxViews: 0,
        topAvgViews: 0,
        postFrequencyWeek: 0,
        stabilityMedianLikes: 0
      }
    };
  }
  
  // 現在の年月を取得
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-11
  
  let totalAccountScore = 0;
  
  // 各ツイートのスコア計算（統一された関数を使用）
  tweets.forEach((tweet) => {
    const scoreResult = calculateTweetInfluenceScore(tweet);
    const finalScore = parseFloat(scoreResult.finalScore);
    totalAccountScore += finalScore;
  });
  
  
  // メトリクス配列の準備
  const likesArray = tweets.map(t => t.public_metrics?.like_count || t.favorite_count || t.like_count || 0);
  const retweetsArray = tweets.map(t => t.public_metrics?.retweet_count || t.retweet_count || 0);
  const viewsArray = tweets.map(t => parseInt(t.public_metrics?.view_count) || parseInt(t.public_metrics?.impression_count) || 0);
  
  // レーダーチャート指標の計算
  const maxLikes = Math.max(...likesArray, 0);
  const maxRetweets = Math.max(...retweetsArray, 0);
  const maxViews = Math.max(...viewsArray, 0);
  
  // 上位20件または10%の平均
  const topCount = Math.max(1, Math.min(20, Math.ceil(tweets.length * 0.1)));
  const topLikes = [...likesArray].sort((a, b) => b - a).slice(0, topCount);
  const topRetweets = [...retweetsArray].sort((a, b) => b - a).slice(0, topCount);
  const topViews = [...viewsArray].sort((a, b) => b - a).slice(0, topCount);
  
  const topAvgLikes = topLikes.reduce((sum, val) => sum + val, 0) / topLikes.length;
  const topAvgRetweets = topRetweets.reduce((sum, val) => sum + val, 0) / topRetweets.length;
  const topAvgViews = topViews.reduce((sum, val) => sum + val, 0) / topViews.length;
  
  // 全体平均を計算
  const allAvgLikes = likesArray.reduce((sum, val) => sum + val, 0) / likesArray.length;
  const allAvgRetweets = retweetsArray.reduce((sum, val) => sum + val, 0) / retweetsArray.length;
  const allAvgViews = viewsArray.reduce((sum, val) => sum + val, 0) / viewsArray.length;
  
  // 0以外の値を持つ配列を作成（安定性計算用）
  const nonZeroLikes = likesArray.filter(l => l > 0);
  const nonZeroViews = viewsArray.filter(v => v > 0);
  
  // 投稿頻度（週あたり）
  const dates = tweets.map(t => new Date(t.created_at || t.timestamp)).filter(d => !isNaN(d.getTime()));
  let postFrequencyWeek = 0;
  let analysisWeeks = 0;
  
  if (dates.length > 1) {
    const minDate = Math.min(...dates);
    const maxDate = Math.max(...dates);
    analysisWeeks = (maxDate - minDate) / (1000 * 60 * 60 * 24 * 7); // 週数
    postFrequencyWeek = analysisWeeks > 0 ? tweets.length / analysisWeeks : tweets.length;
  } else {
    analysisWeeks = 1;
    postFrequencyWeek = tweets.length;
  }
  
  // 新しい安定性スコア計算
  // いいね（nonZeroLikesは既に定義済み）
  const nonZeroLikesSorted = [...nonZeroLikes].sort((a, b) => a - b);
  const nonZeroLikesMedian = nonZeroLikesSorted.length > 0 
    ? (nonZeroLikesSorted.length % 2 === 0 
      ? (nonZeroLikesSorted[Math.floor(nonZeroLikesSorted.length / 2) - 1] + nonZeroLikesSorted[Math.floor(nonZeroLikesSorted.length / 2)]) / 2
      : nonZeroLikesSorted[Math.floor(nonZeroLikesSorted.length / 2)])
    : 0;
  const likesNonZeroRatio = tweets.length > 0 ? nonZeroLikes.length / tweets.length : 0;
  
  // リツイート
  const nonZeroRetweets = retweetsArray.filter(r => r > 0);
  const nonZeroRetweetsSorted = [...nonZeroRetweets].sort((a, b) => a - b);
  const nonZeroRetweetsMedian = nonZeroRetweetsSorted.length > 0
    ? (nonZeroRetweetsSorted.length % 2 === 0
      ? (nonZeroRetweetsSorted[Math.floor(nonZeroRetweetsSorted.length / 2) - 1] + nonZeroRetweetsSorted[Math.floor(nonZeroRetweetsSorted.length / 2)]) / 2
      : nonZeroRetweetsSorted[Math.floor(nonZeroRetweetsSorted.length / 2)])
    : 0;
  const retweetsNonZeroRatio = tweets.length > 0 ? nonZeroRetweets.length / tweets.length : 0;
  
  // 閲覧数（既に定義済みのnonZeroViewsを使用）
  const nonZeroViewsSorted = [...nonZeroViews].sort((a, b) => a - b);
  const nonZeroViewsMedian = nonZeroViewsSorted.length > 0
    ? (nonZeroViewsSorted.length % 2 === 0
      ? (nonZeroViewsSorted[Math.floor(nonZeroViewsSorted.length / 2) - 1] + nonZeroViewsSorted[Math.floor(nonZeroViewsSorted.length / 2)]) / 2
      : nonZeroViewsSorted[Math.floor(nonZeroViewsSorted.length / 2)])
    : 0;
  const viewsNonZeroRatio = tweets.length > 0 ? nonZeroViews.length / tweets.length : 0;
  
  // 安定性スコア計算（より厳しく調整）
  const stabilityScore = (
    (nonZeroLikesMedian * 0.3 + topAvgLikes * 0.2 + likesNonZeroRatio * 50 * 0.1) * 0.4 +  // いいね（40%）: 重み減少、比率ボーナス半減
    (nonZeroRetweetsMedian * 0.3 + topAvgRetweets * 0.2 + retweetsNonZeroRatio * 50 * 0.1) * 0.4 +  // RT（40%）: 重み減少、比率ボーナス半減
    (nonZeroViewsMedian * 0.0005 + topAvgViews * 0.0003 + viewsNonZeroRatio * 25 * 0.1) * 0.2  // 閲覧数（20%）: 係数半減、比率ボーナス1/4
  ) * 0.5;  // 全体を半分にするための係数
  
  
  // 正規化（対数スケーリング）: (log10(actual+1) / log10(max_ref+1)) * 100
  const normalizeLog = (actual, maxRef) => {
    return (Math.log10(actual + 1) / Math.log10(maxRef + 1)) * 100;
  };
  
  // 正規化（線形スケーリング）: (actual / max_ref) * 100
  const normalizeLinear = (actual, maxRef) => {
    return Math.min((actual / maxRef) * 100, 150); // 最大150%までクリップ
  };
  
  // 現在のスケールモードを取得（デフォルトは対数）
  const useLogScale = window.radarScaleMode !== 'linear';
  const normalize = useLogScale ? normalizeLog : normalizeLinear;
  
  const radarValues = {
    maxLikes: normalize(maxLikes, 10000),
    topAvgLikes: normalize(topAvgLikes, 2000),
    maxRetweets: normalize(maxRetweets, 1000),  // 5000 -> 1000に変更
    topAvgRetweets: normalize(topAvgRetweets, 200),  // 1000 -> 200に変更
    maxViews: normalize(maxViews, 100000),
    topAvgViews: normalize(topAvgViews, 20000),
    postFrequencyWeek: normalize(postFrequencyWeek, 50),  // 14 -> 50に変更
    stabilityMedianLikes: normalize(stabilityScore, 100)  // 新しい安定性スコアを正規化
  };
  
  return {
    // スコア関連（整数で表示）
    accountScore: Math.floor(totalAccountScore), // 小数点以下切り捨て
    totalTweets: tweets.length,
    analysisWeeks: Math.round(analysisWeeks * 10) / 10,
    
    // レーダーチャート用指標（実数値）
    maxLikes: Math.round(maxLikes),
    topAvgLikes: Math.round(topAvgLikes),
    maxRetweets: Math.round(maxRetweets),
    topAvgRetweets: Math.round(topAvgRetweets),
    maxViews: Math.round(maxViews),
    topAvgViews: Math.round(topAvgViews),
    postFrequencyWeek: Math.round(postFrequencyWeek * 10) / 10,
    stabilityMedianLikes: Math.round(stabilityScore * 10) / 10,  // 新しい安定性スコア
    
    // 全体平均を追加
    allAvgLikes: Math.round(allAvgLikes * 10) / 10,
    allAvgRetweets: Math.round(allAvgRetweets * 10) / 10,
    allAvgViews: Math.round(allAvgViews * 10) / 10,
    
    // 正規化されたレーダー値（0-100）
    radarValues
  };
}

/**
 * 影響力表示を更新
 */
function updateInfluenceDisplay(stats) {
  // いいね数統計
  const maxLikesElem = document.getElementById('maxLikes');
  const topAvgLikesElem = document.getElementById('topAvgLikes');
  const avgLikesElem = document.getElementById('avgLikes');
  
  if (maxLikesElem) maxLikesElem.textContent = stats.maxLikes.toLocaleString();
  if (topAvgLikesElem) topAvgLikesElem.textContent = stats.topAvgLikes.toLocaleString();
  if (avgLikesElem) avgLikesElem.textContent = stats.avgLikes.toLocaleString();
  
  // リツイート数統計
  const maxRetweetsElem = document.getElementById('maxRetweets');
  const topAvgRetweetsElem = document.getElementById('topAvgRetweets');
  const avgRetweetsElem = document.getElementById('avgRetweets');
  
  if (maxRetweetsElem) maxRetweetsElem.textContent = stats.maxRetweets.toLocaleString();
  if (topAvgRetweetsElem) topAvgRetweetsElem.textContent = stats.topAvgRetweets.toLocaleString();
  if (avgRetweetsElem) avgRetweetsElem.textContent = stats.avgRetweets.toLocaleString();
  
  // 閲覧数統計
  const maxViewsElem = document.getElementById('maxViews');
  const topAvgViewsElem = document.getElementById('topAvgViews');
  const avgViewsElem = document.getElementById('avgViews');
  
  if (maxViewsElem) maxViewsElem.textContent = stats.maxViews.toLocaleString();
  if (topAvgViewsElem) topAvgViewsElem.textContent = stats.topAvgViews.toLocaleString();
  if (avgViewsElem) avgViewsElem.textContent = stats.avgViews.toLocaleString();
  
  // 投稿統計
  const postCountElem = document.getElementById('postCount');
  const postFrequencyElem = document.getElementById('postFrequency');
  
  if (postCountElem) postCountElem.textContent = stats.postCount.toLocaleString();
  if (postFrequencyElem) postFrequencyElem.textContent = stats.postFrequency + '/日';
}

/**
 * 新仕様：影響力表示を更新
 */
function updateNewInfluenceDisplay(stats) {
  const addLog = window.addLogEntry;
  
  // 総合スコア表示を更新
  const totalScoreElem = document.getElementById('influenceTotalScore');
  if (totalScoreElem) {
    totalScoreElem.textContent = `${stats.accountScore.toLocaleString()}`;
  }
  
  // 各要素を安全に取得して更新
  const maxLikesElem = document.getElementById('maxLikes');
  const topAvgLikesElem = document.getElementById('topAvgLikes');
  const avgLikesElem = document.getElementById('avgLikes');
  
  const maxRetweetsElem = document.getElementById('maxRetweets');
  const topAvgRetweetsElem = document.getElementById('topAvgRetweets');
  const avgRetweetsElem = document.getElementById('avgRetweets');
  
  const maxViewsElem = document.getElementById('maxViews');
  const topAvgViewsElem = document.getElementById('topAvgViews');
  const avgViewsElem = document.getElementById('avgViews');
  
  const postCountElem = document.getElementById('postCount');
  const postFrequencyElem = document.getElementById('postFrequency');
  
  // 安全に値を設定
  if (maxLikesElem) maxLikesElem.textContent = (stats.maxLikes || 0).toLocaleString();
  if (topAvgLikesElem) topAvgLikesElem.textContent = (stats.topAvgLikes || 0).toLocaleString();
  if (avgLikesElem) avgLikesElem.textContent = (stats.allAvgLikes || 0).toLocaleString();
  
  if (maxRetweetsElem) maxRetweetsElem.textContent = (stats.maxRetweets || 0).toLocaleString();
  if (topAvgRetweetsElem) topAvgRetweetsElem.textContent = (stats.topAvgRetweets || 0).toLocaleString();
  if (avgRetweetsElem) avgRetweetsElem.textContent = (stats.allAvgRetweets || 0).toLocaleString();
  
  if (maxViewsElem) maxViewsElem.textContent = (stats.maxViews || 0).toLocaleString();
  if (topAvgViewsElem) topAvgViewsElem.textContent = (stats.topAvgViews || 0).toLocaleString();
  if (avgViewsElem) avgViewsElem.textContent = (stats.allAvgViews || 0).toLocaleString();
  
  if (postCountElem) postCountElem.textContent = (stats.totalTweets || 0).toLocaleString();
  if (postFrequencyElem) postFrequencyElem.textContent = `${stats.postFrequencyWeek || 0}/週 (${stats.analysisWeeks || 0}週間)`;
  
  // メタ情報をログに表示
  addLog(`影響力分析完了: スコア=${stats.accountScore}pt, 期間=${stats.analysisWeeks}週, ツイート=${stats.totalTweets}件, 安定性=${stats.stabilityMedianLikes}`, 'success');
  
  // 安定性詳細表示は削除（ツールチップに移行）
  const stabilityDetail = document.getElementById('stabilityDetail');
  if (stabilityDetail) {
    stabilityDetail.style.display = 'none';
  }
}

/**
 * 新仕様：レーダーチャートを描画（対数スケーリング）
 */
function drawInfluenceRadarChart(stats) {
  const canvas = document.getElementById('influenceRadarChart');
  if (!canvas) {
    console.error('レーダーチャートのcanvas要素が見つかりません');
    return;
  }
  
  // キャンバスのサイズを設定（比較モードと同じサイズに）
  canvas.width = 450;
  canvas.height = 450;
  
  const ctx = canvas.getContext('2d');
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const radius = Math.min(centerX, centerY) - 80;
  
  // キャンバスをクリア
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // 基準値の定義（100%として扱う値）
  const benchmarks = [
    10000,  // maxLikes
    2000,   // topAvgLikes
    1000,   // maxRetweets
    200,    // topAvgRetweets
    100000,  // maxViews
    20000,  // topAvgViews
    50,     // postFrequencyWeek
    100     // stabilityMedianLikes
  ];
  
  // レーダーチャートの8軸データ
  const radarData = [
    { 
      label: '❤️ 最大いいね', 
      value: stats.radarValues.maxLikes,
      actual: stats.maxLikes,
      benchmark: benchmarks[0],
      color: '#e91e63' 
    },
    { 
      label: '❤️ 上位平均いいね', 
      value: stats.radarValues.topAvgLikes,
      actual: stats.topAvgLikes,
      benchmark: benchmarks[1],
      color: '#f06292' 
    },
    { 
      label: '🔄 最大RT', 
      value: stats.radarValues.maxRetweets,
      actual: stats.maxRetweets,
      benchmark: benchmarks[2],
      color: '#2196f3' 
    },
    { 
      label: '🔄 上位平均RT', 
      value: stats.radarValues.topAvgRetweets,
      actual: stats.topAvgRetweets,
      benchmark: benchmarks[3],
      color: '#42a5f5' 
    },
    { 
      label: '👁️ 最大閲覧', 
      value: stats.radarValues.maxViews,
      actual: stats.maxViews,
      benchmark: benchmarks[4],
      color: '#4caf50' 
    },
    { 
      label: '👁️ 上位平均閲覧', 
      value: stats.radarValues.topAvgViews,
      actual: stats.topAvgViews,
      benchmark: benchmarks[5],
      color: '#66bb6a' 
    },
    { 
      label: '📊 投稿頻度(週)', 
      value: stats.radarValues.postFrequencyWeek,
      actual: stats.postFrequencyWeek,
      benchmark: benchmarks[6],
      color: '#ff9800' 
    },
    { 
      label: '⚡ 安定性', 
      value: stats.radarValues.stabilityMedianLikes,
      actual: stats.stabilityMedianLikes,
      benchmark: benchmarks[7],
      color: '#9c27b0' 
    }
  ];
  
  
  // 線形モードかどうかを確認
  const isLinearMode = window.radarScaleMode === 'linear';
  
  // グリッド表示の設定
  let displayMaxValue = 100; // グリッド表示用の最大値（パーセンテージ）
  let actualMaxForGrid = 100; // 線形モードで使用する実際の最大値
  if (isLinearMode) {
    // 全データから実際の最大値を取得（実際の値/基準値の比率）
    const allRatios = radarData.map(d => d.actual / d.benchmark);
    actualMaxForGrid = Math.max(...allRatios);
    // グリッド表示用の最大値を設定（100%を基準として、実際の最大値の比率を使用）
    displayMaxValue = Math.ceil(actualMaxForGrid * 100 / 20) * 20;
    displayMaxValue = Math.max(displayMaxValue, 100);
  }
  
  // 背景グリッドを描画
  ctx.strokeStyle = '#38444d';
  ctx.lineWidth = 1;
  
  const gridSteps = isLinearMode ? 5 : 7; // 線形: 5段階、対数: 7段階
  const gridMax = isLinearMode ? 5 : 7;
  
  for (let i = 1; i <= gridMax; i++) {
    const ratio = isLinearMode ? i / 5 : i / 5; // 線形: 20%刻み、対数: 20%刻み（最大140%）
    ctx.beginPath();
    for (let j = 0; j < radarData.length; j++) {
      const angle = (j * 2 * Math.PI) / radarData.length - Math.PI / 2;
      const x = centerX + Math.cos(angle) * radius * ratio;
      const y = centerY + Math.sin(angle) * radius * ratio;
      if (j === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.closePath();
    ctx.stroke();
  }
  
  // 100%ラインを描画（ズームレベルに応じて位置を調整）
  const hundredPercentPosition = 1.0 / window.radarZoomLevel; // ズームレベルに応じた100%の位置
  
  if (hundredPercentPosition <= 1.0 && hundredPercentPosition >= 0.05) { // 表示範囲内の場合のみ描画
    ctx.strokeStyle = '#ff6b35';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let j = 0; j < radarData.length; j++) {
      const angle = (j * 2 * Math.PI) / radarData.length - Math.PI / 2;
      const x = centerX + Math.cos(angle) * radius * hundredPercentPosition;
      const y = centerY + Math.sin(angle) * radius * hundredPercentPosition;
      if (j === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.closePath();
    ctx.stroke();
    ctx.strokeStyle = '#38444d';
    ctx.lineWidth = 1;
  }
  
  // 軸を描画
  ctx.strokeStyle = '#38444d';
  ctx.lineWidth = 1;
  for (let i = 0; i < radarData.length; i++) {
    const angle = (i * 2 * Math.PI) / radarData.length - Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(centerX + Math.cos(angle) * radius, centerY + Math.sin(angle) * radius);
    ctx.stroke();
  }
  
  // データエリアを描画
  ctx.fillStyle = 'rgba(29, 161, 242, 0.2)';
  ctx.strokeStyle = '#1da1f2';
  ctx.lineWidth = 2;
  ctx.beginPath();
  
  for (let i = 0; i < radarData.length; i++) {
    const angle = (i * 2 * Math.PI) / radarData.length - Math.PI / 2;
    let normalizedValue;
    if (isLinearMode) {
      // 線形モード: 実際の値を基準値で割って位置を計算
      normalizedValue = (radarData[i].actual / radarData[i].benchmark) / window.radarZoomLevel;
    } else {
      // 対数モード: 正規化された値を使用（最大150%まで）
      normalizedValue = Math.min(radarData[i].value / 100, 1.5) / window.radarZoomLevel;
    }
    const x = centerX + Math.cos(angle) * radius * normalizedValue;
    const y = centerY + Math.sin(angle) * radius * normalizedValue;
    
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  
  // データポイントに数値を表示（オプション）
  if (window.radarShowValues) {
    ctx.fillStyle = '#ffffff';
    ctx.font = '9px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    for (let i = 0; i < radarData.length; i++) {
      const angle = (i * 2 * Math.PI) / radarData.length - Math.PI / 2;
      let normalizedValue;
      if (isLinearMode) {
        // 線形モード: 実際の値を基準値で割って位置を計算
        normalizedValue = (radarData[i].actual / radarData[i].benchmark) / window.radarZoomLevel;
      } else {
        // 対数モード: 正規化された値を使用（最大150%まで）
        normalizedValue = Math.min(radarData[i].value / 100, 1.5) / window.radarZoomLevel;
      }
      const x = centerX + Math.cos(angle) * radius * normalizedValue;
      const y = centerY + Math.sin(angle) * radius * normalizedValue;
      
      // 背景の円を描画（視認性のため）
      ctx.fillStyle = '#192734';
      ctx.beginPath();
      ctx.arc(x, y, 12, 0, 2 * Math.PI);
      ctx.fill();
      
      // 数値を描画
      ctx.fillStyle = '#ffffff';
      const displayValue = radarData[i].actual.toLocaleString();
      ctx.fillText(displayValue, x, y);
    }
  }
  
  // ラベルを描画（外側）
  ctx.fillStyle = '#8b98a5';  // 薄いグレーに変更
  ctx.font = '11px Arial';
  ctx.textAlign = 'center';
  
  for (let i = 0; i < radarData.length; i++) {
    const angle = (i * 2 * Math.PI) / radarData.length - Math.PI / 2;
    const labelRadius = radius + 30;
    const x = centerX + Math.cos(angle) * labelRadius;
    const y = centerY + Math.sin(angle) * labelRadius;
    
    // ラベルを表示（絵文字付き）
    const label = radarData[i].label;
    // 絵文字とテキストを分離
    const emojiMatch = label.match(/^([^\s]+)\s+(.+)$/);
    if (emojiMatch && label.length > 10) {
      // 絵文字と長いテキストの場合は2行に分割
      const emoji = emojiMatch[1];
      const text = emojiMatch[2];
      ctx.fillText(emoji, x, y - 6);
      ctx.fillText(text, x, y + 8);
    } else {
      // 短いラベルはそのまま表示
      ctx.fillText(label, x, y + 2);
    }
  }
  
  // パーセンテージ表示 - 不要のためコメントアウト
  // ctx.fillStyle = '#8b98a5';
  // ctx.font = '8px Arial';
  // ctx.textAlign = 'left';
  // 
  // if (isLinearMode) {
  //   // 線形モード: 動的スケールに応じた表示
  //   for (let i = 1; i <= 5; i++) {
  //     const percentage = Math.round((i / 5) * displayMaxValue);
  //     const x = centerX + radius * (i / 5) + 5;
  //     const y = centerY + 3;
  //     ctx.fillText(`${percentage}%`, x, y);
  //   }
  // } else {
  //   // 対数モード: 20%, 40%, 60%, 80%, 100%
  //   for (let i = 1; i <= 5; i++) {
  //     const percentage = i * 20;
  //     const x = centerX + radius * (i / 5) + 5;
  //     const y = centerY + 3;
  //     ctx.fillText(`${percentage}%`, x, y);
  //   }
  // }
}

function debugInfluenceAnalysis() {
  const addLog = window.addLogEntry;
  
  if (tweets.length > 0) {
    const sampleTweet = tweets[0];
    addLog(`サンプルツイートのフィールド: ${Object.keys(sampleTweet).join(', ')}`, 'info');
    
    // ユーザー名候補をログ出力
    const usernameCandidates = {
      username: sampleTweet.username,
      user: sampleTweet.user,
      handle: sampleTweet.handle,
      author: sampleTweet.author,
      screen_name: sampleTweet.screen_name
    };
    addLog(`ユーザー名候補: ${JSON.stringify(usernameCandidates)}`, 'info');
    
    // エンゲージメント候補をログ出力
    const engagementCandidates = {
      likes: sampleTweet.likes,
      favorite_count: sampleTweet.favorite_count,
      like_count: sampleTweet.like_count,
      favourites: sampleTweet.favourites,
      favorites: sampleTweet.favorites
    };
    addLog(`エンゲージメント候補: ${JSON.stringify(engagementCandidates)}`, 'info');
    
    // アバター候補をログ出力
    const avatarCandidates = {
      avatar: sampleTweet.avatar,
      profile_image: sampleTweet.profile_image,
      user_avatar: sampleTweet.user_avatar,
      profile_image_url: sampleTweet.profile_image_url,
      profile_pic: sampleTweet.profile_pic,
      user_profile_image: sampleTweet.user_profile_image
    };
    addLog(`アバター候補: ${JSON.stringify(avatarCandidates)}`, 'info');
  }
  
  // ユーザーごとにツイートをグループ化
  const userTweets = {};
  tweets.forEach((tweet, index) => {
    let username = null;
    
    // userオブジェクトから取得
    if (tweet.user && typeof tweet.user === 'object') {
      username = tweet.user.screen_name || tweet.user.username;
    } else {
      username = tweet.username || tweet.handle || tweet.author || tweet.screen_name;
    }
    
    if (!username) {
      addLog(`ツイート ${index} にユーザー名がありません`, 'warning');
      return;
    }
    
    // usernameが文字列でない場合の処理
    if (typeof username !== 'string') {
      addLog(`ツイート ${index} のユーザー名が文字列ではありません: ${JSON.stringify(username)}`, 'warning');
      username = String(username);
    }
    
    if (!userTweets[username]) {
      userTweets[username] = [];
    }
    userTweets[username].push(tweet);
  });
  
  // ユーザー選択UI状態を管理
  window.influenceAnalysisState = {
    userTweets,
    compareMode: false,
    selectedUsers: []
  };
  
  // ユーザー選択UIを更新
  updateUserSelector(userTweets);
  
  // 比較モードボタンのイベントリスナー
  const compareModeBtn = document.getElementById('influenceCompareMode');
  if (compareModeBtn && !compareModeBtn.hasAttribute('data-listener')) {
    compareModeBtn.addEventListener('click', toggleCompareMode);
    compareModeBtn.setAttribute('data-listener', 'true');
  }
  
  // 初期表示（未選択状態）
  showEmptyInfluenceState();
}

function analyzeUserInfluence(username, tweets) {
  if (!tweets || tweets.length === 0) return;
  
  const addLog = window.addLogEntry;
  
  addLog(`ユーザー分析開始: @${username} (${tweets.length}件のツイート)`, 'info');
  
  // 最初のツイートの詳細をログ出力
  const firstTweet = tweets[0];
  addLog(`最初のツイートの構造: ${JSON.stringify(Object.keys(firstTweet))}`, 'info');
  
  // 基本統計を計算（古い形式も維持）
  const basicStats = calculateUserStats(tweets);
  
  // 新しい影響力統計も計算
  const detailedStats = calculateInfluenceStats(tweets);
  
  addLog(`計算された統計: スコア=${basicStats.totalScore}, 平均エンゲージメント=${basicStats.avgEngagement}, 最大いいね=${detailedStats.maxLikes}`, 'info');
  
  // UI更新 - 安全にデータを表示
  // 表示名を安全に取得（userオブジェクトから）
  let displayName = null;
  if (tweets[0].user && typeof tweets[0].user === 'object') {
    displayName = tweets[0].user.name || tweets[0].user.display_name;
  } else {
    displayName = tweets[0].author || tweets[0].name || tweets[0].user_name || tweets[0].display_name;
  }
  
  // 最終的に文字列でない場合はusernameを使用
  const safeName = (typeof displayName === 'string' && displayName) ? displayName : username;
  
  addLog(`表示名: ${safeName}, ハンドル: @${username}`, 'info');
  
  document.getElementById('influenceUsername').textContent = safeName;
  document.getElementById('influenceHandle').textContent = `@${username}`;
  document.getElementById('influenceTotalScore').textContent = isNaN(basicStats.totalScore) ? '0' : basicStats.totalScore;
  
  // データ取得情報を更新
  updateDataInfo(tweets);
  
  // 新しい影響力統計を計算・表示
  const influenceStats = calculateInfluenceStats(tweets);
  updateNewInfluenceDisplay(influenceStats);
  
  // タブが表示されている場合のみレーダーチャートを描画
  setTimeout(() => {
    if (document.getElementById('influencePanel').classList.contains('active')) {
      drawInfluenceRadarChart(influenceStats);
    }
  }, 100);
  
  
  // アバター更新（プロフィール画像があれば使用）
  const avatarElement = document.getElementById('influenceAvatar');
  if (avatarElement) {
    // userオブジェクトからアバターを取得
    let avatar = null;
    if (tweets[0].user && typeof tweets[0].user === 'object') {
      avatar = tweets[0].user.profile_image_url;
      addLog(`userオブジェクトからアバター取得: ${avatar}`, 'info');
    }
    
    // userオブジェクトにない場合は他の場所を探す
    if (!avatar) {
      for (let i = 0; i < Math.min(tweets.length, 3); i++) {
        const tweet = tweets[i];
        avatar = tweet.avatar || tweet.profile_image || tweet.user_avatar || tweet.profile_image_url;
        
        if (avatar && typeof avatar === 'string' && avatar.includes('http')) {
          addLog(`有効なアバターURL発見 (ツイート ${i}): ${avatar}`, 'success');
          break;
        }
      }
    }
    
    if (!avatar) {
      addLog('有効なアバターURLが見つかりませんでした', 'warning');
    }
    
    if (avatar && typeof avatar === 'string' && avatar.includes('http')) {
      // アバターURLの場合、通常サイズに変更
      if (avatar.includes('_normal')) {
        avatar = avatar.replace('_normal', '_200x200');
      }
      avatarElement.innerHTML = `<img src="${avatar}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;" onerror="this.parentElement.innerHTML='👤'">`;
    } else {
      // 名前の最初の文字を表示
      const initial = safeName.charAt(0).toUpperCase() || username.charAt(0).toUpperCase();
      avatarElement.innerHTML = `<span style="font-size: 28px; font-weight: 700;">${initial}</span>`;
    }
  }
  
  // レーダーチャート更新
  drawInfluenceRadarChart(detailedStats);
  
  // スケール切り替えボタンのイベントリスナーを設定（初回のみ）
  const logBtn = document.getElementById('radarScaleLog');
  const linearBtn = document.getElementById('radarScaleLinear');
  
  if (logBtn && !logBtn.hasAttribute('data-listener')) {
    logBtn.addEventListener('click', () => window.setRadarScale('log'));
    logBtn.setAttribute('data-listener', 'true');
  }
  
  if (linearBtn && !linearBtn.hasAttribute('data-listener')) {
    linearBtn.addEventListener('click', () => window.setRadarScale('linear'));
    linearBtn.setAttribute('data-listener', 'true');
  }
  
  // 数値表示切り替えボタンのイベントリスナーを設定（初回のみ）
  const showBtn = document.getElementById('radarValuesShow');
  const hideBtn = document.getElementById('radarValuesHide');
  
  if (showBtn && !showBtn.hasAttribute('data-listener')) {
    showBtn.addEventListener('click', () => window.setRadarValues(true));
    showBtn.setAttribute('data-listener', 'true');
  }
  
  if (hideBtn && !hideBtn.hasAttribute('data-listener')) {
    hideBtn.addEventListener('click', () => window.setRadarValues(false));
    hideBtn.setAttribute('data-listener', 'true');
  }
  
  // 単一モードのキャンバスにマウスホイールイベントを追加
  const singleCanvas = document.getElementById('influenceRadarChart');
  if (singleCanvas && !singleCanvas.hasAttribute('data-wheel-listener')) {
    singleCanvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 1.1 : 0.9;
      window.setRadarZoom(window.radarZoomLevel * delta);
    });
    singleCanvas.setAttribute('data-wheel-listener', 'true');
  }
  
  // 単一モードのズームボタンのイベントリスナーを設定（初回のみ）
  const zoomInBtnSingle = document.getElementById('radarZoomInSingle');
  const zoomOutBtnSingle = document.getElementById('radarZoomOutSingle');
  const zoomResetBtnSingle = document.getElementById('radarZoomResetSingle');
  
  if (zoomInBtnSingle && !zoomInBtnSingle.hasAttribute('data-listener')) {
    zoomInBtnSingle.addEventListener('click', () => {
      window.setRadarZoom(window.radarZoomLevel * 0.8);
    });
    zoomInBtnSingle.setAttribute('data-listener', 'true');
  }
  
  if (zoomOutBtnSingle && !zoomOutBtnSingle.hasAttribute('data-listener')) {
    zoomOutBtnSingle.addEventListener('click', () => {
      window.setRadarZoom(window.radarZoomLevel * 1.25);
    });
    zoomOutBtnSingle.setAttribute('data-listener', 'true');
  }
  
  if (zoomResetBtnSingle && !zoomResetBtnSingle.hasAttribute('data-listener')) {
    zoomResetBtnSingle.addEventListener('click', () => {
      window.setRadarZoom(1.0);
    });
    zoomResetBtnSingle.setAttribute('data-listener', 'true');
  }
  
  // ヒートマップ更新
  updateInfluenceHeatmap(tweets);
  
  // 既存のリサイズハンドラーを削除
  if (window.heatmapResizeHandler) {
    window.removeEventListener('resize', window.heatmapResizeHandler);
  }
  
  // 新しいリサイズハンドラーを登録（現在のユーザーのデータをクロージャで保持）
  window.heatmapResizeHandler = () => {
    updateInfluenceHeatmap(tweets);
  };
  window.addEventListener('resize', window.heatmapResizeHandler);
  
  // 時系列グラフ更新
  updateInfluenceTimeSeries(tweets);
}

// データ取得情報を更新する関数
function updateDataInfo(tweets) {
  const dataSummaryElement = document.getElementById('influenceDataSummary');
  
  if (!dataSummaryElement) return;
  
  if (!tweets || tweets.length === 0) {
    dataSummaryElement.textContent = '-';
    return;
  }
  
  // 期間を計算
  const dates = tweets
    .map(t => new Date(t.created_at || t.date))
    .filter(d => !isNaN(d.getTime()))
    .sort((a, b) => a - b);
    
  if (dates.length > 0) {
    const startDate = dates[0];
    const endDate = dates[dates.length - 1];
    
    // 日付フォーマット
    const formatDate = (date) => {
      return date.toLocaleDateString('ja-JP', { 
        year: 'numeric',
        month: 'short', 
        day: 'numeric' 
      });
    };
    
    // 期間の日数を計算
    const daysDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
    
    // 二行で表示
    if (daysDiff === 0) {
      dataSummaryElement.innerHTML = `📊 ${tweets.length.toLocaleString()}件<br>📅 ${formatDate(startDate)}`;
    } else {
      dataSummaryElement.innerHTML = `📊 ${tweets.length.toLocaleString()}件<br>📅 ${formatDate(startDate)}〜${formatDate(endDate)} (${daysDiff + 1}日間)`;
    }
  } else {
    dataSummaryElement.textContent = `📊 ${tweets.length.toLocaleString()}件`;
  }
}

function calculateUserStats(tweets) {
  const addLog = window.addLogEntry;
  
  if (!tweets || tweets.length === 0) {
    return {
      avgEngagement: 0,
      maxLikes: 0,
      postFrequency: 0,
      totalScore: 0,
      trendDirection: 'insufficient',
      recentPerformance: 'N/A',
      radarData: {
        engagement: 0,
        reach: 0,
        volume: 0,
        consistency: 0,
        trend: 0,
        variety: 0
      }
    };
  }
  
  // 時系列でソート
  const sortedTweets = tweets.sort((a, b) => new Date(a.date || a.created_at) - new Date(b.date || b.created_at));
  
  // public_metricsからエンゲージメントデータを取得
  const engagements = sortedTweets.map((t, idx) => {
    let likes = 0;
    let retweets = 0;
    let replies = 0;
    
    // public_metricsオブジェクトから取得
    if (t.public_metrics && typeof t.public_metrics === 'object') {
      likes = t.public_metrics.like_count || t.public_metrics.favorite_count || 0;
      retweets = t.public_metrics.retweet_count || 0;
      replies = t.public_metrics.reply_count || 0;
    } else {
      // フォールバック: 従来のフィールド名
      likes = t.likes || t.favorite_count || t.like_count || t.favourites || t.favorites || 0;
      retweets = t.retweets || t.retweet_count || t.rt_count || 0;
      replies = t.replies || t.reply_count || 0;
    }
    
    if (idx < 3) { // 最初の3件のみログ出力
      addLog(`ツイート ${idx} のエンゲージメント: いいね=${likes}, RT=${retweets}, 返信=${replies}`, 'info');
      if (t.public_metrics) {
        addLog(`ツイート ${idx} のpublic_metrics: ${JSON.stringify(t.public_metrics)}`, 'info');
      }
    }
    
    return likes + retweets + replies;
  });
  
  const avgEngagement = engagements.length > 0 ? engagements.reduce((a, b) => a + b, 0) / tweets.length : 0;
  
  // いいね数配列も同様に修正
  const likesArray = sortedTweets.map(t => {
    if (t.public_metrics && typeof t.public_metrics === 'object') {
      return t.public_metrics.like_count || t.public_metrics.favorite_count || 0;
    }
    return t.likes || t.favorite_count || t.like_count || t.favourites || t.favorites || 0;
  });
  
  addLog(`いいね数配列（最初の5件）: ${likesArray.slice(0, 5).join(', ')}`, 'info');
  const maxLikes = Math.max(...likesArray, 0);
  
  // 時間範囲と投稿頻度
  const dates = sortedTweets.map(t => new Date(t.date || t.created_at));
  const validDates = dates.filter(d => !isNaN(d.getTime()));
  
  let postFrequency = 0;
  if (validDates.length > 1) {
    const dateRange = Math.max(...validDates) - Math.min(...validDates);
    const days = dateRange / (1000 * 60 * 60 * 24) || 1;
    postFrequency = tweets.length / days;
  } else if (validDates.length === 1) {
    postFrequency = tweets.length; // 1日に全部投稿
  }
  
  // 時系列トレンド分析
  const trendAnalysis = calculateTrendScore(sortedTweets);
  
  // データ量ボーナス（より多くのデータがある方が信頼性が高い）
  const dataVolumeBonus = calculateDataVolumeBonus(sortedTweets);
  
  // 影響力スコア計算（上限なし、実績ベース）
  const engagementScore = isNaN(avgEngagement) ? 0 : Math.log10(avgEngagement + 1) * 50;
  const reachScore = isNaN(maxLikes) ? 0 : Math.log10(maxLikes + 1) * 30;
  const volumeScore = Math.log10(tweets.length + 1) * 20;
  const consistencyScore = calculateConsistencyScore(sortedTweets) * 2;
  const trendScore = (trendAnalysis.trendScore || 0) * 2;
  const dataQualityScore = dataVolumeBonus;
  
  const totalScore = Math.round(engagementScore + reachScore + volumeScore + consistencyScore + trendScore + dataQualityScore);
  
  return {
    avgEngagement: Math.round(avgEngagement),
    maxLikes,
    postFrequency,
    totalScore,
    trendDirection: trendAnalysis.direction,
    recentPerformance: trendAnalysis.recentPerformance,
    radarData: {
      engagement: Math.min(Math.round(engagementScore / 2), 100),
      reach: Math.min(Math.round(reachScore / 1.5), 100),
      volume: Math.min(Math.round(volumeScore / 1), 100),
      consistency: Math.min(Math.round(consistencyScore), 100),
      trend: Math.min(Math.round(trendScore), 100),
      variety: calculateVarietyScore(sortedTweets)
    }
  };
}

function calculateTrendScore(sortedTweets) {
  if (sortedTweets.length < 10) {
    return { trendScore: 10, direction: 'insufficient', recentPerformance: 'N/A' };
  }
  
  // 全期間を3つに分割（過去、中期、最近）
  const totalPeriods = 3;
  const tweetsPerPeriod = Math.floor(sortedTweets.length / totalPeriods);
  
  const periods = [];
  for (let i = 0; i < totalPeriods; i++) {
    const start = i * tweetsPerPeriod;
    const end = i === totalPeriods - 1 ? sortedTweets.length : (i + 1) * tweetsPerPeriod;
    const periodTweets = sortedTweets.slice(start, end);
    
    // 各期間の平均エンゲージメント - public_metricsから取得
    const engagements = periodTweets.map(t => {
      let likes = 0, retweets = 0, replies = 0;
      
      if (t.public_metrics && typeof t.public_metrics === 'object') {
        likes = t.public_metrics.like_count || 0;
        retweets = t.public_metrics.retweet_count || 0;
        replies = t.public_metrics.reply_count || 0;
      } else {
        likes = t.likes || t.favorite_count || t.like_count || 0;
        retweets = t.retweets || t.retweet_count || t.rt_count || 0;
        replies = t.replies || t.reply_count || 0;
      }
      
      return likes + retweets + replies;
    });
    
    const avgEngagement = engagements.length > 0 ? engagements.reduce((sum, eng) => sum + eng, 0) / periodTweets.length : 0;
    
    periods.push({
      avgEngagement,
      tweetCount: periodTweets.length,
      timespan: end - start
    });
  }
  
  // トレンド方向を計算
  const oldPeriod = periods[0];
  const recentPeriod = periods[periods.length - 1];
  
  // 最近の成長率を計算（エンゲージメント基準）
  const growthRate = oldPeriod.avgEngagement > 0 ? 
    (recentPeriod.avgEngagement - oldPeriod.avgEngagement) / oldPeriod.avgEngagement : 0;
  
  // トレンドスコア計算（-20〜+20点）
  let trendScore = 10; // ベーススコア
  
  if (growthRate > 0.5) { // 50%以上の成長
    trendScore += 10;
  } else if (growthRate > 0.2) { // 20%以上の成長
    trendScore += 7;
  } else if (growthRate > 0) { // プラス成長
    trendScore += 4;
  } else if (growthRate > -0.2) { // 軽微な下降
    trendScore += 1;
  } else if (growthRate > -0.5) { // 中程度の下降
    trendScore -= 3;
  } else { // 大幅な下降
    trendScore -= 7;
  }
  
  // 最近のパフォーマンスが全体平均を上回っているかチェック
  const overallEngagements = sortedTweets.map(t => {
    let likes = 0, retweets = 0, replies = 0;
    
    if (t.public_metrics && typeof t.public_metrics === 'object') {
      likes = t.public_metrics.like_count || 0;
      retweets = t.public_metrics.retweet_count || 0;
      replies = t.public_metrics.reply_count || 0;
    } else {
      likes = t.likes || t.favorite_count || t.like_count || 0;
      retweets = t.retweets || t.retweet_count || t.rt_count || 0;
      replies = t.replies || t.reply_count || 0;
    }
    
    return likes + retweets + replies;
  });
  const overallAvg = overallEngagements.length > 0 ? overallEngagements.reduce((sum, eng) => sum + eng, 0) / sortedTweets.length : 0;
  
  if (recentPeriod.avgEngagement > overallAvg * 1.2) {
    trendScore += 3; // 最近のパフォーマンスが全体平均を20%上回る
  }
  
  // 方向の判定
  let direction;
  if (growthRate > 0.2) direction = 'rising';
  else if (growthRate > -0.2) direction = 'stable';
  else direction = 'declining';
  
  const recentPerformance = recentPeriod.avgEngagement > overallAvg ? 'above_average' : 'below_average';
  
  return {
    trendScore: Math.max(0, Math.min(20, trendScore)),
    direction,
    recentPerformance,
    growthRate: Math.round(growthRate * 100)
  };
}

function calculateDataVolumeBonus(tweets) {
  // データ量が多いほどボーナス（信頼性向上）
  // エンゲージメントが0のツイートは影響を最小限に
  const activeData = tweets.filter(t => {
    let likes = 0, retweets = 0, replies = 0;
    
    if (t.public_metrics && typeof t.public_metrics === 'object') {
      likes = t.public_metrics.like_count || 0;
      retweets = t.public_metrics.retweet_count || 0;
      replies = t.public_metrics.reply_count || 0;
    } else {
      likes = t.likes || t.favorite_count || t.like_count || 0;
      retweets = t.retweets || t.retweet_count || t.rt_count || 0;
      replies = t.replies || t.reply_count || 0;
    }
    
    return (likes + retweets + replies) > 0;
  });
  
  // アクティブなデータの割合
  const activeRatio = tweets.length > 0 ? activeData.length / tweets.length : 0;
  
  // データ量ボーナス（対数スケール）
  const volumeBonus = Math.log10(tweets.length + 1) * 10;
  
  // アクティブデータ比率ボーナス
  const qualityBonus = activeRatio * 15;
  
  return Math.round(volumeBonus + qualityBonus);
}

function calculateConsistencyScore(tweets) {
  if (!tweets || tweets.length === 0) return 0;
  
  // 投稿の継続性を評価（期間とエンゲージメントの分散）
  const dates = tweets.map(t => new Date(t.date || t.created_at));
  const validDates = dates.filter(d => !isNaN(d.getTime()));
  
  if (validDates.length <= 1) return Math.log10(tweets.length + 1) * 5; // 日付データなしでも投稿量で評価
  
  const timeSpan = (Math.max(...validDates) - Math.min(...validDates)) / (1000 * 60 * 60 * 24); // 日数
  
  // 期間が長いほど高評価（対数スケール）
  const durationScore = Math.log10(timeSpan + 1) * 8;
  
  // 投稿頻度の一貫性
  const uniqueDates = [...new Set(validDates.map(d => d.toDateString()))];
  const frequencyConsistency = uniqueDates.length > 0 ? Math.log10(uniqueDates.length + 1) * 5 : 0;
  
  return Math.round(durationScore + frequencyConsistency);
}

function calculateVarietyScore(tweets) {
  // コンテンツの多様性を評価（ハッシュタグ、メディア使用など）
  const hasMedia = tweets.filter(t => t.hasMedia).length / tweets.length;
  const avgHashtags = tweets.reduce((sum, t) => sum + (t.hashtags?.length || 0), 0) / tweets.length;
  return Math.round((hasMedia * 50 + Math.min(avgHashtags * 10, 50)));
}

function updateInfluenceHeatmap(tweets) {
  const heatmapDiv = document.getElementById('influenceHeatmap');
  if (!heatmapDiv) return;
  
  // 時間帯別の投稿数を集計
  const hourCounts = new Array(24).fill(0);
  tweets.forEach(tweet => {
    const date = new Date(tweet.date || tweet.created_at);
    if (!isNaN(date.getTime())) {
      const hour = date.getHours();
      if (hour >= 0 && hour < 24) {
        hourCounts[hour]++;
      }
    }
  });
  
  // ヒートマップを描画
  const maxCount = Math.max(...hourCounts);
  if (maxCount === 0) {
    heatmapDiv.innerHTML = '<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #8b98a5;">データがありません</div>';
    return;
  }
  
  // コンテナの幅を確認して、1行か2行かを決定
  const containerWidth = heatmapDiv.parentElement ? heatmapDiv.parentElement.offsetWidth : 600;
  const isWideScreen = containerWidth > 800; // 800px以上なら1行表示
  
  let html = '';
  
  if (isWideScreen) {
    // 広い画面: 24時間を1行で表示
    html = `
      <div style="display: grid; grid-template-columns: repeat(24, 1fr); gap: 4px;">
    `;
    
    for (let hour = 0; hour < 24; hour++) {
      const count = hourCounts[hour];
      const intensity = maxCount > 0 ? count / maxCount : 0;
      const color = count > 0 ? `rgba(29, 161, 242, ${Math.max(intensity, 0.1)})` : '#38444d';
      
      // 時間帯の絵文字を決定
      let emoji = '';
      if (hour >= 0 && hour < 6) emoji = '🌙';
      else if (hour >= 6 && hour < 12) emoji = '🌅';
      else if (hour >= 12 && hour < 18) emoji = '☀️';
      else emoji = '🌆';
      
      // 数値の桁数に応じてフォントサイズを調整
      const countStr = count.toString();
      let fontSize;
      if (countStr.length <= 2) fontSize = '16px';
      else if (countStr.length === 3) fontSize = '14px';
      else fontSize = '12px';
      
      html += `
        <div style="background: ${color}; border-radius: 6px; height: 75px; position: relative; cursor: pointer; 
                    border: 1px solid #38444d; display: flex; flex-direction: column; align-items: center; justify-content: center; 
                    transition: all 0.2s; padding: 4px; overflow: hidden;"
             title="${hour}時: ${count}件の投稿">
          <span style="font-size: 8px; margin-bottom: 2px; opacity: 0.8;">${emoji}</span>
          <span style="font-size: ${fontSize}; color: #ffffff; font-weight: bold; margin-bottom: 1px; line-height: 1;">${count}</span>
          <span style="font-size: 9px; color: #e1e8ed;">${hour}時</span>
        </div>
      `;
    }
    
    html += `</div>`;
    
  } else {
    // 狭い画面: 12時間ずつ2行で表示
    html = `
      <div style="display: grid; gap: 16px;">
        <!-- 0-11時（深夜〜朝） -->
        <div>
          <div style="display: grid; grid-template-columns: repeat(12, 1fr); gap: 6px;">
    `;
    
    // 0-11時
    for (let hour = 0; hour < 12; hour++) {
      const count = hourCounts[hour];
      const intensity = maxCount > 0 ? count / maxCount : 0;
      const color = count > 0 ? `rgba(29, 161, 242, ${Math.max(intensity, 0.1)})` : '#38444d';
      
      let emoji = '';
      if (hour >= 0 && hour < 6) emoji = '🌙';
      else if (hour >= 6 && hour < 12) emoji = '🌅';
      
      // 数値の桁数に応じてフォントサイズを調整
      const countStr = count.toString();
      let fontSize;
      if (countStr.length <= 2) fontSize = '18px';
      else if (countStr.length === 3) fontSize = '16px';
      else if (countStr.length === 4) fontSize = '14px';
      else fontSize = '12px';
      
      html += `
        <div style="background: ${color}; border-radius: 8px; height: 85px; position: relative; cursor: pointer; 
                    border: 1px solid #38444d; display: flex; flex-direction: column; align-items: center; justify-content: center; 
                    transition: all 0.2s; padding: 6px; overflow: hidden;"
             title="${hour}時: ${count}件の投稿">
          <span style="font-size: 10px; margin-bottom: 3px; opacity: 0.9;">${emoji}</span>
          <span style="font-size: ${fontSize}; color: #ffffff; font-weight: bold; margin-bottom: 2px; line-height: 1;">${count}</span>
          <span style="font-size: 10px; color: #e1e8ed;">${hour}時</span>
        </div>
      `;
    }
    
    html += `
          </div>
        </div>
        
        <!-- 12-23時（昼〜夜） -->
        <div>
          <div style="display: grid; grid-template-columns: repeat(12, 1fr); gap: 6px;">
    `;
    
    // 12-23時
    for (let hour = 12; hour < 24; hour++) {
      const count = hourCounts[hour];
      const intensity = maxCount > 0 ? count / maxCount : 0;
      const color = count > 0 ? `rgba(29, 161, 242, ${Math.max(intensity, 0.1)})` : '#38444d';
      
      let emoji = '';
      if (hour >= 12 && hour < 18) emoji = '☀️';
      else if (hour >= 18 && hour < 24) emoji = '🌆';
      
      // 数値の桁数に応じてフォントサイズを調整
      const countStr = count.toString();
      let fontSize;
      if (countStr.length <= 2) fontSize = '18px';
      else if (countStr.length === 3) fontSize = '16px';
      else if (countStr.length === 4) fontSize = '14px';
      else fontSize = '12px';
      
      html += `
        <div style="background: ${color}; border-radius: 8px; height: 85px; position: relative; cursor: pointer; 
                    border: 1px solid #38444d; display: flex; flex-direction: column; align-items: center; justify-content: center; 
                    transition: all 0.2s; padding: 6px; overflow: hidden;"
             title="${hour}時: ${count}件の投稿">
          <span style="font-size: 10px; margin-bottom: 3px; opacity: 0.9;">${emoji}</span>
          <span style="font-size: ${fontSize}; color: #ffffff; font-weight: bold; margin-bottom: 2px; line-height: 1;">${count}</span>
          <span style="font-size: 10px; color: #e1e8ed;">${hour}時</span>
        </div>
      `;
    }
    
    html += `
          </div>
        </div>
      </div>
    `;
  }
  
  heatmapDiv.innerHTML = html;
}

function updateInfluenceTimeSeries(tweets) {
  const timeSeriesDiv = document.getElementById('influenceTimeSeries');
  if (!timeSeriesDiv) return;
  
  if (tweets.length === 0) {
    timeSeriesDiv.innerHTML = '<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #8b98a5;">データがありません</div>';
    return;
  }
  
  const html = `
    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; flex-wrap: wrap;">
      <h4 style="font-size: 16px; font-weight: 700; margin: 0;">エンゲージメント推移</h4>
      <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
        <!-- メトリクス選択 -->
        <select id="timeSeriesMetric" style="background: #253341; border: 1px solid #38444d; color: #ffffff; padding: 4px 8px; border-radius: 4px; font-size: 12px;">
          <option value="tweets">ツイート数</option>
          <option value="likes">いいね数</option>
          <option value="retweets">リツイート数</option>
          <option value="replies">返信数</option>
          <option value="views">閲覧数</option>
        </select>
        
        <!-- 集計単位 -->
        <select id="timeSeriesUnit" style="background: #253341; border: 1px solid #38444d; color: #ffffff; padding: 4px 8px; border-radius: 4px; font-size: 12px;">
          <option value="daily">日別</option>
          <option value="weekly">週別</option>
          <option value="monthly">月別</option>
          <option value="yearly">年別</option>
        </select>
        
        <!-- 期間選択 -->
        <select id="timeSeriesRange" style="background: #253341; border: 1px solid #38444d; color: #ffffff; padding: 4px 8px; border-radius: 4px; font-size: 12px;">
          <option value="all">全期間</option>
          <option value="custom">期間指定</option>
        </select>
        
        <!-- カスタム期間入力（初期は非表示） -->
        <div id="customRangeInputs" style="display: none; gap: 8px;">
          <input type="date" id="timeSeriesStartDate" style="background: #253341; border: 1px solid #38444d; color: #ffffff; padding: 4px 8px; border-radius: 4px; font-size: 12px;">
          <span style="color: #8b98a5;">〜</span>
          <input type="date" id="timeSeriesEndDate" style="background: #253341; border: 1px solid #38444d; color: #ffffff; padding: 4px 8px; border-radius: 4px; font-size: 12px;">
          <button id="applyDateRange" style="background: #1da1f2; border: none; color: #ffffff; padding: 4px 12px; border-radius: 4px; font-size: 12px; cursor: pointer;">適用</button>
        </div>
      </div>
    </div>
    
    <canvas id="timeSeriesChart" width="800" height="250" style="width: 100%; height: 250px; background: #192734; border-radius: 8px;"></canvas>
  `;
  
  timeSeriesDiv.innerHTML = html;
  
  // 時系列グラフを描画
  drawTimeSeriesChart(tweets);
  
  // イベントリスナーを設定
  const metricSelect = document.getElementById('timeSeriesMetric');
  const unitSelect = document.getElementById('timeSeriesUnit');
  const rangeSelect = document.getElementById('timeSeriesRange');
  const customRangeInputs = document.getElementById('customRangeInputs');
  const applyDateBtn = document.getElementById('applyDateRange');
  
  // 共通の再描画関数
  const redrawChart = () => {
    drawTimeSeriesChart(tweets);
  };
  
  if (metricSelect) {
    metricSelect.addEventListener('change', redrawChart);
  }
  
  if (unitSelect) {
    unitSelect.addEventListener('change', redrawChart);
  }
  
  if (rangeSelect) {
    rangeSelect.addEventListener('change', () => {
      if (rangeSelect.value === 'custom') {
        customRangeInputs.style.display = 'flex';
      } else {
        customRangeInputs.style.display = 'none';
        redrawChart();
      }
    });
  }
  
  if (applyDateBtn) {
    applyDateBtn.addEventListener('click', redrawChart);
  }
}

function drawTimeSeriesChart(tweets) {
  const canvas = document.getElementById('timeSeriesChart');
  const metricSelect = document.getElementById('timeSeriesMetric');
  const unitSelect = document.getElementById('timeSeriesUnit');
  const rangeSelect = document.getElementById('timeSeriesRange');
  const startDateInput = document.getElementById('timeSeriesStartDate');
  const endDateInput = document.getElementById('timeSeriesEndDate');
  
  if (!canvas || !metricSelect || !unitSelect) return;
  
  const ctx = canvas.getContext('2d');
  const selectedMetric = metricSelect.value;
  const selectedUnit = unitSelect.value;
  const selectedRange = rangeSelect.value;
  
  // Canvasをクリア
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  if (tweets.length === 0) {
    ctx.fillStyle = '#8b98a5';
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('データがありません', canvas.width / 2, canvas.height / 2);
    return;
  }
  
  // 期間フィルターを適用
  let filteredTweets = [...tweets];
  if (selectedRange === 'custom' && startDateInput.value && endDateInput.value) {
    const startDate = new Date(startDateInput.value);
    const endDate = new Date(endDateInput.value);
    endDate.setHours(23, 59, 59, 999); // 終了日の最後まで含む
    
    filteredTweets = tweets.filter(tweet => {
      const tweetDate = new Date(tweet.created_at || tweet.date);
      return tweetDate >= startDate && tweetDate <= endDate;
    });
  }
  
  // ツイートを日付でソート
  const sortedTweets = filteredTweets.sort((a, b) => new Date(a.created_at || a.date) - new Date(b.created_at || b.date));
  
  // 集計単位によってグループ化
  const aggregatedData = {};
  
  sortedTweets.forEach(tweet => {
    const date = new Date(tweet.created_at || tweet.date);
    if (isNaN(date.getTime())) return;
    
    let key;
    switch (selectedUnit) {
      case 'daily':
        key = date.toISOString().split('T')[0]; // YYYY-MM-DD
        break;
      case 'weekly':
        // 週の開始日（日曜日）を取得（他の処理と統一）
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        key = weekStart.toISOString().split('T')[0];
        break;
      case 'monthly':
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`; // YYYY-MM
        break;
      case 'yearly':
        key = date.getFullYear().toString(); // YYYY
        break;
    }
    
    if (!aggregatedData[key]) {
      aggregatedData[key] = { count: 0, totalLikes: 0, totalRetweets: 0, totalReplies: 0, totalViews: 0 };
    }
    
    aggregatedData[key].count++;
    aggregatedData[key].totalLikes += tweet.public_metrics?.like_count || 0;
    aggregatedData[key].totalRetweets += tweet.public_metrics?.retweet_count || 0;
    aggregatedData[key].totalReplies += tweet.public_metrics?.reply_count || 0;
    aggregatedData[key].totalViews += tweet.public_metrics?.view_count || 0;
  });
  
  let keys = Object.keys(aggregatedData);
  if (keys.length === 0) return;
  
  // 期間補完：データがない期間も含めて連続的な期間を生成
  keys.sort();
  const startKey = keys[0];
  const endKey = keys[keys.length - 1];
  
  let completeKeys = [];
  let currentDate = new Date();
  
  switch (selectedUnit) {
    case 'daily':
      currentDate = new Date(startKey + 'T00:00:00');
      const endDate = new Date(endKey + 'T00:00:00');
      while (currentDate <= endDate) {
        completeKeys.push(currentDate.toISOString().split('T')[0]);
        currentDate.setDate(currentDate.getDate() + 1);
      }
      break;
      
    case 'weekly':
      currentDate = new Date(startKey + 'T00:00:00');
      const endDateWeekly = new Date(endKey + 'T00:00:00');
      while (currentDate <= endDateWeekly) {
        // 週の開始日（日曜日）に調整してからキーを生成
        const weekStart = new Date(currentDate);
        weekStart.setDate(currentDate.getDate() - currentDate.getDay());
        const weekKey = weekStart.toISOString().split('T')[0];
        completeKeys.push(weekKey);
        currentDate.setDate(currentDate.getDate() + 7);
      }
      break;
      
    case 'monthly':
      const [startYear, startMonth] = startKey.split('-').map(Number);
      const [endYear, endMonth] = endKey.split('-').map(Number);
      let year = startYear;
      let month = startMonth;
      
      while (year < endYear || (year === endYear && month <= endMonth)) {
        completeKeys.push(`${year}-${String(month).padStart(2, '0')}`);
        month++;
        if (month > 12) {
          month = 1;
          year++;
        }
      }
      break;
      
    case 'yearly':
      const startYearNum = parseInt(startKey);
      const endYearNum = parseInt(endKey);
      for (let year = startYearNum; year <= endYearNum; year++) {
        completeKeys.push(year.toString());
      }
      break;
  }
  
  // 補完されたキーを使用
  keys = completeKeys;
  
  // データを取得（データがない期間は0で補完）
  let values = [];
  let maxValue = 0;
  
  switch (selectedMetric) {
    case 'tweets':
      values = keys.map(key => aggregatedData[key]?.count || 0);
      break;
    case 'likes':
      values = keys.map(key => aggregatedData[key]?.totalLikes || 0);
      break;
    case 'retweets':
      values = keys.map(key => aggregatedData[key]?.totalRetweets || 0);
      break;
    case 'replies':
      values = keys.map(key => aggregatedData[key]?.totalReplies || 0);
      break;
    case 'views':
      values = keys.map(key => aggregatedData[key]?.totalViews || 0);
      break;
  }
  
  maxValue = Math.max(...values);
  if (maxValue === 0) maxValue = 1;
  
  // グラフの描画領域を設定
  const padding = 40;
  const chartWidth = canvas.width - padding * 2;
  const chartHeight = canvas.height - padding * 2;
  
  // 背景
  ctx.fillStyle = '#192734';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // グリッド線を描画
  ctx.strokeStyle = '#38444d';
  ctx.lineWidth = 1;
  
  // 横のグリッド線
  for (let i = 0; i <= 5; i++) {
    const y = padding + (chartHeight / 5) * i;
    ctx.beginPath();
    ctx.moveTo(padding, y);
    ctx.lineTo(padding + chartWidth, y);
    ctx.stroke();
    
    // Y軸ラベル
    const value = Math.round(maxValue * (1 - i / 5));
    ctx.fillStyle = '#8b98a5';
    ctx.font = '10px Arial';
    ctx.textAlign = 'right';
    ctx.fillText(value.toLocaleString(), padding - 5, y + 3);
  }
  
  // データ点をプロット
  if (values.length > 1) {
    ctx.strokeStyle = '#1da1f2';
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    values.forEach((value, index) => {
      const x = padding + (chartWidth / (values.length - 1)) * index;
      const y = padding + chartHeight - (value / maxValue) * chartHeight;
      
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    
    ctx.stroke();
    
    // データ点を描画
    ctx.fillStyle = '#1da1f2';
    values.forEach((value, index) => {
      const x = padding + (chartWidth / (values.length - 1)) * index;
      const y = padding + chartHeight - (value / maxValue) * chartHeight;
      
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, 2 * Math.PI);
      ctx.fill();
    });
  }
  
  // X軸ラベル（日付）
  ctx.fillStyle = '#8b98a5';
  ctx.font = '9px Arial';
  ctx.textAlign = 'center';
  
  const labelStep = Math.max(1, Math.floor(keys.length / 8)); // 最大8個のラベル
  keys.forEach((key, index) => {
    if (index % labelStep === 0) {
      const x = padding + (chartWidth / (values.length - 1)) * index;
      let label;
      
      switch (selectedUnit) {
        case 'daily':
          label = new Date(key).toLocaleDateString('ja-JP', { month: '2-digit', day: '2-digit' });
          break;
        case 'weekly':
          label = new Date(key).toLocaleDateString('ja-JP', { month: '2-digit', day: '2-digit' }) + '〜';
          break;
        case 'monthly':
          const [year, month] = key.split('-');
          label = `${year.slice(-2)}/${month}`;
          break;
        case 'yearly':
          label = key;
          break;
      }
      
      ctx.fillText(label, x, canvas.height - 10);
    }
  });
}

function getTrendIndicator(direction, recentPerformance) {
  const indicators = {
    rising: { icon: '📈', text: '上昇中', color: '#00ba7c' },
    stable: { icon: '📊', text: '安定', color: '#1da1f2' },
    declining: { icon: '📉', text: '下降中', color: '#f4212e' },
    insufficient: { icon: '❓', text: 'データ不足', color: '#8b98a5' }
  };
  
  return indicators[direction] || indicators.insufficient;
}

function updateTrendDisplay(trendIndicator) {
  // トレンド表示エリアを総合スコアの下に追加
  const scoreCard = document.querySelector('.influence-total-score');
  if (scoreCard) {
    let trendDisplay = scoreCard.querySelector('.trend-display');
    if (!trendDisplay) {
      trendDisplay = document.createElement('div');
      trendDisplay.className = 'trend-display';
      trendDisplay.style.cssText = 'margin-top: 12px; padding: 8px 12px; background: #15202b; border-radius: 6px; display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 14px;';
      scoreCard.appendChild(trendDisplay);
    }
    
    trendDisplay.innerHTML = `
      <span style="font-size: 16px;">${trendIndicator.icon}</span>
      <span style="color: ${trendIndicator.color}; font-weight: 600;">${trendIndicator.text}</span>
    `;
  }
}

function showEmptyInfluenceState() {
  // リサイズハンドラーをクリーンアップ
  if (window.heatmapResizeHandler) {
    window.removeEventListener('resize', window.heatmapResizeHandler);
    window.heatmapResizeHandler = null;
  }
  
  // 未選択状態の表示
  document.getElementById('influenceUsername').textContent = 'ユーザーを選択';
  document.getElementById('influenceHandle').textContent = '@username';
  document.getElementById('influenceTotalScore').textContent = '-';
  
  // 詳細統計をリセット
  document.getElementById('maxLikes').textContent = '0';
  document.getElementById('topAvgLikes').textContent = '0';
  document.getElementById('avgLikes').textContent = '0';
  document.getElementById('maxRetweets').textContent = '0';
  document.getElementById('topAvgRetweets').textContent = '0';
  document.getElementById('avgRetweets').textContent = '0';
  document.getElementById('maxViews').textContent = '0';
  document.getElementById('topAvgViews').textContent = '0';
  document.getElementById('avgViews').textContent = '0';
  document.getElementById('postCount').textContent = '0';
  document.getElementById('postFrequency').textContent = '0/週';
  
  // アバターリセット
  const avatarElement = document.getElementById('influenceAvatar');
  if (avatarElement) {
    avatarElement.innerHTML = '👤';
  }
  
  // トレンド表示をクリア
  const scoreCard = document.querySelector('.influence-total-score');
  if (scoreCard) {
    const trendDisplay = scoreCard.querySelector('.trend-display');
    if (trendDisplay) {
      trendDisplay.remove();
    }
  }
  
  // レーダーチャートをクリア
  const canvas = document.getElementById('influenceRadarChart');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  
  // ヒートマップをクリア
  const heatmapDiv = document.getElementById('influenceHeatmap');
  if (heatmapDiv) {
    heatmapDiv.innerHTML = '<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #8b98a5;">ユーザーを選択してください</div>';
  }
  
  // エンゲージメント推移（時系列グラフ）をクリア
  const timeSeriesDiv = document.getElementById('influenceTimeSeries');
  if (timeSeriesDiv) {
    timeSeriesDiv.innerHTML = '<div style="min-height: 200px; display: flex; align-items: center; justify-content: center; color: #8b98a5;">データを収集してください</div>';
  }
}

/**
 * 単一ツイートの影響力ポイントを計算
 */
function calculateTweetInfluenceScore(tweet) {
  const likes = tweet.public_metrics?.like_count || tweet.favorite_count || tweet.like_count || 0;
  const retweets = tweet.public_metrics?.retweet_count || tweet.retweet_count || 0;
  const replies = tweet.public_metrics?.reply_count || tweet.reply_count || 0;
  const views = parseInt(tweet.public_metrics?.view_count) || parseInt(tweet.public_metrics?.impression_count) || 0;
  
  // シンプルなスコア計算：ボーナス等は一切なし
  const likesScore = likes * 1.0;        // いいね: 1pt
  const retweetsScore = retweets * 3.0;  // リツイート: 3pt（拡散効果重視）
  const repliesScore = replies * 2.0;    // 返信: 2pt（議論を誘発）
  const viewsScore = views * 0.01;       // 閲覧: 0.01pt
  
  const rawScore = likesScore + retweetsScore + repliesScore + viewsScore;
  
  // 時間重み（月単位で固定）
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-11
  
  const tweetDate = new Date(tweet.created_at || tweet.timestamp);
  const tweetYear = tweetDate.getFullYear();
  const tweetMonth = tweetDate.getMonth(); // 0-11
  
  // 月単位の経過期間を計算（同じ月内なら値は変わらない）
  const monthsElapsed = (currentYear - tweetYear) * 12 + (currentMonth - tweetMonth);
  
  // 月単位で減衰: 1ヶ月で98%、12ヶ月で78%、60ヶ月（5年）で54%程度
  const timeWeight = Math.pow(0.98, Math.max(0, monthsElapsed));
  const adjustedTimeWeight = Math.max(timeWeight, 0.5); // 最低50%は保証
  
  // 最終スコア
  const finalScore = rawScore * adjustedTimeWeight;
  
  return {
    rawScore: rawScore.toFixed(1),
    timeWeight: adjustedTimeWeight.toFixed(3),
    finalScore: finalScore.toFixed(1)
  };
}

// ========== ツールチップ機能 ==========================================================

function setupTotalScoreTooltip() {
  const helpIcon = document.querySelector('.total-score-help-icon');
  const tooltip = document.querySelector('.total-score-help-tooltip');
  
  if (helpIcon && tooltip) {
    // ホバー時に表示
    helpIcon.addEventListener('mouseover', () => {
      tooltip.style.display = 'block';
      helpIcon.style.background = '#1da1f2';
    });
    
    // ホバー終了時に非表示
    helpIcon.addEventListener('mouseout', () => {
      tooltip.style.display = 'none';
      helpIcon.style.background = '#536471';
    });
    
    // ツールチップ自体にホバーしている間は表示維持
    tooltip.addEventListener('mouseover', () => {
      tooltip.style.display = 'block';
      helpIcon.style.background = '#1da1f2';
    });
    
    tooltip.addEventListener('mouseout', () => {
      tooltip.style.display = 'none';
      helpIcon.style.background = '#536471';
    });
  }
}

// ========== 新機能: 複数ユーザー比較 ==========================================================

function updateUserSelector(userTweets) {
  const selector = document.getElementById('influenceUserSelector');
  const comparisonList = document.getElementById('comparisonUserList');
  
  const usernames = Object.keys(userTweets);
  
  if (window.influenceAnalysisState.compareMode) {
    // 比較モード: ヘッダーのセレクタは非表示、左側のリストにチェックボックスを表示
    if (selector) {
      selector.innerHTML = '';
    }
    
    if (comparisonList) {
      comparisonList.innerHTML = `
        ${usernames.map(username => `
          <label style="display: flex; align-items: center; gap: 8px; padding: 8px; cursor: pointer; border-radius: 4px; transition: background 0.2s;" class="user-checkbox-label" data-username="${username}">
            <input type="checkbox" value="${username}" class="user-checkbox" style="margin: 0;">
            <span style="font-size: 13px; color: #ffffff;">@${username} (${userTweets[username].length}件)</span>
          </label>
        `).join('')}
      `;
      
      // チェックボックスのイベントリスナー
      comparisonList.querySelectorAll('.user-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', handleUserSelection);
      });
      
      // ホバーエフェクトのイベントリスナー
      comparisonList.querySelectorAll('.user-checkbox-label').forEach(label => {
        label.addEventListener('mouseover', function() {
          this.style.background = '#1a2634';
        });
        label.addEventListener('mouseout', function() {
          this.style.background = 'transparent';
        });
      });
    }
  } else {
    // 単一モード: プルダウン（ヘッダーに表示）
    if (selector) {
      selector.innerHTML = `
        <select id="singleUserSelector" style="background: #253341; border: 1px solid #38444d; color: #ffffff; padding: 6px 12px; border-radius: 8px; font-size: 13px; min-width: 200px;">
          <option value="">ユーザーを選択してください</option>
          ${usernames.map(username => `
            <option value="${username}">@${username} (${userTweets[username].length}件)</option>
          `).join('')}
        </select>
      `;
      
      // プルダウンのイベントリスナー
      const select = selector.querySelector('#singleUserSelector');
      if (select) {
        select.addEventListener('change', (e) => {
          if (e.target.value) {
            analyzeUserInfluence(e.target.value, userTweets[e.target.value]);
          } else {
            showEmptyInfluenceState();
          }
        });
      }
    }
  }
}

function toggleCompareMode() {
  const state = window.influenceAnalysisState;
  state.compareMode = !state.compareMode;
  state.selectedUsers = [];
  
  // ボタンの表示を更新
  const btn = document.getElementById('influenceCompareMode');
  if (btn) {
    if (state.compareMode) {
      btn.classList.remove('btn-secondary');
      btn.classList.add('btn-primary');
      btn.innerHTML = '<span>📊</span> 単一モード';
    } else {
      btn.classList.remove('btn-primary');
      btn.classList.add('btn-secondary');  
      btn.innerHTML = '<span>⚖️</span> 比較モード';
    }
  }
  
  // 表示モードを切り替え
  const singleMode = document.getElementById('influenceContentSingle');
  const compareMode = document.getElementById('influenceContentCompare');
  
  if (state.compareMode) {
    singleMode.style.display = 'none';
    compareMode.style.display = 'block';
  } else {
    singleMode.style.display = 'block';
    compareMode.style.display = 'none';
  }
  
  // ユーザー選択UIを更新
  updateUserSelector(state.userTweets);
  
  // 表示をクリア
  if (state.compareMode) {
    showEmptyCompareState();
  } else {
    showEmptyInfluenceState();
  }
}

function handleUserSelection(e) {
  const state = window.influenceAnalysisState;
  const username = e.target.value;
  
  if (e.target.checked) {
    if (!state.selectedUsers.includes(username)) {
      state.selectedUsers.push(username);
    }
  } else {
    state.selectedUsers = state.selectedUsers.filter(u => u !== username);
  }
  
  // 比較分析を更新
  if (state.selectedUsers.length > 0) {
    analyzeUsersComparison(state.selectedUsers);
  } else {
    showEmptyCompareState();
  }
}

function analyzeUsersComparison(usernames) {
  const state = window.influenceAnalysisState;
  const userData = usernames.map(username => {
    const tweets = state.userTweets[username];
    const stats = calculateUserStats(tweets);
    return { username, tweets, stats };
  });
  
  // 比較表を更新
  updateComparisonTable(userData);
  
  // 比較レーダーチャートを更新
  updateComparisonRadarChart(userData);
  
}

function showEmptyCompareState() {
  // 比較テーブルをクリア
  const table = document.getElementById('influenceComparisonTable');
  if (table) {
    table.innerHTML = '<tr><td style="padding: 20px; text-align: center; color: #8b98a5;">ユーザーを選択してください</td></tr>';
  }
  
  // レーダーチャートをクリア
  const canvas = document.getElementById('influenceCompareRadarChart');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  
  // 比較レーダーチャートの凡例をクリア
  const legendDiv = document.getElementById('influenceComparisonLegend');
  if (legendDiv) {
    legendDiv.innerHTML = '';
  }
}

function updateComparisonTable(userData) {
  const table = document.getElementById('influenceComparisonTable');
  if (!table) return;
  
  const headers = ['ユーザー', '総合スコア', '最大いいね', '最大RT', '最大閲覧数', '投稿頻度', '安定性', 'ツイート数'];
  
  const headerRow = `
    <tr style="background: #192734;">
      ${headers.map(header => `<th style="padding: 12px; text-align: left; border-bottom: 1px solid #38444d; color: #8b98a5; font-size: 12px; font-weight: 600;">${header}</th>`).join('')}
    </tr>
  `;
  
  const dataRows = userData.map((user, index) => {
    const color = keywordColors[index % keywordColors.length];
    
    // userにstatsがない場合は影響力統計を計算
    if (!user.stats || !user.stats.accountScore) {
      const influenceStats = calculateInfluenceStats(user.tweets || []);
      user.stats = { ...user.stats, ...influenceStats };
    }
    
    return `
      <tr style="border-bottom: 1px solid #38444d;">
        <td style="padding: 12px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <div style="width: 12px; height: 12px; border-radius: 50%; background: ${color};"></div>
            <span style="color: #ffffff; font-weight: 600;">@${user.username || 'unknown'}</span>
          </div>
        </td>
        <td style="padding: 12px; color: ${color}; font-weight: 700; font-size: 16px;">${(user.stats.accountScore || 0).toLocaleString()}</td>
        <td style="padding: 12px; color: #ffffff;">${(user.stats.maxLikes || 0).toLocaleString()}</td>
        <td style="padding: 12px; color: #ffffff;">${(user.stats.maxRetweets || 0).toLocaleString()}</td>
        <td style="padding: 12px; color: #ffffff;">${(user.stats.maxViews || 0).toLocaleString()}</td>
        <td style="padding: 12px; color: #ffffff;">${(user.stats.postFrequencyWeek || 0).toFixed(1)}/週</td>
        <td style="padding: 12px; color: #ffffff;">${(user.stats.stabilityMedianLikes || 0).toFixed(1)}</td>
        <td style="padding: 12px; color: #ffffff;">${(user.tweets ? user.tweets.length : 0).toLocaleString()}</td>
      </tr>
    `;
  }).join('');
  
  table.innerHTML = headerRow + dataRows;
}

function updateComparisonRadarChart(userData) {
  const canvas = document.getElementById('influenceCompareRadarChart');
  if (!canvas) return;
  
  // 統計データをキャッシュ
  const processedUserData = userData.map(user => {
    // 既にキャッシュされた統計があるか確認
    const cacheKey = `${user.username}_${user.tweets.length}`;
    if (!window.influenceAnalysisState.statsCache) {
      window.influenceAnalysisState.statsCache = {};
    }
    
    if (window.influenceAnalysisState.statsCache[cacheKey]) {
      return {
        ...user,
        stats: window.influenceAnalysisState.statsCache[cacheKey]
      };
    }
    
    // 新規計算して、キャッシュに保存
    const stats = calculateUserStats(user.tweets);
    window.influenceAnalysisState.statsCache[cacheKey] = stats;
    return {
      ...user,
      stats
    };
  });
  
  drawComparisonRadarChartWithData(processedUserData);
}

function drawComparisonRadarChartWithData(userData) {
  const canvas = document.getElementById('influenceCompareRadarChart');
  if (!canvas) return;
  
  const ctx = canvas.getContext('2d');
  canvas.width = 450;
  canvas.height = 450;
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const radius = Math.min(centerX, centerY) - 80;
  
  // キャンバスをクリア
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // 8軸のラベル（絵文字付き）
  const radarLabels = ['❤️ 最大いいね', '❤️ 上位平均いいね', '🔄 最大RT', '🔄 上位平均RT', '👁️ 最大閲覧', '👁️ 上位平均閲覧', '📊 投稿頻度(週)', '⚡ 安定性'];
  
  // 基準値の定義（100%として扱う値）
  const benchmarks = [
    10000,  // maxLikes
    2000,   // topAvgLikes
    1000,   // maxRetweets (変更: 5000 -> 1000)
    200,    // topAvgRetweets (変更: 1000 -> 200)
    100000,  // maxViews
    20000,  // topAvgViews
    50,     // postFrequencyWeek (変更: 14 -> 50)
    100     // stabilityMedianLikes
  ];
  
  // 各ユーザーのレーダーデータを準備
  const allRadarData = userData.map(user => {
    if (!user.stats || !user.stats.radarValues) {
      const influenceStats = calculateInfluenceStats(user.tweets || []);
      user.stats = { ...user.stats, ...influenceStats };
    }
    
    return [
      { value: user.stats.radarValues?.maxLikes || 0, actualValue: user.stats.maxLikes || 0, benchmark: benchmarks[0] },
      { value: user.stats.radarValues?.topAvgLikes || 0, actualValue: user.stats.topAvgLikes || 0, benchmark: benchmarks[1] },
      { value: user.stats.radarValues?.maxRetweets || 0, actualValue: user.stats.maxRetweets || 0, benchmark: benchmarks[2] },
      { value: user.stats.radarValues?.topAvgRetweets || 0, actualValue: user.stats.topAvgRetweets || 0, benchmark: benchmarks[3] },
      { value: user.stats.radarValues?.maxViews || 0, actualValue: user.stats.maxViews || 0, benchmark: benchmarks[4] },
      { value: user.stats.radarValues?.topAvgViews || 0, actualValue: user.stats.topAvgViews || 0, benchmark: benchmarks[5] },
      { value: user.stats.radarValues?.postFrequencyWeek || 0, actualValue: user.stats.postFrequencyWeek || 0, benchmark: benchmarks[6] },
      { value: user.stats.radarValues?.stabilityMedianLikes || 0, actualValue: user.stats.stabilityMedianLikes || 0, benchmark: benchmarks[7] }
    ];
  });
  
  // 線形モードかどうかを確認
  const isLinearMode = window.radarScaleMode === 'linear';
  
  // グリッド表示の設定
  let displayMaxValue = 100; // グリッド表示用の最大値（パーセンテージ）
  let actualMaxForGrid = 100; // 線形モードで使用する実際の最大値
  if (isLinearMode) {
    // 全ユーザーのデータから実際の最大値を取得（実際の値/基準値の比率）
    const allRatios = allRadarData.flat().map(d => d.actualValue / d.benchmark);
    actualMaxForGrid = Math.max(...allRatios);
    // グリッド表示用の最大値を設定（100%を基準として、実際の最大値の比率を使用）
    displayMaxValue = Math.ceil(actualMaxForGrid * 100 / 20) * 20;
    displayMaxValue = Math.max(displayMaxValue, 100);
  }
  
  // 背景グリッドを描画
  ctx.strokeStyle = '#38444d';
  ctx.lineWidth = 1;
  
  const gridSteps = isLinearMode ? 5 : 7; // 線形: 5段階、対数: 7段階
  const gridMax = isLinearMode ? 5 : 7;
  
  for (let i = 1; i <= gridMax; i++) {
    const ratio = isLinearMode ? i / 5 : i / 5; // 線形: 20%刻み、対数: 20%刻み（最大140%）
    ctx.beginPath();
    for (let j = 0; j < radarLabels.length; j++) {
      const angle = (j * 2 * Math.PI) / radarLabels.length - Math.PI / 2;
      const x = centerX + Math.cos(angle) * radius * ratio;
      const y = centerY + Math.sin(angle) * radius * ratio;
      if (j === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.closePath();
    ctx.stroke();
  }
  
  // 100%ラインを描画（ズームレベルに応じて位置を調整）
  const hundredPercentPosition = 1.0 / window.radarZoomLevel; // ズームレベルに応じた100%の位置
  
  if (hundredPercentPosition <= 1.0 && hundredPercentPosition >= 0.05) { // 表示範囲内の場合のみ描画
    ctx.strokeStyle = '#ff6b35';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let j = 0; j < radarLabels.length; j++) {
      const angle = (j * 2 * Math.PI) / radarLabels.length - Math.PI / 2;
      const x = centerX + Math.cos(angle) * radius * hundredPercentPosition;
      const y = centerY + Math.sin(angle) * radius * hundredPercentPosition;
      if (j === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.closePath();
    ctx.stroke();
    ctx.strokeStyle = '#38444d';
    ctx.lineWidth = 1;
  }
  
  // 軸を描画
  ctx.strokeStyle = '#38444d';
  ctx.lineWidth = 1;
  for (let i = 0; i < radarLabels.length; i++) {
    const angle = (i * 2 * Math.PI) / radarLabels.length - Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(centerX + Math.cos(angle) * radius, centerY + Math.sin(angle) * radius);
    ctx.stroke();
  }
  
  // ラベルを描画
  ctx.fillStyle = '#8b98a5';  // 薄いグレー
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  for (let i = 0; i < radarLabels.length; i++) {
    const angle = (i * 2 * Math.PI) / radarLabels.length - Math.PI / 2;
    const labelRadius = radius + 30;
    const x = centerX + Math.cos(angle) * labelRadius;
    const y = centerY + Math.sin(angle) * labelRadius;
    
    // ラベルを表示（絵文字付き）
    const label = radarLabels[i];
    // 絵文字とテキストを分離
    const emojiMatch = label.match(/^([^\s]+)\s+(.+)$/);
    if (emojiMatch && label.length > 10) {
      // 絵文字と長いテキストの場合は2行に分割
      const emoji = emojiMatch[1];
      const text = emojiMatch[2];
      ctx.fillText(emoji, x, y - 6);
      ctx.fillText(text, x, y + 8);
    } else {
      // 短いラベルはそのまま表示
      ctx.fillText(label, x, y + 2);
    }
  }
  
  // 各ユーザーのデータを描画
  userData.forEach((user, index) => {
    const color = keywordColors[index % keywordColors.length];
    const radarData = allRadarData[index]; // すでに準備済みのデータを使用
    
    // データライン描画
    ctx.strokeStyle = color;
    ctx.fillStyle = color + '30'; // 30%透明度
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    for (let i = 0; i < radarData.length; i++) {
      const angle = (i * 2 * Math.PI) / radarData.length - Math.PI / 2;
      let normalizedValue;
      if (isLinearMode) {
        // 線形モード: 実際の値を基準値で割って位置を計算
        normalizedValue = (radarData[i].actualValue / radarData[i].benchmark) / window.radarZoomLevel;
      } else {
        // 対数モード: 正規化された値を使用（最大150%まで）
        normalizedValue = Math.min(radarData[i].value / 100, 1.5) / window.radarZoomLevel;
      }
      const x = centerX + Math.cos(angle) * radius * normalizedValue;
      const y = centerY + Math.sin(angle) * radius * normalizedValue;
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.closePath();
    ctx.stroke();
    ctx.fill();
  });
  
  // データポイントに数値を表示（オプション）
  if (window.radarShowValues) {
    userData.forEach((user, index) => {
      const color = keywordColors[index % keywordColors.length];
      const radarData = allRadarData[index];
      
      ctx.fillStyle = '#ffffff';
      ctx.font = '8px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      for (let i = 0; i < radarData.length; i++) {
        const angle = (i * 2 * Math.PI) / radarData.length - Math.PI / 2;
        let normalizedValue;
        if (isLinearMode) {
          // 線形モード: 実際の値を基準値で割って位置を計算
          normalizedValue = (radarData[i].actualValue / radarData[i].benchmark) / window.radarZoomLevel;
        } else {
          // 対数モード: 正規化された値を使用（最大150%まで）
          normalizedValue = Math.min(radarData[i].value / 100, 1.5) / window.radarZoomLevel;
        }
        const x = centerX + Math.cos(angle) * radius * normalizedValue;
        const y = centerY + Math.sin(angle) * radius * normalizedValue;
        
        // 背景の円を描画（視認性のため）
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, 10, 0, 2 * Math.PI);
        ctx.fill();
        
        // 数値を描画
        ctx.fillStyle = '#ffffff';
        const displayValue = isLinearMode 
          ? (radarData[i].actualValue !== undefined ? radarData[i].actualValue.toFixed(1) : radarData[i].value.toFixed(0))
          : radarData[i].value.toFixed(0);
        ctx.fillText(displayValue, x, y);
      }
    });
  }
  
  // パーセンテージ表示 - 不要のためコメントアウト
  // ctx.fillStyle = '#8b98a5';
  // ctx.font = '8px Arial';
  // ctx.textAlign = 'left';
  // 
  // if (isLinearMode) {
  //   // 線形モード: 動的スケールに応じた表示
  //   for (let i = 1; i <= 5; i++) {
  //     const percentage = Math.round((i / 5) * displayMaxValue);
  //     const x = centerX + radius * (i / 5) + 5;
  //     const y = centerY + 3;
  //     ctx.fillText(`${percentage}%`, x, y);
  //   }
  // } else {
  //   // 対数モード: 20%, 40%, 60%, 80%, 100%
  //   for (let i = 1; i <= 5; i++) {
  //     const percentage = i * 20;
  //     const x = centerX + radius * (i / 5) + 5;
  //     const y = centerY + 3;
  //     ctx.fillText(`${percentage}%`, x, y);
  //   }
  // }
  
  // 凡例を更新
  const legend = document.getElementById('influenceComparisonLegend');
  if (legend) {
    legend.innerHTML = userData.map((user, index) => {
      const color = keywordColors[index % keywordColors.length];
      return `
        <div style="display: flex; align-items: center; gap: 8px; font-size: 13px;">
          <div style="width: 16px; height: 16px; border-radius: 4px; background: ${color};"></div>
          <span style="color: #ffffff;">@${user.username}</span>
        </div>
      `;
    }).join('');
  }
  
  // 比較モード用のスケール切り替えボタンのイベントリスナーを設定（初回のみ）
  const logBtnCompare = document.getElementById('radarScaleLogCompare');
  const linearBtnCompare = document.getElementById('radarScaleLinearCompare');
  
  if (logBtnCompare && !logBtnCompare.hasAttribute('data-listener')) {
    logBtnCompare.addEventListener('click', () => {
      window.setRadarScale('log');
      // 比較モード用のボタンスタイルも更新
      updateCompareButtonStyles();
    });
    logBtnCompare.setAttribute('data-listener', 'true');
  }
  
  if (linearBtnCompare && !linearBtnCompare.hasAttribute('data-listener')) {
    linearBtnCompare.addEventListener('click', () => {
      window.setRadarScale('linear');
      // 比較モード用のボタンスタイルも更新
      updateCompareButtonStyles();
    });
    linearBtnCompare.setAttribute('data-listener', 'true');
  }
  
  // 比較モード用の数値表示切り替えボタンのイベントリスナーを設定（初回のみ）
  const showBtnCompare = document.getElementById('radarValuesShowCompare');
  const hideBtnCompare = document.getElementById('radarValuesHideCompare');
  
  if (showBtnCompare && !showBtnCompare.hasAttribute('data-listener')) {
    showBtnCompare.addEventListener('click', () => {
      window.setRadarValues(true);
      // 比較モード用のボタンスタイルも更新
      updateCompareButtonStyles();
    });
    showBtnCompare.setAttribute('data-listener', 'true');
  }
  
  if (hideBtnCompare && !hideBtnCompare.hasAttribute('data-listener')) {
    hideBtnCompare.addEventListener('click', () => {
      window.setRadarValues(false);
      // 比較モード用のボタンスタイルも更新
      updateCompareButtonStyles();
    });
    hideBtnCompare.setAttribute('data-listener', 'true');
  }
  
  // ズームボタンのイベントリスナーを設定（初回のみ）
  const zoomInBtn = document.getElementById('radarZoomIn');
  const zoomOutBtn = document.getElementById('radarZoomOut');
  const zoomResetBtn = document.getElementById('radarZoomReset');
  const compareCanvas = document.getElementById('influenceCompareRadarChart');
  
  if (zoomInBtn && !zoomInBtn.hasAttribute('data-listener')) {
    zoomInBtn.addEventListener('click', () => {
      window.setRadarZoom(window.radarZoomLevel * 0.8);
    });
    zoomInBtn.setAttribute('data-listener', 'true');
  }
  
  if (zoomOutBtn && !zoomOutBtn.hasAttribute('data-listener')) {
    zoomOutBtn.addEventListener('click', () => {
      window.setRadarZoom(window.radarZoomLevel * 1.25);
    });
    zoomOutBtn.setAttribute('data-listener', 'true');
  }
  
  if (zoomResetBtn && !zoomResetBtn.hasAttribute('data-listener')) {
    zoomResetBtn.addEventListener('click', () => {
      window.setRadarZoom(1.0);
    });
    zoomResetBtn.setAttribute('data-listener', 'true');
  }
  
  // マウスホイールでのズーム
  if (compareCanvas && !compareCanvas.hasAttribute('data-wheel-listener')) {
    compareCanvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 1.1 : 0.9;
      window.setRadarZoom(window.radarZoomLevel * delta);
    });
    compareCanvas.setAttribute('data-wheel-listener', 'true');
  }
  
  // 初期状態でボタンスタイルを更新
  updateCompareButtonStyles();
  
  // エンゲージメント推移グラフの更新
  updateComparisonEngagementChart(userData);
}

// 比較モード用エンゲージメント推移グラフの更新
function updateComparisonEngagementChart(userData) {
  const canvas = document.getElementById('engagementComparisonChart');
  if (!canvas) return;
  
  // 初期描画
  drawComparisonEngagementChart(userData);
  
  // イベントリスナーを設定（初回のみ）- 新しいUI要素に対応
  const metricSelect = document.getElementById('comparisonEngagementMetric');
  const periodSelect = document.getElementById('comparisonEngagementPeriod');
  const rangeSelect = document.getElementById('comparisonEngagementRange');
  const customRangeInputs = document.getElementById('comparisonCustomRangeInputs');
  const applyDateBtn = document.getElementById('comparisonApplyDateRange');
  
  // 共通の再描画関数 - グローバル状態から最新のユーザーデータを取得
  const redrawChart = () => {
    if (window.influenceAnalysisState?.compareMode && window.influenceAnalysisState?.selectedUsers?.length > 0) {
      const currentUserData = window.influenceAnalysisState.selectedUsers.map(username => ({
        username,
        name: username, // nameフィールドも追加
        tweets: window.influenceAnalysisState.userTweets[username] || []
      }));
      drawComparisonEngagementChart(currentUserData);
    } else {
      drawComparisonEngagementChart([]);
    }
  };
  
  if (metricSelect && !metricSelect.hasAttribute('data-listener')) {
    metricSelect.addEventListener('change', redrawChart);
    metricSelect.setAttribute('data-listener', 'true');
  }
  
  if (periodSelect && !periodSelect.hasAttribute('data-listener')) {
    periodSelect.addEventListener('change', redrawChart);
    periodSelect.setAttribute('data-listener', 'true');
  }
  
  if (rangeSelect && !rangeSelect.hasAttribute('data-listener')) {
    rangeSelect.addEventListener('change', () => {
      if (rangeSelect.value === 'custom') {
        customRangeInputs.style.display = 'flex';
      } else {
        customRangeInputs.style.display = 'none';
        redrawChart();
      }
    });
    rangeSelect.setAttribute('data-listener', 'true');
  }
  
  if (applyDateBtn && !applyDateBtn.hasAttribute('data-listener')) {
    applyDateBtn.addEventListener('click', redrawChart);
    applyDateBtn.setAttribute('data-listener', 'true');
  }
}

// 比較モード用エンゲージメント推移グラフの描画
function drawComparisonEngagementChart(userData) {
  const canvas = document.getElementById('engagementComparisonChart');
  if (!canvas) return;
  
  const ctx = canvas.getContext('2d');
  
  // 新しいUI要素から設定を取得
  const metricSelect = document.getElementById('comparisonEngagementMetric');
  const periodSelect = document.getElementById('comparisonEngagementPeriod');
  const rangeSelect = document.getElementById('comparisonEngagementRange');
  const startDateInput = document.getElementById('comparisonStartDate');
  const endDateInput = document.getElementById('comparisonEndDate');
  
  const selectedMetric = metricSelect ? metricSelect.value : 'likes';
  const selectedPeriod = periodSelect ? periodSelect.value : 'daily';
  const selectedRange = rangeSelect ? rangeSelect.value : 'all';
  
  // Canvasをクリアし、単一モードと同じ背景色を設定
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#192734';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  if (userData.length === 0) {
    ctx.fillStyle = '#8b98a5';
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('ユーザーを選択してください', canvas.width / 2, canvas.height / 2);
    return;
  }
  
  // 各ユーザーのデータを処理
  const userColors = ['#1da1f2', '#e91e63', '#4caf50', '#ff9800', '#9c27b0', '#f44336', '#2196f3', '#795548'];
  const allDataPoints = [];
  const userDataSets = [];
  
  userData.forEach((user, userIndex) => {
    let tweets = user.tweets || [];
    
    // 期間フィルターを適用
    if (selectedRange === 'custom' && startDateInput && endDateInput && startDateInput.value && endDateInput.value) {
      const startDate = new Date(startDateInput.value);
      const endDate = new Date(endDateInput.value);
      endDate.setHours(23, 59, 59, 999); // 終了日の最後まで含む
      
      tweets = tweets.filter(tweet => {
        const tweetDate = new Date(tweet.created_at || tweet.date);
        return tweetDate >= startDate && tweetDate <= endDate;
      });
    }
    
    // ツイートを日付でソート
    const sortedTweets = tweets.sort((a, b) => new Date(a.created_at || a.date) - new Date(b.created_at || b.date));
    
    // 期間に応じてグループ化
    const aggregatedData = {};
    
    sortedTweets.forEach(tweet => {
      const date = new Date(tweet.created_at || tweet.date);
      if (isNaN(date.getTime())) return;
      
      let key;
      switch (selectedPeriod) {
        case 'daily':
          key = date.toISOString().split('T')[0]; // YYYY-MM-DD
          break;
        case 'weekly':
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          key = weekStart.toISOString().split('T')[0];
          break;
        case 'monthly':
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          break;
        case 'yearly':
          key = date.getFullYear().toString();
          break;
        default:
          key = date.toISOString().split('T')[0];
      }
      
      if (!aggregatedData[key]) {
        aggregatedData[key] = { 
          date: key, 
          posts: 0, 
          likes: 0, 
          retweets: 0, 
          replies: 0, 
          views: 0 
        };
      }
      
      aggregatedData[key].posts++; // tweetsをpostsに変更
      aggregatedData[key].likes += tweet.public_metrics?.like_count || tweet.favorite_count || tweet.like_count || 0;
      aggregatedData[key].retweets += tweet.public_metrics?.retweet_count || tweet.retweet_count || 0;
      aggregatedData[key].replies += tweet.public_metrics?.reply_count || tweet.reply_count || 0;
      aggregatedData[key].views += tweet.public_metrics?.view_count || 0;
    });
    
    const dataPoints = Object.values(aggregatedData).sort((a, b) => new Date(a.date) - new Date(b.date));
    userDataSets.push({
      username: user.username || user.name,
      color: userColors[userIndex % userColors.length],
      data: dataPoints
    });
    allDataPoints.push(...dataPoints);
  });
  
  if (allDataPoints.length === 0) {
    ctx.fillStyle = '#8b98a5';
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('データがありません', canvas.width / 2, canvas.height / 2);
    return;
  }
  
  // 描画領域の設定
  const padding = { top: 30, right: 30, bottom: 50, left: 70 };
  const chartWidth = canvas.width - padding.left - padding.right;
  const chartHeight = canvas.height - padding.top - padding.bottom;
  
  // 日付範囲を取得
  const allDates = allDataPoints.map(d => new Date(d.date));
  const minDate = new Date(Math.min(...allDates));
  const maxDate = new Date(Math.max(...allDates));
  const dateRange = maxDate - minDate || 1; // 0除算を防ぐ
  
  // 値の範囲を取得
  const maxValue = Math.max(...allDataPoints.map(d => d[selectedMetric]), 1); // 最小値1で0除算を防ぐ
  
  // グリッド線を描画（単一モードと同様）
  ctx.strokeStyle = '#2c3e50';
  ctx.lineWidth = 0.5;
  const gridSteps = 5;
  for (let i = 1; i < gridSteps; i++) {
    const y = padding.top + (i / gridSteps) * chartHeight;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(padding.left + chartWidth, y);
    ctx.stroke();
  }
  
  // 各ユーザーのラインを描画
  userDataSets.forEach(userDataSet => {
    ctx.strokeStyle = userDataSet.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    let isFirstPoint = true;
    userDataSet.data.forEach(point => {
      const x = padding.left + ((new Date(point.date) - minDate) / dateRange) * chartWidth;
      const y = padding.top + chartHeight - (point[selectedMetric] / maxValue) * chartHeight;
      
      if (isFirstPoint) {
        ctx.moveTo(x, y);
        isFirstPoint = false;
      } else {
        ctx.lineTo(x, y);
      }
    });
    
    ctx.stroke();
    
    // データポイントを描画
    ctx.fillStyle = userDataSet.color;
    userDataSet.data.forEach(point => {
      const x = padding.left + ((new Date(point.date) - minDate) / dateRange) * chartWidth;
      const y = padding.top + chartHeight - (point[selectedMetric] / maxValue) * chartHeight;
      
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, 2 * Math.PI);
      ctx.fill();
    });
  });
  
  // 軸を描画（単一モードと同じスタイル）
  ctx.strokeStyle = '#4a5568';
  ctx.lineWidth = 1;
  
  // Y軸
  ctx.beginPath();
  ctx.moveTo(padding.left, padding.top);
  ctx.lineTo(padding.left, padding.top + chartHeight);
  ctx.stroke();
  
  // X軸
  ctx.beginPath();
  ctx.moveTo(padding.left, padding.top + chartHeight);
  ctx.lineTo(padding.left + chartWidth, padding.top + chartHeight);
  ctx.stroke();
  
  // Y軸ラベル（単一モードと同じスタイル）
  ctx.fillStyle = '#a0aec0';
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'right';
  const ySteps = 5;
  for (let i = 0; i <= ySteps; i++) {
    const value = Math.round((maxValue / ySteps) * i);
    const y = padding.top + chartHeight - (i / ySteps) * chartHeight;
    ctx.fillText(value.toLocaleString(), padding.left - 10, y + 4);
  }
  
  // X軸ラベル（日付）を追加
  ctx.textAlign = 'center';
  ctx.fillStyle = '#a0aec0';
  const uniqueDates = [...new Set(allDataPoints.map(d => d.date))].sort();
  const maxLabels = Math.floor(chartWidth / 80);
  const labelInterval = Math.max(1, Math.floor(uniqueDates.length / maxLabels));
  
  uniqueDates.forEach((date, index) => {
    if (index % labelInterval === 0) {
      const x = padding.left + ((new Date(date) - minDate) / dateRange) * chartWidth;
      const displayDate = formatDateForDisplay(date, selectedPeriod);
      ctx.fillText(displayDate, x, padding.top + chartHeight + 20);
    }
  });
  
  // 日付表示をフォーマットする関数
  function formatDateForDisplay(dateString, period) {
    switch (period) {
      case 'weekly':
        return new Date(dateString).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' });
      case 'monthly':
        const [year, month] = dateString.split('-');
        return `${year}/${month}`;
      case 'yearly':
        return dateString;
      default: // daily
        return new Date(dateString).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' });
    }
  }
  
  // 凡例を更新
  updateComparisonEngagementLegend(userDataSets);
}

// 比較モード用エンゲージメント推移グラフの凡例を更新
function updateComparisonEngagementLegend(userDataSets) {
  const legendDiv = document.getElementById('comparisonEngagementLegend');
  if (!legendDiv) return;
  
  const legendItems = userDataSets.map(userDataSet => 
    `<div style="display: flex; align-items: center; gap: 8px;">
      <div style="width: 16px; height: 3px; background: ${userDataSet.color}; border-radius: 2px;"></div>
      <span style="color: #ffffff; font-size: 12px;">@${userDataSet.username}</span>
    </div>`
  ).join('');
  
  legendDiv.innerHTML = legendItems;
}

function updateUserCardsGrid(userData) {
  const grid = document.getElementById('influenceUserCardsGrid');
  if (!grid) return;
  
  const cards = userData.map((user, index) => {
    const color = keywordColors[index % keywordColors.length];
    const trendIndicator = getTrendIndicator(user.stats.trendDirection);
    
    return `
      <div style="background: #253341; border: 1px solid #38444d; border-radius: 12px; padding: 16px;">
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
          <div style="width: 48px; height: 48px; background: ${color}; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 18px; color: #ffffff; font-weight: 700;">
            ${user.username.charAt(0).toUpperCase()}
          </div>
          <div>
            <h4 style="margin: 0; color: #ffffff; font-size: 16px;">@${user.username}</h4>
            <p style="margin: 0; color: #8b98a5; font-size: 12px;">${user.tweets.length}件のツイート</p>
          </div>
        </div>
        
        <div style="text-align: center; margin-bottom: 16px; padding: 16px; background: #192734; border-radius: 8px;">
          <div style="font-size: 12px; color: #8b98a5; margin-bottom: 4px;">影響力スコア</div>
          <div style="font-size: 32px; font-weight: 700; color: ${color};">${user.stats.totalScore}</div>
        </div>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px;">
          <div style="background: #192734; padding: 8px; border-radius: 6px; text-align: center;">
            <div style="font-size: 11px; color: #8b98a5;">平均エンゲージメント</div>
            <div style="font-size: 14px; font-weight: 600; color: #ffffff;">${user.stats.avgEngagement.toLocaleString()}</div>
          </div>
          <div style="background: #192734; padding: 8px; border-radius: 6px; text-align: center;">
            <div style="font-size: 11px; color: #8b98a5;">最大いいね</div>
            <div style="font-size: 14px; font-weight: 600; color: #ffffff;">${user.stats.maxLikes.toLocaleString()}</div>
          </div>
        </div>
        
        <div style="display: flex; align-items: center; justify-content: center; gap: 6px; padding: 8px; background: #15202b; border-radius: 6px;">
          <span style="font-size: 14px;">${trendIndicator.icon}</span>
          <span style="color: ${trendIndicator.color}; font-size: 12px; font-weight: 600;">${trendIndicator.text}</span>
        </div>
      </div>
    `;
  }).join('');
  
  grid.innerHTML = cards;
}

// ========== レーダーチャート基準値設定モーダル ==========================================================

function getBenchmarkValues() {
  try {
    const saved = localStorage.getItem('radarChartBenchmarks');
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (error) {
    console.warn('基準値の読み込みに失敗しました:', error);
  }
  
  // デフォルト値を返す
  return {
    likes: radarChartBenchmarks.likes,
    retweets: radarChartBenchmarks.retweets,
    views: radarChartBenchmarks.views,
    frequency: radarChartBenchmarks.frequency,
    volume: radarChartBenchmarks.volume
  };
}

function setupBenchmarkModal() {
  const modal = document.getElementById('radarBenchmarkModal');
  const openBtn = document.getElementById('radarBenchmarkSettings');
  const closeBtn = document.getElementById('closeBenchmarkModal');
  const saveBtn = document.getElementById('saveBenchmarkSettings');
  const resetBtn = document.getElementById('resetBenchmarkDefaults');
  
  if (!modal || !openBtn) return;
  
  // モーダルを開く
  openBtn.addEventListener('click', () => {
    loadBenchmarkValues();
    modal.style.display = 'flex';
  });
  
  // モーダルを閉じる
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      modal.style.display = 'none';
    });
  }
  
  // 背景クリックで閉じる
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.style.display = 'none';
    }
  });
  
  // 保存ボタン
  if (saveBtn) {
    saveBtn.addEventListener('click', saveBenchmarkValues);
  }
  
  // リセットボタン
  if (resetBtn) {
    resetBtn.addEventListener('click', resetBenchmarkValues);
  }
}

function loadBenchmarkValues() {
  const savedBenchmarks = getBenchmarkValues();
  
  document.getElementById('benchmarkLikes').value = savedBenchmarks.likes;
  document.getElementById('benchmarkRetweets').value = savedBenchmarks.retweets;
  document.getElementById('benchmarkViews').value = savedBenchmarks.views;
  document.getElementById('benchmarkFrequency').value = savedBenchmarks.frequency;
  document.getElementById('benchmarkVolume').value = savedBenchmarks.volume;
}

function saveBenchmarkValues() {
  const benchmarks = {
    likes: parseInt(document.getElementById('benchmarkLikes').value) || radarChartBenchmarks.likes,
    retweets: parseInt(document.getElementById('benchmarkRetweets').value) || radarChartBenchmarks.retweets,
    views: parseInt(document.getElementById('benchmarkViews').value) || radarChartBenchmarks.views,
    frequency: parseFloat(document.getElementById('benchmarkFrequency').value) || radarChartBenchmarks.frequency,
    volume: parseInt(document.getElementById('benchmarkVolume').value) || radarChartBenchmarks.volume
  };
  
  // LocalStorageに保存
  localStorage.setItem('radarChartBenchmarks', JSON.stringify(benchmarks));
  
  // モーダルを閉じる
  document.getElementById('radarBenchmarkModal').style.display = 'none';
  
  // 現在の表示を更新（アカウントが選択されている場合）
  const selectedUser = document.getElementById('singleUserSelector')?.value;
  if (selectedUser && window.influenceAnalysisState?.userTweets?.[selectedUser]) {
    const userTweets = window.influenceAnalysisState.userTweets[selectedUser];
    const influenceStats = calculateInfluenceStats(userTweets);
    drawInfluenceRadarChart(influenceStats);
  }
  
  const addLogSave = window.addLogEntry;
  addLogSave('レーダーチャート基準値を保存しました', 'success');
}

function resetBenchmarkValues() {
  // デフォルト値をフィールドに設定
  document.getElementById('benchmarkLikes').value = radarChartBenchmarks.likes;
  document.getElementById('benchmarkRetweets').value = radarChartBenchmarks.retweets;
  document.getElementById('benchmarkViews').value = radarChartBenchmarks.views;
  document.getElementById('benchmarkFrequency').value = radarChartBenchmarks.frequency;
  document.getElementById('benchmarkVolume').value = radarChartBenchmarks.volume;
  
  // LocalStorageからも削除
  localStorage.removeItem('radarChartBenchmarks');
  
  const addLogReset = window.addLogEntry;
  addLogReset('レーダーチャート基準値をデフォルトにリセットしました', 'info');
}

// 新仕様では基準値設定は不要（対数スケーリングで固定上限使用）
// document.addEventListener('DOMContentLoaded', setupBenchmarkModal);