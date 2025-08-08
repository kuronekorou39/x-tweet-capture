// ========== アカウントタブ機能 ==========================================================

// アカウント分析関連のグローバル変数
let currentAccountKeywordFilter = 'all';
let currentAccountSortType = 'tweets';

/**
 * ユニークアカウント数を計算
 */
function calculateUniqueAccounts(keywords) {
  const uniqueUsernames = new Set();
  
  keywords.forEach(keyword => {
    if (keyword.tweets) {
      keyword.tweets.forEach(tweet => {
        if (tweet.username) {
          uniqueUsernames.add(tweet.username.toLowerCase());
        }
      });
    }
  });
  
  return uniqueUsernames.size;
}

/**
 * キーワード別ユニークアカウント数を計算
 */
function calculateKeywordUniqueAccounts(keyword) {
  if (!keyword.tweets) return 0;
  
  const uniqueUsernames = new Set();
  keyword.tweets.forEach(tweet => {
    if (tweet.username) {
      uniqueUsernames.add(tweet.username.toLowerCase());
    }
  });
  
  return uniqueUsernames.size;
}

/**
 * アカウント統計を分析（同期版）
 */
function analyzeAccountStatsSync(keywords, selectedKeywordId = 'all') {
  const accountStats = {};
  
  
  // フィルタリング
  const targetKeywords = selectedKeywordId === 'all' 
    ? keywords 
    : keywords.filter(k => k.id === selectedKeywordId);
  
  
  // 各ツイートを処理
  let totalTweets = 0;
  targetKeywords.forEach(keyword => {
    if (keyword.tweets) {
      totalTweets += keyword.tweets.length;
      keyword.tweets.forEach(tweet => {
        if (tweet.username) {
          const username = tweet.username.toLowerCase();
          
          if (!accountStats[username]) {
            accountStats[username] = {
              username: tweet.username, // 元の大文字小文字を保持
              tweets: 0,
              totalLikes: 0,
              totalRetweets: 0,
              totalReplies: 0,
              keywords: new Set(),
              firstTweet: tweet.createdAt,
              lastTweet: tweet.createdAt
            };
          }
          
          const account = accountStats[username];
          account.tweets++;
          account.totalLikes += tweet.likes || 0;
          account.totalRetweets += tweet.retweets || 0;
          account.totalReplies += tweet.replies || 0;
          account.keywords.add(keyword.text);
          
          // 時間範囲を更新
          if (tweet.createdAt < account.firstTweet) {
            account.firstTweet = tweet.createdAt;
          }
          if (tweet.createdAt > account.lastTweet) {
            account.lastTweet = tweet.createdAt;
          }
        }
      });
    }
  });
  
  
  // Setを配列に変換
  Object.values(accountStats).forEach(account => {
    account.keywords = Array.from(account.keywords);
    account.avgLikes = account.tweets > 0 ? Math.round(account.totalLikes / account.tweets) : 0;
    account.avgRetweets = account.tweets > 0 ? Math.round(account.totalRetweets / account.tweets) : 0;
    account.avgReplies = account.tweets > 0 ? Math.round(account.totalReplies / account.tweets) : 0;
  });
  
  return Object.values(accountStats);
}

/**
 * アカウント統計を分析（非同期版）
 */
async function analyzeAccountStats(keywords, selectedKeywordId = 'all', onProgress = null) {
  const accountStats = {};
  
  // フィルタリング
  const targetKeywords = selectedKeywordId === 'all' 
    ? keywords 
    : keywords.filter(k => k.id === selectedKeywordId);
  
  let processedTweets = 0;
  let totalTweets = 0;
  
  // 総ツイート数を計算
  targetKeywords.forEach(keyword => {
    if (keyword.tweets) {
      totalTweets += keyword.tweets.length;
    }
  });
  
  // 各ツイートを処理
  for (const keyword of targetKeywords) {
    if (keyword.tweets) {
      for (const tweet of keyword.tweets) {
        if (tweet.username) {
          const username = tweet.username.toLowerCase();
          
          if (!accountStats[username]) {
            accountStats[username] = {
              username: tweet.username,
              tweets: 0,
              totalLikes: 0,
              totalRetweets: 0,
              totalReplies: 0,
              keywords: new Set(),
              firstTweet: tweet.createdAt,
              lastTweet: tweet.createdAt
            };
          }
          
          const account = accountStats[username];
          account.tweets++;
          account.totalLikes += tweet.likes || 0;
          account.totalRetweets += tweet.retweets || 0;
          account.totalReplies += tweet.replies || 0;
          account.keywords.add(keyword.text);
          
          if (tweet.createdAt < account.firstTweet) {
            account.firstTweet = tweet.createdAt;
          }
          if (tweet.createdAt > account.lastTweet) {
            account.lastTweet = tweet.createdAt;
          }
        }
        
        processedTweets++;
        
        // 進捗報告
        if (onProgress && processedTweets % 100 === 0) {
          onProgress((processedTweets / totalTweets) * 100);
          await new Promise(resolve => setTimeout(resolve, 1));
        }
      }
    }
  }
  
  // Setを配列に変換
  Object.values(accountStats).forEach(account => {
    account.keywords = Array.from(account.keywords);
    account.avgLikes = account.tweets > 0 ? Math.round(account.totalLikes / account.tweets) : 0;
    account.avgRetweets = account.tweets > 0 ? Math.round(account.totalRetweets / account.tweets) : 0;
    account.avgReplies = account.tweets > 0 ? Math.round(account.totalReplies / account.tweets) : 0;
  });
  
  return Object.values(accountStats);
}

