// Authorization トークンを保存する変数
let cachedAuthToken = null;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

  if (message.type === "replay-request") {
    // リクエストヘッダーからAuthorizationトークンを抽出して保存
    if (message.headers && message.headers.authorization && message.headers.authorization.startsWith('Bearer ')) {
      cachedAuthToken = message.headers.authorization;
    }

    fetch(message.url, {
      method: message.method,
      headers: message.headers,
      body: message.body,
      credentials: "include"
    }).then(async (res) => {
      const text = await res.text();  // または res.json()
      const headers = {};
      res.headers.forEach((value, key) => {
        headers[key] = value;
      });

      sendResponse({
        success: true,
        response: text,
        headers: headers,
        status: res.status
      });
    }).catch((err) => {
      console.error("[onMessage] fetch エラー:", err);
      sendResponse({ success: false, error: err.toString() });
    });

    return true;
  }

  if (message.type === "favorite-tweet-api") {
    // DeclarativeNetRequestルールでOriginヘッダーを書き換える
    const ruleId = 1001;
    
    chrome.declarativeNetRequest.updateDynamicRules({
      addRules: [{
        id: ruleId,
        priority: 1,
        action: {
          type: 'modifyHeaders',
          requestHeaders: [
            { header: 'origin', operation: 'set', value: 'https://x.com' },
            { header: 'sec-fetch-site', operation: 'set', value: 'same-origin' }
          ]
        },
        condition: {
          urlFilter: '||x.com/i/api/graphql/*/FavoriteTweet',
          resourceTypes: ['xmlhttprequest']
        }
      }],
      removeRuleIds: [ruleId]
    }, () => {
      const apiUrl = 'https://x.com/i/api/graphql/lI07N6Otwv1PhnEgXILM7A/FavoriteTweet';
      const payload = {
        variables: { tweet_id: message.tweetId },
        queryId: "lI07N6Otwv1PhnEgXILM7A"
      };

      // クッキーを取得してCSRFトークンを抽出
      chrome.cookies.getAll({ domain: ".x.com" }, (cookies) => {
        const csrfCookie = cookies.find(cookie => cookie.name === 'ct0');
        const csrfToken = csrfCookie ? csrfCookie.value : '';
        
        if (!csrfToken) {
          sendResponse({ 
            success: false, 
            message: 'CSRFトークンが見つかりません',
            details: 'X.comにログインしているかご確認ください'
          });
          return;
        }

        // Authorization トークンが取得されていない場合
        if (!cachedAuthToken) {
          sendResponse({ 
            success: false, 
            message: 'Authorizationトークンがありません',
            details: '先にツイート検索を実行してください'
          });
          return;
        }

        // ランダムなtransaction IDを生成
        const generateTransactionId = () => {
          const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
          let result = '';
          for (let i = 0; i < 120; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
          }
          return result;
        };

        const headers = {
          'accept': '*/*',
          'content-type': 'application/json',
          'referer': 'https://x.com/',
          'x-client-transaction-id': generateTransactionId(),
          'x-csrf-token': csrfToken,
          'authorization': cachedAuthToken,
          'x-twitter-active-user': 'yes',
          'x-twitter-auth-type': 'OAuth2Session',
          'x-twitter-client-language': 'ja'
        };

        fetch(apiUrl, {
          method: 'POST',
          headers: headers,
          body: JSON.stringify(payload),
          credentials: 'include'
        }).then(async (response) => {
          // ルールをクリーンアップ
          chrome.declarativeNetRequest.updateDynamicRules({
            removeRuleIds: [ruleId]
          });
          
          const responseText = await response.text();
          let success = response.ok;
          let message = `ステータス: ${response.status}`;
          
          // すでにいいね済みの場合も成功とみなす
          if (responseText.includes('has already favorited tweet')) {
            success = true;
            message += ' (既にいいね済み)';
          }
          
          sendResponse({
            success: success,
            message: message,
            details: `レスポンス: ${responseText.substring(0, 200)}${responseText.length > 200 ? '...' : ''}`
          });
        }).catch((error) => {
          // ルールをクリーンアップ
          chrome.declarativeNetRequest.updateDynamicRules({
            removeRuleIds: [ruleId]
          });
          
          sendResponse({
            success: false,
            message: `エラー: ${error.message}`,
            details: error.toString()
          });
        });
      });
    });

    return true;
  }

  if (message.action === 'openPage' && message.url && message.tabId) {
    chrome.tabs.update(message.tabId, { url: message.url });
  }
});