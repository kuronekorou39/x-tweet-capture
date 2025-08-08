// ========== グローバル変数 ==========================================================

// キーワード管理オブジェクト
const keywordManager = {
  keywords: {},           // すべてのキーワードを保存
  activeTab: 'graph',     // 現在のアクティブタブ
  nextId: 1,              // 次のキーワードID
  maxKeywords: 3,         // 最大キーワード数
  historicalJobs: {},     // 過去データ収集ジョブ
  realtimeJobs: {}        // リアルタイム監視ジョブ
};

// カウントダウンタイマーのグローバル管理
const activeCountdownTimers = {};

// FavoriteTweet API実行フラグ（アプリ起動中は1度だけ実行）
let favoriteTweetExecuted = false;

// レート制限管理
const rateLimitManager = {
  used: 0,
  limit: 50,
  remaining: 50,
  resetTime: null,
  windowStart: Date.now()
};

// カラーテーマ
const keywordColors = [
  '#1da1f2',  // 青
  '#f91880',  // ピンク  
  '#7856ff'   // 紫
];

// パフォーマンス最適化用のインスタンス
let tweetsVirtualScroller = null;

// グラフ表示設定
let showChartValues = false;

// ツイート表示キャッシュ
let cachedTweetsList = null;
let lastTweetsUpdateTime = 0;

// キャッシュをクリアする関数
function clearTweetsCache() {
  cachedTweetsList = null;
  lastTweetsUpdateTime = 0;
}

/**
 * ツイートの重複を防ぎながら追加する関数
 * 同じIDのツイートは上書きされる
 * @param {Array} existingTweets - 既存のツイート配列
 * @param {Array} newTweets - 追加する新しいツイート配列
 * @returns {Array} 重複を除いた結合済みツイート配列
 */
function mergeTweetsWithoutDuplicates(existingTweets, newTweets) {
  // 既存ツイートをID -> ツイートのMapに変換
  const tweetMap = new Map();
  
  // 既存ツイートをMapに追加
  existingTweets.forEach(tweet => {
    if (tweet.id) {
      tweetMap.set(tweet.id, tweet);
    }
  });
  
  // 新しいツイートを追加（同じIDがあれば上書き）
  newTweets.forEach(tweet => {
    if (tweet.id) {
      tweetMap.set(tweet.id, tweet);
    }
  });
  
  // Mapから配列に戻す
  return Array.from(tweetMap.values());
}

// ========== 初期化 ==========================================================

document.addEventListener('DOMContentLoaded', () => {
  initializeUI();
  setupEventListeners();
  setupNetworkMonitoring();
  updateRateLimitDisplay();
  addLogEntry('システム起動完了', 'info');

  // 現在時刻を定期的に更新
  setInterval(updateCurrentTime, 1000);
  
});

function initializeUI() {
  // 初期状態の統計を更新
  updateStats();

  const now = new Date().toLocaleTimeString('ja-JP');
  document.getElementById('logsContent').innerHTML = `
    <div class="log-entry">
      <span class="log-time">${now}</span>
      <span class="log-message log-info">システム起動完了</span>
    </div>
  `;

  // 仮想スクロールを初期化
  initializeVirtualScrollers();
}

/**
 * 仮想スクロールの初期化
 */
function initializeVirtualScrollers() {
  // ツイート一覧用の仮想スクロール
  const tweetsList = document.getElementById('tweetsList');
  if (tweetsList) {
    tweetsVirtualScroller = new VirtualScroller(tweetsList, {
      itemHeight: 160, // ツイートアイテムの高さ
      buffer: 5,
      renderItem: (tweet, index) => {
        return createTweetHTML(tweet, index);
      }
    });

    // イベントデリゲーションを設定
    setupTweetsEventDelegation();
  }
}

/**
 * ツイート一覧のイベントデリゲーション設定
 */
function setupTweetsEventDelegation() {
  const tweetsList = document.getElementById('tweetsList');
  if (!tweetsList) return;

  // イベントデリゲーションでパフォーマンスを向上
  tweetsList.addEventListener('click', (e) => {
    // リンクコピーボタンのクリック処理
    const button = e.target.closest('.link-copy-btn');
    if (button) {
      handleTweetLinkCopy(button);
    }
  });

  tweetsList.addEventListener('error', (e) => {
    // プロフィール画像のエラーハンドリング
    if (e.target.classList.contains('profile-img')) {
      handleProfileImageError(e.target);
    }
  }, true);
}

/**
 * ツイートリンクコピー処理
 */
function handleTweetLinkCopy(button) {
  const tweetId = button.getAttribute('data-tweet-id');
  const screenName = button.getAttribute('data-screen-name');

  // tweetIdまたはscreenNameが無効な場合はエラーメッセージを表示
  if (!tweetId || !screenName || screenName === 'unknown') {
    alert('ツイート情報が不完全なため、リンクをコピーできません。');
    return;
  }

  const tweetUrl = `https://x.com/${screenName}/status/${tweetId}`;

  // DevTools環境ではClipboard APIが使用できないため、直接モーダルを表示
  showCopyModal(tweetUrl);
}

/**
 * コピー用モーダル表示
 */
function showCopyModal(tweetUrl) {
  // 背景オーバーレイ
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.5); z-index: 999;';

  // モーダル本体
  const modalDiv = document.createElement('div');
  modalDiv.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: #253341; border: 1px solid #38444d; padding: 20px; border-radius: 8px; z-index: 1000; color: #ffffff; box-shadow: 0 4px 20px rgba(0,0,0,0.5);';

  const textDiv = document.createElement('div');
  textDiv.style.cssText = 'margin-bottom: 15px; font-size: 14px;';
  textDiv.textContent = 'ツイートリンクをコピーしてください:';

  const input = document.createElement('input');
  input.type = 'text';
  input.value = tweetUrl;
  input.readOnly = true;
  input.style.cssText = 'width: 300px; padding: 8px; background: #192734; border: 1px solid #38444d; color: #ffffff; border-radius: 4px; font-size: 12px;';
  input.addEventListener('click', function () {
    this.select();
  });

  const closeButton = document.createElement('button');
  closeButton.textContent = '閉じる';
  closeButton.style.cssText = 'margin-top: 15px; padding: 8px 16px; background: #1da1f2; color: #ffffff; border: none; border-radius: 4px; cursor: pointer; font-size: 13px;';

  // 閉じる処理を共通化
  const closeModal = function () {
    overlay.remove();
    modalDiv.remove();
  };

  closeButton.addEventListener('click', closeModal);

  // オーバーレイクリックで閉じる
  overlay.addEventListener('click', closeModal);

  // モーダル内クリックでは閉じない
  modalDiv.addEventListener('click', function (e) {
    e.stopPropagation();
  });

  modalDiv.appendChild(textDiv);
  modalDiv.appendChild(input);
  modalDiv.appendChild(closeButton);

  document.body.appendChild(overlay);
  document.body.appendChild(modalDiv);

  // 自動的にテキストを選択
  input.focus();
  input.select();
}

/**
 * プロフィール画像エラーハンドリング
 */
function handleProfileImageError(img) {
  img.style.display = 'none';
  const fallback = img.nextElementSibling;
  if (fallback && fallback.classList.contains('profile-fallback')) {
    fallback.style.display = 'flex';
  }
}

function setupEventListeners() {
  // キーワード追加ボタン
  document.getElementById('addKeywordBtn').addEventListener('click', addKeyword);

  // インポートファイル入力
  document.getElementById('importFileInput').addEventListener('change', handleMultipleFileImport);

  // インポートモーダル設定
  setupImportModal();
  
  // レーダーチャート ヘルプツールチップ設定
  setupRadarHelpTooltip();

  // 全体クリックでツールチップを閉じる
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.keyword-help-icon') && !e.target.closest('.keyword-help-tooltip') &&
      !e.target.closest('.speed-help-icon') && !e.target.closest('.speed-help-tooltip') &&
      !e.target.closest('.radar-help-icon') && !e.target.closest('.radar-help-tooltip') &&
      !e.target.closest('.radar-compare-help-icon') && !e.target.closest('.radar-compare-help-tooltip')) {
      document.querySelectorAll('.keyword-help-tooltip').forEach(tooltip => {
        tooltip.style.display = 'none';
      });
      document.querySelectorAll('.speed-help-tooltip').forEach(tooltip => {
        tooltip.style.display = 'none';
      });
      document.querySelectorAll('.radar-help-tooltip').forEach(tooltip => {
        tooltip.style.display = 'none';
      });
      document.querySelectorAll('.radar-compare-help-tooltip').forEach(tooltip => {
        tooltip.style.display = 'none';
      });
    }
  });


  // チャートタイプ変更とリフレッシュ
  document.getElementById('chartType').addEventListener('change', handleChartTypeChange);
  document.getElementById('refreshChartBtn').addEventListener('click', refreshChart);
  document.getElementById('toggleValuesBtn').addEventListener('click', toggleChartValues);
  
  // 期間モード関連
  document.getElementById('periodMode').addEventListener('change', handlePeriodModeChange);
  document.getElementById('startDate').addEventListener('change', updateChart);
  document.getElementById('endDate').addEventListener('change', updateChart);

  // アカウント分析パネルのイベントリスナー
  document.getElementById('accountSortType')?.addEventListener('change', updateAccountsPanel);
  document.getElementById('accountFilterKeyword')?.addEventListener('change', updateAccountsPanel);

  // タブ切り替え
  document.querySelectorAll('.analytics-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.getAttribute('data-tab');
      switchAnalyticsTab(tabName);
    });
  });

  // ツイートフィルター
  document.querySelectorAll('.keyword-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const filter = btn.getAttribute('data-filter');
      filterTweets(filter);
    });
  });
}

// ========== タブ機能 ==========================================================

function switchAnalyticsTab(tabName) {
  // タブボタンの状態を更新
  document.querySelectorAll('.analytics-tab').forEach(tab => {
    tab.classList.remove('active');
  });
  document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

  // パネルの表示を切り替え
  document.querySelectorAll('.analytics-panel').forEach(panel => {
    panel.classList.remove('active');
  });
  document.getElementById(`${tabName}Panel`).classList.add('active');

  // 影響力分析タブから離れる場合のクリーンアップ
  if (keywordManager.activeTab === 'influence' && tabName !== 'influence') {
    // 影響力分析の状態をリセット
    if (window.influenceAnalysisState) {
      window.influenceAnalysisState.compareMode = false;
      window.influenceAnalysisState.selectedUsers = [];
      window.influenceAnalysisState.selectedUser = null;
    }
    
    // 比較モードボタンをリセット
    const compareModeBtn = document.getElementById('influenceCompareMode');
    if (compareModeBtn) {
      compareModeBtn.classList.remove('btn-primary');
      compareModeBtn.classList.add('btn-secondary');
      compareModeBtn.innerHTML = '<span>⚖️</span> 比較モード';
    }
    
    // 影響力分析の表示をクリア
    const singleModeContent = document.getElementById('influenceContentSingle');
    const compareModeContent = document.getElementById('influenceContentCompare');
    
    if (singleModeContent) {
      // 単一モードの表示要素をリセット
      const usernameElem = document.getElementById('influenceUsername');
      const handleElem = document.getElementById('influenceHandle');
      const scoreElem = document.getElementById('influenceScore');
      const postCountElem = document.getElementById('influencePostCount');
      const postFrequencyElem = document.getElementById('influencePostFrequency');
      const dataSummaryElem = document.getElementById('influenceDataSummary');
      
      if (usernameElem) usernameElem.textContent = 'ユーザーを選択';
      if (handleElem) handleElem.textContent = '@username';
      if (scoreElem) scoreElem.textContent = '0';
      if (postCountElem) postCountElem.textContent = '0';
      if (postFrequencyElem) postFrequencyElem.textContent = '0/週 (0週間)';
      if (dataSummaryElem) dataSummaryElem.textContent = '-';
      
      // エンゲージメント推移グラフをクリア
      const timeSeriesDiv = document.getElementById('influenceTimeSeries');
      if (timeSeriesDiv) {
        timeSeriesDiv.innerHTML = '<div style="min-height: 200px; display: flex; align-items: center; justify-content: center; color: #8b98a5;">データを収集してください</div>';
      }
    }
    
    if (compareModeContent) {
      // 比較モードのグラフをクリア
      const chartContainer = document.getElementById('comparisonChart');
      if (chartContainer) {
        chartContainer.innerHTML = '';
      }
      
      // エンゲージメント推移比較グラフとその凡例をクリア
      const engagementCanvas = document.getElementById('engagementComparisonChart');
      if (engagementCanvas) {
        const ctx = engagementCanvas.getContext('2d');
        ctx.clearRect(0, 0, engagementCanvas.width, engagementCanvas.height);
      }
      
      const engagementLegend = document.getElementById('comparisonEngagementLegend');
      if (engagementLegend) {
        engagementLegend.innerHTML = '';
      }
      
      // 比較モードを非表示
      compareModeContent.style.display = 'none';
    }
  }

  keywordManager.activeTab = tabName;

  // タブ切り替え時に必要な更新処理
  if (tabName === 'influence') {
    updateInfluenceAnalysis();
  } else if (tabName === 'tweets') {
    // ローディング表示
    showTweetsLoading();

    // 非同期で処理を実行
    setTimeout(() => {
      try {
        // 仮想スクロールが初期化されていない場合は初期化
        if (!tweetsVirtualScroller) {
          initializeVirtualScrollers();
        }
        updateTweetsList();
        updateTweetsFilter();
        hideTweetsLoading();
      } catch (error) {
        addLogEntry(`ツイート表示エラー: ${error.message}`, 'error');
        hideTweetsLoading();
      }
    }, 10); // 10ms後に実行して、UIをブロックしない
  } else if (tabName === 'accounts') {
    // ローディング表示
    showAccountsLoading();

    // 非同期で処理を実行
    setTimeout(() => {
      try {
        updateAccountsPanel();
        hideAccountsLoading();
      } catch (error) {
        addLogEntry(`アカウント分析エラー: ${error.message}`, 'error');
        hideAccountsLoading();
      }
    }, 10); // 10ms後に実行して、UIをブロックしない
  }

  addLogEntry(`${getTabDisplayName(tabName)}タブに切り替えました`, 'info');
}

function showTweetsLoading() {
  const tweetsList = document.getElementById('tweetsList');
  if (tweetsList) {
    tweetsList.innerHTML = `
      <div class="loading-overlay" style="position: relative; background: #192734;">
        <div class="loading-content">
          <div class="loading-spinner"></div>
          <div class="loading-message">ツイートを読み込み中...</div>
        </div>
      </div>
    `;
  }
}

function hideTweetsLoading() {
  // ローディング表示は updateTweetsList() で自動的に置き換えられる
}

function showAccountsLoading() {
  const accountsList = document.getElementById('accountsList');
  if (accountsList) {
    accountsList.innerHTML = `
      <div class="loading-overlay" style="position: relative; background: #192734;">
        <div class="loading-content">
          <div class="loading-spinner"></div>
          <div class="loading-message">アカウント分析中...</div>
        </div>
      </div>
    `;
  }
}

function hideAccountsLoading() {
  const accountsList = document.getElementById('accountsList');
  if (accountsList) {
    // ローディング要素があれば削除
    const loadingElement = accountsList.querySelector('.loading-overlay');
    if (loadingElement) {
      loadingElement.remove();
    }
  }
}

function showAccountsListLoading() {
  const accountsList = document.getElementById('accountsList');
  if (accountsList) {
    accountsList.innerHTML = `
      <div class="loading-overlay" style="position: relative; background: transparent; padding: 20px;">
        <div class="loading-content">
          <div class="loading-spinner"></div>
          <div class="loading-message">アカウント一覧を読み込み中...</div>
        </div>
      </div>
    `;
  }
}

function getTabDisplayName(tabName) {
  const names = {
    'graph': 'グラフ',
    'tweets': 'ツイート',
    'accounts': 'アカウント分析',
    'influence': '影響力分析',
    'logs': 'ログ'
  };
  return names[tabName] || tabName;
}

// ========== キーワード管理 ==========================================================

function addKeyword() {
  if (Object.keys(keywordManager.keywords).length >= keywordManager.maxKeywords) {
    alert(`キーワードは最大${keywordManager.maxKeywords}個まで追加できます。`);
    return;
  }

  const keywordId = `keyword_${keywordManager.nextId++}`;
  const colorIndex = Object.keys(keywordManager.keywords).length;

  const keyword = {
    id: keywordId,
    text: '',
    startDate: new Date().toISOString().split('T')[0], // 開始日
    endDate: new Date().toISOString().split('T')[0],   // 終了日（デフォルトは今日）
    active: false,
    tweets: [],
    trendData: [],
    color: keywordColors[colorIndex],
    stats: {
      totalTweets: 0,
      lastUpdate: null
    },
    collection: {
      isRunning: false,
      isCompleted: false,
      collectedCount: 0,
      progress: 0,
      currentCursor: null,
      waitingForInitialApi: false,
      countdownTimer: null,
      apiLimitTimer: null,
      dependencyErrorCount: 0  // DependencyError連続発生回数
    },
    historical: {
      isRunning: false,
      isCompleted: false,
      collectedCount: 0,
      progress: 0,
      currentCursor: null,
      dependencyErrorCount: 0,
      countdownTimer: null,
      nextBatchTimer: null,
      errorRetryTimer: null,
      apiLimitTimer: null
    },
    realtime: {
      isRunning: false,
      collectedCount: 0,
      currentCursor: null
    },
    searchSpeed: 1,  // 検索スピード（1-3）
    apiConfigs: []   // 複数のAPI設定を保存
  };

  keywordManager.keywords[keywordId] = keyword;

  // UIにカードを追加
  createKeywordCard(keyword);

  // 追加ボタンの状態を更新
  updateAddKeywordButton();

  // 統計を更新
  updateStats();

  addLogEntry(`新しいキーワード（キーワード ${colorIndex + 1}）を追加しました`, 'info');
}

function createKeywordCard(keyword) {
  const keywordsList = document.getElementById('keywordsList');
  const colorIndex = Object.keys(keywordManager.keywords).length - 1;

  const card = document.createElement('div');
  card.className = `keyword-card keyword-${colorIndex + 1}`;
  card.dataset.keywordId = keyword.id;

  card.innerHTML = `
    <div class="keyword-card-header">
      <div class="keyword-number">${colorIndex + 1}</div>
      <div class="keyword-actions">
        <button class="keyword-action-btn delete-keyword" data-keyword-id="${keyword.id}">削除</button>
      </div>
    </div>
    
    <div class="keyword-input-group" style="position: relative;">
      <label style="display: flex; align-items: center; gap: 6px;">
        検索キーワード
        <span class="keyword-help-icon" data-keyword-id="${keyword.id}" style="
          display: inline-flex; align-items: center; justify-content: center;
          width: 16px; height: 16px; border-radius: 50%; 
          background: #536471; color: #ffffff; font-size: 10px; 
          cursor: help; transition: all 0.2s;
        ">?</span>
      </label>
      <input type="text" placeholder="チームみらい 安野" 
             class="keyword-text-input" data-keyword-id="${keyword.id}">
      
      <!-- ツールチップ -->
      <div class="keyword-help-tooltip" id="tooltip-${keyword.id}" style="
        position: absolute; top: -170px; left: 50%; transform: translateX(-50%);
        background: #15202b; color: #ffffff; padding: 12px 16px;
        border-radius: 8px; font-size: 12px; line-height: 1.4;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        border: 1px solid #38444d; z-index: 1000;
        display: none; width: 300px; text-align: left;
      ">
        <div style="font-weight: 700; margin-bottom: 8px; color: #1da1f2;">🔍 検索の書き方</div>
        <div style="margin-bottom: 6px;"><strong>AND検索:</strong> <code style="background: #253341; padding: 2px 4px; border-radius: 3px;">チーム みらい</code></div>
        <div style="margin-bottom: 6px;"><strong>完全一致:</strong> <code style="background: #253341; padding: 2px 4px; border-radius: 3px;">"team mirai"</code></div>
        <div style="margin-bottom: 6px;"><strong>除外語:</strong> <code style="background: #253341; padding: 2px 4px; border-radius: 3px;">みらい -テスト</code></div>
        <div style="margin-bottom: 6px;"><strong>ハッシュタグ:</strong> <code style="background: #253341; padding: 2px 4px; border-radius: 3px;">#チームみらい</code></div>
        <div><strong>ユーザー指定:</strong> <code style="background: #253341; padding: 2px 4px; border-radius: 3px;">@username</code></div>
        <!-- 矢印 -->
        <div style="
          position: absolute; bottom: -6px; left: 50%; 
          transform: translateX(-50%);
          width: 0; height: 0;
          border-left: 6px solid transparent;
          border-right: 6px solid transparent;
          border-top: 6px solid #38444d;
        "></div>
        <div style="
          position: absolute; bottom: -5px; left: 50%; 
          transform: translateX(-50%);
          width: 0; height: 0;
          border-left: 6px solid transparent;
          border-right: 6px solid transparent;
          border-top: 6px solid #15202b;
        "></div>
      </div>
    </div>
    
    <div class="keyword-dates">
      <div class="keyword-input-group">
        <label>開始日（JST 09:00〜）</label>
        <input type="date" class="date-input start-date" data-keyword-id="${keyword.id}" 
               value="${new Date().toISOString().split('T')[0]}">
      </div>
      <div class="keyword-input-group">
        <label>終了日（〜翌日08:59）</label>
        <input type="date" class="date-input end-date" data-keyword-id="${keyword.id}" 
               value="${new Date().toISOString().split('T')[0]}">
      </div>
    </div>

    <div class="keyword-input-group" style="margin-top: 12px; position: relative;">
      <label style="display: flex; align-items: center; gap: 6px;">
        検索スピード
        <span class="speed-help-icon" data-keyword-id="${keyword.id}" style="
          display: inline-flex; align-items: center; justify-content: center;
          width: 16px; height: 16px; border-radius: 50%; 
          background: #536471; color: #ffffff; font-size: 10px; 
          cursor: help; transition: all 0.2s;
        ">?</span>
      </label>
      <select class="search-speed-select" data-keyword-id="${keyword.id}" 
              style="width: 100%; padding: 8px; background: #192734; color: #ffffff; 
                     border: 1px solid #38444d; border-radius: 4px;">
        <option value="1">1 - 標準（1分に1回）</option>
        <option value="2">2 - 高速（1分に2回）</option>
        <option value="3">3 - 最速（1分に3回）</option>
      </select>
      
      <!-- ツールチップ -->
      <div class="speed-help-tooltip" id="speed-tooltip-${keyword.id}" style="
        position: absolute; top: -200px; left: 50%; transform: translateX(-50%);
        background: #15202b; color: #ffffff; padding: 12px 16px;
        border-radius: 8px; font-size: 12px; line-height: 1.4;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        border: 1px solid #38444d; z-index: 1000;
        display: none; width: 300px; text-align: left;
      ">
        <div style="font-weight: 700; margin-bottom: 8px; color: #1da1f2;">⚡ 検索スピード設定</div>
        <div style="margin-bottom: 6px;"><strong>標準 (1):</strong> 1分間隔で1回のAPI呼び出し</div>
        <div style="margin-bottom: 6px;"><strong>高速 (2):</strong> 1分間隔で2回の並列API呼び出し</div>
        <div style="margin-bottom: 8px;"><strong>最速 (3):</strong> 1分間隔で3回の並列API呼び出し</div>
        <div style="font-size: 11px; color: #8b98a5; padding: 8px; background: #253341; border-radius: 4px;">
          💡 高速設定は複数のトランザクションIDを使用してAPI制限を効率的に活用し、より多くのデータを収集できます
        </div>
        <!-- 矢印 -->
        <div style="
          position: absolute; bottom: -6px; left: 50%; 
          transform: translateX(-50%);
          width: 0; height: 0;
          border-left: 6px solid transparent;
          border-right: 6px solid transparent;
          border-top: 6px solid #38444d;
        "></div>
        <div style="
          position: absolute; bottom: -5px; left: 50%; 
          transform: translateX(-50%);
          width: 0; height: 0;
          border-left: 6px solid transparent;
          border-right: 6px solid transparent;
          border-top: 6px solid #15202b;
        "></div>
      </div>
    </div>

    
    <div class="keyword-controls">
      <button class="btn btn-primary start-collection" data-keyword-id="${keyword.id}" id="start-collection-${keyword.id}">
        <span>📂</span>
        データ収集開始
      </button>
      <button class="btn btn-danger stop-collection" data-keyword-id="${keyword.id}" id="stop-collection-${keyword.id}" style="display: none;">
        <span>■</span>
        収集停止
      </button>
    </div>
    
    <!-- データ収集ステータス -->
    <div class="collection-status" style="margin-top: 12px; padding: 12px; background: #192734; 
         border: 1px solid #38444d; border-radius: 8px;">
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
        <div id="historical-status-${keyword.id}" class="status-indicator waiting"></div>
        <span style="font-size: 13px; color: #8b98a5;">データ収集</span>
      </div>
      <div id="historical-status-text-${keyword.id}" style="font-size: 12px; color: #ffffff; margin-bottom: 8px;">
        準備中...
      </div>
      
      <!-- カウントダウンプログレスバー -->
      <div id="countdown-progress-container-${keyword.id}">
        <div style="background: #253341; height: 8px; border-radius: 4px; overflow: hidden; margin-bottom: 8px;">
          <div id="countdown-progress-bar-${keyword.id}" style="height: 100%; background: linear-gradient(90deg, #1da1f2, #1a91da); 
               width: 0%; transition: width 1s linear;"></div>
        </div>
      </div>
    </div>
    
    <div class="keyword-data-controls" style="margin-top: 8px; display: flex; gap: 8px;">
      <button class="btn btn-secondary keyword-export" data-keyword-id="${keyword.id}" style="flex: 1; padding: 6px 12px; font-size: 12px;">
        <span>📥</span>
        エクスポート
      </button>
      <button class="btn btn-secondary keyword-import" data-keyword-id="${keyword.id}" style="flex: 1; padding: 6px 12px; font-size: 12px;">
        <span>📤</span>
        インポート
      </button>
      <input type="file" class="keyword-import-input" data-keyword-id="${keyword.id}" accept=".json" style="display: none;">
    </div>
    
    <!-- キーワード統計情報 -->
    <div class="keyword-stats" id="keywordStats-${keyword.id}" style="margin-top: 12px;">
      <div class="keyword-stats-grid" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px;">
        <div class="stat-item" style="background: #1e2732; padding: 8px; border-radius: 6px; border: 1px solid #38444d; text-align: center;">
          <div class="stat-label" style="font-size: 10px; color: #8b98a5; margin-bottom: 2px; font-weight: 500;">ツイート数</div>
          <div class="stat-value tweet-count" style="font-size: 14px; font-weight: 700; color: #ffffff; line-height: 1.2;">0</div>
        </div>
        <div class="stat-item" style="background: #1e2732; padding: 8px; border-radius: 6px; border: 1px solid #38444d; text-align: center;">
          <div class="stat-label" style="font-size: 10px; color: #8b98a5; margin-bottom: 2px; font-weight: 500;">アカウント数</div>
          <div class="stat-value account-count" style="font-size: 14px; font-weight: 700; color: #ffffff; line-height: 1.2;">0</div>
        </div>
        <div class="stat-item" style="background: #1e2732; padding: 8px; border-radius: 6px; border: 1px solid #38444d; text-align: center;">
          <div class="stat-label" style="font-size: 10px; color: #8b98a5; margin-bottom: 2px; font-weight: 500;">いいね数</div>
          <div class="stat-value like-count" style="font-size: 14px; font-weight: 700; color: #ffffff; line-height: 1.2;">0</div>
        </div>
        <div class="stat-item" style="background: #1e2732; padding: 8px; border-radius: 6px; border: 1px solid #38444d; text-align: center;">
          <div class="stat-label" style="font-size: 10px; color: #8b98a5; margin-bottom: 2px; font-weight: 500;">リツイート数</div>
          <div class="stat-value retweet-count" style="font-size: 14px; font-weight: 700; color: #ffffff; line-height: 1.2;">0</div>
        </div>
      </div>
    </div>`;

  keywordsList.appendChild(card);

  // 新しく作成されたカードにイベントリスナーを追加
  setupKeywordCardListeners(card, keyword.id);
}

