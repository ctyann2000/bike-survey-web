# 🚲 自転車競合店調査 AI (Bike Survey AI)

> **4K動画ウォークスルー撮影 ➔ Gemini 3.7 Flash AI解析 ➔ Excel自動出力 Webアプリケーション**

自転車小売業における500〜700台規模のメガ売場を、スマホで5〜8分歩き撮りした動画から、**全車種のメーカー・型番・年式・税込/税抜価格・台数・特記事項**をAIが自動抽出し、ワンクリックで会社用Excel（`.xlsx`）を出力するWebツールです。

---

## 🌟 主な特徴

* **ブラウザ完結・インストール不要**: 会社の事務用PC（Windows/Mac）にPython等の環境構築が一切不要。ChromeやEdgeで開くだけで誰でも使えます。
* **超軽量・シンプル設計**: 画面上の重い動画プレイヤー機能を省き、大容量（1〜2GB）の4K動画でもPCの動作が重くならず、サクサク軽快に動作します。
* **「確認時間（タイムスタンプ）」機能**: 出力されるExcelシート内に各車両が映っていた秒数（例: `01:45`）が自動記録されます。価格や仕様に疑問があった際、PC標準の動画プレイヤーでその秒数を見れば即座に検証できます。
* **最新モデル Gemini 3.7 Flash 搭載**: 米粒のようなPOPの型番や年式文字も高い精度で読み取り、無料枠（Free Tier）で利用可能です。
* **GitHub Pages 完全無料ホスティング対応**: GitHubにプッシュするだけで、自社専用の社内WebアプリURLが自動発行されます。

---

## 📁 ディレクトリ構成

```
bike-survey-web/
├── index.html                  # Webアプリのメイン画面
├── style.css                   # レスポンシブ＆クリーンなUIデザイン
├── app.js                      # Gemini API連携・動画アップロード・Excel生成ロジック
├── survey_agent.py             # Python環境でバッチ実行したい場合の自律エージェント
├── requirements.txt            # Python版の依存パッケージ
├── .gitignore                  # 動画ファイルやキャッシュのGit除外設定
├── .github/workflows/deploy.yml# GitHub Pages自動デプロイ設定
└── README.md                   # 本ドキュメント
```

---

## 🚀 GitHubへの公開・デプロイ手順（初回のみ）

本プロジェクトをGitHubにアップロードして、社内全員が使えるWebアプリURLを発行する手順です。

### STEP 1: GitHubで新規リポジトリを作成
1. [GitHub (https://github.com/)](https://github.com/) にログインします。
2. 画面右上の「＋」➔ **「New repository」** をクリックします。
3. Repository name に `bike-survey-web` と入力します。
4. 公開範囲（**Private** または **Public**）を選択し、「Create repository」をクリックします。
   * ※社内利用の場合、Privateリポジトリを推奨します。

### STEP 2: ローカルからGitHubへプッシュ
PCのターミナル（PowerShell等）で以下のコマンドを実行します：

```bash
cd C:\Users\ctyan\.gemini\antigravity\scratch\bike-survey-web
git init
git add .
git commit -m "feat: 自転車競合店調査 AI Webアプリ 初回リリース"
git branch -M main
git remote add origin https://github.com/<あなたのユーザー名>/bike-survey-web.git
git push -u origin main
```

### STEP 3: GitHub Pages の有効化
1. GitHubのリポジトリ画面上部の **「Settings」** タブをクリックします。
2. 左メニューの **「Pages」** をクリックします。
3. **「Build and deployment」>「Source」** で **「GitHub Actions」** を選択します。
4. 数分待つと、画面上部に専用のURL（例: `https://<あなたのユーザー名>.github.io/bike-survey-web/`）が発行されます！
   * 社内スタッフにこのURLを共有するだけで利用開始できます。

---

## 📖 社内スタッフ向け 操作マニュアル

### 1. 店頭での撮影（5〜8分）
* スマートフォンのカメラを **4K / 30fps または 60fps** に設定します。
* 値札POPが見える高さ（ハンドル〜サドル付近）にカメラを向け、通路を少しゆっくり歩き撮りします。

### 2. 会社PCでの解析（3ステップ）
1. 発行されたWebアプリのURL（またはローカルの `index.html`）をブラウザで開きます。
2. **APIキーの設定**: 初回のみ、Google AI Studio で取得した無料APIキーを入力して「保存」します（ブラウザに安全に保存され、次回以降入力不要）。
3. **動画をドロップ**: 撮影した動画ファイルをドラッグ＆ドロップし、「AI解析を開始する」をクリックします。
4. **Excelダウンロード**: 数分で解析が完了し、画面下の **「Excelダウンロード (.xlsx)」** を押すと、整然とフォーマットされた調査表がダウンロードされます！

---

## 📊 出力されるExcelの項目

| 列名 | 項目名 | 内容例 |
| :--- | :--- | :--- |
| A | カテゴリ | 電動アシスト / シティ・ファミリー / スポーツ / キッズ |
| B | メーカー | パナソニック / ブリヂストン / ヤマハ / PB等 |
| C | 車種名・モデル名 | ビビ・DX / ステップクルーズe / パス ウィズ |
| D | 型番/品番 | BE-ELD636 / ST6B42 |
| E | 年式 | 2024年 / 2023年（型落ち） / 不明 |
| F | 税込価格(円) | 128,000 |
| G | 税抜価格(円) | 116,364 |
| H | 台数 | 3 |
| I | 特記事項・POP | 台数限定特価、16.0Ah、内装3段 |
| J | **確認時間** | **01:45**（動画内で映っている時間） |