/**
 * アカウントパネルを更新
 */
function updateAccountsPanel() {
  const keywords = Object.values(keywordManager.keywords);
  
  // 非同期で更新
  setTimeout(async () => {
    await updateAccountsPanelInner(keywords, currentAccountKeywordFilter, currentAccountSortType, true);
  }, 10);
}

/**
 * アカウントパネル内部更新処理
 */
async function updateAccountsPanelInner(keywords, selectedKeywordId, sortType, useAsync = false) {
  try {
    showAccountsLoading();
    
    let accountStats;
    if (useAsync) {
      accountStats = await analyzeAccountStats(keywords, selectedKeywordId, (progress) => {
        // 進捗表示を更新可能
      });
    } else {
      accountStats = analyzeAccountStatsSync(keywords, selectedKeywordId);
    }
    
    // ソート
    accountStats.sort((a, b) => {
      switch (sortType) {
        case 'tweets':
          return b.tweets - a.tweets;
        case 'likes':
          return b.totalLikes - a.totalLikes;
        case 'retweets':
          return b.totalRetweets - a.totalRetweets;
        case 'username':
          return a.username.localeCompare(b.username);
        default:
          return b.tweets - a.tweets;
      }
    });
    
    // キーワードフィルター更新
    updateAccountKeywordFilter(keywords);
    
    // データが無い場合はメッセージを表示
    if (accountStats.length === 0) {
      const accountsList = document.getElementById('accountsList');
      if (accountsList) {
        accountsList.innerHTML = `
          <div style="text-align: center; padding: 40px; color: #8b98a5;">
            <div style="font-size: 48px; margin-bottom: 16px;">👥</div>
            <div style="font-size: 16px; margin-bottom: 8px;">アカウントデータがありません</div>
            <div style="font-size: 14px;">キーワード検索を開始すると、ここにアカウント分析が表示されます。</div>
          </div>
        `;
      }
    } else {
      // 表示
      await displayAccountsList(accountStats);
    }
    
    hideAccountsLoading();
    
  } catch (error) {
    addLogEntry(`アカウント分析エラー: ${error.message}`, 'error');
    hideAccountsLoading();
  }
}

/**
 * アカウントキーワードフィルター更新
 */
function updateAccountKeywordFilter(keywords) {
  const filterContainer = document.getElementById('accountKeywordFilter');
  if (!filterContainer) return;

  filterContainer.innerHTML = `
    <button class="filter-btn ${currentAccountKeywordFilter === 'all' ? 'active' : ''}" 
            onclick="setAccountKeywordFilter('all')">
      すべて
    </button>
  `;

  keywords.forEach((keyword, index) => {
    if (keyword.stats.totalTweets > 0) {
      const btn = document.createElement('button');
      btn.className = 'filter-btn';
      if (currentAccountKeywordFilter === keyword.id) {
        btn.classList.add('active');
      }
      btn.onclick = () => setAccountKeywordFilter(keyword.id);
      btn.innerHTML = `K${index + 1}: ${keyword.text}`;
      btn.style.marginLeft = '8px';
      filterContainer.appendChild(btn);
    }
  });
}

/**
 * アカウント一覧を表示
 */
async function displayAccountsList(accountStats) {
  if (accountStats.length > 500) {
    await displayAccountsListChunked(accountStats);
  } else {
    displayAccountsListSimple(accountStats);
  }
}

/**
 * アカウント一覧を表示（チャンク処理）
 */
async function displayAccountsListChunked(accountStats) {
  const accountsList = document.getElementById('accountsList');
  if (!accountsList) return;

  accountsList.innerHTML = '';
  showAccountsListLoading();

  const chunkSize = 50;
  for (let i = 0; i < accountStats.length; i += chunkSize) {
    const chunk = accountStats.slice(i, i + chunkSize);
    const chunkHTML = chunk.map((account, index) => 
      createAccountHTML(account, i + index)
    ).join('');
    
    accountsList.insertAdjacentHTML('beforeend', chunkHTML);
    
    // UI更新のため少し待機
    if (i + chunkSize < accountStats.length) {
      await new Promise(resolve => setTimeout(resolve, 5));
    }
  }

  hideAccountsListLoading();
  setupAccountItemListeners();
}

/**
 * アカウント一覧を表示（シンプル）
 */
function displayAccountsListSimple(accountStats) {
  const accountsList = document.getElementById('accountsList');
  if (!accountsList) return;

  const html = accountStats.map((account, index) => 
    createAccountHTML(account, index)
  ).join('');
  
  accountsList.innerHTML = html;
  setupAccountItemListeners();
}