function setupKeywordCardListeners(card, keywordId) {
  // 削除ボタン
  card.querySelector('.delete-keyword').addEventListener('click', () => {
    deleteKeyword(keywordId);
  });

  // 基本検索テキスト
  card.querySelector('.keyword-text-input').addEventListener('change', (e) => {
    updateKeywordText(keywordId, e.target.value);
  });

  // ヘルプアイコン
  const helpIcon = card.querySelector('.keyword-help-icon');
  const helpTooltip = card.querySelector('.keyword-help-tooltip');

  if (helpIcon && helpTooltip) {
    helpIcon.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      // 他のツールチップを閉じる
      document.querySelectorAll('.keyword-help-tooltip').forEach(tooltip => {
        if (tooltip !== helpTooltip) {
          tooltip.style.display = 'none';
        }
      });

      // このツールチップの表示/非表示を切り替え
      if (helpTooltip.style.display === 'none' || !helpTooltip.style.display) {
        helpTooltip.style.display = 'block';
      } else {
        helpTooltip.style.display = 'none';
      }
    });

    helpIcon.addEventListener('mouseenter', () => {
      helpIcon.style.background = '#1da1f2';
    });

    helpIcon.addEventListener('mouseleave', () => {
      helpIcon.style.background = '#536471';
    });
  }

  // 検索スピードヘルプアイコン
  const speedHelpIcon = card.querySelector('.speed-help-icon');
  const speedHelpTooltip = card.querySelector('.speed-help-tooltip');

  if (speedHelpIcon && speedHelpTooltip) {
    speedHelpIcon.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      // 他のツールチップを閉じる
      document.querySelectorAll('.speed-help-tooltip').forEach(tooltip => {
        if (tooltip !== speedHelpTooltip) {
          tooltip.style.display = 'none';
        }
      });

      // このツールチップの表示/非表示を切り替え
      if (speedHelpTooltip.style.display === 'none' || !speedHelpTooltip.style.display) {
        speedHelpTooltip.style.display = 'block';
      } else {
        speedHelpTooltip.style.display = 'none';
      }
    });

    speedHelpIcon.addEventListener('mouseenter', () => {
      speedHelpIcon.style.background = '#1da1f2';
    });

    speedHelpIcon.addEventListener('mouseleave', () => {
      speedHelpIcon.style.background = '#536471';
    });
  }


  // 日付設定
  card.querySelector('.start-date').addEventListener('change', (e) => {
    updateKeywordStartDate(keywordId, e.target.value);
  });

  card.querySelector('.end-date').addEventListener('change', (e) => {
    updateKeywordEndDate(keywordId, e.target.value);
  });

  // 検索スピード設定
  card.querySelector('.search-speed-select').addEventListener('change', (e) => {
    const speed = parseInt(e.target.value);
    const keyword = keywordManager.keywords[keywordId];
    if (keyword) {
      keyword.searchSpeed = speed;
      addLogEntry(`キーワード ${getKeywordNumber(keywordId)}: 検索スピードを${speed}に設定しました`, 'info', keywordId);
    }
  });

  // データ収集
  card.querySelector('.start-collection').addEventListener('click', () => {
    startDataCollection(keywordId);
  });

  card.querySelector('.stop-collection').addEventListener('click', () => {
    stopDataCollection(keywordId);
  });

  // インポート/エクスポート
  card.querySelector('.keyword-export').addEventListener('click', () => {
    const keyword = keywordManager.keywords[keywordId];
    const keywordText = keyword?.text || '-';
    const tweetCount = keyword?.tweets?.length || 0;
    const message = `キーワード「${keywordText}」のデータ（${tweetCount}件のツイート）をエクスポートしますか？`;
    
    if (confirm(message)) {
      exportKeywordData(keywordId);
    }
  });

  card.querySelector('.keyword-import').addEventListener('click', () => {
    // インポート対象のキーワードIDを記録
    window.currentImportTargetKeywordId = keywordId;
    // インポートモーダルを表示
    document.getElementById('importModal').style.display = 'flex';
  });

  card.querySelector('.keyword-import-input').addEventListener('change', (e) => {
    handleKeywordImport(keywordId, e);
  });
}

function updateKeywordText(keywordId, value) {
  if (keywordManager.keywords[keywordId]) {
    keywordManager.keywords[keywordId].text = value;
    addLogEntry(`キーワード ${getKeywordNumber(keywordId)}: 検索テキストを「${value}」に設定`, 'info', keywordId);
  }
}

function updateKeywordStartDate(keywordId, value) {
  if (keywordManager.keywords[keywordId]) {
    keywordManager.keywords[keywordId].startDate = value;
    addLogEntry(`キーワード ${getKeywordNumber(keywordId)}: 開始日を${value}に設定`, 'info', keywordId);
  }
}

function updateKeywordEndDate(keywordId, value) {
  if (keywordManager.keywords[keywordId]) {
    keywordManager.keywords[keywordId].endDate = value;
    addLogEntry(`キーワード ${getKeywordNumber(keywordId)}: 終了日を${value}に設定`, 'info', keywordId);
  }
}

// ========== 検索クエリ構築 ==========================================================

/**
 * キーワードと日付範囲から検索クエリを構築
 */
function buildSearchQueryWithDateRange(keyword) {
  let searchQuery = keyword.text.trim();

  // 日付フィルターを追加
  if (keyword.startDate) {
    searchQuery += ` since:${keyword.startDate}`;
  }

  if (keyword.endDate) {
    // until は翌日を指定する必要がある（その日の23:59:59まで含めるため）
    const endDate = new Date(keyword.endDate);
    endDate.setDate(endDate.getDate() + 1);
    const untilDate = endDate.toISOString().split('T')[0];
    searchQuery += ` until:${untilDate}`;
  }

  addLogEntry(`キーワード ${getKeywordNumber(keyword.id)}: 日付フィルター付きクエリ - "${searchQuery}"`, 'info', keyword.id);

  return searchQuery;
}

/**
 * X検索ページのURLを生成（日付フィルター付き）
 */
function buildSearchUrlWithDateRange(keyword) {
  const searchQuery = buildSearchQueryWithDateRange(keyword);
  const encodedQuery = encodeURIComponent(searchQuery);
  return `https://x.com/search?q=${encodedQuery}&src=typed_query&f=live`;
}

// ========== データ収集機能 ==========================================================

function startDataCollection(keywordId) {
  const keyword = keywordManager.keywords[keywordId];
  if (!keyword) return;

  if (!keyword.text.trim()) {
    addLogEntry(`キーワード ${getKeywordNumber(keywordId)}: 検索キーワードを設定してください`, 'error', keywordId);
    return;
  }

  if (!keyword.startDate || !keyword.endDate) {
    addLogEntry(`キーワード ${getKeywordNumber(keywordId)}: 開始日と終了日を設定してください`, 'error', keywordId);
    return;
  }

  if (new Date(keyword.startDate) > new Date(keyword.endDate)) {
    addLogEntry(`キーワード ${getKeywordNumber(keywordId)}: 開始日は終了日より前に設定してください`, 'error', keywordId);
    return;
  }

  // UIを更新
  updateHistoricalStatus(keywordId, 'running', 'X検索ページを開いています...');
  toggleCollectionButtons(keywordId, true);

  // 過去データ収集の設定を初期化
  keyword.historical = {
    isRunning: true,
    isCompleted: false,
    collectedCount: 0,
    progress: 0,
    currentCursor: null,
    dependencyErrorCount: 0
  };

  addLogEntry(`キーワード ${getKeywordNumber(keywordId)}: ${keyword.text}の過去データ収集を開始します`, 'success', keywordId);

  const searchSpeed = keyword.searchSpeed || 1;

  // 最初にX検索ページを開いて、APIヘッダーを取得
  openTwitterSearchPage(keywordId);
}

function stopDataCollection(keywordId) {
  const keyword = keywordManager.keywords[keywordId];
  if (!keyword) return;

  if (keyword.historical) {
    keyword.historical.isRunning = false;

    // API設定待機フラグをクリア
    if (keyword.historical.waitingForInitialApi) {
      keyword.historical.waitingForInitialApi = false;
    }

    // inFastModeフラグを確実にクリア
    if (keyword.historical.inFastMode) {
      keyword.historical.inFastMode = false;
    }

    // 全てのタイマーをクリア
    if (keyword.historical.countdownTimer) {
      clearInterval(keyword.historical.countdownTimer);
      keyword.historical.countdownTimer = null;
    }
    if (keyword.historical.nextBatchTimer) {
      clearTimeout(keyword.historical.nextBatchTimer);
      keyword.historical.nextBatchTimer = null;
    }
    if (keyword.historical.errorRetryTimer) {
      clearTimeout(keyword.historical.errorRetryTimer);
      keyword.historical.errorRetryTimer = null;
    }
    if (keyword.historical.apiLimitTimer) {
      clearTimeout(keyword.historical.apiLimitTimer);
      keyword.historical.apiLimitTimer = null;
    }

    // グローバルカウントダウンタイマーもクリア
    Object.keys(activeCountdownTimers).forEach(key => {
      if (key.startsWith(`${keywordId}-`)) {
        clearInterval(activeCountdownTimers[key]);
        delete activeCountdownTimers[key];
      }
    });
  }

  // collectionモードのタイマーもクリア
  if (keyword.collection) {
    keyword.collection.isRunning = false;

    // collectionモードのAPI設定待機フラグもクリア
    if (keyword.collection.waitingForInitialApi) {
      keyword.collection.waitingForInitialApi = false;
    }

    if (keyword.collection.countdownTimer) {
      clearInterval(keyword.collection.countdownTimer);
      keyword.collection.countdownTimer = null;
    }
    if (keyword.collection.apiLimitTimer) {
      clearTimeout(keyword.collection.apiLimitTimer);
      keyword.collection.apiLimitTimer = null;
    }
  }

  updateHistoricalStatus(keywordId, 'stopped', 'データ収集を停止しました');
  toggleCollectionButtons(keywordId, false);

  // プログレスバーを0%にリセット
  const progressBar = document.getElementById(`historical-progress-${keywordId}`);
  const progressText = document.getElementById(`historical-progress-text-${keywordId}`);
  const collectedText = document.getElementById(`historical-collected-${keywordId}`);

  if (progressBar) progressBar.style.width = '0%';
  if (progressText) progressText.textContent = '0%';
  if (collectedText) collectedText.textContent = '0';

  // カウントダウンプログレスバーもリセット
  const countdownProgressBar = document.getElementById(`countdown-progress-bar-${keywordId}`);
  if (countdownProgressBar) {
    countdownProgressBar.style.width = '0%';
  }

  addLogEntry(`キーワード ${getKeywordNumber(keywordId)}: データ収集を停止しました`, 'warning', keywordId);
}

function updateCollectionUI(keywordId, status, message) {
  const progressDiv = document.getElementById(`progress-${keywordId}`);
  const statusDiv = document.getElementById(`status-${keywordId}`);
  const timerDiv = document.getElementById(`timer-${keywordId}`);

  if (progressDiv) {
    // 完了状態でもプログレスバーを表示（完了した状態として）
    progressDiv.style.display = status === 'running' || status === 'waiting' || status === 'completed' ? 'block' : 'none';
  }

  if (statusDiv) {
    statusDiv.textContent = message;
    statusDiv.className = `progress-status ${status}`;

    // 完了状態の場合は成功を示すスタイルを追加
    if (status === 'completed') {
      statusDiv.style.color = '#00ba7c';
      statusDiv.style.fontWeight = 'bold';
    } else if (status === 'error') {
      statusDiv.style.color = '#f4212e';
    } else {
      statusDiv.style.color = '#8b98a5';
      statusDiv.style.fontWeight = 'normal';
    }
  }

  if (timerDiv && status !== 'running' && status !== 'waiting') {
    timerDiv.style.display = 'none';
  }
}

function toggleCollectionButtons(keywordId, isRunning) {
  const startBtn = document.getElementById(`start-collection-${keywordId}`);
  const stopBtn = document.getElementById(`stop-collection-${keywordId}`);

  if (startBtn && stopBtn) {
    startBtn.style.display = isRunning ? 'none' : 'inline-flex';
    stopBtn.style.display = isRunning ? 'inline-flex' : 'none';
  }
}

function startCountdownTimer(keywordId, seconds) {
  const keyword = keywordManager.keywords[keywordId];
  if (!keyword || !keyword.collection) return;

  const timerDiv = document.getElementById(`timer-${keywordId}`);
  const countdownSpan = document.getElementById(`countdown-${keywordId}`);

  if (timerDiv) timerDiv.style.display = 'block';

  let remainingSeconds = seconds;

  const updateCountdown = () => {
    if (countdownSpan) {
      countdownSpan.textContent = remainingSeconds;
    }

    if (remainingSeconds <= 0) {
      if (timerDiv) timerDiv.style.display = 'none';
      if (keyword.collection.countdownTimer) {
        clearInterval(keyword.collection.countdownTimer);
        keyword.collection.countdownTimer = null;
      }
      return;
    }

    remainingSeconds--;
  };

  updateCountdown(); // 初回実行
  keyword.collection.countdownTimer = setInterval(updateCountdown, 1000);
}

// ========== 過去データ収集機能 ==========================================================

function startHistoricalCollection(keywordId) {
  const keyword = keywordManager.keywords[keywordId];
  if (!keyword) return;

  // 互換性のため、historicalプロパティがない場合は初期化
  if (!keyword.historical) {
    keyword.historical = {
      isRunning: false,
      isCompleted: false,
      collectedCount: 0,
      progress: 0,
      currentCursor: null,
      dependencyErrorCount: 0
    };
  }

  if (!keyword.text.trim()) {
    addLogEntry(`キーワード ${getKeywordNumber(keywordId)}: 検索キーワードを設定してください`, 'error', keywordId);
    return;
  }

  if (!keyword.startDate) {
    addLogEntry(`キーワード ${getKeywordNumber(keywordId)}: 開始日時を設定してください`, 'error', keywordId);
    return;
  }

  // UIを更新
  updateHistoricalStatus(keywordId, 'running', 'X検索ページを開いています...');
  toggleHistoricalButtons(keywordId, true);

  // 収集ジョブを開始
  keyword.historical.isRunning = true;
  keyword.historical.isCompleted = false;
  keyword.historical.collectedCount = 0;
  keyword.historical.progress = 0;
  keyword.historical.currentCursor = null; // カーソルもリセット
  keyword.historical.waitingForInitialApi = true; // 初回API通信待機フラグ
  keyword.historical.countdownTimer = null;
  keyword.historical.nextBatchTimer = null;
  keyword.historical.errorRetryTimer = null;
  keyword.historical.apiLimitTimer = null;
  keyword.historical.errorRetryCount = 0; // エラーリトライカウンタをリセット
  keyword.historical.dependencyErrorCount = 0; // DependencyErrorカウンタもリセット

  addLogEntry(`キーワード ${getKeywordNumber(keywordId)}: historical.isRunning=${keyword.historical.isRunning} に設定しました`, 'info', keywordId);

  setTimeout(() => {
    const currentKeyword = keywordManager.keywords[keywordId];
  }, 5000);

  addLogEntry(`キーワード ${getKeywordNumber(keywordId)}: 過去データ収集を開始します`, 'success', keywordId);

  // 最初にX検索ページを開いて、APIヘッダーを取得
  openTwitterSearchPage(keywordId);
}

function stopHistoricalCollection(keywordId) {
  const keyword = keywordManager.keywords[keywordId];
  if (!keyword) return;

  keyword.historical.isRunning = false;

  // API設定待機フラグをクリア
  if (keyword.historical.waitingForInitialApi) {
    keyword.historical.waitingForInitialApi = false;
  }

  // まず最初にグローバルカウントダウンタイマーをクリア（即座に停止）
  Object.keys(activeCountdownTimers).forEach(key => {
    if (key.startsWith(`${keywordId}-`)) {
      clearInterval(activeCountdownTimers[key]);
      delete activeCountdownTimers[key];
    }
  });

  // inFastModeフラグを確実にクリア
  if (keyword.historical.inFastMode) {
    keyword.historical.inFastMode = false;
  }

  // 全てのタイマーをクリア
  if (keyword.historical.countdownTimer) {
    clearInterval(keyword.historical.countdownTimer);
    keyword.historical.countdownTimer = null;
  }
  if (keyword.historical.nextBatchTimer) {
    clearTimeout(keyword.historical.nextBatchTimer);
    keyword.historical.nextBatchTimer = null;
  }
  if (keyword.historical.errorRetryTimer) {
    clearTimeout(keyword.historical.errorRetryTimer);
    keyword.historical.errorRetryTimer = null;
  }
  if (keyword.historical.apiLimitTimer) {
    clearTimeout(keyword.historical.apiLimitTimer);
    keyword.historical.apiLimitTimer = null;
  }

  updateHistoricalStatus(keywordId, 'stopped', '過去データ収集を停止しました');
  toggleHistoricalButtons(keywordId, false);

  // プログレスバーを0%にリセット
  const progressBar = document.getElementById(`historical-progress-${keywordId}`);
  const progressText = document.getElementById(`historical-progress-text-${keywordId}`);
  const collectedText = document.getElementById(`historical-collected-${keywordId}`);

  if (progressBar) progressBar.style.width = '0%';
  if (progressText) progressText.textContent = '0%';
  if (collectedText) collectedText.textContent = '0';

  // カウントダウンプログレスバーもリセット
  const countdownProgressBar = document.getElementById(`countdown-progress-bar-${keywordId}`);
  if (countdownProgressBar) {
    countdownProgressBar.style.width = '0%';
  }

  // 強制的にステータステキストを更新（カウントダウンが上書きされないように）
  setTimeout(() => {
    updateHistoricalStatus(keywordId, 'stopped', '過去データ収集を停止しました');
  }, 10);

  addLogEntry(`キーワード ${getKeywordNumber(keywordId)}: 過去データ収集を停止しました`, 'warning', keywordId);
}

