// ========== ツイート表示 ==========================================================

function updateTweetsList() {
  const allTweets = [];

  // すべてのキーワードからツイートを収集
  Object.values(keywordManager.keywords).forEach((keyword) => {
    if (keyword.tweets && keyword.tweets.length > 0) {
      const keywordIndex = getKeywordNumber(keyword.id);
      const keywordColor = keywordColors[keywordIndex - 1] || '#1da1f2';

      keyword.tweets.forEach((tweet, index) => {
        // 表示用のツイートオブジェクトを作成（元のデータは変更しない）
        const displayTweet = { ...tweet };
        
        // 表示用情報を動的に付与
        displayTweet.keywordIndex = keywordIndex;
        displayTweet.keywordColor = keywordColor;
        
        // タイムスタンプを確保
        if (!displayTweet.timestamp) {
          const timestamp = new Date(tweet.created_at || tweet.timestamp).getTime();
          if (isNaN(timestamp)) {
            console.warn(`無効なタイムスタンプ: ${tweet.created_at || tweet.timestamp}`);
          }
          displayTweet.timestamp = timestamp;
        }
        
        allTweets.push(displayTweet);
      });
    }
  });


  if (allTweets.length === 0) {
    tweetsAllData = [];
    tweetsCurrentPage = 1;
    displayTweetsPage();
    return;
  }

  // 並び替え設定を取得
  const sortBy = document.getElementById('tweetsSortBy')?.value || 'timestamp';
  const sortOrder = document.getElementById('tweetsSortOrder')?.value || 'desc';

  // 並び替え実行
  const sortedTweets = sortTweets([...allTweets], sortBy, sortOrder);

  // 全データを保存
  tweetsAllData = sortedTweets;
  
  // 検索フィルターを適用
  applySearchFilter();
  
  tweetsCurrentPage = 1; // 最初のページに戻る
  displayTweetsPage();
}

/**
 * ツイート一覧更新のフォールバック（仮想スクロール使用不可時）
 * ※現在はページング機能を使用するため、この関数は使用されません
 */
function updateTweetsListFallback() {
  // ページング機能を使用
  updateTweetsList();
}

/**
 * ツイートHTML作成（影響力ポイント付き）
 */
function createTweetHTML(tweet) {
  const timeStr = new Date(tweet.timestamp).toLocaleString('ja-JP');

  // undefinedをセーフに処理
  const userName = tweet.user?.name || '不明なユーザー';
  const userHandle = tweet.user?.screen_name || 'unknown';
  const tweetText = tweet.text || '内容が取得できませんでした';
  const likesCount = tweet.public_metrics?.like_count || 0;
  const retweetsCount = tweet.public_metrics?.retweet_count || 0;
  const repliesCount = tweet.public_metrics?.reply_count || 0;
  const profileImage = tweet.user?.profile_image_url || '';
  
  // 影響力ポイントを計算（関数が存在する場合のみ）
  let influenceScore = null;
  if (typeof calculateTweetInfluenceScore === 'function') {
    try {
      influenceScore = calculateTweetInfluenceScore(tweet);
    } catch (e) {
      console.warn('影響力スコア計算エラー:', e);
    }
  }

  return `
    <div class="tweet-item" data-keyword="${tweet.keywordIndex}">
      <div class="tweet-header">
        <div class="tweet-user">
          <div class="tweet-avatar">
            ${profileImage ?
      `<img src="${profileImage}" alt="${userName}" style="width: 32px; height: 32px; border-radius: 50%;" class="profile-img">
               <div class="profile-fallback" style="display: none; width: 32px; height: 32px; background: #536471; border-radius: 50%; align-items: center; justify-content: center; font-size: 14px;">👤</div>` :
      '<div style="width: 32px; height: 32px; background: #536471; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 14px;">👤</div>'
    }
          </div>
          <div class="tweet-user-info">
            <div class="tweet-username">${userName}</div>
            <div class="tweet-handle">@${userHandle}</div>
          </div>
        </div>
        <div class="tweet-meta">
          <span class="tweet-keyword-tag tweet-keyword-${tweet.keywordIndex}">
            キーワード ${tweet.keywordIndex}
          </span>
          <span>${timeStr}</span>
        </div>
      </div>
      <div class="tweet-content">${tweetText}</div>
      <div class="tweet-stats">
        <div class="tweet-stat">
          <span>❤️</span>
          <span>${likesCount}</span>
        </div>
        <div class="tweet-stat">
          <span>🔄</span>
          <span>${retweetsCount}</span>
        </div>
        <div class="tweet-stat">
          <span>💬</span>
          <span>${repliesCount}</span>
        </div>
        <div class="tweet-stat">
          <span>👁️</span>
          <span>${(parseInt(tweet.public_metrics?.view_count) || 0).toLocaleString()}</span>
        </div>
        <div class="tweet-stat tweet-link-copy">
          <button class="link-copy-btn" data-tweet-id="${tweet.id}" data-screen-name="${userHandle}" 
                  title="ツイートのリンクをコピー"
                  ${(!tweet.id || !userHandle || userHandle === 'unknown') ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''}>
            <span>🔗</span>
            <span>リンク</span>
          </button>
        </div>
        ${influenceScore ? 
          `<div class="tweet-stat" title="影響力スコア詳細: Raw=${influenceScore.rawScore}pt × 時間重み=${influenceScore.timeWeight} = ${influenceScore.finalScore}pt">
            <span>⚡</span>
            <span>${influenceScore.finalScore}pt</span>
          </div>` : 
          ''
        }
      </div>
    </div>
  `;
}

