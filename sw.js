// Service Worker - サンプル依頼フォーム
// バージョンを上げると古いキャッシュが自動更新されます
const CACHE_NAME = 'sample-form-v1';

// キャッシュするファイル一覧
const CACHE_FILES = [
  './index.html',
  './manifest.json',
  // Encoding.js（CDN）もキャッシュしてオフラインでShift-JIS出力を可能にする
  'https://cdnjs.cloudflare.com/ajax/libs/encoding-japanese/2.1.0/encoding.min.js',
];

// ============================================================
// インストール時：必要なファイルをキャッシュに保存
// ============================================================
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      console.log('[SW] キャッシュ保存中...');
      // CDNファイルはキャッシュ失敗しても続行（オフライン時はUTF-8フォールバック）
      return cache.addAll(CACHE_FILES).catch(function(err) {
        console.warn('[SW] 一部ファイルのキャッシュに失敗しました:', err);
        // HTMLだけは確実にキャッシュ
        return cache.add('./index.html');
      });
    }).then(function() {
      // 新しいSWを即座にアクティブ化
      return self.skipWaiting();
    })
  );
});

// ============================================================
// アクティベート時：古いキャッシュを削除
// ============================================================
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(key) {
          return key !== CACHE_NAME;
        }).map(function(key) {
          console.log('[SW] 古いキャッシュ削除:', key);
          return caches.delete(key);
        })
      );
    }).then(function() {
      // 全クライアントで新しいSWを即座に有効化
      return self.clients.claim();
    })
  );
});

// ============================================================
// フェッチ時：キャッシュ優先で返す（オフライン対応）
// ============================================================
self.addEventListener('fetch', function(event) {
  // POSTリクエストはキャッシュしない
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(function(cached) {
      if (cached) {
        // キャッシュあり → キャッシュを返しつつバックグラウンドで更新
        fetchAndUpdate(event.request);
        return cached;
      }
      // キャッシュなし → ネットワークから取得してキャッシュに保存
      return fetch(event.request).then(function(response) {
        if (response && response.status === 200) {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(event.request, clone);
          });
        }
        return response;
      }).catch(function() {
        // オフラインでキャッシュもない場合
        console.warn('[SW] オフライン・キャッシュなし:', event.request.url);
      });
    })
  );
});

// バックグラウンドでキャッシュを更新する
function fetchAndUpdate(request) {
  fetch(request).then(function(response) {
    if (response && response.status === 200) {
      caches.open(CACHE_NAME).then(function(cache) {
        cache.put(request, response);
      });
    }
  }).catch(function() {
    // オフライン時は何もしない
  });
}