async function performHistoricalCollection(keywordId) {
  // この関数がPromiseを返すことを保証
  return new Promise(async (resolve) => {
    const keyword = keywordManager.keywords[keywordId];
    if (!keyword) {
      resolve();
      return;
    }

    // 互換性のため、historicalプロパティがない場合は初期化
    if (!keyword.historical) {
      keyword.historical = {
        isRunning: false,
        isCompleted: false,
        collectedCount: 0,
        progress: 0,
        currentCursor: null,
        dependencyErrorCount: 0
      };
    }

    if (!keyword.historical.isRunning) {
      resolve();
      return;
    }

    // API制限をチェック
    if (rateLimitManager.used >= rateLimitManager.limit) {
      updateHistoricalStatus(keywordId, 'waiting', 'API制限のため待機中...');
      const waitTime = Math.max(0, rateLimitManager.resetTime - Date.now());
      keyword.historical.apiLimitTimer = setTimeout(() => {
        if (keyword.historical.apiLimitTimer) {
          keyword.historical.apiLimitTimer = null;
        }
        performHistoricalCollection(keywordId);
      }, waitTime + 1000);
      resolve();
      return;
    }

    // 実際のX検索API呼び出し
    try {
      const result = await fetchTweets(keywordId, 'historical');

      if (result.success) {
        const collectedCount = result.tweets.length;
        const previousTweetCount = keyword.tweets.length;
        
        // 取得したツイートをキーワードに保存（重複を防ぐ）
        keyword.tweets = mergeTweetsWithoutDuplicates(keyword.tweets, result.tweets);
        clearTweetsCache(); // キャッシュをクリア
        
        // 実際に追加されたツイート数を計算
        const actualNewTweets = keyword.tweets.length - previousTweetCount;
        keyword.historical.collectedCount += actualNewTweets;
        keyword.stats.totalTweets = keyword.tweets.length;

        // 初回のループでの検索成功時に1度だけFavoriteTweet APIを実行
        if (!favoriteTweetExecuted && keyword.historical.collectedCount === actualNewTweets) {
          favoriteTweetExecuted = true;
          injectFavoriteTweetCall("1945479138347008267");
        }

        // DependencyErrorカウンタをリセット
        keyword.historical.dependencyErrorCount = 0;

        // エラーリトライカウンタをリセット（成功時）
        keyword.historical.errorRetryCount = 0;

        // 次のカーソルを保存
        if (result.cursor) {
          keyword.historical.currentCursor = result.cursor;
        }

        // API使用量を更新
        rateLimitManager.used++;
        updateRateLimitDisplay();

        // ツイート表示を更新
        updateTweetsList();

        // 進捗を更新
        let currentProgress = 0;
        if (keyword.endDate) {
          const totalDays = calculateDaysBetween(keyword.startDate, keyword.endDate);
          currentProgress = Math.min((keyword.historical.collectedCount / (totalDays * 50)) * 100, 100);
        } else {
          // 終了日時がない場合は現在時刻まで
          const totalDays = calculateDaysBetween(keyword.startDate, new Date().toISOString());
          currentProgress = Math.min((keyword.historical.collectedCount / (totalDays * 50)) * 100, 100);
        }

        keyword.historical.progress = currentProgress;

        updateHistoricalUI(keywordId);
        updateStats();
        // ツイート表示は1000件ごとに更新
        if (keyword.tweets.length % 1000 === 0 || !keyword.historical.isRunning) {
          updateTweetsList(); // ツイート表示を更新
        }

        addLogEntry(`キーワード ${getKeywordNumber(keywordId)}: ${collectedCount}件取得 → ${actualNewTweets}件追加（総数：${keyword.tweets.length}件）`, 'success', keywordId);

        // UI状態を更新
        updateHistoricalStatus(keywordId, 'running', `データ収集中... (${keyword.historical.collectedCount}件取得済み)`);

        // 完了判定: カーソルが0|で始まる場合、または取得件数が0の場合
        const isCompleted = (result.cursor && result.cursor.startsWith('0|')) || collectedCount === 0;

        addLogEntry(`完了判定: カーソル=${result.cursor || 'なし'}, 取得件数=${collectedCount}, 完了=${isCompleted}`, 'info', keywordId);

        if (isCompleted) {
          keyword.historical.isCompleted = true;
          keyword.historical.isRunning = false;

          // 完了理由を判定
          let completionReason = '過去データ収集が完了しました';
          if (collectedCount === 0) {
            completionReason = 'これ以上のツイートがありません - 収集完了';
          } else if (result.cursor && result.cursor.startsWith('0|')) {
            completionReason = '最古のツイートに到達しました - 収集完了';
          }

          updateHistoricalStatus(keywordId, 'completed', completionReason);
          toggleHistoricalButtons(keywordId, false);
          toggleCollectionButtons(keywordId, false);

          // カウントダウンタイマーをクリア
          if (keyword.historical.countdownTimer) {
            clearInterval(keyword.historical.countdownTimer);
            keyword.historical.countdownTimer = null;
          }

          // リアルタイム監視ボタンを有効化
          const realtimeBtn = document.getElementById(`start-realtime-${keywordId}`);
          if (realtimeBtn) {
            realtimeBtn.disabled = false;
          }

          addLogEntry(`キーワード ${getKeywordNumber(keywordId)}: ${completionReason}`, 'success', keywordId);
          resolve(); // 完了時にresolve
          return;
        }

        // 高速モード中でない場合のみ次の収集をスケジュール
        if (!keyword.historical.inFastMode) {
          scheduleNextCollection(keywordId, 'historical');
        }

        resolve(); // 正常終了時にresolve

      } else {
        // エラーの場合
        if (result.isDependencyError) {
          // DependencyErrorの場合
          keyword.historical.dependencyErrorCount = (keyword.historical.dependencyErrorCount || 0) + 1;

          if (keyword.historical.dependencyErrorCount >= 5) {
            // 5回連続でDependencyErrorが発生した場合は停止
            addLogEntry(`キーワード ${getKeywordNumber(keywordId)}: DependencyErrorが5回連続で発生したため、収集を停止します`, 'error', keywordId);
            updateHistoricalStatus(keywordId, 'error', 'DependencyErrorが継続的に発生しています');
            keyword.historical.isRunning = false;
            toggleHistoricalButtons(keywordId, false);
            toggleCollectionButtons(keywordId, false);
            resolve(); // エラー時でもresolve
            return;
          }

          addLogEntry(`キーワード ${getKeywordNumber(keywordId)}: DependencyError検出 (${keyword.historical.dependencyErrorCount}回目) - 60秒後に再試行します`, 'warning', keywordId);
          updateHistoricalStatus(keywordId, 'waiting', 'DependencyError発生 - 再試行待機中...');

          // 高速モード中でない場合のみ60秒後に再試行
          if (!keyword.historical.inFastMode) {
            scheduleNextCollection(keywordId, 'historical', false);
          }
          resolve(); // DependencyError時でもresolve
        } else {
          // その他のエラー
          addLogEntry(`キーワード ${getKeywordNumber(keywordId)}: データ取得エラー - ${result.error}`, 'error', keywordId);
          updateHistoricalStatus(keywordId, 'error', 'データ取得エラーが発生しました');
          toggleCollectionButtons(keywordId, false);

          // エラー時のリトライを統一的に処理
          scheduleErrorRetry(keywordId, 'historical', 'データ取得エラー');
        }
        resolve(); // その他のエラー時でもresolve
      }

    } catch (error) {
      addLogEntry(`キーワード ${getKeywordNumber(keywordId)}: 通信エラー - ${error.message}`, 'error', keywordId);
      updateHistoricalStatus(keywordId, 'error', '通信エラーが発生しました');
      toggleCollectionButtons(keywordId, false);

      // エラー時のリトライを統一的に処理
      scheduleErrorRetry(keywordId, 'historical', '通信エラー');
      resolve(); // エラー時でもresolve
    }
  }); // Promise終了
}

/**
 * エラー時のリトライを統一的に管理
 */
function scheduleErrorRetry(keywordId, mode, errorType) {
  const keyword = keywordManager.keywords[keywordId];
  if (!keyword) return;

  // 高速モード中は即座にリトライしない
  if (keyword.historical && keyword.historical.inFastMode) {
    addLogEntry(`キーワード ${getKeywordNumber(keywordId)}: 高速モード中のためエラーリトライをスキップ`, 'warning', keywordId);
    return;
  }

  // 収集が停止されている場合はリトライしない
  if (mode === 'historical' && (!keyword.historical || !keyword.historical.isRunning)) {
    addLogEntry(`キーワード ${getKeywordNumber(keywordId)}: 収集停止中のためエラーリトライをスキップ`, 'warning', keywordId);
    return;
  }

  // エラー回数をカウント（初期化がない場合は0から開始）
  if (!keyword.historical.errorRetryCount) {
    keyword.historical.errorRetryCount = 0;
  }
  keyword.historical.errorRetryCount++;

  const maxRetries = 3; // 最大リトライ回数
  if (keyword.historical.errorRetryCount > maxRetries) {
    addLogEntry(`キーワード ${getKeywordNumber(keywordId)}: エラーリトライ回数上限(${maxRetries}回)に達したため収集を停止`, 'error', keywordId);
    if (mode === 'historical') {
      stopHistoricalCollection(keywordId);
    }
    return;
  }

  const waitSeconds = 60; // 必ず60秒待機
  addLogEntry(`キーワード ${getKeywordNumber(keywordId)}: ${errorType} - ${waitSeconds}秒後にリトライ(${keyword.historical.errorRetryCount}/${maxRetries})`, 'warning', keywordId);

  // カウントダウン表示付きで60秒後にリトライ
  if (mode === 'historical') {
    updateHistoricalStatus(keywordId, 'waiting', `エラーリトライまであと ${waitSeconds} 秒`);
  }

  // カウントダウンタイマーを開始（1秒ごとに更新）
  let remainingSeconds = waitSeconds;
  const countdownTimer = setInterval(() => {
    const currentKeyword = keywordManager.keywords[keywordId];
    if (!currentKeyword) {
      clearInterval(countdownTimer);
      return;
    }

    remainingSeconds--;
    if (mode === 'historical' && currentKeyword.historical && currentKeyword.historical.isRunning) {
      updateHistoricalStatus(keywordId, 'waiting', `エラーリトライまであと ${remainingSeconds} 秒`);
    }

    if (remainingSeconds <= 0) {
      clearInterval(countdownTimer);
    }
  }, 1000);

  // 確実に60秒待機してからリトライ
  keyword.historical.errorRetryTimer = setTimeout(() => {
    clearInterval(countdownTimer); // カウントダウンタイマーをクリア
    const currentKeyword = keywordManager.keywords[keywordId];
    if (!currentKeyword) return;

    // エラーリトライタイマーをクリア
    if (currentKeyword.historical.errorRetryTimer) {
      currentKeyword.historical.errorRetryTimer = null;
    }

    if (mode === 'historical' && currentKeyword.historical && currentKeyword.historical.isRunning) {
      addLogEntry(`キーワード ${getKeywordNumber(keywordId)}: エラーリトライを実行`, 'info', keywordId);
      scheduleNextCollection(keywordId, mode, false); // エラーフラグをfalseにしてリトライ
    } else {
      addLogEntry(`キーワード ${getKeywordNumber(keywordId)}: 収集停止のためエラーリトライをキャンセル`, 'warning', keywordId);
    }
  }, waitSeconds * 1000);
}

/**
 * 次の収集をスケジュール（検索スピードを考慮）
 */
function scheduleNextCollection(keywordId, mode, isError = false) {
  const keyword = keywordManager.keywords[keywordId];
  if (!keyword) {
    addLogEntry(`scheduleNextCollection: キーワードが見つかりません ${keywordId}`, 'error');
    return;
  }

  const searchSpeed = keyword.searchSpeed || 1;
  const baseDelay = 60000; // 基本は60秒

  // エラー時は2倍の遅延
  const errorMultiplier = isError ? 2 : 1;

  // 検索スピードが2以上の場合、複数回のAPIコールをスケジュール
  if (searchSpeed > 1 && !isError && keyword.apiConfigs && keyword.apiConfigs.length >= searchSpeed) {

    // API制限チェック
    if (rateLimitManager.used + searchSpeed > rateLimitManager.limit) {
      const waitTime = Math.max(0, rateLimitManager.resetTime - Date.now());
      addLogEntry(`キーワード ${getKeywordNumber(keywordId)}: API制限に達しました。${Math.ceil(waitTime / 1000)}秒待機します`, 'warning', keywordId);

      // 高速モードフラグをリセット（重複実行を防ぐ）
      keyword.historical.inFastMode = false;

      keyword.historical.apiLimitTimer = setTimeout(() => {
        if (keyword.historical.apiLimitTimer) {
          keyword.historical.apiLimitTimer = null;
        }
        scheduleNextCollection(keywordId, mode);
      }, waitTime + 1000);
      return;
    }

    // 高速モード：順次実行でカーソルを共有
    addLogEntry(`キーワード ${getKeywordNumber(keywordId)}: ${searchSpeed}回のAPIコールを順次実行`, 'info', keywordId);

    // 高速モードフラグを設定
    keyword.historical.inFastMode = true;

    // 順次実行用の再帰関数
    const executeSequentialAPI = async (currentIndex) => {
      if (currentIndex >= searchSpeed) {
        // 高速モードフラグをリセット
        const currentKeyword = keywordManager.keywords[keywordId];
        if (currentKeyword && currentKeyword.historical) {
          currentKeyword.historical.inFastMode = false;
        }

        // すべてのAPI実行完了後に60秒タイマーを開始
        startNextBatchTimer(keywordId, mode);
        return;
      }

      const currentKeyword = keywordManager.keywords[keywordId];
      if (!currentKeyword || !(currentKeyword.collection?.isRunning || currentKeyword.historical?.isRunning || currentKeyword.realtime?.isRunning)) {
        return;
      }


      // UI状態を更新
      if (mode === 'historical') {
        updateHistoricalStatus(keywordId, 'running', `高速検索 ${currentIndex + 1}/${searchSpeed} 実行中... (${currentKeyword?.historical?.collectedCount || 0}件取得済み)`);
        // performHistoricalCollectionを実行し、完了を待つ
        performHistoricalCollection(keywordId).then(() => {
          // API実行完了後に次の実行をスケジュール
          setTimeout(() => {
            executeSequentialAPI(currentIndex + 1);
          }, 3000); // 3秒間隔
        });
      } else {
        performRealtimeCollection(keywordId).then(() => {
          setTimeout(() => {
            executeSequentialAPI(currentIndex + 1);
          }, 3000);
        });
      }
    };

    // 1回目のAPI実行を開始
    executeSequentialAPI(0);
  } else {
    // 通常モード：最初の実行かどうかをチェック
    const isFirstExecution = !keyword.historical?.collectedCount && !keyword.collection?.collectedCount && !keyword.realtime?.totalCount;

    if (isFirstExecution) {
      // 最初の実行はすぐに開始
      if (mode === 'historical') {
        performHistoricalCollection(keywordId);
      } else if (mode === 'collection') {
        performDataCollection(keywordId);
      } else {
        performRealtimeCollection(keywordId);
      }
      return;
    }

    // 2回目以降は60秒後に実行（カウントダウン付き）
    const delayMs = baseDelay * errorMultiplier;
    const totalSeconds = Math.ceil(delayMs / 1000);

    // カウントダウンタイマーを表示
    let remainingSeconds = totalSeconds;

    // カウントダウンプログレスバーを表示
    // const progressContainer = document.getElementById(`countdown-progress-container-${keywordId}`);
    const progressBar = document.getElementById(`countdown-progress-bar-${keywordId}`);
    // const countdownText = document.getElementById(`countdown-text-${keywordId}`);

    // 既存のカウントダウンタイマーをクリア
    if (activeCountdownTimers[`${keywordId}-scheduleNext`]) {
      clearInterval(activeCountdownTimers[`${keywordId}-scheduleNext`]);
      activeCountdownTimers[`${keywordId}-scheduleNext`] = null;
    }

    const capturedKeywordId = keywordId;
    const countdownTimerId = setInterval(() => {
      const currentKeyword = keywordManager.keywords[capturedKeywordId];
      if (!currentKeyword || !currentKeyword.historical || !currentKeyword.historical.isRunning) {
        clearInterval(countdownTimerId);
        delete activeCountdownTimers[`${keywordId}-scheduleNext`];
        return;
      }
      remainingSeconds--;

      // プログレスバーを更新
      if (progressBar) {
        const progressPercent = (remainingSeconds / totalSeconds) * 100;
        progressBar.style.width = progressPercent + '%';

        // 残り時間に応じて色を変更
        if (remainingSeconds <= 10) {
          progressBar.style.background = 'linear-gradient(90deg, #f91880, #ff4458)';
        } else if (remainingSeconds <= 30) {
          progressBar.style.background = 'linear-gradient(90deg, #ff8717, #ffb84d)';
        } else {
          progressBar.style.background = 'linear-gradient(90deg, #1da1f2, #1a91da)';
        }
      }

      if (mode === 'historical') {
        updateHistoricalStatus(keywordId, 'waiting', `次のAPI呼び出しまであと ${remainingSeconds} 秒`);
      } else if (mode === 'collection') {
        updateCollectionUI(keywordId, 'waiting', `次のAPI呼び出しまであと ${remainingSeconds} 秒`);
      }

      if (remainingSeconds <= 0) {
        clearInterval(countdownTimerId);
        if (currentKeyword.historical) {
          currentKeyword.historical.countdownTimer = null;
        }
      }
    }, 1000);

    // タイマーIDを保存
    keyword.historical.countdownTimer = countdownTimerId;
    activeCountdownTimers[`${keywordId}-scheduleNext`] = countdownTimerId;

    setTimeout(() => {
      if (keyword.historical && keyword.historical.countdownTimer) {
        clearInterval(keyword.historical.countdownTimer);
        keyword.historical.countdownTimer = null;
      }
      if (keyword.collection?.isRunning || keyword.historical?.isRunning || keyword.realtime?.isRunning) {
        if (mode === 'historical') {
          performHistoricalCollection(keywordId);
        } else {
          performRealtimeCollection(keywordId);
        }
      }
    }, delayMs);
  }
}

/**
 * 高速モード完了後に60秒タイマーを開始する関数
 */
function startNextBatchTimer(keywordId, mode) {
  const keyword = keywordManager.keywords[keywordId];
  if (!keyword) return;


  // カウントダウンタイマーを表示
  let remainingSeconds = 60;
  const totalSeconds = 60;

  // カウントダウンプログレスバーを表示
  // const progressContainer = document.getElementById(`countdown-progress-container-${keywordId}`);
  const progressBar = document.getElementById(`countdown-progress-bar-${keywordId}`);
  // const countdownText = document.getElementById(`countdown-text-${keywordId}`);

  // 既存のカウントダウンタイマーをクリア
  if (activeCountdownTimers[`${keywordId}-nextBatch`]) {
    clearInterval(activeCountdownTimers[`${keywordId}-nextBatch`]);
    activeCountdownTimers[`${keywordId}-nextBatch`] = null;
  }

  const capturedKeywordId = keywordId;
  const countdownTimerId = setInterval(() => {
    const currentKeyword = keywordManager.keywords[capturedKeywordId];
    if (!currentKeyword || !currentKeyword.historical || !currentKeyword.historical.isRunning) {
      clearInterval(countdownTimerId);
      delete activeCountdownTimers[`${keywordId}-nextBatch`];
      return;
    }
    remainingSeconds--;

    // プログレスバーを更新
    if (progressBar) {
      const progressPercent = (remainingSeconds / totalSeconds) * 100;
      progressBar.style.width = progressPercent + '%';

      // 残り時間に応じて色を変更
      if (remainingSeconds <= 10) {
        progressBar.style.background = 'linear-gradient(90deg, #f91880, #ff4458)';
      } else if (remainingSeconds <= 30) {
        progressBar.style.background = 'linear-gradient(90deg, #ff8717, #ffb84d)';
      } else {
        progressBar.style.background = 'linear-gradient(90deg, #1da1f2, #1a91da)';
      }
    }

    if (mode === 'historical') {
      updateHistoricalStatus(keywordId, 'waiting', `次のAPI呼び出しまであと ${remainingSeconds} 秒`);
    } else if (mode === 'collection') {
      updateCollectionUI(keywordId, 'waiting', `次のAPI呼び出しまであと ${remainingSeconds} 秒`);
    }

    if (remainingSeconds <= 0) {
      clearInterval(countdownTimerId);
      if (currentKeyword.historical) {
        currentKeyword.historical.countdownTimer = null;
      }
    }
  }, 1000);

  // タイマーIDを保存
  keyword.historical.countdownTimer = countdownTimerId;
  activeCountdownTimers[`${keywordId}-nextBatch`] = countdownTimerId;

  keyword.historical.nextBatchTimer = setTimeout(() => {
    if (keyword.historical && keyword.historical.countdownTimer) {
      clearInterval(keyword.historical.countdownTimer);
      keyword.historical.countdownTimer = null;
    }

    // nextBatchTimerをクリア
    if (keyword.historical.nextBatchTimer) {
      keyword.historical.nextBatchTimer = null;
    }

    if (keyword.collection?.isRunning || keyword.historical?.isRunning || keyword.realtime?.isRunning) {
      scheduleNextCollection(keywordId, mode);
    } else {
      addLogEntry(`キーワード ${getKeywordNumber(keywordId)}: 収集が停止されているため次のバッチをスキップ`, 'warning', keywordId);
    }
  }, 60000);
}

// ========== リアルタイム監視機能 ==========================================================

function startRealtimeMonitoring(keywordId) {
  const keyword = keywordManager.keywords[keywordId];
  if (!keyword) return;

  if (!keyword.historical.isCompleted) {
    addLogEntry(`キーワード ${getKeywordNumber(keywordId)}: 過去データ収集を先に完了してください`, 'error', keywordId);
    return;
  }

  keyword.realtime.isRunning = true;
  keyword.realtime.collectedCount = 0;
  keyword.realtime.lastCheck = new Date();

  updateRealtimeStatus(keywordId, 'active', 'リアルタイム監視中...');
  toggleRealtimeButtons(keywordId, true);

  addLogEntry(`キーワード ${getKeywordNumber(keywordId)}: リアルタイム監視を開始しました`, 'success', keywordId);

  // 定期実行を開始
  scheduleRealtimeCheck(keywordId);
}

function stopRealtimeMonitoring(keywordId) {
  const keyword = keywordManager.keywords[keywordId];
  if (!keyword) return;

  keyword.realtime.isRunning = false;
  if (keyword.realtime.intervalId) {
    clearTimeout(keyword.realtime.intervalId);
    keyword.realtime.intervalId = null;
  }

  updateRealtimeStatus(keywordId, 'stopped', 'リアルタイム監視を停止しました');
  toggleRealtimeButtons(keywordId, false);

  addLogEntry(`キーワード ${getKeywordNumber(keywordId)}: リアルタイム監視を停止しました`, 'warning', keywordId);
}

function scheduleRealtimeCheck(keywordId) {
  const keyword = keywordManager.keywords[keywordId];
  if (!keyword || !keyword.realtime.isRunning) return;

  const intervalMinutes = Math.max(keyword.updateInterval || 15, 1); // 最低1分間隔
  const nextCheckTime = new Date(Date.now() + intervalMinutes * 60 * 1000);
  keyword.realtime.nextCheck = nextCheckTime;

  updateRealtimeUI(keywordId);

  keyword.realtime.intervalId = setTimeout(() => {
    performRealtimeCheck(keywordId);
  }, intervalMinutes * 60 * 1000);
}

async function performRealtimeCheck(keywordId) {
  const keyword = keywordManager.keywords[keywordId];
  if (!keyword || !keyword.realtime.isRunning) return;

  // API制限をチェック
  if (rateLimitManager.used >= rateLimitManager.limit) {
    addLogEntry(`キーワード ${getKeywordNumber(keywordId)}: API制限のため次回チェックを延期`, 'warning', keywordId);
    scheduleRealtimeCheck(keywordId);
    return;
  }

  // 実際のX検索API呼び出し（リアルタイム用）
  try {
    const result = await fetchTweets(keywordId, 'realtime');

    if (result.success) {
      const newTweets = result.tweets.length;
      const previousTweetCount = keyword.tweets.length;
      
      // 新着ツイートをキーワードに保存（重複を防ぐ）
      keyword.tweets = mergeTweetsWithoutDuplicates(keyword.tweets, result.tweets);
      clearTweetsCache(); // キャッシュをクリア
      
      // 実際に追加されたツイート数を計算
      const actualNewTweets = keyword.tweets.length - previousTweetCount;
      keyword.realtime.collectedCount += actualNewTweets;
      keyword.stats.totalTweets = keyword.tweets.length;
      keyword.realtime.lastCheck = new Date();

      // API使用量を更新
      rateLimitManager.used++;
      updateRateLimitDisplay();

      updateRealtimeUI(keywordId);
      updateStats();
      updateTweetsList(); // ツイート表示を更新

      if (newTweets > 0) {
        addLogEntry(`キーワード ${getKeywordNumber(keywordId)}: ${newTweets}件の新着ツイートを検出`, 'success', keywordId);
      } else {
        addLogEntry(`キーワード ${getKeywordNumber(keywordId)}: 新着ツイートはありませんでした`, 'info', keywordId);
      }

    } else {
      addLogEntry(`キーワード ${getKeywordNumber(keywordId)}: リアルタイム取得エラー - ${result.error}`, 'error', keywordId);
    }

  } catch (error) {
    addLogEntry(`キーワード ${getKeywordNumber(keywordId)}: リアルタイム通信エラー - ${error.message}`, 'error', keywordId);
  }

  // 次回チェックをスケジュール
  scheduleRealtimeCheck(keywordId);
}

// ========== UI更新ヘルパー関数 ==========================================================

function updateHistoricalStatus(keywordId, status, message) {
  const statusElement = document.getElementById(`historical-status-${keywordId}`);
  const textElement = document.getElementById(`historical-status-text-${keywordId}`);

  if (statusElement && textElement) {
    statusElement.className = `status-indicator ${status}`;
    textElement.textContent = message;
  }
}

function updateRealtimeStatus(keywordId, status, message) {
  const statusElement = document.getElementById(`realtime-status-${keywordId}`);
  const textElement = document.getElementById(`realtime-status-text-${keywordId}`);

  if (statusElement && textElement) {
    statusElement.className = `status-indicator ${status}`;
    textElement.textContent = message;
  }
}

function updateHistoricalUI(keywordId) {
  const keyword = keywordManager.keywords[keywordId];
  if (!keyword) return;

  // 進捗バー更新
  const progressBar = document.getElementById(`historical-progress-${keywordId}`);
  const progressText = document.getElementById(`historical-progress-text-${keywordId}`);
  const collectedText = document.getElementById(`historical-collected-${keywordId}`);

  if (progressBar) progressBar.style.width = `${keyword.historical.progress}%`;
  if (progressText) progressText.textContent = `${Math.round(keyword.historical.progress)}%`;
  if (collectedText) collectedText.textContent = keyword.historical.collectedCount;

  // 総ツイート数更新
  const totalElement = document.getElementById(`total-tweets-${keywordId}`);
  if (totalElement) totalElement.textContent = keyword.stats.totalTweets;
}