function updateTweetsFilter() {
  const filterContainer = document.querySelector('.tweets-filter');
  const existingFilters = filterContainer.querySelectorAll('.keyword-filter-btn:not([data-filter="all"])');

  // 既存のキーワードフィルターを削除
  existingFilters.forEach(btn => btn.remove());

  // アクティブなキーワードのフィルターボタンを追加
  Object.values(keywordManager.keywords).forEach((keyword, index) => {
    if (keyword.stats.totalTweets > 0) {
      const btn = document.createElement('button');
      btn.className = `keyword-filter-btn keyword-${index + 1}`;
      btn.setAttribute('data-filter', `keyword-${index + 1}`);
      btn.addEventListener('click', () => filterTweets(`keyword-${index + 1}`));
      btn.innerHTML = `キーワード ${index + 1} (${keyword.stats.totalTweets})`;
      filterContainer.appendChild(btn);
    }
  });
}

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

// ========== 並び替え機能 ==========================================================

/**
 * ツイート並び替え関数
 */
function sortTweets(tweets, sortBy, sortOrder) {
  // 影響力ポイントのキャッシュ
  const influenceCache = new Map();
  
  return tweets.sort((a, b) => {
    let valueA, valueB;
    
    switch(sortBy) {
      case 'timestamp':
        valueA = a.timestamp;
        valueB = b.timestamp;
        break;
      case 'likes':
        valueA = a.public_metrics?.like_count || 0;
        valueB = b.public_metrics?.like_count || 0;
        break;
      case 'retweets':
        valueA = a.public_metrics?.retweet_count || 0;
        valueB = b.public_metrics?.retweet_count || 0;
        break;
      case 'replies':
        valueA = a.public_metrics?.reply_count || 0;
        valueB = b.public_metrics?.reply_count || 0;
        break;
      case 'views':
        valueA = parseInt(a.public_metrics?.view_count) || 0;
        valueB = parseInt(b.public_metrics?.view_count) || 0;
        break;
      case 'influence':
        // キャッシュを使用して影響力ポイントを計算
        if (!influenceCache.has(a.id)) {
          try {
            const scoreA = typeof calculateTweetInfluenceScore === 'function' 
              ? calculateTweetInfluenceScore(a) 
              : { finalScore: '0' };
            influenceCache.set(a.id, parseFloat(scoreA.finalScore));
          } catch (e) {
            influenceCache.set(a.id, 0);
          }
        }
        if (!influenceCache.has(b.id)) {
          try {
            const scoreB = typeof calculateTweetInfluenceScore === 'function' 
              ? calculateTweetInfluenceScore(b) 
              : { finalScore: '0' };
            influenceCache.set(b.id, parseFloat(scoreB.finalScore));
          } catch (e) {
            influenceCache.set(b.id, 0);
          }
        }
        valueA = influenceCache.get(a.id);
        valueB = influenceCache.get(b.id);
        break;
      default:
        valueA = a.timestamp;
        valueB = b.timestamp;
    }
    
    // 昇順/降順の処理
    return sortOrder === 'asc' ? valueA - valueB : valueB - valueA;
  });
}

/**
 * 統合されたコントロールのイベントリスナー設定
 */
