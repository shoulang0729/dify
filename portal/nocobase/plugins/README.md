# portal/nocobase/plugins/ — 自作プラグイン（TypeScript）

**NocoBase 固有の層。NocoBase をやめたら捨てる。** 当面は空（`.gitkeep`）。

TypeScript のプラグインを書き始めると `package-lock.json`（数百 KB〜数 MB）が入り、`portal/` の
探索範囲が広がる（設計書 `docs/handoff/2026-09-11-repo-layout-v3.md` §1-1 観点 I）。**必要になった
時点で `portal/package.json` に依存を足す**（ルートの `package.json` には足さない。S-2）。
