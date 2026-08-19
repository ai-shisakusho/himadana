# Prototype 005 — 暇だな。

暇なときに「やりたいのに後回しにしていること」を1つ決めて、そのままタイマーを始めるWebアプリです。

## Ver.0.2

- サンプル行動を初期登録
- 行動の追加・編集・削除・ON/OFF
- 5 / 15 / 30 / 60分から暇時間を選択
- 時間内にできる行動をランダム提案
- 10秒カウントダウン＋3段階の文言・背景・CSSキャラクター変化
- 「別のを出す」3回目以降のツッコミ
- 決定後タイマー開始
- 一時停止・再開・中止
- 完了回数と今日の達成数をlocalStorageへ保存
- 完了後「まだ暇？ もう一回」
- 候補0件時の専用案内画面
- 削除・初期化・タイマー中止はアプリ内確認ダイアログ

## 技術

- HTML
- CSS
- JavaScript
- localStorage
- 外部ライブラリ / APIなし

## ローカル確認

`index.html` をブラウザで開くだけでも動きます。

HTTPサーバーで確認する場合:

```bash
python -m http.server 8000
```

その後 `http://localhost:8000/` を開きます。

## セキュリティ / プライバシー

- 登録データはブラウザのlocalStorageのみ
- 外部送信なし
- ユーザー入力はDOM APIの`textContent`で表示
- 外部CDN・APIキーなし

## アイコン

- `favicon.ico`：ブラウザ用favicon
- `favicon-16x16.png` / `favicon-32x32.png`：小サイズfavicon
- `apple-touch-icon.png`：iOSホーム画面用
- `icon-192.png` / `icon-512.png`：通常アプリアイコン
- `icon-maskable-192.png` / `icon-maskable-512.png`：Android等のmaskable用
- `site.webmanifest`：Web App Manifest
- `icon-source.png` / `icon-maskable-source.png`：元画像