function setupTweetsControls() {
  const applyBtn = document.getElementById('applyControlsBtn');
  const searchInput = document.getElementById('tweetsSearchInput');
  const sortBySelect = document.getElementById('tweetsSortBy');
  const sortOrderSelect = document.getElementById('tweetsSortOrder');
  
  if (applyBtn) {
    // ホバー効果を追加
    applyBtn.addEventListener('mouseover', () => {
      applyBtn.style.background = '#0d8bd9';
    });
    
    applyBtn.addEventListener('mouseout', () => {
      if (!applyBtn.disabled) {
        applyBtn.style.background = '#1da1f2';
      }
    });
    
    applyBtn.addEventListener('click', () => {
      applyTweetsControls();
    });
  }
  
  // エンターキーでも実行
  [searchInput, sortBySelect, sortOrderSelect].forEach(element => {
    if (element) {
      element.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          applyBtn?.click();
        }
      });
    }
  });
}

/**
 * 検索と並び替えを統合して実行
 */
function applyTweetsControls() {
  const addLog = window.addLogEntry;
  const applyBtn = document.getElementById('applyControlsBtn');
  const searchInput = document.getElementById('tweetsSearchInput');
  const sortBySelect = document.getElementById('tweetsSortBy');
  const sortOrderSelect = document.getElementById('tweetsSortOrder');
  
  const searchQuery = searchInput?.value || '';
  const sortBy = sortBySelect?.value || 'timestamp';
  const sortOrder = sortOrderSelect?.value || 'desc';
  
  // ローディング状態
  const originalText = applyBtn.textContent;
  applyBtn.textContent = '処理中...';
  applyBtn.disabled = true;
  applyBtn.style.background = '#536471';
  
  const searchText = searchQuery.trim() ? `"${searchQuery}"で検索・` : '';
  addLog(`${searchText}${getSortDisplayName(sortBy)}で${sortOrder === 'desc' ? '降順' : '昇順'}に処理中...`, 'info');
  
  // 少し遅延を入れてローディング感を演出
  setTimeout(() => {
    try {
      // 検索クエリを設定
      tweetsSearchQuery = searchQuery;
      
      // 並び替えを適用してリスト再描画
      updateTweetsList();
      
      const resultCount = tweetsFilteredData.length;
      const totalCount = tweetsAllData.length;
      
      if (searchQuery.trim() === '') {
        addLog(`並び替え完了: ${getSortDisplayName(sortBy)} (${sortOrder === 'desc' ? '降順' : '昇順'}) - 全${totalCount.toLocaleString()}件`, 'success');
      } else {
        addLog(`検索・並び替え完了: ${resultCount.toLocaleString()}件 / 全${totalCount.toLocaleString()}件`, 'success');
      }
    } catch (error) {
      addLog(`処理エラー: ${error.message}`, 'error');
    } finally {
      // ローディング状態を解除
      applyBtn.textContent = originalText;
      applyBtn.disabled = false;
      applyBtn.style.background = '#1da1f2';
    }
  }, 100);
}

/**
 * 並び替え基準の表示名を取得
 */
function getSortDisplayName(sortBy) {
  const names = {
    timestamp: '時刻順',
    likes: 'いいね数',
    retweets: 'リツイート数', 
    replies: '返信数',
    views: '閲覧数',
    influence: '影響力ポイント'
  };
  return names[sortBy] || '時刻順';
}

// ページング変数
let tweetsCurrentPage = 1;
const tweetsPerPage = 10000;
let tweetsAllData = []; // 全ツイートデータ
let tweetsFilteredData = []; // 検索フィルター済みデータ
let tweetsSearchQuery = ''; // 現在の検索クエリ

/**
 * ページング機能のセットアップ
 */
function setupTweetsPagination() {
  const prevBtn = document.getElementById('tweetsPrevBtn');
  const nextBtn = document.getElementById('tweetsNextBtn');
  const pageInput = document.getElementById('tweetsPageInput');
  const goToPageBtn = document.getElementById('tweetsGoToPageBtn');
  
  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      if (tweetsCurrentPage > 1) {
        tweetsCurrentPage--;
        displayTweetsPage();
      }
    });
  }
  
  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      const totalPages = Math.ceil(tweetsFilteredData.length / tweetsPerPage);
      if (tweetsCurrentPage < totalPages) {
        tweetsCurrentPage++;
        displayTweetsPage();
      }
    });
  }
  
  if (goToPageBtn && pageInput) {
    const goToPage = () => {
      const pageNum = parseInt(pageInput.value);
      const totalPages = Math.ceil(tweetsFilteredData.length / tweetsPerPage);
      if (pageNum >= 1 && pageNum <= totalPages) {
        tweetsCurrentPage = pageNum;
        displayTweetsPage();
      } else {
        pageInput.value = tweetsCurrentPage;
      }
    };
    
    goToPageBtn.addEventListener('click', goToPage);
    pageInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        goToPage();
      }
    });
  }
}

