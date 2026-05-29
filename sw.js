// Service Worker - サンプル依頼フォーム
// バージョンを上げると古いキャッシュが自動更新されます
const CACHE_VERSION = 'v3';
const CACHE_NAME = 'sample-form-' + CACHE_VERSION;

// ============================================================
// インストール時：HTMLだけ確実にキャッシュ
// （パス問題を避けるため相対パスを使わず動的に解決する）
// ============================================================
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      // sw.jsと同じディレクトリのindex.htmlをキャッシュ
      var baseUrl = self.location.href.replace('sw.js', '');
      var filesToCache = [
        baseUrl + 'index.html',
        baseUrl + 'manifest.json',
        'https://cdnjs.cloudflare.com/ajax/libs/encoding-japanese/2.1.0/encoding.min.js',
      ];
      console.log('[SW] キャッシュ対象:', filesToCache);
      // 個別にキャッシュして1つ失敗しても続行
      return Promise.allSettled(
        filesToCache.map(function(url) {
          return cache.add(url).catch(function(err) {
            console.warn('[SW] キャッシュ失敗（続行）:', url, err);
          });
        })
      );
    }).then(function() {
      console.log('[SW] インストール完了');
      return self.skipWaiting();
    })
  );
});

// ============================================================
// アクティベート時：古いキャッシュを全削除
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
      console.log('[SW] アクティベート完了');
      return self.clients.claim();
    })
  );
});

// ============================================================
// フェッチ：キャッシュ優先、なければネットワーク
// ============================================================
self.addEventListener('fetch', function(event) {
  if (event.request.method !== 'GET') return;

  // chrome-extension等は無視
  if (!event.request.url.startsWith('http')) return;

  event.respondWith(
    caches.match(event.request).then(function(cached) {
      if (cached) {
        // キャッシュがあればそれを返しつつバックグラウンドで更新
        event.waitUntil(
          fetch(event.request).then(function(response) {
            if (response && response.status === 200) {
              return caches.open(CACHE_NAME).then(function(cache) {
                return cache.put(event.request, response);
              });
            }
          }).catch(function() {})
        );
        return cached;
      }
      // キャッシュなし → ネットワーク取得してキャッシュ保存
      return fetch(event.request).then(function(response) {
        if (!response || response.status !== 200) return response;
        var clone = response.clone();
        caches.open(CACHE_NAME).then(function(cache) {
          cache.put(event.request, clone);
        });
        return response;
      }).catch(function(err) {
        console.warn('[SW] ネットワーク取得失敗:', event.request.url, err);
        // HTMLへのリクエストがオフラインで失敗した場合はキャッシュのindex.htmlを返す
        if (event.request.headers.get('accept') &&
            event.request.headers.get('accept').includes('text/html')) {
          var baseUrl = self.location.href.replace('sw.js', '');
          return caches.match(baseUrl + 'index.html');
        }
      });
    })
  );
});