function updateRealtimeUI(keywordId) {
  const keyword = keywordManager.keywords[keywordId];
  if (!keyword) return;

  const collectedElement = document.getElementById(`realtime-collected-${keywordId}`);
  const nextElement = document.getElementById(`realtime-next-${keywordId}`);

  if (collectedElement) collectedElement.textContent = keyword.realtime.collectedCount;
  if (nextElement && keyword.realtime.nextCheck) {
    nextElement.textContent = keyword.realtime.nextCheck.toLocaleTimeString('ja-JP', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  // 総ツイート数更新
  const totalElement = document.getElementById(`total-tweets-${keywordId}`);
  if (totalElement) totalElement.textContent = keyword.stats.totalTweets;
}

function toggleHistoricalButtons(keywordId, isRunning) {
  const startBtn = document.getElementById(`start-historical-${keywordId}`);
  const stopBtn = document.getElementById(`stop-historical-${keywordId}`);

  if (startBtn && stopBtn) {
    startBtn.style.display = isRunning ? 'none' : 'inline-flex';
    stopBtn.style.display = isRunning ? 'inline-flex' : 'none';
  }
}

function toggleRealtimeButtons(keywordId, isRunning) {
  const startBtn = document.getElementById(`start-realtime-${keywordId}`);
  const stopBtn = document.getElementById(`stop-realtime-${keywordId}`);

  if (startBtn && stopBtn) {
    startBtn.style.display = isRunning ? 'none' : 'inline-flex';
    stopBtn.style.display = isRunning ? 'inline-flex' : 'none';
  }
}

function calculateDaysBetween(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const timeDiff = end.getTime() - start.getTime();
  return Math.ceil(timeDiff / (1000 * 3600 * 24));
}

// ========== ネットワーク監視機能 ==========================================================

function setupNetworkMonitoring() {
  // X SearchTimeline APIの通信を監視
  chrome.devtools.network.onRequestFinished.addListener(function (entry) {
    const url = entry.request.url;
    const mimeType = entry.response.content.mimeType;

    // SearchTimeline APIの通信を検出
    if (mimeType === "application/json" && url.includes('/SearchTimeline')) {
      handleSearchTimelineRequest(entry);
    }
  });
}

function handleSearchTimelineRequest(entry) {
  entry.getContent(async (body) => {
    try {
      const fullUrl = entry.request.url;
      const urlObj = new URL(fullUrl);
      const variablesRaw = urlObj.searchParams.get("variables");
      const headers = extractSearchHeaders(entry.request.headers);

      if (!variablesRaw) return;

      const variables = JSON.parse(decodeURIComponent(variablesRaw));
      const query = variables?.rawQuery || '';

      // 現在待機中のキーワードを探す
      const waitingKeyword = Object.values(keywordManager.keywords).find(keyword =>
        (keyword.collection?.waitingForInitialApi || keyword.historical?.waitingForInitialApi) &&
        query.includes(keyword.text.trim())
      );

      if (waitingKeyword) {
        // 初回API通信をキャプチャ
        if (waitingKeyword.collection?.waitingForInitialApi) {
          waitingKeyword.collection.waitingForInitialApi = false;
        }
        if (waitingKeyword.historical?.waitingForInitialApi) {
          waitingKeyword.historical.waitingForInitialApi = false;
        }
        // API設定を配列に追加
        if (!waitingKeyword.apiConfigs) {
          waitingKeyword.apiConfigs = [];
        }

        waitingKeyword.apiConfigs.push({
          url: fullUrl,
          headers: JSON.stringify(headers, null, 2),
          baseQuery: query,
          transactionId: headers['x-client-transaction-id']
        });

        const currentIndex = waitingKeyword.currentApiConfigIndex || 0;

        // レスポンスヘッダーからレート制限情報を取得して更新
        const responseHeaders = {};
        entry.response.headers.forEach(header => {
          responseHeaders[header.name.toLowerCase()] = header.value;
        });
        updateRateLimitFromHeaders(responseHeaders);
        updateRateLimitDisplay();

        // 次のAPI設定を取得するか、収集を開始
        const totalConfigs = waitingKeyword.searchSpeed || 1;
        if (currentIndex + 1 < totalConfigs) {
          updateCollectionUI(waitingKeyword.id, 'waiting', `API設定 ${currentIndex + 2}/${totalConfigs} を取得中...`);
          setTimeout(() => {
            openTwitterSearchPageForConfig(waitingKeyword.id, currentIndex + 1, totalConfigs);
          }, 2000);
        } else {
          // 旧形式との互換性のため、最初の設定をapiConfigにも保存
          waitingKeyword.apiConfig = waitingKeyword.apiConfigs[0];

          const actualKeyword = keywordManager.keywords[waitingKeyword.id];
          updateCollectionUI(waitingKeyword.id, 'waiting', '1分待機後にデータ収集を開始します...');

          // API設定取得完了後は60秒待機してからデータ収集を開始

          // カウントダウンタイマーを表示
          let remainingSeconds = 60;
          const totalSeconds = 60;

          // プログレスバーを取得
          const progressBar = document.getElementById(`countdown-progress-bar-${waitingKeyword.id}`);

          const capturedKeywordId = waitingKeyword.id;
          const countdownTimerId = setInterval(() => {
            const currentKeyword = keywordManager.keywords[capturedKeywordId];
            if (!currentKeyword || !currentKeyword.historical || !currentKeyword.historical.isRunning) {
              clearInterval(countdownTimerId);
              return;
            }
            remainingSeconds--;

            // プログレスバーを更新
            if (progressBar) {
              const progressPercent = (remainingSeconds / totalSeconds) * 100;
              progressBar.style.width = progressPercent + '%';

              // 残り時間に応じて色を変更
              if (remainingSeconds <= 10) {
                progressBar.style.background = 'linear-gradient(90deg, #f91880, #ff4458)';
              } else if (remainingSeconds <= 30) {
                progressBar.style.background = 'linear-gradient(90deg, #ff8717, #ffb84d)';
              } else {
                progressBar.style.background = 'linear-gradient(90deg, #1da1f2, #1a91da)';
              }
            }

            updateHistoricalStatus(waitingKeyword.id, 'waiting', `${remainingSeconds}秒後にデータ収集を開始します...`);

            if (remainingSeconds <= 0) {
              clearInterval(countdownTimerId);
              const keywordToUpdate = keywordManager.keywords[capturedKeywordId];
              if (keywordToUpdate && keywordToUpdate.historical) {
                keywordToUpdate.historical.countdownTimer = null;
              }

              // 実行前に再度停止チェック
              if (currentKeyword?.historical?.isRunning) {
                startActualHistoricalCollection(waitingKeyword.id);
              } else {
              }
            }
          }, 1000);
        }
      }

    } catch (error) {
      addLogEntry(`SearchTimeline API監視エラー: ${error.message}`, 'error');
    }
  });
}

function extractSearchHeaders(headers) {
  const wanted = [
    "content-type",
    "authorization",
    "x-csrf-token",
    "x-client-transaction-id",
    "x-twitter-active-user",
    "x-twitter-auth-type",
    "x-twitter-client-language",
    "x-xp-forwarded-for",
    "user-agent"
  ];

  return Object.fromEntries(
    headers
      .filter(h => wanted.includes(h.name.toLowerCase()))
      .map(h => [h.name, h.value])
  );
}

/**
 * API設定が取得された後の実際のデータ収集を開始
 */
function startActualDataCollection(keywordId) {
  const keyword = keywordManager.keywords[keywordId];
  if (!keyword || !keyword.collection?.isRunning) return;

  if (!keyword.apiConfig) {
    addLogEntry(`キーワード ${getKeywordNumber(keywordId)}: API設定が取得できていません`, 'error', keywordId);
    return;
  }

  addLogEntry(`キーワード ${getKeywordNumber(keywordId)}: データ収集を開始します`, 'success', keywordId);
  updateCollectionUI(keywordId, 'running', 'データを収集中...');

  // 検索スピードに応じて複数のAPIコールを実行
  const searchSpeed = keyword.searchSpeed || 1;
  if (searchSpeed > 1 && keyword.apiConfigs && keyword.apiConfigs.length >= searchSpeed) {
    // 高速モード：短い間隔で複数実行（異なるトークンを使用）
    const interval = 3000; // 3秒間隔
    for (let i = 0; i < searchSpeed; i++) {
      setTimeout(() => {
        if (keyword.collection?.isRunning) {
          performDataCollection(keywordId);
        }
      }, i * interval);
    }

    // 次のバッチは60秒後
    setTimeout(() => {
      if (keyword.collection?.isRunning) {
        scheduleNextCollection(keywordId, 'collection');
      }
    }, 60000);
  } else {
    // 通常モード
    performDataCollection(keywordId);
  }
}

/**
 * API設定が取得された後の実際の過去データ収集を開始
 */
function startActualHistoricalCollection(keywordId) {
  const keyword = keywordManager.keywords[keywordId];
  if (!keyword) {
    return;
  }

  // 実行前に停止チェック
  if (!keyword.historical?.isRunning) {
    return;
  }

  if (!keyword.apiConfig) {
    addLogEntry(`キーワード ${getKeywordNumber(keywordId)}: API設定が取得できていません`, 'error', keywordId);
    return;
  }

  addLogEntry(`キーワード ${getKeywordNumber(keywordId)}: 過去データ収集を開始します`, 'success', keywordId);
  updateHistoricalStatus(keywordId, 'running', '過去データを収集中...');

  // scheduleNextCollectionを使用して統一的に処理
  addLogEntry(`キーワード ${getKeywordNumber(keywordId)}: 過去データ収集の最初のバッチを開始します`, 'info', keywordId);
  scheduleNextCollection(keywordId, 'historical');
}

/**
 * X検索ページを開いて初回API通信をトリガーする
 */
function openTwitterSearchPage(keywordId) {
  const keyword = keywordManager.keywords[keywordId];
  if (!keyword) return;

  // 検索スピードに応じた複数のAPI設定を取得
  const totalConfigs = keyword.searchSpeed || 1;
  keyword.apiConfigs = [];
  keyword.currentApiConfigIndex = 0;


  // 最初のAPI設定を取得
  openTwitterSearchPageForConfig(keywordId, 0, totalConfigs);
}

function openTwitterSearchPageForConfig(keywordId, configIndex, totalConfigs) {
  const keyword = keywordManager.keywords[keywordId];
  if (!keyword) return;

  // 過去データ収集かリアルタイム収集かを判定
  if (keyword.historical?.isRunning) {
    keyword.historical.waitingForInitialApi = true;
  } else {
    keyword.collection.waitingForInitialApi = true;
  }
  keyword.currentApiConfigIndex = configIndex;

  // 日付フィルター付きの検索URLを構築
  const searchUrl = buildSearchUrlWithDateRange(keyword);


  // ブラウザで検索ページを開く
  chrome.runtime.sendMessage({
    action: 'openPage',
    url: searchUrl,
    tabId: chrome.devtools.inspectedWindow.tabId
  });

  // 10秒後にまだAPI通信が検出されていない場合はタイムアウト
  setTimeout(() => {
    if (keyword.collection?.waitingForInitialApi && keyword.currentApiConfigIndex === configIndex) {
      keyword.collection.waitingForInitialApi = false;

      // 次のAPI設定を取得
      if (configIndex + 1 < totalConfigs) {
        setTimeout(() => {
          openTwitterSearchPageForConfig(keywordId, configIndex + 1, totalConfigs);
        }, 2000);
      } else {
        // すべて完了したら収集開始
        startActualDataCollection(keywordId);
      }
    }
  }, 10000);
}

/**
 * 実際のデータ収集を実行
 */
async function performDataCollection(keywordId) {
  const keyword = keywordManager.keywords[keywordId];
  if (!keyword || !keyword.collection?.isRunning) return;

  // API制限をチェック
  if (rateLimitManager.used >= rateLimitManager.limit) {
    updateCollectionUI(keywordId, 'waiting', 'API制限のため待機中...');
    const waitTime = Math.max(0, rateLimitManager.resetTime - Date.now());
    keyword.collection.apiLimitTimer = setTimeout(() => {
      if (keyword.collection.apiLimitTimer) {
        keyword.collection.apiLimitTimer = null;
      }
      performDataCollection(keywordId);
    }, waitTime + 1000);
    return;
  }

  // 実際のX検索API呼び出し
  try {
    const result = await fetchTweets(keywordId, 'historical');

    if (result.success) {
      const collectedCount = result.tweets.length;
      const previousTweetCount = keyword.tweets.length;
      
      // 取得したツイートをキーワードに保存（重複を防ぐ）
      keyword.tweets = mergeTweetsWithoutDuplicates(keyword.tweets, result.tweets);
      clearTweetsCache(); // キャッシュをクリア
      
      // 実際に追加されたツイート数を計算
      const actualNewTweets = keyword.tweets.length - previousTweetCount;
      keyword.collection.collectedCount += actualNewTweets;
      keyword.stats.totalTweets = keyword.tweets.length;

      // 次のカーソルを保存
      if (result.cursor) {
        keyword.collection.currentCursor = result.cursor;
      }

      // API使用量を更新
      rateLimitManager.used++;
      updateRateLimitDisplay();

      // ツイート表示を更新
      updateTweetsList();

      // 統計を更新
      updateStats();

      // 進捗を更新
      const progressBar = document.getElementById(`progress-bar-${keywordId}`);
      const progressCount = document.getElementById(`progress-count-${keywordId}`);

      if (progressCount) {
        progressCount.textContent = keyword.collection.collectedCount;
      }

      // プログレスバーは無限スタイル（実際の進捗は不明のため）
      if (progressBar) {
        progressBar.style.width = '100%';
        progressBar.style.background = 'linear-gradient(90deg, #1da1f2 0%, #1da1f2 50%, rgba(29,161,242,0.3) 50%, rgba(29,161,242,0.3) 100%)';
        progressBar.style.backgroundSize = '200% 100%';
        progressBar.style.animation = 'progress-slide 1.5s ease-in-out infinite';
      }

      keyword.stats.lastUpdate = new Date();

      updateCollectionUI(keywordId, 'running', `${collectedCount}件のツイートを取得しました`);
      addLogEntry(`キーワード ${getKeywordNumber(keywordId)}: ${collectedCount}件のツイートを取得`, 'success', keywordId);


      // 継続判定: ツイートが0件の場合は完了とみなす
      const shouldContinue = result.cursor && keyword.collection.isRunning && collectedCount > 0;

      if (shouldContinue) {
        updateCollectionUI(keywordId, 'waiting', '次のAPI呼び出しを準備中...');
        startCountdownTimer(keywordId, 60);
        setTimeout(() => performDataCollection(keywordId), 60000); // 60秒待機
      } else {
        // 完了
        keyword.collection.isCompleted = true;
        keyword.collection.isRunning = false;

        // 完了時のプログレスバー表示
        const progressBar = document.getElementById(`progress-bar-${keywordId}`);
        if (progressBar) {
          progressBar.style.width = '100%';
          progressBar.style.background = '#00ba7c'; // 完了色
          progressBar.style.animation = 'none';
        }

        // 完了理由を判定
        let completionReason = '';
        if (collectedCount === 0) {
          completionReason = 'これ以上のツイートがありません';
        } else if (!result.cursor) {
          completionReason = '最後のページに到達しました';
        } else if (!keyword.collection.isRunning) {
          completionReason = '手動で停止されました';
        }

        updateCollectionUI(keywordId, 'completed', completionReason);
        toggleCollectionButtons(keywordId, false);
        updateStats(); // 完了時にも統計を更新

        // カウントダウンタイマーをクリア
        if (keyword.collection.countdownTimer) {
          clearInterval(keyword.collection.countdownTimer);
          keyword.collection.countdownTimer = null;
          const countdownElement = document.getElementById(`countdown-${keywordId}`);
          if (countdownElement) {
            countdownElement.style.display = 'none';
          }
        }

        addLogEntry(`キーワード ${getKeywordNumber(keywordId)}: データ収集が完了しました - ${completionReason}`, 'success', keywordId);
        addLogEntry(`キーワード ${getKeywordNumber(keywordId)}: 総収集数: ${keyword.collection.collectedCount}件`, 'success', keywordId);
      }

    } else {
      addLogEntry(`キーワード ${getKeywordNumber(keywordId)}: データ収集エラー - ${result.error}`, 'error', keywordId);
      updateCollectionUI(keywordId, 'error', `エラー: ${result.error}`);
    }

  } catch (error) {
    addLogEntry(`キーワード ${getKeywordNumber(keywordId)}: 通信エラー - ${error.message}`, 'error', keywordId);
    updateCollectionUI(keywordId, 'error', `通信エラー: ${error.message}`);
  }
}

// ========== X API通信機能 ==========================================================

/**
 * FavoriteTweet APIをページ内のコンテキストから呼び出す
 * @param {string} tweetId - ツイートID
 */
function injectFavoriteTweetCall(tweetId) {
  try {
    // background scriptにメッセージを送信してAPIを呼び出す
    chrome.runtime.sendMessage({
      type: 'favorite-tweet-api',
      tweetId: tweetId
    });
  } catch (error) {
  }
}


/**
 * X SearchTimeline APIからツイートを取得
 * @param {string} keywordId - キーワードID 
 * @param {string} mode - 'historical' または 'realtime'
 * @returns {Promise<{success: boolean, tweets: array, cursor: string, error?: string}>}
 */
async function fetchTweets(keywordId, mode) {
  const keyword = keywordManager.keywords[keywordId];
  if (!keyword) {
    return { success: false, error: 'キーワードが見つかりません' };
  }

  // 複数のAPI設定がある場合は順番に使用
  let apiConfig;
  if (keyword.apiConfigs && keyword.apiConfigs.length > 0) {
    // 現在のAPI設定インデックスを管理
    if (!keyword.currentApiIndex) {
      keyword.currentApiIndex = 0;
    }

    apiConfig = keyword.apiConfigs[keyword.currentApiIndex];

    // 次回は次のAPI設定を使用（ラウンドロビン）
    keyword.currentApiIndex = (keyword.currentApiIndex + 1) % keyword.apiConfigs.length;
  } else if (keyword.apiConfig) {
    // 旧形式の単一API設定
    apiConfig = keyword.apiConfig;
  } else {
    return { success: false, error: 'API設定が取得できていません。検索ページへのアクセスが必要です。' };
  }

  try {
    // 検索クエリを構築（日付フィルター付き）
    const searchQuery = buildSearchQueryWithDateRange(keyword);

    // カーソル確認
    const currentCursor = mode === 'historical' ? keyword.historical?.currentCursor : keyword.collection?.currentCursor;

    // API URLを構築（キャプチャしたベースURLを使用）
    const apiUrl = buildSearchApiUrlFromCaptured(apiConfig.url, searchQuery, currentCursor);

    // キャプチャしたヘッダーをそのまま使用
    const headers = JSON.parse(apiConfig.headers);

    // APIリクエストを実行
    const requestObj = {
      method: 'GET',
      url: apiUrl,
      headers: headers
    };

    const response = await sendTwitterRequest(requestObj);

    if (response.success) {
      // レスポンスボディの存在確認
      if (!response.body) {
        return {
          success: false,
          error: 'レスポンスボディが空です'
        };
      }

      // レスポンスを解析
      addLogEntry(`API レスポンス確認: ボディサイズ=${response.body?.length || 0}, ヘッダー数=${Object.keys(response.headers || {}).length}`, 'info', keywordId);
      const result = parseSearchResponse(response.body, response.headers);

      // レート制限情報を更新
      updateRateLimitFromHeaders(response.headers);

      addLogEntry(`API 解析結果: ツイート数=${result.tweets?.length || 0}, カーソル=${result.cursor ? result.cursor.substring(0, 50) + '...' : 'なし'}`, 'info', keywordId);

      // DependencyErrorの場合は特別な処理
      if (result.isDependencyError) {
        return {
          success: false,
          error: 'DependencyError',
          isDependencyError: true,
          tweets: [],
          cursor: null
        };
      }

      return {
        success: true,
        tweets: result.tweets,
        cursor: result.cursor
      };

    } else {
      return {
        success: false,
        error: `API エラー (${response.status}): ${response.statusText}`
      };
    }

  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * キーワード設定から検索クエリを構築
 */
function buildSearchQuery(keyword) {
  let query = keyword.text.trim();

  // 対象日付を追加（その日のツイートのみ取得）
  if (keyword.targetDate) {
    const targetDate = keyword.targetDate; // YYYY-MM-DD形式
    const nextDate = new Date(targetDate);
    nextDate.setDate(nextDate.getDate() + 1);
    const nextDateStr = nextDate.toISOString().split('T')[0];

    query += ` since:${targetDate} until:${nextDateStr}`;
  }

  return query;
}

/**
 * SearchTimeline API URLを構築
 */
function buildSearchApiUrl(query, cursor = null) {
  const baseUrl = 'https://x.com/i/api/graphql/xQgzkJguvzoS8E_1LrVGPA/SearchTimeline';

  const variables = {
    rawQuery: query,
    count: 20,
    querySource: "typed_query",
    product: "Top"
  };

  if (cursor) {
    variables.cursor = cursor;
  }

  const features = {
    "rweb_video_screen_enabled": false,
    "payments_enabled": false,
    "profile_label_improvements_pcf_label_in_post_enabled": true,
    "rweb_tipjar_consumption_enabled": true,
    "verified_phone_label_enabled": false,
    "creator_subscriptions_tweet_preview_api_enabled": true,
    "responsive_web_graphql_timeline_navigation_enabled": true,
    "responsive_web_graphql_skip_user_profile_image_extensions_enabled": false,
    "premium_content_api_read_enabled": false,
    "communities_web_enable_tweet_community_results_fetch": true,
    "c9s_tweet_anatomy_moderator_badge_enabled": true,
    "responsive_web_grok_analyze_button_fetch_trends_enabled": false,
    "responsive_web_grok_analyze_post_followups_enabled": true,
    "responsive_web_jetfuel_frame": true,
    "responsive_web_grok_share_attachment_enabled": true,
    "articles_preview_enabled": true,
    "responsive_web_edit_tweet_api_enabled": true,
    "graphql_is_translatable_rweb_tweet_is_translatable_enabled": true,
    "view_counts_everywhere_api_enabled": true,
    "longform_notetweets_consumption_enabled": true,
    "responsive_web_twitter_article_tweet_consumption_enabled": true,
    "tweet_awards_web_tipping_enabled": false,
    "responsive_web_grok_show_grok_translated_post": false,
    "responsive_web_grok_analysis_button_from_backend": false,
    "creator_subscriptions_quote_tweet_preview_enabled": false,
    "freedom_of_speech_not_reach_fetch_enabled": true,
    "standardized_nudges_misinfo": true,
    "tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled": true,
    "longform_notetweets_rich_text_read_enabled": true,
    "longform_notetweets_inline_media_enabled": true,
    "responsive_web_grok_image_annotation_enabled": true,
    "responsive_web_grok_community_note_auto_translation_is_enabled": false,
    "responsive_web_enhance_cards_enabled": false
  };

  const url = new URL(baseUrl);
  url.searchParams.set('variables', JSON.stringify(variables));
  url.searchParams.set('features', JSON.stringify(features));

  return url.toString();
}

/**
 * キャプチャしたAPI URLを基に新しい検索URLを構築
 */
function buildSearchApiUrlFromCaptured(capturedUrl, newQuery, cursor = null) {
  try {
    const url = new URL(capturedUrl);
    const variablesRaw = url.searchParams.get('variables');

    if (variablesRaw) {
      const variables = JSON.parse(decodeURIComponent(variablesRaw));

      // クエリを新しいものに置き換え
      variables.rawQuery = newQuery;

      // カーソルを設定（ページネーション用）
      if (cursor) {
        variables.cursor = cursor;
      } else {
        delete variables.cursor;
      }

      // 件数を設定
      variables.count = 20;

      url.searchParams.set('variables', JSON.stringify(variables));
    }

    return url.toString();

  } catch (error) {
    // フォールバックとして新しいURLを構築
    return buildSearchApiUrl(newQuery, cursor);
  }
}

// この関数は新しい実装では使用されません（実際のリクエストからヘッダーを取得するため）
// /**
//  * 現在のブラウザセッションからX APIヘッダーを取得 (非推奨)
//  */

/**
 * X APIリクエストを実行
 */
function sendTwitterRequest(requestObj) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({
      type: "replay-request",
      url: requestObj.url,
      method: requestObj.method,
      headers: requestObj.headers,
      body: requestObj.body || undefined,
    }, (response) => {
      if (response?.success) {
        resolve({
          success: true,
          body: response.response,
          headers: response.headers,
          status: response.status,
          statusText: response.statusText || 'OK'
        });
      } else {
        resolve({
          success: false,
          status: response?.status || 500,
          statusText: response?.statusText || 'Unknown Error',
          error: response?.error || "Unknown error"
        });
      }
    });
  });
}

/**
 * 検索APIレスポンスを解析
 */
function parseSearchResponse(responseBody, headers) {
  try {
    // レスポンスボディの検証
    if (!responseBody || responseBody.trim() === '') {
      addLogEntry('空のレスポンスボディを受信しました', 'warning');
      return { tweets: [], cursor: null };
    }

    const data = JSON.parse(responseBody);

    // APIエラーチェック
    if (data.errors && data.errors.length > 0) {
      // すべてのAPIエラーを一時的エラーとして扱う
      addLogEntry(`APIエラー: ${data.errors[0].message} - 60秒後に再試行します`, 'error');
      return {
        tweets: [],
        cursor: null,
        isDependencyError: true
      };
    }

    const tweets = [];
    let cursor = null;


    // レスポンス解析開始（ログ簡略化）
    const instructions = data?.data?.search_by_raw_query?.search_timeline?.timeline?.instructions || [];

    for (const instruction of instructions) {
      addLogEntry(`instruction処理: type=${instruction.type}, entries数=${instruction.entries?.length || 0}`, 'info');

      // TimelineAddEntries と TimelineReplaceEntry の両方を処理
      if (instruction.type === 'TimelineAddEntries') {
        for (const entry of instruction.entries || []) {
          if (entry.entryId?.startsWith('tweet-')) {
            const tweetData = entry.content?.itemContent?.tweet_results?.result;

            if (tweetData) {
              // ユーザー情報を様々なパスから取得を試行
              let userResult = null;
              let userInfo = {};

              // データ構造確認（ログ簡略化）

              // パターン1: core.user_results.result
              if (tweetData.core?.user_results?.result) {
                userResult = tweetData.core.user_results.result;

                // ユーザー情報取得成功
              }

              // パターン2: legacy.entities.user_mentions[0] (リツイートの場合)
              if (!userResult && tweetData.legacy?.entities?.user_mentions?.length > 0) {
                const mention = tweetData.legacy.entities.user_mentions[0];
                userResult = {
                  rest_id: mention.id_str,
                  legacy: {
                    screen_name: mention.screen_name,
                    name: mention.name
                  }
                };
              }

              // パターン3: legacy内に直接ユーザー情報がある場合
              if (!userResult && tweetData.legacy) {
                userResult = {
                  rest_id: tweetData.legacy.user_id_str,
                  legacy: {
                    screen_name: tweetData.legacy.screen_name,
                    name: tweetData.legacy.user_name || tweetData.legacy.name
                  }
                };
              }

              // ユーザー情報を構築
              if (userResult) {
                // 複数のパスを試してユーザー情報を取得
                const userName = userResult.legacy?.name || userResult.core?.name || userResult.name || userResult.displayName;
                const screenName = userResult.legacy?.screen_name || userResult.core?.screen_name || userResult.screen_name || userResult.username;
                const profileImage = userResult.avatar?.image_url;

                userInfo = {
                  id: userResult.rest_id || userResult.id_str,
                  screen_name: screenName,
                  name: userName,
                  profile_image_url: profileImage
                };

                // 代替パスを試す
                if (!userInfo.name || !userInfo.screen_name) {
                  if (!userInfo.name) {
                    const altName = userResult.display_name || userResult.fullName || userResult.username || 'Unknown User';
                    userInfo.name = altName;
                  }

                  if (!userInfo.screen_name) {
                    const altScreenName = userResult.handle || userResult.user_name || userResult.login;
                    if (altScreenName) {
                      userInfo.screen_name = altScreenName;
                    }
                  }
                }
              } else {
                // userResultがnullの場合はこのツイートをスキップ
                addLogEntry('ユーザー情報が取得できないツイートをスキップしました', 'warning');
                continue; // 次のツイートに進む
              }

              // ツイート情報を構築
              const legacy = tweetData.legacy || {};
              const tweet = {
                id: tweetData.rest_id || tweetData.id_str,
                text: legacy.full_text || legacy.text || '内容を取得できませんでした',
                created_at: legacy.created_at || new Date().toISOString(),
                user: userInfo,
                public_metrics: {
                  retweet_count: legacy.retweet_count || 0,
                  like_count: legacy.favorite_count || 0,
                  reply_count: legacy.reply_count || 0,
                  quote_count: legacy.quote_count || 0,
                  view_count: parseInt(tweetData.views?.count) || 0
                },
                urls: legacy.entities?.urls || [],
                hashtags: legacy.entities?.hashtags || [],
                user_mentions: legacy.entities?.user_mentions || []
              };

              // ユーザー情報の最終検証
              if (!userInfo.name || !userInfo.screen_name || userInfo.name === 'Unknown User') {
                addLogEntry(`不完全なユーザー情報のツイートをスキップ: ${JSON.stringify(userInfo)}`, 'warning');
                continue;
              }

              tweets.push(tweet);
            }
          } else if (entry.entryId?.includes('cursor-bottom')) {
            cursor = entry.content?.value;
            addLogEntry(`カーソル取得: ${cursor}`, 'info');
          }
        }
      } else if (instruction.type === 'TimelineReplaceEntry') {
        // TimelineReplaceEntryでもカーソルとツイートをチェック
        const entry = instruction.entry;
        if (entry && entry.entryId?.includes('cursor-bottom')) {
          cursor = entry.content?.value;
          addLogEntry(`カーソル取得(ReplaceEntry): ${cursor}`, 'info');
        } else if (entry && entry.entryId?.startsWith('tweet-')) {
          // TimelineReplaceEntry内のツイートデータを処理
          const tweetData = entry.content?.itemContent?.tweet_results?.result;
          addLogEntry(`ReplaceEntry内ツイート発見: ${entry.entryId}`, 'info');

          if (tweetData) {
            // 同じツイート処理ロジックを適用（TimelineAddEntriesと同じ処理）
            // [ここにツイート処理ロジックをコピー]
            addLogEntry(`ReplaceEntry ツイート処理開始`, 'info');
          }
        }
      }
    }

    addLogEntry(`=== 解析完了: ${tweets.length}件のツイートを取得 ===`, 'success');
    return { tweets, cursor };

  } catch (error) {
    addLogEntry(`レスポンス解析エラー: ${error.message}`, 'error');
    addLogEntry(`レスポンスボディの先頭100文字: ${responseBody ? responseBody.substring(0, 100) : 'null'}`, 'warning');
    return { tweets: [], cursor: null };
  }
}

/**
 * レスポンスヘッダーからレート制限情報を更新
 */
function updateRateLimitFromHeaders(headers) {
  const rateLimit = headers['x-rate-limit-limit'];
  const rateRemaining = headers['x-rate-limit-remaining'];
  const rateReset = headers['x-rate-limit-reset'];

  if (rateLimit !== undefined) {
    rateLimitManager.limit = parseInt(rateLimit, 10);
  }
  if (rateRemaining !== undefined) {
    rateLimitManager.remaining = parseInt(rateRemaining, 10);
    rateLimitManager.used = rateLimitManager.limit - rateLimitManager.remaining;
  }
  if (rateReset !== undefined) {
    rateLimitManager.resetTime = parseInt(rateReset, 10) * 1000; // ミリ秒に変換
  }
}


function deleteKeyword(keywordId) {
  if (!keywordManager.keywords[keywordId]) return;

  const keywordNumber = getKeywordNumber(keywordId);

  // 検索を停止
  stopKeywordSearch(keywordId);

  // UIから削除
  const card = document.querySelector(`[data-keyword-id="${keywordId}"]`);
  if (card) {
    card.remove();
  }

  // データから削除
  delete keywordManager.keywords[keywordId];

  // キャッシュをクリア（重要）
  clearTweetsCache();
  
  // ツイートタブのグローバル変数もクリア
  if (typeof tweetsAllData !== 'undefined') {
    tweetsAllData = [];
  }
  if (typeof tweetsFilteredData !== 'undefined') {
    tweetsFilteredData = [];
  }
  
  // 影響力分析の状態もクリア（比較モード対応）
  if (window.influenceAnalysisState) {
    window.influenceAnalysisState.userTweets = {};
    window.influenceAnalysisState.selectedUsers = [];
    window.influenceAnalysisState.selectedUser = null;
    window.influenceAnalysisState.compareMode = false;
    window.influenceAnalysisState.cachedStats = null;
    window.influenceAnalysisState.cachedUsername = null;
    window.influenceAnalysisState.statsCache = {};
  }

  // 単一モードの表示を完全にクリア
  const usernameElem = document.getElementById('influenceUsername');
  const handleElem = document.getElementById('influenceHandle');
  const scoreElem = document.getElementById('influenceScore');
  const postCountElem = document.getElementById('influencePostCount');
  const postFrequencyElem = document.getElementById('influencePostFrequency');
  const dataSummaryElem = document.getElementById('influenceDataSummary');
  
  if (usernameElem) usernameElem.textContent = 'ユーザーを選択';
  if (handleElem) handleElem.textContent = '@username';
  if (scoreElem) scoreElem.textContent = '0';
  if (postCountElem) postCountElem.textContent = '0';
  if (postFrequencyElem) postFrequencyElem.textContent = '0/週 (0週間)';
  if (dataSummaryElem) dataSummaryElem.textContent = '-';
  
  // レーダーチャートをクリア
  const radarCanvas = document.getElementById('influenceRadarChart');
  if (radarCanvas) {
    const ctx = radarCanvas.getContext('2d');
    ctx.clearRect(0, 0, radarCanvas.width, radarCanvas.height);
  }
  
  // エンゲージメント推移グラフをクリア
  const timeSeriesDiv = document.getElementById('influenceTimeSeries');
  if (timeSeriesDiv) {
    timeSeriesDiv.innerHTML = '<div style="min-height: 200px; display: flex; align-items: center; justify-content: center; color: #8b98a5;">データを収集してください</div>';
  }
  
  // ユーザーセレクタをリセット
  const userSelector = document.getElementById('userSelector');
  if (userSelector) {
    userSelector.innerHTML = '<option value="">ユーザーを選択してください</option>';
  }
  
  // アバターアイコンをリセット
  const avatarElem = document.getElementById('influenceAvatar');
  if (avatarElem) {
    avatarElem.innerHTML = '👤';
  }
  
  // 投稿時間帯分析をクリア
  const heatmapDiv = document.getElementById('influenceHeatmap');
  if (heatmapDiv) {
    heatmapDiv.innerHTML = '<div style="min-height: 120px; display: flex; align-items: center; justify-content: center; color: #8b98a5;">データを収集してください</div>';
  }
  
  // 詳細統計をリセット
  const statsElements = [
    'maxLikes', 'topAvgLikes', 'avgLikes',
    'maxRetweets', 'topAvgRetweets', 'avgRetweets',
    'maxViews', 'topAvgViews', 'avgViews'
  ];
  
  statsElements.forEach(id => {
    const elem = document.getElementById(id);
    if (elem) {
      elem.textContent = '0';
    }
  });
  
  // 比較レーダーチャートをクリア
  const chartContainer = document.getElementById('comparisonChart');
  if (chartContainer) {
    chartContainer.innerHTML = '';
  }
  
  // エンゲージメント推移比較グラフをクリア
  const engagementCanvas = document.getElementById('engagementComparisonChart');
  if (engagementCanvas) {
    const ctx = engagementCanvas.getContext('2d');
    ctx.clearRect(0, 0, engagementCanvas.width, engagementCanvas.height);
  }
  
  // 凡例をクリア
  const engagementLegend = document.getElementById('comparisonEngagementLegend');
  if (engagementLegend) {
    engagementLegend.innerHTML = '';
  }
  
  // 比較モードを非表示
  const compareModeContent = document.getElementById('influenceContentCompare');
  if (compareModeContent) {
    compareModeContent.style.display = 'none';
  }
  
  // 比較モードボタンをリセット
  const compareModeBtn = document.getElementById('influenceCompareMode');
  if (compareModeBtn) {
    compareModeBtn.classList.remove('btn-primary');
    compareModeBtn.classList.add('btn-secondary');
    compareModeBtn.innerHTML = '<span>⚖️</span> 比較モード';
  }

  // 残りのカードの番号を振り直し
  renumberKeywordCards();

  // 追加ボタンの状態を更新
  updateAddKeywordButton();

  // 統計を更新
  updateStats();

  // チャートを更新
  updateChart();

  // ツイートフィルターを更新
  updateTweetsFilter();
  
  // ツイート表示を更新（キーワード削除を反映）
  updateTweetsList();
  
  // アカウント分析タブも更新
  updateAccountKeywordFilter();
  
  // 影響力分析タブを再初期化（データが変更されたため）
  if (keywordManager.activeTab === 'influence') {
    updateInfluenceAnalysis();
  }

  addLogEntry(`キーワード ${keywordNumber} を削除しました`, 'info');
}

function renumberKeywordCards() {
  const cards = document.querySelectorAll('.keyword-card');
  cards.forEach((card, index) => {
    // 番号を更新
    const numberElem = card.querySelector('.keyword-number');
    if (numberElem) {
      numberElem.textContent = index + 1;
    }

    // クラス名を更新
    card.className = `keyword-card keyword-${index + 1}`;
  });
}

function updateAddKeywordButton() {
  const btn = document.getElementById('addKeywordBtn');
  const count = Object.keys(keywordManager.keywords).length;

  if (count >= keywordManager.maxKeywords) {
    btn.disabled = true;
    btn.innerHTML = '<span>🚫</span>キーワード上限に達しました';
  } else {
    btn.disabled = false;
    btn.innerHTML = '<span>➕</span>キーワードを追加（最大3個）';
  }
}

function getKeywordNumber(keywordId) {
  const cards = Array.from(document.querySelectorAll('.keyword-card'));
  const card = document.querySelector(`[data-keyword-id="${keywordId}"]`);
  return cards.indexOf(card) + 1;
}

// ========== 検索機能 ==========================================================

function stopKeywordSearch(keywordId) {
  const keyword = keywordManager.keywords[keywordId];
  if (!keyword || !keyword.active) return;

  keyword.active = false;
  updateKeywordStatus(keywordId, '', '停止');

  // ボタンの状態を切り替え
  document.getElementById(`start-${keywordId}`).style.display = 'inline-flex';
  document.getElementById(`stop-${keywordId}`).style.display = 'none';

  // カードのアクティブ状態を解除
  const card = document.querySelector(`[data-keyword-id="${keywordId}"]`);
  if (card) {
    card.classList.remove('active');
  }

  // 定期実行をクリア
  if (keyword.intervalId) {
    clearInterval(keyword.intervalId);
    keyword.intervalId = null;
  }

  addLogEntry(`検索を停止: "${keyword.text}"`, 'warning', keywordId);

  updateStats();
}

function buildSearchUrl(keyword) {
  const baseUrl = 'https://x.com/i/api/graphql/xQgzkJguvzoS8E_1LrVGPA/SearchTimeline';

  // 高度検索クエリを構築
  const rawQuery = buildAdvancedQuery(keyword);

  const variables = {
    rawQuery: rawQuery,
    count: 20,
    querySource: 'typed_query',
    product: 'Latest'  // LatestとTopを選択可能に
  };

  const params = new URLSearchParams({
    variables: JSON.stringify(variables),
    features: JSON.stringify({
      rweb_video_screen_enabled: false,
      payments_enabled: false,
      profile_label_improvements_pcf_label_in_post_enabled: true,
      rweb_tipjar_consumption_enabled: true,
      verified_phone_label_enabled: false,
      creator_subscriptions_tweet_preview_api_enabled: true,
      responsive_web_graphql_timeline_navigation_enabled: true,
      responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
      premium_content_api_read_enabled: false,
      communities_web_enable_tweet_community_results_fetch: true,
      c9s_tweet_anatomy_moderator_badge_enabled: true,
      responsive_web_grok_analyze_button_fetch_trends_enabled: false,
      responsive_web_grok_analyze_post_followups_enabled: true,
      responsive_web_jetfuel_frame: true,
      responsive_web_grok_share_attachment_enabled: true,
      articles_preview_enabled: true,
      responsive_web_edit_tweet_api_enabled: true,
      graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
      view_counts_everywhere_api_enabled: true,
      longform_notetweets_consumption_enabled: true,
      responsive_web_twitter_article_tweet_consumption_enabled: true,
      tweet_awards_web_tipping_enabled: false,
      responsive_web_grok_show_grok_translated_post: false,
      responsive_web_grok_analysis_button_from_backend: false,
      creator_subscriptions_quote_tweet_preview_enabled: false,
      freedom_of_speech_not_reach_fetch_enabled: true,
      standardized_nudges_misinfo: true,
      tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
      longform_notetweets_rich_text_read_enabled: true,
      longform_notetweets_inline_media_enabled: true,
      responsive_web_grok_image_annotation_enabled: true,
      responsive_web_grok_community_note_auto_translation_is_enabled: false,
      responsive_web_enhance_cards_enabled: false
    })
  });

  return `${baseUrl}?${params.toString()}`;
}

function buildAdvancedQuery(keyword) {
  let queryParts = [];

  // 基本キーワード（AND検索）
  if (keyword.text.trim()) {
    queryParts.push(keyword.text.trim());
  }

  // 日時範囲
  if (keyword.startDate) {
    const startDate = new Date(keyword.startDate).toISOString().split('T')[0];
    queryParts.push(`since:${startDate}`);
  }

  if (keyword.endDate) {
    const endDate = new Date(keyword.endDate).toISOString().split('T')[0];
    queryParts.push(`until:${endDate}`);
  }

  const finalQuery = queryParts.join(' ');

  return finalQuery;
}

// ========== パフォーマンス最適化 ==========================================================

/**
 * ローディング状態管理クラス
 */
class LoadingManager {
  constructor() {
    this.activeLoadings = new Map();
  }

  /**
   * ローディングを開始
   */
  start(containerId, message = '読み込み中...', showProgress = false) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const loadingId = `loading_${Date.now()}_${Math.random()}`;

    const loadingDiv = document.createElement('div');
    loadingDiv.id = loadingId;
    loadingDiv.className = 'loading-overlay';
    loadingDiv.innerHTML = `
      <div class="loading-content">
        <div class="loading-spinner"></div>
        <div class="loading-message">${message}</div>
        ${showProgress ? '<div class="loading-progress"><div class="loading-progress-bar" id="progress-' + loadingId + '"></div></div>' : ''}
      </div>
    `;

    container.style.position = 'relative';
    container.appendChild(loadingDiv);

    this.activeLoadings.set(containerId, loadingId);
    return loadingId;
  }

  /**
   * プログレスバーを更新
   */
  updateProgress(containerId, progress) {
    const loadingId = this.activeLoadings.get(containerId);
    if (loadingId) {
      const progressBar = document.getElementById(`progress-${loadingId}`);
      if (progressBar) {
        progressBar.style.width = `${Math.min(100, Math.max(0, progress))}%`;
      }
    }
  }

  /**
   * ローディングメッセージを更新
   */
  updateMessage(containerId, message) {
    const loadingId = this.activeLoadings.get(containerId);
    if (loadingId) {
      const loadingDiv = document.getElementById(loadingId);
      if (loadingDiv) {
        const messageDiv = loadingDiv.querySelector('.loading-message');
        if (messageDiv) {
          messageDiv.textContent = message;
        }
      }
    }
  }

  /**
   * ローディングを終了
   */
  end(containerId) {
    const loadingId = this.activeLoadings.get(containerId);
    if (loadingId) {
      const loadingDiv = document.getElementById(loadingId);
      if (loadingDiv) {
        loadingDiv.remove();
      }
      this.activeLoadings.delete(containerId);
    }
  }

  /**
   * すべてのローディングを終了
   */
  endAll() {
    this.activeLoadings.forEach((loadingId, containerId) => {
      this.end(containerId);
    });
  }
}