/**
 * 現在のページのツイートを表示
 */
function displayTweetsPage() {
  const tweetsList = document.getElementById('tweetsList');
  const paginationInfo = document.querySelector('.tweets-pagination-info');
  const paginationControls = document.querySelector('.tweets-pagination-controls');
  
  if (!tweetsList) return;
  
  const totalTweets = tweetsFilteredData.length;
  const totalPages = Math.ceil(totalTweets / tweetsPerPage);
  
  if (totalTweets === 0) {
    // データがない場合
    tweetsList.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📝</div>
        <div class="empty-state-title">ツイートがありません</div>
        <div class="empty-state-desc">キーワード検索を開始すると、<br>ここにツイートが表示されます。</div>
      </div>
    `;
    if (paginationInfo) paginationInfo.style.display = 'none';
    if (paginationControls) paginationControls.style.display = 'none';
    return;
  }
  
  // ローディング表示
  tweetsList.innerHTML = `
    <div class="loading-state" style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 200px; color: #536471;">
      <div class="loading-spinner" style="width: 32px; height: 32px; border: 3px solid #e1e8ed; border-top: 3px solid #1da1f2; border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 16px;"></div>
      <div>ページ${tweetsCurrentPage}を読み込み中...</div>
    </div>
  `;
  
  // 少し遅延を入れてローディング感を演出
  setTimeout(() => {
    const startIndex = (tweetsCurrentPage - 1) * tweetsPerPage;
    const endIndex = Math.min(startIndex + tweetsPerPage, totalTweets);
    const currentPageTweets = tweetsFilteredData.slice(startIndex, endIndex);
    
    // ツイートを表示
    tweetsList.innerHTML = currentPageTweets.map(tweet => createTweetHTML(tweet)).join('');
    
    // ページング情報を更新
    const pageInfoElement = document.getElementById('tweetsPageInfo');
    if (pageInfoElement) {
      pageInfoElement.textContent = `${startIndex + 1}-${endIndex}件目 / 全${totalTweets.toLocaleString()}件`;
    }
    if (paginationInfo) paginationInfo.style.display = 'block';
    
    // ページングコントロールを更新
    if (paginationControls) paginationControls.style.display = 'block';
    const pageInputElement = document.getElementById('tweetsPageInput');
    const totalPagesElement = document.getElementById('tweetsTotalPages');
    if (pageInputElement) pageInputElement.value = tweetsCurrentPage;
    if (totalPagesElement) totalPagesElement.textContent = totalPages.toLocaleString();
    
    const prevBtn = document.getElementById('tweetsPrevBtn');
    const nextBtn = document.getElementById('tweetsNextBtn');
    
    if (prevBtn) prevBtn.disabled = tweetsCurrentPage <= 1;
    if (nextBtn) nextBtn.disabled = tweetsCurrentPage >= totalPages;
    
    const searchStatus = tweetsSearchQuery ? ` (検索: "${tweetsSearchQuery}")` : '';
    addLogEntry(`ページ${tweetsCurrentPage}を表示: ${startIndex + 1}-${endIndex}件目${searchStatus}`, 'info');
  }, 200); // 200msの遅延
}

// ========== 検索機能 ==========================================================

/**
 * 検索フィルターを適用
 */
function applySearchFilter() {
  if (!tweetsSearchQuery || tweetsSearchQuery.trim() === '') {
    // 検索クエリがない場合は全データを表示
    tweetsFilteredData = [...tweetsAllData];
  } else {
    const query = tweetsSearchQuery.toLowerCase().trim();
    tweetsFilteredData = tweetsAllData.filter(tweet => {
      const tweetText = (tweet.text || '').toLowerCase();
      const userName = (tweet.user?.name || '').toLowerCase();
      const userHandle = (tweet.user?.screen_name || '').toLowerCase();
      
      return tweetText.includes(query) || userName.includes(query) || userHandle.includes(query);
    });
  }
}


// 初期化時にイベントリスナーを設定
document.addEventListener('DOMContentLoaded', () => {
  setupTweetsControls();
  setupTweetsPagination();
});

