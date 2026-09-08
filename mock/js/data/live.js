'use strict';
/* mock/js/data/live.js — LIVE（Dify 上の本番アプリへの公開 URL）
   設計書 docs/handoff/2026-09-08-live-links.md。CLAUDE.md §2-3（js/data/** は純粋なリテラルのみ）・§2-10（公開範囲）。
   ここに書いてよいのは cloud-master（data/world/ の架空データしか入っていない環境）の公開 Web アプリ URL だけ。
   顧客の実データが入る環境（inhouse / customer-a）の URL は絶対に書かない。 */

const LIVE = {
  // '<内部 id>': { url: '<https:// で始まる公開 Web アプリ URL>', env: 'cloud-master', updated: 'YYYY-MM-DD' },
};