// グローバルインスタンス
const loadingManager = new LoadingManager();

/**
 * 非同期処理ヘルパー
 */
class AsyncProcessor {
  /**
   * 大きなタスクを小さなチャンクに分割して非同期処理
   */
  static async processInChunks(items, processor, chunkSize = 100, onProgress = null) {
    const results = [];
    const totalItems = items.length;

    for (let i = 0; i < totalItems; i += chunkSize) {
      const chunk = items.slice(i, i + chunkSize);
      const chunkResults = await this.processChunk(chunk, processor);
      results.push(...chunkResults);

      // プログレス更新
      if (onProgress) {
        const progress = Math.min(100, ((i + chunkSize) / totalItems) * 100);
        onProgress(progress);
      }

      // UIをブロックしないように少し待機
      await this.sleep(1);
    }

    return results;
  }

  /**
   * チャンク処理
   */
  static async processChunk(chunk, processor) {
    return new Promise((resolve) => {
      setTimeout(() => {
        const results = chunk.map(processor);
        resolve(results);
      }, 0);
    });
  }

  /**
   * 指定時間待機
   */
  static sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * 仮想スクロール実装クラス
 */
class VirtualScroller {
  constructor(container, options = {}) {
    this.container = container;
    this.itemHeight = options.itemHeight || 100;
    this.buffer = options.buffer || 5; // 前後に余分に表示するアイテム数
    this.renderItem = options.renderItem || (() => '<div>Item</div>');
    this.data = [];

    this.scrollTop = 0;
    this.containerHeight = 0;
    this.visibleStart = 0;
    this.visibleEnd = 0;

    this.viewport = null;
    this.content = null;

    this.init();
  }

  init() {
    // 既存の内容をクリア
    this.container.innerHTML = '';

    // ビューポートを作成
    this.viewport = document.createElement('div');
    this.viewport.style.cssText = `
      height: 100%;
      overflow-y: auto;
      overflow-x: hidden;
    `;

    // コンテンツコンテナを作成
    this.content = document.createElement('div');
    this.content.style.cssText = `
      position: relative;
      padding-bottom: 20px;
    `;

    this.viewport.appendChild(this.content);
    this.container.appendChild(this.viewport);

    // スクロールイベントを追加
    this.viewport.addEventListener('scroll', () => {
      this.handleScroll();
    });

    // リサイズオブザーバーを追加
    if (window.ResizeObserver) {
      this.resizeObserver = new ResizeObserver(() => {
        this.updateContainerHeight();
        this.render();
      });
      this.resizeObserver.observe(this.viewport);
    }

    this.updateContainerHeight();
  }

  updateContainerHeight() {
    this.containerHeight = this.viewport.clientHeight;
  }

  setData(data) {
    this.data = data;
    this.scrollTop = 0;
    this.viewport.scrollTop = 0;
    this.render();
  }

  handleScroll() {
    this.scrollTop = this.viewport.scrollTop;
    this.render();
  }

  getVisibleRange() {
    const start = Math.floor(this.scrollTop / this.itemHeight);
    const visibleCount = Math.ceil(this.containerHeight / this.itemHeight);

    this.visibleStart = Math.max(0, start - this.buffer);
    this.visibleEnd = Math.min(this.data.length, start + visibleCount + this.buffer);

    return {
      start: this.visibleStart,
      end: this.visibleEnd,
      offset: this.visibleStart * this.itemHeight
    };
  }

  render() {
    if (!this.data.length) {
      this.content.innerHTML = '';
      return;
    }

    const { start, end, offset } = this.getVisibleRange();
    const totalHeight = this.data.length * this.itemHeight;

    // コンテンツの高さを設定（スクロールバーの長さ用）
    this.content.style.height = `${totalHeight}px`;

    // 表示するアイテムのHTMLを生成
    const visibleItems = this.data.slice(start, end);
    const itemsHTML = visibleItems.map((item, index) => {
      return this.renderItem(item, start + index);
    }).join('');

    // 位置調整用のコンテナ
    this.content.innerHTML = `
      <div style="transform: translateY(${offset}px);">
        ${itemsHTML}
      </div>
    `;
  }

  scrollToTop() {
    this.viewport.scrollTop = 0;
  }

  destroy() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
  }
}

// ========== 統計・表示更新 ==========================================================

/**
 * 一意アカウント数を計算
 */
function calculateUniqueAccounts(keywords) {
  const uniqueUsers = new Set();

  keywords.forEach(keyword => {
    if (keyword.tweets && keyword.tweets.length > 0) {
      keyword.tweets.forEach(tweet => {
        // ユーザーIDまたはscreen_nameで一意性を判定
        const userId = tweet.user?.id || tweet.user?.screen_name;
        if (userId) {
          uniqueUsers.add(userId);
        }
      });
    }
  });

  return uniqueUsers.size;
}

/**
 * キーワード別の一意アカウント数を計算
 */
function calculateKeywordUniqueAccounts(keyword) {
  const uniqueUsers = new Set();

  if (keyword.tweets && keyword.tweets.length > 0) {
    keyword.tweets.forEach(tweet => {
      const userId = tweet.user?.id || tweet.user?.screen_name;
      if (userId) {
        uniqueUsers.add(userId);
      }
    });
  }

  return uniqueUsers.size;
}

/**
 * エンゲージメント指標を計算
 */
function calculateEngagementMetrics(keywords) {
  let totalLikes = 0;
  let totalRetweets = 0;
  let maxViews = 0;
  let viewSampleLogged = false;

  keywords.forEach(keyword => {
    if (keyword.tweets && keyword.tweets.length > 0) {
      keyword.tweets.forEach(tweet => {
        // いいね数
        const likeCount = tweet.public_metrics?.like_count || 0;
        totalLikes += likeCount;

        // リツイート数
        const retweetCount = tweet.public_metrics?.retweet_count || 0;
        totalRetweets += retweetCount;

        // 閲覧数（複数のフィールドを確認）
        const viewCount = parseInt(tweet.public_metrics?.impression_count) ||
          parseInt(tweet.public_metrics?.view_count) ||
          parseInt(tweet.public_metrics?.impressions) ||
          parseInt(tweet.impression_count) ||
          parseInt(tweet.view_count) || 0;
        maxViews = Math.max(maxViews, viewCount);

      });
    }
  });


  return {
    totalLikes,
    totalRetweets,
    maxViews
  };
}

/**
 * キーワード別エンゲージメント指標を計算
 */
