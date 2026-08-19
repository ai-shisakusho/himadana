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
- 外部APIなし（Cloudflare Web Analyticsの計測スクリプトのみ利用）

## ローカル確認

`index.html` をブラウザで開くだけでも動きます。

HTTPサーバーで確認する場合:

```bash
python -m http.server 8000
```

その後 `http://localhost:8000/` を開きます。

## セキュリティ / プライバシー

- 登録データはブラウザのlocalStorageのみ
- 行動データの外部送信なし。アクセス解析のみCloudflare Web Analyticsへ送信
- ユーザー入力はDOM APIの`textContent`で表示
- APIキーなし。外部読み込みはCloudflare Web Analyticsの公式スクリプトのみ