/**
 * アカウントHTMLを生成
 */
function createAccountHTML(accountData, index) {
  const rankBadgeColor = index < 3 ? ['#ffd700', '#c0c0c0', '#cd7f32'][index] : '#4a5568';
  const rank = index + 1;
  
  return `
    <div class="account-item" style="
      background: #253341; 
      border-radius: 8px; 
      padding: 16px; 
      margin-bottom: 8px;
      border-left: 4px solid #1da1f2;
    ">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <div style="display: flex; align-items: center;">
          <span style="
            background: ${rankBadgeColor};
            color: ${index < 3 ? '#000' : '#fff'};
            padding: 4px 8px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: bold;
            margin-right: 12px;
          ">#${rank}</span>
          <strong style="color: #ffffff; font-size: 16px;">@${accountData.username}</strong>
        </div>
        <div style="text-align: right;">
          <div style="color: #1da1f2; font-weight: bold; font-size: 14px;">
            ${accountData.tweets.toLocaleString()}ツイート
          </div>
          <div style="color: #8b98a5; font-size: 11px;">
            ${accountData.keywords.length}キーワード
          </div>
        </div>
      </div>
      
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 12px;">
        <div style="text-align: center; background: #1a202c; padding: 8px; border-radius: 6px;">
          <div style="color: #f56565; font-weight: bold; font-size: 14px;">
            ❤️ ${accountData.totalLikes.toLocaleString()}
          </div>
          <div style="color: #8b98a5; font-size: 10px;">
            平均${accountData.avgLikes}
          </div>
        </div>
        <div style="text-align: center; background: #1a202c; padding: 8px; border-radius: 6px;">
          <div style="color: #48bb78; font-weight: bold; font-size: 14px;">
            🔄 ${accountData.totalRetweets.toLocaleString()}
          </div>
          <div style="color: #8b98a5; font-size: 10px;">
            平均${accountData.avgRetweets}
          </div>
        </div>
        <div style="text-align: center; background: #1a202c; padding: 8px; border-radius: 6px;">
          <div style="color: #ed8936; font-weight: bold; font-size: 14px;">
            💬 ${accountData.totalReplies.toLocaleString()}
          </div>
          <div style="color: #8b98a5; font-size: 10px;">
            平均${accountData.avgReplies}
          </div>
        </div>
      </div>
      
      <div style="margin-bottom: 8px;">
        <div style="color: #8b98a5; font-size: 11px; margin-bottom: 4px;">関連キーワード:</div>
        <div style="display: flex; flex-wrap: wrap; gap: 4px;">
          ${accountData.keywords.map(keyword => `
            <span style="
              background: #4a5568;
              color: #ffffff;
              padding: 2px 6px;
              border-radius: 10px;
              font-size: 10px;
            ">${keyword}</span>
          `).join('')}
        </div>
      </div>
      
      <div style="display: flex; justify-content: space-between; align-items: center; color: #8b98a5; font-size: 11px;">
        <span>初回: ${new Date(accountData.firstTweet).toLocaleDateString('ja-JP')}</span>
        <span>最新: ${new Date(accountData.lastTweet).toLocaleDateString('ja-JP')}</span>
      </div>
    </div>
  `;
}

/**
 * アカウントアイテムリスナー設定
 */
function setupAccountItemListeners() {
  const accountItems = document.querySelectorAll('.account-item');
  accountItems.forEach(item => {
    item.addEventListener('click', function() {
      const username = this.querySelector('strong').textContent.replace('@', '');
      window.open(`https://twitter.com/${username}`, '_blank');
    });
  });
}

/**
 * アカウントキーワードフィルター設定
 */
function setAccountKeywordFilter(filterId) {
  currentAccountKeywordFilter = filterId;
  updateAccountsPanel();
}

/**
 * アカウントソート設定
 */
function setAccountSort(sortType) {
  currentAccountSortType = sortType;
  
  // ソートボタンのアクティブ状態を更新
  document.querySelectorAll('.account-sort-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  document.querySelector(`[onclick="setAccountSort('${sortType}')"]`)?.classList.add('active');
  
  updateAccountsPanel();
}

/**
 * アカウントローディング表示
 */
function showAccountsLoading() {
  const loadingDiv = document.getElementById('accountsLoading');
  if (loadingDiv) {
    loadingDiv.style.display = 'flex';
  }
}

/**
 * アカウントローディング非表示
 */
function hideAccountsLoading() {
  const loadingDiv = document.getElementById('accountsLoading');
  if (loadingDiv) {
    loadingDiv.style.display = 'none';
  }
}

/**
 * アカウント一覧ローディング表示
 */
function showAccountsListLoading() {
  const loadingDiv = document.getElementById('accountsListLoading');
  if (loadingDiv) {
    loadingDiv.style.display = 'flex';
  }
}

/**
 * アカウント一覧ローディング非表示
 */
function hideAccountsListLoading() {
  const loadingDiv = document.getElementById('accountsListLoading');
  if (loadingDiv) {
    loadingDiv.style.display = 'none';
  }
}