function calculateKeywordEngagementMetrics(keyword) {
  let totalLikes = 0;
  let totalRetweets = 0;
  let totalViews = 0;

  if (keyword.tweets && keyword.tweets.length > 0) {
    keyword.tweets.forEach(tweet => {
      totalLikes += tweet.public_metrics?.like_count || 0;
      totalRetweets += tweet.public_metrics?.retweet_count || 0;
      // 閲覧数（複数のフィールドを確認）
      totalViews += parseInt(tweet.public_metrics?.impression_count) ||
        parseInt(tweet.public_metrics?.view_count) ||
        parseInt(tweet.public_metrics?.impressions) ||
        parseInt(tweet.impression_count) ||
        parseInt(tweet.view_count) || 0;
    });
  }

  return {
    totalLikes,
    totalRetweets,
    totalViews,
    averageLikes: keyword.tweets && keyword.tweets.length > 0 ? Math.round(totalLikes / keyword.tweets.length) : 0,
    averageRetweets: keyword.tweets && keyword.tweets.length > 0 ? Math.round(totalRetweets / keyword.tweets.length) : 0,
    averageViews: keyword.tweets && keyword.tweets.length > 0 ? Math.round(totalViews / keyword.tweets.length) : 0
  };
}

/**
 * アカウント別投稿数を集計（非同期版）
 */
async function analyzeAccountStats(keywords, selectedKeywordId = 'all', onProgress = null) {
  const accountStats = new Map();

  // 対象キーワードを決定
  const targetKeywords = selectedKeywordId === 'all'
    ? keywords
    : keywords.filter(k => k.id === selectedKeywordId);

  // すべてのツイートを収集
  const allTweets = [];
  targetKeywords.forEach(keyword => {
    if (keyword.tweets && keyword.tweets.length > 0) {
      keyword.tweets.forEach(tweet => {
        allTweets.push({ tweet, keywordId: keyword.id });
      });
    }
  });

  // ツイートを非同期で処理
  await AsyncProcessor.processInChunks(
    allTweets,
    ({ tweet, keywordId }) => {
      const user = tweet.user;
      if (!user || (!user.id && !user.screen_name)) return;

      const userId = user.id || user.screen_name;
      const userKey = `${userId}`;

      if (!accountStats.has(userKey)) {
        accountStats.set(userKey, {
          user: {
            id: user.id,
            screen_name: user.screen_name,
            name: user.name,
            profile_image_url: user.profile_image_url
          },
          tweets: [],
          tweetCount: 0,
          keywords: new Set(),
          latestTweetDate: null
        });
      }

      const accountData = accountStats.get(userKey);
      accountData.tweets.push(tweet);
      accountData.tweetCount++;
      accountData.keywords.add(keywordId);

      // 最新ツイート日時を更新
      const tweetDate = new Date(tweet.created_at || tweet.timestamp);
      if (!accountData.latestTweetDate || tweetDate > accountData.latestTweetDate) {
        accountData.latestTweetDate = tweetDate;
      }
    },
    500, // チャンクサイズ
    onProgress
  );

  // Map を配列に変換
  return Array.from(accountStats.values());
}

/**
 * アカウント分析パネルを更新（非同期版）
 */
function updateAccountsPanel() {
  const keywords = Object.values(keywordManager.keywords);
  const selectedKeywordId = document.getElementById('accountFilterKeyword')?.value || 'all';
  const sortType = document.getElementById('accountSortType')?.value || 'tweets';

  // アカウント統計分析
  const accountStats = analyzeAccountStatsSync(keywords, selectedKeywordId);

  // ソート処理
  accountStats.sort((a, b) => {
    switch (sortType) {
      case 'tweets':
        return b.tweetCount - a.tweetCount;
      case 'alphabetical':
        return (a.user.screen_name || '').localeCompare(b.user.screen_name || '');
      case 'recent':
        return (b.latestTweetDate || 0) - (a.latestTweetDate || 0);
      default:
        return b.tweetCount - a.tweetCount;
    }
  });


  // キーワードフィルターを更新
  updateAccountKeywordFilter(keywords);

  // アカウント一覧を表示
  displayAccountsListSimple(accountStats);
}

/**
 * アカウント分析パネルの内部処理
 */
async function updateAccountsPanelInner(keywords, selectedKeywordId, sortType, useAsync = false) {
  // アカウント統計分析
  const accountStats = analyzeAccountStatsSync(keywords, selectedKeywordId);

  // ソート処理
  accountStats.sort((a, b) => {
    switch (sortType) {
      case 'tweets':
        return b.tweetCount - a.tweetCount;
      case 'alphabetical':
        return (a.user.screen_name || '').localeCompare(b.user.screen_name || '');
      case 'recent':
        return (b.latestTweetDate || 0) - (a.latestTweetDate || 0);
      default:
        return b.tweetCount - a.tweetCount;
    }
  });


  // キーワードフィルターを更新
  updateAccountKeywordFilter(keywords);

  // アカウント一覧にローディングを表示してから非同期で表示
  showAccountsListLoading();
  setTimeout(async () => {
    await displayAccountsListSync(accountStats);
  }, 10);
}

/**
 * 軽量版アカウント統計分析（同期処理）
 */
function analyzeAccountStatsSync(keywords, selectedKeywordId = 'all') {
  const accountStats = new Map();

  // 対象キーワードを決定
  const targetKeywords = selectedKeywordId === 'all'
    ? keywords
    : keywords.filter(k => k.id === selectedKeywordId);

  targetKeywords.forEach(keyword => {
    if (keyword.tweets && keyword.tweets.length > 0) {
      keyword.tweets.forEach(tweet => {
        const user = tweet.user;
        if (!user || (!user.id && !user.screen_name)) return;

        const userId = user.id || user.screen_name;
        const userKey = `${userId}`;

        if (!accountStats.has(userKey)) {
          accountStats.set(userKey, {
            user: {
              id: user.id,
              screen_name: user.screen_name,
              name: user.name,
              profile_image_url: user.profile_image_url
            },
            tweets: [],
            tweetCount: 0,
            keywords: new Set(),
            latestTweetDate: null
          });
        }

        const accountData = accountStats.get(userKey);
        accountData.tweets.push(tweet);
        accountData.tweetCount++;
        accountData.keywords.add(keyword.id);

        // 最新ツイート日時を更新
        const tweetDate = new Date(tweet.created_at || tweet.timestamp);
        if (!accountData.latestTweetDate || tweetDate > accountData.latestTweetDate) {
          accountData.latestTweetDate = tweetDate;
        }
      });
    }
  });

  return Array.from(accountStats.values());
}


/**
 * キーワードフィルターを更新
 */
function updateAccountKeywordFilter(keywords) {
  const filterSelect = document.getElementById('accountFilterKeyword');
  if (!filterSelect) return;

  // キーワードが渡されない場合は現在のキーワードを取得
  if (!keywords) {
    keywords = Object.values(keywordManager.keywords);
  }

  const currentValue = filterSelect.value;

  // オプションをクリア（「全キーワード」以外）
  while (filterSelect.children.length > 1) {
    filterSelect.removeChild(filterSelect.lastChild);
  }

  // キーワードオプションを追加
  keywords.forEach((keyword, index) => {
    const option = document.createElement('option');
    option.value = keyword.id;
    option.textContent = `キーワード${index + 1}: ${keyword.text || 'unnamed'}`;
    filterSelect.appendChild(option);
  });

  // 前の選択値を復元
  filterSelect.value = currentValue;
}

/**
 * アカウント一覧を表示（非同期版）
 */
async function displayAccountsList(accountStats) {
  const accountsList = document.getElementById('accountsList');
  if (!accountsList) return;

  if (accountStats.length === 0) {
    accountsList.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">👥</div>
        <div class="empty-state-title">アカウントデータがありません</div>
        <div class="empty-state-desc">ツイートを収集すると、<br>アカウント別の分析が表示されます。</div>
      </div>
    `;
    return;
  }

  // 大量のアカウントの場合は仮想スクロール（または分割表示）を使用
  if (accountStats.length > 100) {
    await displayAccountsListChunked(accountStats);
  } else {
    await displayAccountsListSync(accountStats);
  }
}

/**
 * アカウント一覧を分割して表示
 */
async function displayAccountsListChunked(accountStats) {
  const accountsList = document.getElementById('accountsList');
  if (!accountsList) return;

  // 一旦クリア
  accountsList.innerHTML = '';

  // アカウントHTMLを非同期で生成
  const htmlChunks = await AsyncProcessor.processInChunks(
    accountStats,
    (accountData, index) => createAccountHTML(accountData, index),
    50 // チャンクサイズ
  );

  // HTMLを組み合わせて表示
  accountsList.innerHTML = htmlChunks.join('');

  // クリックイベントを追加
  setupAccountItemListeners();
}

/**
 * アカウント一覧を同期表示（軽量版）
 */
async function displayAccountsListSync(accountStats) {
  const accountsList = document.getElementById('accountsList');
  if (!accountsList) return;

  // 空の状態チェック
  if (accountStats.length === 0) {
    accountsList.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">👥</div>
        <div class="empty-state-title">アカウントデータがありません</div>
        <div class="empty-state-desc">ツイートを収集すると、<br>アカウント別の分析が表示されます。</div>
      </div>
    `;
    return;
  }

  // 少数の場合は一括表示
  if (accountStats.length <= 20) {
    accountsList.innerHTML = accountStats.map((accountData, index) =>
      createAccountHTML(accountData, index)
    ).join('');
    setupAccountItemListeners();
    return;
  }

  // 多数の場合はチャンク表示
  accountsList.innerHTML = '';
  const chunkSize = 10;

  for (let i = 0; i < accountStats.length; i += chunkSize) {
    const chunk = accountStats.slice(i, i + chunkSize);
    const htmlChunk = chunk.map((accountData, index) =>
      createAccountHTML(accountData, i + index)
    ).join('');

    accountsList.innerHTML += htmlChunk;

    // 少し待機してUIを更新
    if (i + chunkSize < accountStats.length) {
      await new Promise(resolve => setTimeout(resolve, 5));
    }
  }

  // クリックイベントを追加
  setupAccountItemListeners();
}

/**
 * アカウント一覧を単純表示（ツイートタブと同じアプローチ）
 */
function displayAccountsListSimple(accountStats) {
  const accountsList = document.getElementById('accountsList');
  if (!accountsList) return;

  if (accountStats.length === 0) {
    accountsList.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">👥</div>
        <div class="empty-state-title">アカウントデータがありません</div>
        <div class="empty-state-desc">ツイートを収集すると、<br>アカウント別の分析が表示されます。</div>
      </div>
    `;
    return;
  }

  accountsList.innerHTML = accountStats.map((accountData, index) =>
    createAccountHTML(accountData, index)
  ).join('');

  // クリックイベントを追加
  setupAccountItemListeners();
}

/**
 * アカウントHTMLを生成
 */
function createAccountHTML(accountData, index) {
  const user = accountData.user;
  const displayName = user.name || user.screen_name || 'Unknown User';
  const handle = user.screen_name || 'unknown';
  const avatarUrl = user.profile_image_url;
  const keywordCount = accountData.keywords.size;

  // アバター表示
  const avatarContent = avatarUrl
    ? `<img src="${avatarUrl}" alt="${displayName}" onerror="this.style.display='none'">`
    : displayName.charAt(0).toUpperCase();

  return `
    <div class="account-item" data-account-id="${user.id || handle}">
      <div class="account-header">
        <div class="account-info">
          <div class="account-avatar">${avatarContent}</div>
          <div class="account-details">
            <h4>${displayName}</h4>
            <p class="handle">@${handle}</p>
          </div>
        </div>
        <div class="account-stats">
          <div class="stat-badge primary">${accountData.tweetCount}件</div>
          <div class="stat-badge">${keywordCount}キーワード</div>
          <div class="stat-badge">👁️ 詳細</div>
        </div>
      </div>
      <div class="account-tweets" id="tweets-${user.id || handle}">
        <div style="font-size: 14px; font-weight: 600; margin-bottom: 12px; color: #ffffff;">
          投稿内容 (${accountData.tweetCount}件)
        </div>
        ${accountData.tweets.slice(0, 5).map(tweet => `
          <div class="account-tweet">
            <div>${tweet.text || 'テキストが取得できませんでした'}</div>
            <div class="account-tweet-meta">
              <span>${new Date(tweet.created_at || tweet.timestamp).toLocaleString('ja-JP')}</span>
              <span>❤️ ${tweet.public_metrics?.like_count || 0} 🔄 ${tweet.public_metrics?.retweet_count || 0}</span>
            </div>
          </div>
        `).join('')}
        ${accountData.tweets.length > 5 ? `
          <div style="text-align: center; padding: 8px; color: #8b98a5; font-size: 12px;">
            他 ${accountData.tweets.length - 5} 件のツイート
          </div>
        ` : ''}
      </div>
    </div>
  `;
}

/**
 * アカウントアイテムのクリックイベントを設定
 */
function setupAccountItemListeners() {
  document.querySelectorAll('.account-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const accountId = item.dataset.accountId;
      const tweetsDiv = item.querySelector('.account-tweets');

      // 展開/折りたたみ
      if (tweetsDiv.classList.contains('visible')) {
        tweetsDiv.classList.remove('visible');
        item.classList.remove('expanded');
      } else {
        // 他のアカウントを折りたたみ
        document.querySelectorAll('.account-item').forEach(otherItem => {
          otherItem.classList.remove('expanded');
          otherItem.querySelector('.account-tweets').classList.remove('visible');
        });

        // 現在のアカウントを展開
        tweetsDiv.classList.add('visible');
        item.classList.add('expanded');
      }
    });
  });
}

/**
 * 詳細版統計更新（全キーワード、全統計項目を計算）
 */
function updateStats() {
  const keywords = Object.values(keywordManager.keywords);

  // キーワードごとの統計をカード内に表示
  keywords.forEach((keyword) => {
    const keywordStatsContainer = document.getElementById(`keywordStats-${keyword.id}`);
    if (!keywordStatsContainer) return;

    const tweetCount = keyword.tweets ? keyword.tweets.length : 0;

    // 一意アカウント数を計算
    const uniqueAccounts = keyword.tweets ?
      new Set(keyword.tweets.map(t => t.user?.id || t.user?.screen_name).filter(Boolean)).size : 0;

    // エンゲージメント指標を計算
    const totalLikes = keyword.tweets ?
      keyword.tweets.reduce((sum, t) => sum + (t.public_metrics?.like_count || t.favorite_count || t.like_count || 0), 0) : 0;
    const totalRetweets = keyword.tweets ?
      keyword.tweets.reduce((sum, t) => sum + (t.public_metrics?.retweet_count || t.retweet_count || 0), 0) : 0;

    // 統計値を更新
    const tweetCountElem = keywordStatsContainer.querySelector('.tweet-count');
    const accountCountElem = keywordStatsContainer.querySelector('.account-count');
    const likeCountElem = keywordStatsContainer.querySelector('.like-count');
    const retweetCountElem = keywordStatsContainer.querySelector('.retweet-count');

    if (tweetCountElem) tweetCountElem.textContent = tweetCount.toLocaleString();
    if (accountCountElem) accountCountElem.textContent = uniqueAccounts.toLocaleString();
    if (likeCountElem) likeCountElem.textContent = totalLikes.toLocaleString();
    if (retweetCountElem) retweetCountElem.textContent = totalRetweets.toLocaleString();

  });

  // アカウント分析パネルも更新
  if (document.getElementById('accountsPanel')?.classList.contains('active')) {
    updateAccountsPanel();
  }
}

function updateKeywordStatus(keywordId, statusClass, statusText) {
  const statusIndicator = document.getElementById(`status-${keywordId}`);
  const statusTextElem = document.getElementById(`status-text-${keywordId}`);

  if (statusIndicator) {
    statusIndicator.className = `status-indicator ${statusClass}`;
  }

  if (statusTextElem) {
    statusTextElem.textContent = statusText;
  }
}

function updateRateLimitDisplay() {
  const { used, limit, remaining } = rateLimitManager;
  const percentage = (used / limit) * 100;

  document.getElementById('rateUsed').textContent = used;
  // document.getElementById('rateRemaining').textContent = remaining;

  const fillElem = document.getElementById('rateProgressFill');
  fillElem.style.width = `${percentage}%`;

  // 色を使用率に応じて変更
  fillElem.className = 'rate-progress-fill';
  if (percentage > 80) {
    fillElem.classList.add('danger');
  } else if (percentage > 60) {
    fillElem.classList.add('warning');
  }

  // リセット時刻を更新
  if (rateLimitManager.resetTime) {
    document.getElementById('rateReset').textContent =
      new Date(rateLimitManager.resetTime).toLocaleTimeString('ja-JP');
  }
}

function updateCurrentTime() {
  // レート制限のリセット時刻をチェック
  if (rateLimitManager.resetTime && Date.now() > rateLimitManager.resetTime) {
    // 15分経過したらリセット
    rateLimitManager.used = 0;
    rateLimitManager.remaining = rateLimitManager.limit;
    rateLimitManager.resetTime = Date.now() + 15 * 60 * 1000; // 数値として設定
    updateRateLimitDisplay();
    addLogEntry('API制限がリセットされました', 'info');
  }
}

// ========== ツイート表示 ==========================================================
// tweets-tab.jsで管理されているため、ここでは削除


function filterTweets(filter) {
  // フィルターボタンの状態を更新
  document.querySelectorAll('.keyword-filter-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  document.querySelector(`[data-filter="${filter}"]`).classList.add('active');

  // ツイートを表示/非表示
  const tweets = document.querySelectorAll('.tweet-item');
  tweets.forEach(tweet => {
    if (filter === 'all' || tweet.dataset.keyword === filter.replace('keyword-', '')) {
      tweet.style.display = 'block';
    } else {
      tweet.style.display = 'none';
    }
  });

  addLogEntry(`ツイートフィルターを${filter === 'all' ? 'すべて' : filter}に設定`, 'info');
}

// ========== チャート機能 ==========================================================

// 期間モード変更ハンドラー
function handlePeriodModeChange() {
  const periodMode = document.getElementById('periodMode').value;
  const customInputs = document.getElementById('customPeriodInputs');
  
  if (periodMode === 'custom') {
    customInputs.style.display = 'flex';
  } else {
    customInputs.style.display = 'none';
  }
  
  updateChart();
}

// チャートタイプ変更ハンドラー（時間別の自動制限付き）
function handleChartTypeChange() {
  const chartType = document.getElementById('chartType').value;
  const periodMode = document.getElementById('periodMode').value;
  
  // 時間別・日別が選択された場合の処理（処理前に事前制限）
  if (chartType === 'hourly' || chartType === 'daily') {
    if (periodMode === 'all') {
      // 全期間モードの場合は必ず期間指定に強制変更
      const activeKeywords = Object.values(keywordManager.keywords).filter(k => k.tweets && k.tweets.length > 0);
      if (activeKeywords.length > 0) {
        const allTweets = activeKeywords.flatMap(k => k.tweets || []);
        const dates = allTweets.map(t => new Date(t.created_at || t.timestamp)).filter(d => !isNaN(d.getTime()));
        if (dates.length > 0) {
          const maxDate = Math.max(...dates);
          
          // 強制的に期間指定モードに変更（データ量に関係なく）
          document.getElementById('periodMode').value = 'custom';
          document.getElementById('customPeriodInputs').style.display = 'flex';
          
          // チャートタイプに応じた期間制限を設定
          let limitDays, limitMessage;
          if (chartType === 'hourly') {
            limitDays = 14; // 2週間
            limitMessage = '時間別表示は処理負荷が高いため、期間を最新2週間に自動設定しました';
          } else if (chartType === 'daily') {
            limitDays = 90; // 3ヶ月
            limitMessage = '日別表示は処理負荷が高いため、期間を最新3ヶ月に自動設定しました';
          }
          
          const endDate = new Date(maxDate);
          const startDate = new Date(maxDate - limitDays * 24 * 60 * 60 * 1000);
          const startDateStr = startDate.toISOString().split('T')[0];
          const endDateStr = endDate.toISOString().split('T')[0];
          
          document.getElementById('endDate').value = endDateStr;
          document.getElementById('startDate').value = startDateStr;
          
          addLogEntry(limitMessage, 'warning');
          
          // DOM読み取りではなく直接値を渡してupdateChart実行
          updateChartWithPeriod('custom', startDateStr, endDateStr);
          return; // 即座のupdateChart実行を防ぐ
        }
      }
    } else if (periodMode === 'custom') {
      // 期間指定モードで既に長期間が設定されている場合もチェック
      const startDateStr = document.getElementById('startDate')?.value;
      const endDateStr = document.getElementById('endDate')?.value;
      
      if (startDateStr && endDateStr) {
        const startDate = new Date(startDateStr);
        const endDate = new Date(endDateStr);
        const daysDiff = (endDate - startDate) / (1000 * 60 * 60 * 24);
        
        let maxDays, adjustMessage;
        if (chartType === 'hourly') {
          maxDays = 14;
          adjustMessage = '時間別表示は処理負荷が高いため';
        } else if (chartType === 'daily') {
          maxDays = 90;
          adjustMessage = '日別表示は処理負荷が高いため';
        }
        
        if (daysDiff > maxDays) {
          // 開始日から制限日数後に終了日を調整
          const adjustedEnd = new Date(startDate.getTime() + maxDays * 24 * 60 * 60 * 1000);
          const adjustedEndStr = adjustedEnd.toISOString().split('T')[0];
          document.getElementById('endDate').value = adjustedEndStr;
          
          const periodText = chartType === 'hourly' ? '2週間' : '3ヶ月';
          addLogEntry(`${adjustMessage}、期間を ${startDateStr} 〜 ${adjustedEndStr} (${periodText}) に自動調整しました`, 'warning');
          
          // DOM読み取りではなく直接値を渡してupdateChart実行
          updateChartWithPeriod('custom', startDateStr, adjustedEndStr);
          return;
        }
      }
    }
  }
  
  updateChart();
}

// 期間パラメータを直接指定してチャート更新（DOM読み取り回避）
function updateChartWithPeriod(periodMode, startDate, endDate) {
  updateChartInternal(periodMode, startDate, endDate);
}

function updateChart() {
  updateChartInternal();
}

function updateChartInternal(forcePeriodMode = null, forceStartDate = null, forceEndDate = null) {

  const chartPlaceholder = document.getElementById('chartPlaceholder');
  const chartCanvas = document.getElementById('trendChart');
  const chartLegend = document.getElementById('chartLegend');

  const activeKeywords = Object.values(keywordManager.keywords).filter(k => k.tweets && k.tweets.length > 0);


  // 各キーワードのツイート数をログ出力
  Object.values(keywordManager.keywords).forEach(keyword => {
  });

  if (activeKeywords.length === 0) {
    addLogEntry('ツイートを持つキーワードがないため、プレースホルダーを表示', 'warning');
    chartPlaceholder.style.display = 'block';
    chartCanvas.style.display = 'none';
    chartLegend.style.display = 'none';
    
    // プレースホルダーを通常のメッセージに戻す
    chartPlaceholder.innerHTML = `
      <div style="text-align: center; padding: 40px; color: #666;">
        <h3>📊 トピック分析</h3>
        <p>キーワードを追加してツイートを取得すると、ここにトレンドグラフが表示されます。</p>
      </div>
    `;
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
      addLogEntry('1日分のデータのため、時間別表示に自動変更', 'info');
      chartType = 'hourly';
      document.getElementById('chartType').value = 'hourly';
    }
  }

  const chartData = prepareChartData(activeKeywords, chartType, forcePeriodMode, forceStartDate, forceEndDate);

  // 処理が中止された場合（空のデータが返された場合）の処理
  if (!chartData || Object.keys(chartData).length === 0) {
    chartPlaceholder.style.display = 'block';
    chartCanvas.style.display = 'none';
    chartLegend.style.display = 'none';
    
    // 現在のチャートタイプを再取得
    const currentChartType = document.getElementById('chartType').value;
    
    // プレースホルダーのメッセージを処理中止の内容に変更
    let modeText, periodText;
    if (currentChartType === 'hourly') {
      modeText = '時間別';
      periodText = '2週間以内';
    } else if (currentChartType === 'daily') {
      modeText = '日別';
      periodText = '3ヶ月以内';
    } else {
      // その他のモード（ありえないが安全のため）
      modeText = currentChartType;
      periodText = 'より短い';
    }
    
    const warningHTML = `
      <div style="text-align: center; padding: 40px; color: #ff6b6b;">
        <h3>⚠️ ${modeText}表示は制限されています</h3>
        <p>処理負荷軽減のため、${modeText}表示は${periodText}の期間でのみ利用可能です。</p>
        <p>期間を短くするか、週別・月別表示をご利用ください。</p>
      </div>
    `;
    
    chartPlaceholder.innerHTML = warningHTML;
    return;
  }

  // シンプルなCanvasグラフを描画
  addLogEntry(`グラフパネルアクティブ: ${document.getElementById('graphPanel').classList.contains('active')}`, 'info');

  drawSimpleChart(chartCanvas, chartData, activeKeywords, forcePeriodMode, forceStartDate, forceEndDate);

  addLogEntry('チャートを更新しました', 'info');
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

// ========== ログ機能 ==========================================================

function addLogEntry(message, type = 'info', keywordId = null) {
  const logsContent = document.getElementById('logsContent');
  const now = new Date();
  const timeStr = now.toLocaleTimeString('ja-JP');

  const logEntry = document.createElement('div');
  logEntry.className = 'log-entry';

  let keywordTag = '';
  if (keywordId && keywordManager.keywords[keywordId]) {
    const keywordNumber = getKeywordNumber(keywordId);
    keywordTag = `<span class="log-keyword log-keyword-${keywordNumber}">K${keywordNumber}</span>`;
  }

  logEntry.innerHTML = `
    <span class="log-time">${timeStr}</span>
    ${keywordTag}
    <span class="log-message log-${type}">${message}</span>
  `;

  logsContent.appendChild(logEntry);
  logsContent.scrollTop = logsContent.scrollHeight;

  // ログが多くなりすぎないよう制限
  const maxLogs = 100;
  while (logsContent.children.length > maxLogs) {
    logsContent.removeChild(logsContent.firstChild);
  }
}

function clearLogs() {
  const logsContent = document.getElementById('logsContent');
  logsContent.innerHTML = `
    <div class="log-entry">
      <span class="log-time">${new Date().toLocaleTimeString('ja-JP')}</span>
      <span class="log-message log-info">ログをクリアしました</span>
    </div>
  `;
}

// ========== エクスポート機能 ==========================================================

function exportAllData() {
  const allData = {
    keywords: keywordManager.keywords,
    exportTime: new Date().toISOString(),
    totalTweets: Object.values(keywordManager.keywords).reduce((sum, k) => sum + k.stats.totalTweets, 0)
  };

  const blob = new Blob([JSON.stringify(allData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  a.href = url;
  a.download = `x-tweet-data-${timestamp}.json`;
  a.click();

  URL.revokeObjectURL(url);

  addLogEntry('すべてのデータをエクスポートしました', 'success');
}

// ========== 初期化とレート制限設定 ==========================================================

// レート制限を15分ごとにリセット
rateLimitManager.resetTime = new Date(Date.now() + 15 * 60 * 1000);

if (typeof chrome === 'undefined' || !chrome.devtools) {
  // 開発環境用のモックデータ
  setTimeout(() => {
    addKeyword();
    const firstKeywordId = Object.keys(keywordManager.keywords)[0];
    if (firstKeywordId) {
      updateKeywordText(firstKeywordId, 'テストキーワード');
      updateKeywordStartDate(firstKeywordId, '2024-01-01T09:00');
      updateKeywordEndDate(firstKeywordId, '2024-12-31T18:00');
    }
  }, 1000);
}

// ========== データエクスポート・インポート機能 ==========================================================

/**
 * 個別キーワードのデータをエクスポート
 */
function exportKeywordData(keywordId) {
  const keyword = keywordManager.keywords[keywordId];
  
  try {
    // ツイートデータからkeywordIndexとkeywordColorを削除
    const cleanTweets = (keyword?.tweets || []).map(tweet => {
      const cleanTweet = { ...tweet };
      delete cleanTweet.keywordIndex;
      delete cleanTweet.keywordColor;
      return cleanTweet;
    });

    cleanTweets.sort((a, b) => {
      const dateA = new Date(a.created_at || a.timestamp);
      const dateB = new Date(b.created_at || b.timestamp);
      return dateA - dateB; // 古い順
    });

    const exportData = {
      exportDate: new Date().toISOString(),
      keyword: {
        text: keyword?.text || '-',
        tweets: cleanTweets,
        stats: {
          totalTweets: cleanTweets.length,
          lastUpdate: keyword?.stats?.lastUpdate || new Date().toISOString()
        }
      }
    };

    // ファイル名を生成
    let filename = 'x-tweet-data';

    // 検索対象期間を追加
    if (keyword?.startDate && keyword?.endDate) {
      if (keyword.startDate === keyword.endDate) {
        filename += `-${keyword.startDate}`;
      } else {
        filename += `-${keyword.startDate}_${keyword.endDate}`;
      }
    }

    // キーワードテキストを追加
    if (keyword?.text) {
      const cleanText = keyword.text.replace(/[<>:"/\\|?*]/g, '').substring(0, 20);
      if (cleanText) {
        filename += ` (${cleanText})`;
      }
    } else {
      filename += '-empty';
    }

    filename += '.json';

    // ダウンロード実行
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);

    const tweetCount = cleanTweets.length;
    const keywordNum = keyword ? getKeywordNumber(keywordId) : '-';
    addLogEntry(`キーワード ${keywordNum}: ${tweetCount}件のツイートをエクスポートしました - ${filename}`, 'success', keywordId);

  } catch (error) {
    addLogEntry(`エクスポートエラー - ${error.message}`, 'error', keywordId);
  }
}

/**
 * 個別キーワードへのツイートデータインポート
 */
function handleKeywordImport(keywordId, event) {
  const keyword = keywordManager.keywords[keywordId];
  if (!keyword) {
    addLogEntry('インポート対象のキーワードが見つかりません', 'error');
    return;
  }

  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const importData = JSON.parse(e.target.result);

      // データ形式の判定とバリデーション
      let tweetsToImport = [];

      if (importData.keyword && importData.keyword.tweets) {
        // 新しいシンプル形式または旧形式の個別キーワードエクスポート
        tweetsToImport = importData.keyword.tweets;
        addLogEntry(`キーワード ${getKeywordNumber(keywordId)}: キーワードエクスポートファイルを検出`, 'info', keywordId);
      } else if (importData.keywords) {
        // 全データエクスポート形式 - 最初のキーワードのツイートを使用
        const firstKeywordData = Object.values(importData.keywords)[0];
        if (firstKeywordData && firstKeywordData.tweets) {
          tweetsToImport = firstKeywordData.tweets;
          addLogEntry(`キーワード ${getKeywordNumber(keywordId)}: 全データエクスポートファイルから最初のキーワードのデータを使用`, 'info', keywordId);
        }
      } else {
        throw new Error('無効なデータ形式です。エクスポートされたJSONファイルを選択してください。');
      }

      if (!Array.isArray(tweetsToImport) || tweetsToImport.length === 0) {
        addLogEntry(`キーワード ${getKeywordNumber(keywordId)}: インポート可能なツイートデータが見つかりません`, 'warning', keywordId);
        return;
      }

      // 既存ツイートとの重複チェック
      const existingTweetIds = new Set(keyword.tweets.map(tweet => tweet.id));
      const newTweets = tweetsToImport.filter(tweet => !existingTweetIds.has(tweet.id));

      if (newTweets.length === 0) {
        addLogEntry(`キーワード ${getKeywordNumber(keywordId)}: すべてのツイートが既に存在しています（重複なし）`, 'info', keywordId);
        return;
      }

      // インポートしたツイートからkeywordIndexとkeywordColorを削除
      const cleanNewTweets = newTweets.map(tweet => {
        const cleanTweet = { ...tweet };
        delete cleanTweet.keywordIndex;
        delete cleanTweet.keywordColor;
        return cleanTweet;
      });

      // ツイートを追加（重複を防ぐ）
      keyword.tweets = mergeTweetsWithoutDuplicates(keyword.tweets, cleanNewTweets);
      clearTweetsCache(); // キャッシュをクリア

      // 統計を更新
      keyword.stats.totalTweets = keyword.tweets.length;
      keyword.stats.lastUpdate = new Date();

      // 収集状況を更新
      if (keyword.collection) {
        keyword.collection.collectedCount = keyword.tweets.length;
      }

      // UI更新
      updateStats();
      updateTweetsList();

      // グラフ更新
      updateChart();

      addLogEntry(`キーワード ${getKeywordNumber(keywordId)}: ${newTweets.length}件の新しいツイートをインポートしました（総数: ${keyword.tweets.length}件）`, 'success', keywordId);

    } catch (error) {
      addLogEntry(`キーワード ${getKeywordNumber(keywordId)}: インポートエラー - ${error.message}`, 'error', keywordId);
    }

    // ファイル入力をクリア
    event.target.value = '';
  };

  reader.readAsText(file);
}

/**
 * インポートファイル選択をトリガー
 */
function importData() {
  // インポートモーダルを表示
  document.getElementById('importModal').style.display = 'flex';
}

/**
 * インポートモーダルのセットアップ
 */
function setupImportModal() {
  const importModal = document.getElementById('importModal');
  const importModalClose = document.getElementById('importModalClose');
  const importFileButton = document.getElementById('importFileButton');
  const importDropZone = document.getElementById('importDropZone');

  // モーダルを閉じる
  const closeModal = () => {
    importModal.style.display = 'none';
  };

  // 閉じるボタン
  importModalClose.addEventListener('click', closeModal);

  // モーダル外クリックで閉じる
  importModal.addEventListener('click', (e) => {
    if (e.target === importModal) {
      closeModal();
    }
  });

  // ESCキーで閉じる
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && importModal.style.display === 'flex') {
      closeModal();
    }
  });

  // ファイル選択ボタン
  importFileButton.addEventListener('click', () => {
    addLogEntry(
      '複数ファイルを選択してください（Ctrl+クリック または Shift+クリック）',
      'info'
    );

    const fileInput = document.getElementById('importFileInput');

    // ❶ まず value を空にしておくと、同じファイルを連続選択しても change が発火する
    fileInput.value = '';

    // ❷ **1 回限り** の change ハンドラを設定
    fileInput.addEventListener(
      'change',
      () => {
        closeModal();
      },
      { once: true }
    );

    fileInput.click();

  });

  // ドラッグ&ドロップエリア
  importDropZone.addEventListener('click', () => {
    addLogEntry('ファイルを画面にドラッグ&ドロップしてください', 'info');
  });

  // ドラッグ&ドロップイベント
  importDropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    importDropZone.classList.add('drag-over');
  });

  importDropZone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    importDropZone.classList.remove('drag-over');
  });

  importDropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    importDropZone.classList.remove('drag-over');
    closeModal();

    // 対象キーワードIDを取得
    const targetKeywordId = window.currentImportTargetKeywordId;
    if (!targetKeywordId) {
      addLogEntry('インポート対象のキーワードが特定できませんでした', 'error');
      return;
    }

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      const jsonFiles = files.filter(file => file.name.endsWith('.json'));
      if (jsonFiles.length > 0) {
        addLogEntry(`${jsonFiles.length}個のJSONファイルをドロップで受け取りました`, 'info');
        handleMultipleFileImportToKeyword(jsonFiles, targetKeywordId);
      } else {
        addLogEntry('JSONファイルが見つかりません', 'error');
      }
    }
  });
}

/**
 * 指定されたキーワードに複数ファイルをインポート（ドラッグ&ドロップ用）
 */
async function handleMultipleFileImportToKeyword(files, targetKeywordId) {
  if (files.length === 0) return;

  const targetKeyword = keywordManager.keywords[targetKeywordId];
  if (!targetKeyword) {
    addLogEntry('対象キーワードが見つかりませんでした', 'error');
    return;
  }

  // 進行状況表示
  const totalFiles = files.length;
  let processedFiles = 0;
  let successCount = 0;
  let errorCount = 0;

  addLogEntry(`${totalFiles}個のファイルを「${targetKeyword.text || 'unnamed'}」にドロップインポートします`, 'info');

  // ファイルを一つずつ処理
  for (const file of files) {
    processedFiles++;
    addLogEntry(`ファイル ${processedFiles}/${totalFiles}: ${file.name} を処理中...`, 'info');

    try {
      await importSingleFileToKeyword(file, targetKeywordId);
      successCount++;
      addLogEntry(`✓ ${file.name} のインポートが完了しました`, 'success');
    } catch (error) {
      errorCount++;
      addLogEntry(`✗ ${file.name} のインポートに失敗しました: ${error.message}`, 'error');
    }
  }

  // 最終結果を表示
  addLogEntry(`ドロップインポート完了: 成功 ${successCount}件, 失敗 ${errorCount}件`, errorCount === 0 ? 'success' : 'error');

  // 統計とUIを更新
  updateStats();
  updateAccountKeywordFilter();
  updateTweetsFilter();

  // 対象キーワードIDをクリア
  window.currentImportTargetKeywordId = null;
}

/**
 * ファイルリストから複数ファイルインポート処理
 */
async function handleMultipleFileImportFromFiles(files) {
  if (files.length === 0) return;

  // 既存のキーワードがあるかチェック
  const existingKeywords = Object.values(keywordManager.keywords);
  let targetKeywordId = null;
  let importMode = 'separate'; // 'separate' または 'merge'

  if (existingKeywords.length > 0 && files.length > 1) {
    // ユーザーに選択肢を提供
    const mergeChoice = confirm(`複数ファイル（${files.length}個）のインポート方法を選択してください：\n\nOK: 既存のキーワードに統合\nキャンセル: 新しいキーワードとして個別に作成`);

    if (mergeChoice) {
      importMode = 'merge';
      // 既存キーワードから選択
      const keywordNames = existingKeywords.map((kw, index) => `${index + 1}: ${kw.text || 'unnamed'}`).join('\n');
      const selection = prompt(`統合先のキーワードを選択してください（番号を入力）：\n\n${keywordNames}`);

      if (selection && !isNaN(selection)) {
        const index = parseInt(selection) - 1;
        if (index >= 0 && index < existingKeywords.length) {
          targetKeywordId = existingKeywords[index].id;
          addLogEntry(`統合先キーワード: ${existingKeywords[index].text}`, 'info');
        } else {
          addLogEntry('無効な番号です。個別インポートに切り替えます', 'error');
          importMode = 'separate';
        }
      } else {
        addLogEntry('キャンセルされました。個別インポートに切り替えます', 'info');
        importMode = 'separate';
      }
    }
  }

  // 進行状況表示
  const totalFiles = files.length;
  let processedFiles = 0;
  let successCount = 0;
  let errorCount = 0;

  addLogEntry(`${totalFiles}個のファイルのドロップインポートを開始します (${importMode === 'merge' ? '統合モード' : '個別モード'})`, 'info');

  // ファイルを一つずつ処理
  for (const file of files) {
    processedFiles++;
    addLogEntry(`ファイル ${processedFiles}/${totalFiles}: ${file.name} を処理中...`, 'info');

    try {
      if (importMode === 'merge' && targetKeywordId) {
        await importSingleFileToKeyword(file, targetKeywordId);
      } else {
        await importSingleFile(file);
      }
      successCount++;
      addLogEntry(`✓ ${file.name} のインポートが完了しました`, 'success');
    } catch (error) {
      errorCount++;
      addLogEntry(`✗ ${file.name} のインポートに失敗しました: ${error.message}`, 'error');
    }
  }

  // 最終結果を表示
  addLogEntry(`ドロップインポート完了: 成功 ${successCount}件, 失敗 ${errorCount}件`, errorCount === 0 ? 'success' : 'error');

  // 統計とUIを更新
  updateStats();
  updateAccountKeywordFilter();
  updateTweetsFilter();
}

/**
 * 単一ファイルを既存キーワードにインポート処理
 */
function importSingleFileToKeyword(file, targetKeywordId) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = function (e) {
      try {
        const importData = JSON.parse(e.target.result);
        addLogEntry(`ファイル解析成功: ${file.name} (統合モード)`, 'info');

        // データ形式を検出して処理
        let keywordData = null;

        if (importData.keyword && typeof importData.keyword === 'object') {
          // version付き形式
          keywordData = importData.keyword;
        } else if (importData.keywords && typeof importData.keywords === 'object') {
          // 標準形式から最初のキーワードを取得
          const firstKey = Object.keys(importData.keywords)[0];
          keywordData = importData.keywords[firstKey];
        } else if (importData.text) {
          // 直接キーワード形式
          keywordData = importData;
        } else {
          throw new Error('キーワードデータが見つかりません');
        }

        // 既存キーワードを取得
        const targetKeyword = keywordManager.keywords[targetKeywordId];
        if (!targetKeyword) {
          throw new Error('対象キーワードが見つかりません');
        }

        // ツイートデータを統合
        if (keywordData.tweets && Array.isArray(keywordData.tweets)) {
          if (!targetKeyword.tweets) {
            targetKeyword.tweets = [];
          }

          // 重複チェック（ツイートIDで判定）
          const existingIds = new Set(targetKeyword.tweets.map(t => t.id));
          const newTweets = keywordData.tweets.filter(t => !existingIds.has(t.id));

          targetKeyword.tweets.push(...newTweets);
          addLogEntry(`${newTweets.length}件の新規ツイートを統合 (重複除外: ${keywordData.tweets.length - newTweets.length}件)`, 'info');
        }

        // トレンドデータを統合
        if (keywordData.trendData && Array.isArray(keywordData.trendData)) {
          if (!targetKeyword.trendData) {
            targetKeyword.trendData = [];
          }
          targetKeyword.trendData.push(...keywordData.trendData);
        }

        // 統計を更新
        targetKeyword.stats.totalTweets = targetKeyword.tweets ? targetKeyword.tweets.length : 0;
        targetKeyword.stats.lastUpdate = new Date();

        resolve(`${file.name}を${targetKeyword.text}に統合`);

      } catch (error) {
        reject(new Error(`ファイル解析エラー: ${error.message}`));
      }
    };

    reader.onerror = function () {
      reject(new Error('ファイル読み込みエラー'));
    };

    reader.readAsText(file);
  });
}

/**
 * 複数ファイルインポート処理
 */
async function handleMultipleFileImport(event) {
  const files = Array.from(event.target.files);
  if (files.length === 0) return;

  // 対象キーワードIDを取得
  const targetKeywordId = window.currentImportTargetKeywordId;
  if (!targetKeywordId) {
    addLogEntry('インポート対象のキーワードが特定できませんでした', 'error');
    return;
  }

  const targetKeyword = keywordManager.keywords[targetKeywordId];
  if (!targetKeyword) {
    addLogEntry('対象キーワードが見つかりませんでした', 'error');
    return;
  }

  // 進行状況表示
  const totalFiles = files.length;
  let processedFiles = 0;
  let successCount = 0;
  let errorCount = 0;

  addLogEntry(`${totalFiles}個のファイルを「${targetKeyword.text || 'unnamed'}」にインポートします`, 'info');

  // ファイルを一つずつ処理
  for (const file of files) {
    processedFiles++;
    addLogEntry(`ファイル ${processedFiles}/${totalFiles}: ${file.name} を処理中...`, 'info');

    try {
      await importSingleFileToKeyword(file, targetKeywordId);
      successCount++;
      addLogEntry(`✓ ${file.name} のインポートが完了しました`, 'success');
    } catch (error) {
      errorCount++;
      addLogEntry(`✗ ${file.name} のインポートに失敗しました: ${error.message}`, 'error');
    }
  }

  // 最終結果を表示
  addLogEntry(`インポート完了: 成功 ${successCount}件, 失敗 ${errorCount}件`, errorCount === 0 ? 'success' : 'error');

  // ファイル入力をクリア
  event.target.value = '';

  // 統計とUIを更新
  updateStats();
  updateAccountKeywordFilter();
  updateTweetsFilter();

  // 対象キーワードIDをクリア
  window.currentImportTargetKeywordId = null;
}

/**
 * 単一ファイルインポート処理
 */
function importSingleFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = function (e) {
      try {
        const importData = JSON.parse(e.target.result);
        addLogEntry(`ファイル解析成功: ${file.name}`, 'info');

        // データ構造を分析
        const topLevelKeys = Object.keys(importData);
        addLogEntry(`ファイル構造分析 ${file.name}:`, 'info');
        addLogEntry(`- トップレベルキー: [${topLevelKeys.join(', ')}]`, 'info');
        addLogEntry(`- keywords存在: ${!!importData.keywords}`, 'info');
        addLogEntry(`- keywordsタイプ: ${typeof importData.keywords}`, 'info');
        if (topLevelKeys.length > 0) {
          const firstKey = topLevelKeys[0];
          addLogEntry(`- 最初のキー "${firstKey}" の値タイプ: ${typeof importData[firstKey]}`, 'info');
          if (typeof importData[firstKey] === 'object' && importData[firstKey] !== null) {
            addLogEntry(`- "${firstKey}" のサブキー: [${Object.keys(importData[firstKey]).slice(0, 5).join(', ')}${Object.keys(importData[firstKey]).length > 5 ? '...' : ''}]`, 'info');
          }
        }

        // 異なるデータ形式に対応
        let keywordsData = null;

        if (importData.keywords && typeof importData.keywords === 'object') {
          // 通常の形式: { keywords: { keyword_1: {...}, keyword_2: {...} } }
          keywordsData = importData.keywords;
          addLogEntry(`✓ 標準形式を検出: ${file.name}`, 'success');
        } else if (Array.isArray(importData) && importData.length > 0 && importData[0].text) {
          // 配列形式: [{ text: "keyword1", tweets: [...] }, { text: "keyword2", tweets: [...] }]
          keywordsData = {};
          importData.forEach((item, index) => {
            keywordsData[`keyword_${index + 1}`] = item;
          });
          addLogEntry(`✓ 配列形式を検出: ${file.name}, 要素数: ${importData.length}`, 'success');
        } else if (importData.text && (importData.tweets || importData.trendData)) {
          // 単一キーワード形式: { text: "keyword", tweets: [...] }
          keywordsData = { keyword_1: importData };
          addLogEntry(`✓ 単一キーワード形式を検出: ${file.name}`, 'success');
        } else if (importData.data && typeof importData.data === 'object') {
          // ネストされたdata形式: { data: { keywords: {...} } }
          if (importData.data.keywords) {
            keywordsData = importData.data.keywords;
            addLogEntry(`✓ ネストされたdata形式を検出: ${file.name}`, 'success');
          } else {
            keywordsData = importData.data;
            addLogEntry(`✓ data直接形式を検出: ${file.name}`, 'success');
          }
        } else if (importData.exportData && importData.exportData.keywords) {
          // エクスポートデータ形式: { exportData: { keywords: {...} } }
          keywordsData = importData.exportData.keywords;
          addLogEntry(`✓ エクスポートデータ形式を検出: ${file.name}`, 'success');
        } else if (typeof importData === 'object' && Object.keys(importData).some(key => key.startsWith('keyword_'))) {
          // キーワードが直接トップレベルにある形式: { keyword_1: {...}, keyword_2: {...} }
          keywordsData = importData;
          addLogEntry(`✓ トップレベルキーワード形式を検出: ${file.name}`, 'success');
        } else if (importData.keyword && typeof importData.keyword === 'object') {
          // 単一キーワード形式（version付き）: { version: "1.0", exportDate: "...", keyword: {...} }
          keywordsData = { keyword_1: importData.keyword };
          addLogEntry(`✓ 単一キーワード形式（version付き）を検出: ${file.name}`, 'success');
        } else {
          addLogEntry(`✗ サポートされていないデータ形式: ${file.name}`, 'error');
          addLogEntry(`利用可能なキー: [${Object.keys(importData).join(', ')}]`, 'error');
          if (Object.keys(importData).length > 0) {
            const firstKey = Object.keys(importData)[0];
            const firstValue = importData[firstKey];
            addLogEntry(`最初のキー "${firstKey}" の値: ${typeof firstValue === 'object' ? JSON.stringify(firstValue).substring(0, 100) + '...' : firstValue}`, 'error');
          }
          throw new Error(`サポートされていないデータ形式です。ログタブでファイル構造を確認してください。`);
        }

        if (!keywordsData || Object.keys(keywordsData).length === 0) {
          throw new Error(`キーワードデータが見つかりません`);
        }

        addLogEntry(`✓ バリデーション成功: ${file.name}, キーワード数: ${Object.keys(keywordsData).length}`, 'success');

        // 既存のキーワードIDの最大値を取得（リアルタイムで計算）
        const existingIds = Object.keys(keywordManager.keywords).map(id => parseInt(id.replace('keyword_', '')));
        const maxId = Math.max(existingIds.length > 0 ? Math.max(...existingIds) : 0, keywordManager.nextId - 1);
        let nextImportId = maxId + 1;

        let importedCount = 0;

        // インポートデータを処理
        Object.keys(keywordsData).forEach(originalKeywordId => {
          const keywordData = keywordsData[originalKeywordId];

          // 新しいIDを生成（重複回避）
          const newKeywordId = `keyword_${nextImportId++}`;

          // キーワードオブジェクトを作成
          const newKeyword = {
            id: newKeywordId,
            text: keywordData.text || '',
            startDate: keywordData.startDate || keywordData.targetDate || new Date().toISOString().split('T')[0],
            endDate: keywordData.endDate || keywordData.targetDate || new Date().toISOString().split('T')[0],
            active: false,
            tweets: keywordData.tweets || [],
            trendData: keywordData.trendData || [],
            color: keywordColors[(nextImportId - 1) % keywordColors.length],
            stats: {
              totalTweets: keywordData.tweets ? keywordData.tweets.length : 0,
              lastUpdate: keywordData.stats?.lastUpdate ? new Date(keywordData.stats.lastUpdate) : null
            },
            collection: {
              isRunning: false,
              isCompleted: keywordData.collection?.isCompleted || false,
              collectedCount: keywordData.collection?.collectedCount || (keywordData.tweets ? keywordData.tweets.length : 0),
              progress: 0,
              currentCursor: null,
              waitingForInitialApi: false,
              countdownTimer: null
            }
          };

          // キーワードマネージャーに追加
          keywordManager.keywords[newKeywordId] = newKeyword;

          // nextIdを即座に更新（競合回避）
          keywordManager.nextId = nextImportId;

          importedCount++;
        });

        // UIを更新 - 新しいキーワードのカードを作成
        Object.values(keywordManager.keywords).forEach(keyword => {
          if (!document.querySelector(`[data-keyword-id="${keyword.id}"]`)) {
            createKeywordCard(keyword);
          }
        });

        resolve(`${importedCount}件のキーワードをインポート`);

      } catch (error) {
        reject(new Error(`ファイル解析エラー: ${error.message}`));
      }
    };

    reader.onerror = function () {
      reject(new Error('ファイル読み込みエラー'));
    };

    reader.readAsText(file);
  });
}

/**
 * チャート用のデータを準備
 */
function prepareChartData(keywords, chartType, forcePeriodMode = null, forceStartDate = null, forceEndDate = null) {
  addLogEntry(`=== チャートデータ準備開始 (${chartType}) ===`, 'info');
  addLogEntry(`処理対象キーワード数: ${keywords.length}`, 'info');

  // 時間別・日別モードの処理前制限チェック（強制パラメータ優先）
  if (chartType === 'hourly' || chartType === 'daily') {
    const periodMode = forcePeriodMode || document.getElementById('periodMode')?.value || 'all';
    if (periodMode === 'all') {
      const modeText = chartType === 'hourly' ? '時間別' : '日別';
      addLogEntry(`${modeText}表示は処理負荷が高いため、全期間モードでは処理を中止します`, 'error');
      return {}; // 空のデータを返す
    }
    
    // 期間指定でも制限日数を超える場合は処理を中止（強制パラメータ優先）
    const startDateStr = forceStartDate || document.getElementById('startDate')?.value;
    const endDateStr = forceEndDate || document.getElementById('endDate')?.value;
    if (startDateStr && endDateStr) {
      const startDate = new Date(startDateStr);
      const endDate = new Date(endDateStr);
      const daysDiff = (endDate - startDate) / (1000 * 60 * 60 * 24);
      
      let maxDays, modeText;
      if (chartType === 'hourly') {
        maxDays = 14;
        modeText = '時間別';
      } else if (chartType === 'daily') {
        maxDays = 90;
        modeText = '日別';
      }
      
      if (daysDiff > maxDays) {
        addLogEntry(`${modeText}表示は処理負荷が高いため、${maxDays}日を超える期間（${daysDiff.toFixed(1)}日）では処理を中止します`, 'error');
        return {}; // 空のデータを返す
      } else {
        addLogEntry(`${modeText}表示: 期間制限内（${daysDiff.toFixed(1)}日）で処理を開始`, 'info');
      }
    }
  }

  const data = {};

  keywords.forEach(keyword => {
    addLogEntry(`キーワード処理: ${keyword.id}, ツイート数: ${keyword.tweets ? keyword.tweets.length : 0}`, 'info');

    const tweetsByTime = {};

    if (!keyword.tweets || keyword.tweets.length === 0) {
      addLogEntry(`キーワード ${keyword.id} にはツイートがありません`, 'warning');
      data[keyword.id] = tweetsByTime;
      return;
    }

    // 期間フィルタリング用の日付範囲を取得（強制パラメータ優先）
    let startDateFilter = null;
    let endDateFilter = null;
    const periodMode = forcePeriodMode || document.getElementById('periodMode')?.value || 'all';
    
    if (periodMode === 'custom') {
      const startDateStr = forceStartDate || document.getElementById('startDate')?.value;
      const endDateStr = forceEndDate || document.getElementById('endDate')?.value;
      
      if (startDateStr && endDateStr) {
        startDateFilter = new Date(startDateStr + 'T00:00:00');
        endDateFilter = new Date(endDateStr + 'T23:59:59');
        addLogEntry(`期間フィルタリング適用: ${startDateStr} 〜 ${endDateStr}`, 'info');
      }
    }

    keyword.tweets.forEach((tweet, index) => {
      const timestamp = tweet.created_at || tweet.timestamp;

      if (index < 3) {
        addLogEntry(`  ツイート${index + 1}: timestamp="${timestamp}"`, 'info');
      }

      if (!timestamp) {
        addLogEntry('タイムスタンプなしのツイートをスキップ', 'warning');
        return;
      }

      const date = new Date(timestamp);

      if (isNaN(date.getTime())) {
        if (index < 3) {
          addLogEntry(`無効な日付: ${timestamp}`, 'error');
        }
        return;
      }

      // 期間フィルタリングチェック
      if (startDateFilter && endDateFilter) {
        if (date < startDateFilter || date > endDateFilter) {
          if (index < 3) {
            addLogEntry(`期間外のためスキップ: ${timestamp}`, 'info');
          }
          return;
        }
      }

      let key;

      switch (chartType) {
        case 'hourly':
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:00`;
          break;
        case 'daily':
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
          break;
        case 'weekly':
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          key = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, '0')}-${String(weekStart.getDate()).padStart(2, '0')}`;
          break;
        case 'monthly':
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          break;
        case 'yearly':
          key = `${date.getFullYear()}`;
          break;
      }

      if (!tweetsByTime[key]) {
        tweetsByTime[key] = 0;
      }
      tweetsByTime[key]++;
    });
    data[keyword.id] = tweetsByTime;
  });

  addLogEntry('=== チャートデータ準備完了 ===', 'success');
  return data;
}

/**
 * きれいな最大値を計算
 */
function calculateNiceMaxValue(maxValue) {
  if (maxValue <= 0) return 1;

  // 小さい値の場合は特別処理
  if (maxValue <= 10) {
    return Math.ceil(maxValue * 1.2);
  }

  // 適度な余白を追加（20%から10%に変更）
  const paddedMax = maxValue * 1.1;

  // より適切な刻み幅を決定
  let step;
  if (paddedMax <= 50) {
    step = 5;
  } else if (paddedMax <= 100) {
    step = 10;
  } else if (paddedMax <= 500) {
    step = 25;
  } else if (paddedMax <= 1000) {
    step = 50;
  } else if (paddedMax <= 2000) {
    step = 100;
  } else if (paddedMax <= 5000) {
    step = 250;
  } else if (paddedMax <= 10000) {
    step = 500;
  } else {
    // 10000を超える場合は桁数に応じた処理
    const magnitude = Math.pow(10, Math.floor(Math.log10(paddedMax)));
    step = magnitude / 4; // 4分割程度
  }
  
  return Math.ceil(paddedMax / step) * step;
}

/**
 * Y軸の目盛り値を計算
 */
function calculateNiceYAxisValues(niceMaxValue) {
  // 5つまたは6つの目盛りを作成
  const targetTicks = 5;
  const interval = niceMaxValue / targetTicks;

  const values = [];
  for (let i = 0; i <= targetTicks; i++) {
    values.push(Math.round(interval * i));
  }

  return values;
}

/**
 * 連続した時間軸を生成（データがない時間帯も含める）
 */
function generateContinuousTimeKeys(existingKeys, chartType, forcePeriodMode = null, forceStartDate = null, forceEndDate = null) {
  if (existingKeys.length === 0) return [];

  existingKeys.sort();
  const startKey = existingKeys[0];
  const endKey = existingKeys[existingKeys.length - 1];

  const result = [];
  let current = new Date(startKey.replace(' ', 'T'));
  let end = new Date(endKey.replace(' ', 'T'));

  // 無効な日付チェック
  if (isNaN(current.getTime()) || isNaN(end.getTime())) {
    addLogEntry(`無効な日付: startKey=${startKey}, endKey=${endKey}`, 'error');
    return existingKeys;
  }

  // 期間指定モードの場合は日付範囲を制限（強制パラメータ優先）
  const periodMode = forcePeriodMode || document.getElementById('periodMode')?.value || 'all';
  if (periodMode === 'custom') {
    const startDateStr = forceStartDate || document.getElementById('startDate')?.value;
    const endDateStr = forceEndDate || document.getElementById('endDate')?.value;
    
    if (startDateStr && endDateStr) {
      const customStart = new Date(startDateStr + 'T00:00:00');
      const customEnd = new Date(endDateStr + 'T23:59:59');
      
      // 指定された期間内にデータがある場合のみ制限
      if (!isNaN(customStart.getTime()) && !isNaN(customEnd.getTime())) {
        // 強制パラメータが指定されている場合はUI更新なし（すでに更新済み）
        if (!forceStartDate && !forceEndDate && (chartType === 'hourly' || chartType === 'daily')) {
          const daysDiff = (customEnd - customStart) / (1000 * 60 * 60 * 24);
          let maxDays, modeText, periodText;
          
          if (chartType === 'hourly') {
            maxDays = 14;
            modeText = '時間別';
            periodText = '2週間';
          } else if (chartType === 'daily') {
            maxDays = 90;
            modeText = '日別';
            periodText = '3ヶ月';
          }
          
          if (daysDiff > maxDays) {
            // 開始日から制限日数後に終了日を調整
            const adjustedEnd = new Date(customStart.getTime() + maxDays * 24 * 60 * 60 * 1000);
            end = adjustedEnd;
            
            // UI も更新
            const adjustedEndStr = adjustedEnd.toISOString().split('T')[0];
            document.getElementById('endDate').value = adjustedEndStr;
            
            addLogEntry(`${modeText}表示のため、期間を ${startDateStr} 〜 ${adjustedEndStr} (${periodText}) に自動調整しました`, 'warning');
          } else {
            if (customStart > current) {
              current = customStart;
            }
            if (customEnd < end) {
              end = customEnd;
            }
            addLogEntry(`期間指定: ${startDateStr} 〜 ${endDateStr}`, 'info');
          }
        } else {
          // 強制パラメータが指定されている場合、または時間別以外は通常通り期間を適用
          if (customStart > current) {
            current = customStart;
          }
          if (customEnd < end) {
            end = customEnd;
          }
          addLogEntry(`期間指定: ${startDateStr} 〜 ${endDateStr}`, 'info');
        }
      }
    }
  }

  // 期間チェック：チャートタイプに応じて制限（全期間モードでのフォールバック）
  const timeDiff = end.getTime() - current.getTime();
  const daysDiff = timeDiff / (1000 * 60 * 60 * 24);

  // 全期間モードでの制限（期間指定モードでない場合のみ）
  if (periodMode === 'all') {
    let maxDays;
    switch (chartType) {
      case 'hourly':
        maxDays = 14; // 時間別は全期間モードでも最大2週間
        break;
      case 'daily':
        maxDays = 365 * 20; // 日別は最大20年
        break;
      case 'weekly':
        maxDays = 365 * 30; // 週別は最大30年
        break;
      case 'monthly':
        maxDays = 365 * 50; // 月別は最大50年
        break;
      case 'yearly':
        maxDays = 365 * 100; // 年別は最大100年
        break;
      default:
        maxDays = 365 * 20;
        break;
    }

    if (daysDiff > maxDays) {
      // ユーザーに通知
      if (typeof addLogEntry === 'function') {
        const typeNames = {
          'hourly': '時間別',
          'daily': '日別', 
          'weekly': '週別',
          'monthly': '月別',
          'yearly': '年別'
        };
        addLogEntry(`${typeNames[chartType] || chartType}グラフ: 期間が長すぎるため最新${maxDays}日分に制限します`, 'warning');
      }
      // 期間を制限：最新データから遡って開始日を調整
      const limitedStart = new Date(end.getTime() - maxDays * 24 * 60 * 60 * 1000);
      current.setTime(limitedStart.getTime());
    }
  }

  while (current <= end) {
    let key;

    switch (chartType) {
      case 'hourly':
        key = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')} ${String(current.getHours()).padStart(2, '0')}:00`;
        current.setHours(current.getHours() + 1);
        break;
      case 'daily':
        key = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`;
        current.setDate(current.getDate() + 1);
        break;
      case 'weekly':
        // 週の開始日（日曜日）に調整
        const weekStart = new Date(current);
        weekStart.setDate(current.getDate() - current.getDay());
        key = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, '0')}-${String(weekStart.getDate()).padStart(2, '0')}`;
        if (result.length < 3) {
          addLogEntry(`連続週別キー: current=${current.toISOString().split('T')[0]}, 週開始=${weekStart.toISOString().split('T')[0]}, キー="${key}"`, 'info');
        }
        current.setDate(current.getDate() + 7);
        break;
      case 'monthly':
        key = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`;
        current.setMonth(current.getMonth() + 1);
        break;
      case 'yearly':
        key = `${current.getFullYear()}`;
        current.setFullYear(current.getFullYear() + 1);
        break;
      default:
        key = startKey;
        break;
    }

    result.push(key);

    // 無限ループ防止（チャートタイプに応じて調整）
    let maxPoints;
    switch (chartType) {
      case 'hourly':
        maxPoints = 50000; // 時間別は最大50,000ポイント（約5.7年分）
        break;
      case 'daily':
        maxPoints = 10000; // 日別は最大10,000ポイント（約27年分）
        break;
      default:
        maxPoints = 5000; // その他は最大5,000ポイント
        break;
    }
    
    if (result.length > maxPoints) {
      addLogEntry(`時間軸生成が${maxPoints}を超えました。処理を停止します。chartType=${chartType}, result.length=${result.length}`, 'error');
      addLogEntry(`最後の数個のキー: ${result.slice(-10).join(', ')}`, 'warning');
      break;
    }

    // 追加の安全チェック：異常に長い期間をチェック
    if (result.length > 500) {
      const timeDiff = end.getTime() - current.getTime();
      const daysDiff = timeDiff / (1000 * 60 * 60 * 24);
      addLogEntry(`長い期間が検出されました: ${daysDiff.toFixed(1)}日, result.length=${result.length}`, 'warning');
    }
  }

  return result;
}

/**
 * シンプルなチャートを描画
 */
function drawSimpleChart(canvas, chartData, keywords, forcePeriodMode = null, forceStartDate = null, forceEndDate = null) {

  // 空データの場合は制限メッセージを表示
  if (!chartData || Object.keys(chartData).length === 0) {
    const chartPlaceholder = document.getElementById('chartPlaceholder');
    if (chartPlaceholder) {
      // 現在のチャートタイプを取得
      const currentChartType = document.getElementById('chartType').value;
      
      let modeText, periodText;
      if (currentChartType === 'hourly') {
        modeText = '時間別';
        periodText = '2週間以内';
      } else if (currentChartType === 'daily') {
        modeText = '日別';
        periodText = '3ヶ月以内';
      } else {
        modeText = currentChartType;
        periodText = 'より短い';
      }
      
      const warningHTML = `
        <div style="text-align: center; padding: 40px; color: #ff6b6b;">
          <h3>⚠️ ${modeText}表示は制限されています</h3>
          <p>処理負荷軽減のため、${modeText}表示は${periodText}の期間でのみ利用可能です。</p>
          <p>期間を短くするか、週別・月別表示をご利用ください。</p>
        </div>
      `;
      
      chartPlaceholder.innerHTML = warningHTML;
      chartPlaceholder.style.display = 'block';
      canvas.style.display = 'none';
      
      const chartLegend = document.getElementById('chartLegend');
      if (chartLegend) {
        chartLegend.style.display = 'none';
      }
    }
    return;
  }

  if (!canvas) {
    addLogEntry('Canvas要素が見つかりません', 'error');
    return;
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    addLogEntry('2Dコンテキストを取得できません', 'error');
    return;
  }

  let width = canvas.offsetWidth;
  const height = 350;

  // キャンバスのサイズが0の場合は最小サイズを設定
  if (width <= 0) {
    width = 800; // デフォルト幅
    addLogEntry(`Canvas offsetWidthが0のため、デフォルト幅${width}pxを使用`, 'warning');
  }

  canvas.width = width;
  canvas.height = height;

  addLogEntry(`Canvas設定: ${width}x${height}`, 'info');
  addLogEntry(`Canvas offsetWidth: ${canvas.offsetWidth}`, 'info');


  if (width === 0 || height === 0) {
    addLogEntry(`Canvasのサイズが0です: ${width}x${height}`, 'error');
    addLogEntry('Canvas要素の親要素構造に問題があります', 'error');
    return;
  }

  // キャンバスをクリア
  ctx.clearRect(0, 0, width, height);

  // 全ての時間軸を収集してソート
  const allTimeKeys = new Set();
  Object.values(chartData).forEach(data => {
    Object.keys(data).forEach(key => allTimeKeys.add(key));
  });

  // チャートタイプを取得
  const currentChartType = document.getElementById('chartType').value;

  // 連続した時間軸を生成（0件の時間帯も含める）
  const sortedTimeKeys = generateContinuousTimeKeys(Array.from(allTimeKeys), currentChartType, forcePeriodMode, forceStartDate, forceEndDate);


  if (sortedTimeKeys.length === 0) {
    addLogEntry('時間軸データがありません。チャートを描画できません。', 'error');
    return;
  }

  addLogEntry(`最大値計算を開始...`, 'info');

  // 期間制限された時間軸内のデータのみから最大値を取得
  let maxValue = 0;
  Object.entries(chartData).forEach(([keywordId, data]) => {
    // 期間制限された時間軸内の値のみを抽出
    const filteredValues = sortedTimeKeys.map(timeKey => data[timeKey] || 0);
    const keywordMax = Math.max(...filteredValues);
    maxValue = Math.max(maxValue, keywordMax);
  });

  // maxValueが0の場合は最小値1を設定（グラフが描画できない場合を回避）
  if (maxValue === 0) {
    maxValue = 1;
    addLogEntry('最大値が0のため1に設定', 'warning');
  }

  // Y軸の見やすい最大値を計算
  const niceMaxValue = calculateNiceMaxValue(maxValue);
  const yAxisValues = calculateNiceYAxisValues(niceMaxValue);

  // マージンとスケール
  const margin = { top: 20, right: 20, bottom: 50, left: 50 };
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;

  // 背景
  ctx.fillStyle = '#15202b';
  ctx.fillRect(0, 0, width, height);

  // グリッド線
  ctx.strokeStyle = '#38444d';
  ctx.lineWidth = 1;

  // Y軸グリッド
  yAxisValues.forEach((value, index) => {
    const y = margin.top + (chartHeight * index / (yAxisValues.length - 1));
    ctx.beginPath();
    ctx.moveTo(margin.left, y);
    ctx.lineTo(width - margin.right, y);
    ctx.stroke();

    // Y軸ラベル
    ctx.fillStyle = '#8b98a5';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(yAxisValues[yAxisValues.length - 1 - index], margin.left - 10, y + 4);
  });

  // X軸ラベル
  ctx.fillStyle = '#8b98a5';
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'center';
  const labelInterval = Math.ceil(sortedTimeKeys.length / 10);

  // チャートタイプを取得して適切なラベル形式を決定
  // (currentChartTypeは既に上で取得済み)

  sortedTimeKeys.forEach((key, index) => {
    if (index % labelInterval === 0) {
      // データポイントと同じX座標計算ロジックを使用
      const x = sortedTimeKeys.length === 1
        ? margin.left + chartWidth / 2
        : margin.left + (index / (sortedTimeKeys.length - 1)) * chartWidth;

      // チャートタイプに応じてラベル表示を調整
      let displayLabel = key;
      if (currentChartType === 'hourly') {
        // 時間別の場合：日付と時間の両方を表示（短縮形式）
        const parts = key.split(' ');
        if (parts.length >= 2) {
          const datePart = parts[0].split('-');
          const timePart = parts[1];
          displayLabel = `${datePart[1]}/${datePart[2]} ${timePart}`;
        }
      } else if (currentChartType === 'daily') {
        // 日別の場合：月/日の形式で表示
        const datePart = key.split('-');
        if (datePart.length >= 3) {
          displayLabel = `${datePart[1]}/${datePart[2]}`;
        }
      } else if (currentChartType === 'weekly') {
        // 週別の場合：そのまま日付のみ表示
        displayLabel = key.split(' ')[0];
      } else if (currentChartType === 'monthly') {
        // 月別の場合：年/月の形式で表示
        const datePart = key.split('-');
        if (datePart.length >= 2) {
          displayLabel = `${datePart[0]}/${datePart[1]}`;
        }
      } else if (currentChartType === 'yearly') {
        // 年別の場合：年のみ表示
        displayLabel = key;
      } else {
        // その他の場合：そのまま表示
        displayLabel = key;
      }

      ctx.save();
      ctx.translate(x, height - margin.bottom + 20);
      ctx.rotate(-Math.PI / 4);
      ctx.fillText(displayLabel, 0, 0);
      ctx.restore();
    }
  });

  // データを描画
  keywords.forEach((keyword, keywordIndex) => {
    const data = chartData[keyword.id];
    const color = keyword.color || keywordColors[keywordIndex % keywordColors.length];

    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();

    let firstPoint = true;
    sortedTimeKeys.forEach((timeKey, index) => {
      const value = data[timeKey] || 0;
      // X座標の計算を改善（1データポイントの場合の考慮）
      const x = sortedTimeKeys.length === 1
        ? margin.left + chartWidth / 2
        : margin.left + (index / (sortedTimeKeys.length - 1)) * chartWidth;
      const y = margin.top + chartHeight - (value / niceMaxValue) * chartHeight;

      if (firstPoint) {
        ctx.moveTo(x, y);
        firstPoint = false;
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();

    // データポイント
    ctx.fillStyle = color;
    sortedTimeKeys.forEach((timeKey, index) => {
      const value = data[timeKey] || 0;

      // 同じX座標計算ロジックを使用（一貫性のため）
      const x = sortedTimeKeys.length === 1
        ? margin.left + chartWidth / 2
        : margin.left + (index / (sortedTimeKeys.length - 1)) * chartWidth;
      const y = margin.top + chartHeight - (value / niceMaxValue) * chartHeight;

      // 0件でもポイントを表示（小さいサイズで）
      const pointSize = value > 0 ? 3 : 1;
      ctx.beginPath();
      ctx.arc(x, y, pointSize, 0, Math.PI * 2);
      ctx.fill();

      // 値をポイントの上に表示（切り替え可能、0より大きい場合のみ）
      if (showChartValues && value > 0) {
        ctx.fillStyle = '#ffffff';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(value.toString(), x, y - 8);
        ctx.fillStyle = color; // 色を戻す
      }
    });
  });

  addLogEntry('=== グラフ描画完了 ===', 'success');
}

// ========== レーダーチャート ヘルプツールチップ ==========================================================

function setupRadarHelpTooltip() {
  // 単一モード用
  const helpIcon = document.querySelector('.radar-help-icon');
  const helpTooltip = document.querySelector('.radar-help-tooltip');
  
  if (helpIcon && helpTooltip) {
    helpIcon.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      // 他のツールチップを閉じる
      document.querySelectorAll('.keyword-help-tooltip').forEach(tooltip => {
        tooltip.style.display = 'none';
      });
      document.querySelectorAll('.speed-help-tooltip').forEach(tooltip => {
        tooltip.style.display = 'none';
      });
      document.querySelectorAll('.radar-compare-help-tooltip').forEach(tooltip => {
        tooltip.style.display = 'none';
      });
      
      // このツールチップの表示を切り替え
      if (helpTooltip.style.display === 'block') {
        helpTooltip.style.display = 'none';
      } else {
        helpTooltip.style.display = 'block';
      }
    });
  }
  
  // 比較モード用
  const compareHelpIcon = document.querySelector('.radar-compare-help-icon');
  const compareHelpTooltip = document.querySelector('.radar-compare-help-tooltip');
  
  if (compareHelpIcon && compareHelpTooltip) {
    compareHelpIcon.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      // 他のツールチップを閉じる
      document.querySelectorAll('.keyword-help-tooltip').forEach(tooltip => {
        tooltip.style.display = 'none';
      });
      document.querySelectorAll('.speed-help-tooltip').forEach(tooltip => {
        tooltip.style.display = 'none';
      });
      document.querySelectorAll('.radar-help-tooltip').forEach(tooltip => {
        tooltip.style.display = 'none';
      });
      
      // このツールチップの表示を切り替え
      if (compareHelpTooltip.style.display === 'block') {
        compareHelpTooltip.style.display = 'none';
      } else {
        compareHelpTooltip.style.display = 'block';
      }
    });
  }
}