// ========================================================
// 自転車競合店調査 AI - メインアプリケーションロジック
// ========================================================

document.addEventListener(DOMContentLoaded, () => {
  // Lucideアイコンの初期化
  if (window.lucide) {
    window.lucide.createIcons();
  }

  // --- DOM要素 ---
  const inputApiKey = document.getElementById(input-api-key);
  const btnSaveKey = document.getElementById(btn-save-key);
  const apiKeyBanner = document.getElementById(api-key-banner);
  const inputStoreName = document.getElementById(input-store-name);
  const inputSurveyDate = document.getElementById(input-survey-date);
  const selectModel = document.getElementById(select-model);

  const dropZone = document.getElementById(drop-zone);
  const fileInput = document.getElementById(file-input);
  const selectedFileInfo = document.getElementById(selected-file-info);
  const fileNameDisplay = document.getElementById(file-name);
  const fileSizeDisplay = document.getElementById(file-size);
  const btnStartAnalysis = document.getElementById(btn-start-analysis);

  const progressCard = document.getElementById(progress-card);
  const progressTitle = document.getElementById(progress-title);
  const progressDesc = document.getElementById(progress-desc);
  const progressBar = document.getElementById(progress-bar);
  const progressPercent = document.getElementById(progress-percent);
  const progressLog = document.getElementById(progress-log);

  const resultCard = document.getElementById(result-card);
  const tableBody = document.getElementById(table-body);
  const badgeTotalCount = document.getElementById(badge-total-count);
  const resultMetaInfo = document.getElementById(result-meta-info);
  const summaryTotalQty = document.getElementById(summary-total-qty);
  const summarySkuCount = document.getElementById(summary-sku-count);
  const summaryEbikeRatio = document.getElementById(summary-ebike-ratio);
  const summaryAvgPrice = document.getElementById(summary-avg-price);

  const btnExportExcel = document.getElementById(btn-export-excel);
  const btnExportCsv = document.getElementById(btn-export-csv);

  // --- 状態変数 ---
  let selectedFile = null;
  let currentResults = [];

  // --- 初期化: 今日の日付をセット ---
  const today = new Date().toISOString().split(T)[0];
  inputSurveyDate.value = today;

  // --- 初期化: APIキーの読み込み ---
  const savedKey = localStorage.getItem(gemini_api_key);
  if (savedKey) {
    inputApiKey.value = savedKey;
    apiKeyBanner.classList.add(bg-emerald-50, border-emerald-200);
    apiKeyBanner.classList.remove(bg-amber-50, border-amber-200);
  }

  // APIキー保存
  btnSaveKey.addEventListener(click, () => {
    const key = inputApiKey.value.trim();
    if (key) {
      localStorage.setItem(gemini_api_key, key);
      alert(APIキーをブラウザに安全に保存しました！);
      apiKeyBanner.classList.add(bg-emerald-50, border-emerald-200);
      apiKeyBanner.classList.remove(bg-amber-50, border-amber-200);
      updateStartButtonState();
    } else {
      localStorage.removeItem(gemini_api_key);
      alert(APIキーをクリアしました。);
      apiKeyBanner.classList.remove(bg-emerald-50, border-emerald-200);
      apiKeyBanner.classList.add(bg-amber-50, border-amber-200);
      updateStartButtonState();
    }
  });

  // --- ファイル選択・ドラッグ＆ドロップ ---
  dropZone.addEventListener(click, () => fileInput.click());

  dropZone.addEventListener(dragover, (e) => {
    e.preventDefault();
    dropZone.classList.add(dragover);
  });

  dropZone.addEventListener(dragleave, () => {
    dropZone.classList.remove(dragover);
  });

  dropZone.addEventListener(drop, (e) => {
    e.preventDefault();
    dropZone.classList.remove(dragover);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  });

  fileInput.addEventListener(change, (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileSelected(e.target.files[0]);
    }
  });

  function handleFileSelected(file) {
    if (!file.type.startsWith(video/) && !file.name.match(/\.(mp4|mov|webm)$/i)) {
      alert(動画ファイル（MP4 / MOV / WEBM）を選択してください。);
      return;
    }
    selectedFile = file;
    fileNameDisplay.textContent = file.name;
    fileSizeDisplay.textContent = ( MB);
    selectedFileInfo.classList.remove(hidden);
    updateStartButtonState();
  }

  function updateStartButtonState() {
    const hasKey = !!inputApiKey.value.trim() || !!localStorage.getItem(gemini_api_key);
    const hasFile = !!selectedFile;
    btnStartAnalysis.disabled = !(hasKey && hasFile);
  }

  // --- ログ・進捗ユーティリティ ---
  function updateProgress(percent, title, desc, logMsg) {
    progressBar.style.width = ${percent}%;
    progressPercent.textContent = ${percent}%;
    if (title) progressTitle.textContent = title;
    if (desc) progressDesc.textContent = desc;
    if (logMsg) {
      const time = new Date().toLocaleTimeString();
      progressLog.innerHTML += <div><span class=text-slate-400>[]</span> </div>;
      progressLog.scrollTop = progressLog.scrollHeight;
    }
  }

  // --- 解析プロセスの実行 ---
  btnStartAnalysis.addEventListener(click, async () => {
    const apiKey = inputApiKey.value.trim() || localStorage.getItem(gemini_api_key);
    if (!apiKey) {
      alert(APIキーを入力してください。);
      return;
    }
    if (!selectedFile) {
      alert(動画ファイルを選択してください。);
      return;
    }

    // UI初期化
    btnStartAnalysis.disabled = true;
    progressCard.classList.remove(hidden);
    resultCard.classList.add(hidden);
    progressLog.innerHTML = ";
 updateProgress(5, 準備中..., 動画ファイルの読み込みと検証を行っています, 解析パイプラインを開始しました);

 try {
 // STEP 1: Gemini Files API へ動画アップロード
 updateProgress(15, 動画をアップロード中..., ファイルサイズ: MB, Google Gemini Files API へアップロード開始...);
 
 const fileData = await uploadToGeminiFilesApi(selectedFile, apiKey, (upPercent) => {
 const mapped = Math.floor(15 + (upPercent * 0.4)); // 15% ~ 55%
 updateProgress(mapped, 動画をアップロード中..., 送信中: % 完了, null);
 });

 updateProgress(60, クラウド処理完了待機中..., Google側で動画のインデックスを作成しています, アップロード完了 (File URI: ));

 // STEP 2: 動画の処理状態（ACTIVE）を待機
 await waitForFileActive(fileData.file.name, apiKey);
 updateProgress(75, AIマルチモーダル解析中..., Gemini 3.7 Flash が値札POPと車種を検出中..., モデル呼び出し中: POP文字・価格・年式・台数の時系列構造化抽出を実行中);

 // STEP 3: Gemini generateContent で構造化抽出
 const modelName = selectModel.value || gemini-3.7-flash;
 const surveyData = await generateSurveyData(fileData.file.uri, modelName, apiKey);

 updateProgress(95, 結果集計中..., 名寄せとデータ整形を行っています, 解析完了: 合計 件のSKUを検出);

 // STEP 4: 結果の描画
 currentResults = surveyData.bikes || [];
 renderResults(currentResults);

 updateProgress(100, 完了！, Excel出力の準備が整いました, 全プロセスが正常に完了しました！);
 setTimeout(() => {
 progressCard.classList.add(hidden);
 resultCard.classList.remove(hidden);
 }, 800);

 } catch (err) {
 console.error(err);
 updateProgress(0, エラーが発生しました, err.message, <span class=text-rose-600 font-bold>エラー: </span>);
 alert(解析中にエラーが発生しました:\n);
 } finally {
 btnStartAnalysis.disabled = false;
 }
 });

 // --- Gemini Files API アップロード関数 ---
 async function uploadToGeminiFilesApi(file, apiKey, onProgress) {
 // 1. Resumable Upload の初期化リクエスト
 const initUrl = https://generativelanguage.googleapis.com/upload/v1beta/files?key=;
 const initResponse = await fetch(initUrl, {
 method: POST,
 headers: {
 X-Goog-Upload-Protocol: resumable,
 X-Goog-Upload-Command: start,
 X-Goog-Upload-Header-Content-Length: file.size.toString(),
 X-Goog-Upload-Header-Content-Type: file.type || video/mp4,
 Content-Type: application/json
 },
 body: JSON.stringify({
 file: {
 display_name: file.name
 }
 })
 });

 if (!initResponse.ok) {
 const errText = await initResponse.text();
 throw new Error(アップロード初期化エラー (): );
 }

 const uploadUrl = initResponse.headers.get(X-Goog-Upload-URL);
 if (!uploadUrl) {
 throw new Error(アップロードURLの取得に失敗しました。);
 }

 // 2. 実際のバイナリデータを送信
 const uploadResponse = await fetch(uploadUrl, {
 method: POST,
 headers: {
 X-Goog-Upload-Offset: 0,
 X-Goog-Upload-Command: upload, finalize,
 Content-Length: file.size.toString()
 },
 body: file
 });

 if (!uploadResponse.ok) {
 const errText = await uploadResponse.text();
 throw new Error(動画データ送信エラー (): );
 }

 return await uploadResponse.json();
 }

 // --- ファイルACTIVE待機関数 ---
 async function waitForFileActive(fileName, apiKey) {
 const checkUrl = https://generativelanguage.googleapis.com/v1beta/?key=;
 for (let i = 0; i < 60; i++) { // 最大5分待機
 const res = await fetch(checkUrl);
 if (res.ok) {
 const data = await res.json();
 if (data.state === ACTIVE) {
 return true;
 } else if (data.state === FAILED) {
 throw new Error(Googleクラウド側での動画処理に失敗しました。);
 }
 }
 await new Promise(r => setTimeout(r, 4000));
 }
 throw new Error(動画処理の待機時間がタイムアウトしました。);
 }

 // --- Gemini 構造化生成リクエスト ---
 async function generateSurveyData(fileUri, model, apiKey) {
 const url = https://generativelanguage.googleapis.com/v1beta/models/:generateContent?key=;
 
 const prompt = 
 あなたは自転車小売業の競合店舗調査の専門エキスパートです。
 この動画は自転車売場の通路を歩いて撮影したものです。
 動画内に映っているすべての自転車の【値札・プライスカードPOP】を時系列で読み取り、
 重複を排除して全商品の詳細情報を漏れなく抽出してください。

 【抽出項目】
 1. category: 大分類（電動アシスト / シティ・ファミリー / スポーツ・クロス / キッズ・ジュニア / 折りたたみ・ミニベロ / その他）
 2. maker: メーカー（パナソニック / ブリヂストン / ヤマハ / GIANT / あさひPB / その他）
 3. model_name: 車種名・モデル名（例: ビビ・DX, ステップクルーズe, パス ウィズ等）
 4. model_code: 型番/品番（POPに記載があれば。例: BE-ELD636, ST6B42等）
 5. model_year: 年式（例: 2024年, 2023年型落ち, 不明）
 6. price_tax_included: 税込価格（数値・円）
 7. price_tax_excluded: 税抜価格（数値・円）
 8. quantity: 展示台数（同モデル・同価格の並び台数）
 9. spec_notes: 仕様・セールPOPメモ（例: 16.0Ah、内装3段、台数限定特価等）
 10. timestamp: 動画内で出現した時間（例: 01:23）

 【ルール】
 ・同一の自転車が複数秒にわたって連続して映っている場合は、重複して別レコードにせず1件にまとめてください。
 ・価格はPOPに記載された数値を確実に拾ってください。
 ;

 // JSON Schema の定義
 const responseSchema = {
 type: OBJECT,
 properties: {
 store_name: { type: STRING },
 survey_date: { type: STRING },
 bikes: {
 type: ARRAY,
 items: {
 type: OBJECT,
 properties: {
 category: { type: STRING },
 maker: { type: STRING },
 model_name: { type: STRING },
 model_code: { type: STRING },
 model_year: { type: STRING },
 price_tax_included: { type: INTEGER },
 price_tax_excluded: { type: INTEGER },
 quantity: { type: INTEGER },
 spec_notes: { type: STRING },
 timestamp: { type: STRING }
 },
 required: [category, maker, model_name, price_tax_included, price_tax_excluded, quantity, timestamp]
 }
 }
 },
 required: [bikes]
 };

 const response = await fetch(url, {
 method: POST,
 headers: { Content-Type: application/json },
 body: JSON.stringify({
 contents: [
 {
 parts: [
 { text: prompt },
 { file_data: { mime_type: video/mp4, file_uri: fileUri } }
 ]
 }
 ],
 generationConfig: {
 responseMimeType: application/json,
 responseSchema: responseSchema
 }
 })
 });

 if (!response.ok) {
 const errText = await response.text();
 throw new Error(AI解析エラー (): );
 }

 const resJson = await response.json();
 const candidate = resJson.candidates?.[0];
 if (!candidate || !candidate.content?.parts?.[0]?.text) {
 throw new Error(AIから有効な解析データが返却されませんでした。);
 }

 return JSON.parse(candidate.content.parts[0].text);
 }

 // --- 解析結果の描画 ---
 function renderResults(bikes) {
 tableBody.innerHTML = ;
 let totalQty = 0;
 let totalPrice = 0;
 let ebikeQty = 0;

 bikes.forEach((bike) => {
 const qty = parseInt(bike.quantity) || 1;
 const priceInc = parseInt(bike.price_tax_included) || 0;
 const priceExc = parseInt(bike.price_tax_excluded) || 0;
 totalQty += qty;
 totalPrice += priceInc * qty;

 if (bike.category && (bike.category.includes(電動) || bike.category.toLowerCase().includes(e-bike))) {
 ebikeQty += qty;
 }

 const tr = document.createElement(tr);
 tr.innerHTML = 
 <td class=px-3 py-2 whitespace-nowrap><span class=px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700></span></td>
 <td class=px-3 py-2 whitespace-nowrap font-medium text-slate-900></td>
 <td class=px-3 py-2 font-semibold text-indigo-950></td>
 <td class=px-3 py-2 font-mono text-slate-500 text-[11px]></td>
 <td class=px-3 py-2 whitespace-nowrap text-slate-600></td>
 <td class=px-3 py-2 text-right font-bold text-slate-900 whitespace-nowrap>¥</td>
 <td class=px-3 py-2 text-right text-slate-500 whitespace-nowrap>¥</td>
 <td class=px-3 py-2 text-center font-bold text-indigo-600></td>
 <td class=px-3 py-2 text-slate-500 text-[11px]></td>
 <td class=px-3 py-2 text-center font-mono text-xs text-indigo-700 bg-indigo-50/50 rounded font-semibold whitespace-nowrap></td>
 ;
 tableBody.appendChild(tr);
 });

 // サマリー更新
 badgeTotalCount.textContent = ${totalQty} 台;
 summaryTotalQty.textContent = ${totalQty} 台;
 summarySkuCount.textContent = ${bikes.length} SKU;
 summaryEbikeRatio.textContent = totalQty > 0 ? ${Math.round((ebikeQty / totalQty) * 100)} % : 0 %;
 summaryAvgPrice.textContent = totalQty > 0 ? ¥ : ¥0;

 const storeName = inputStoreName.value.trim() || 競合店舗;
 const surveyDate = inputSurveyDate.value || today;
 resultMetaInfo.textContent = 店舗名: | 調査日: | 合計展示台数: 台;
 }

 // --- Excel (.xlsx) ダウンロード機能 (SheetJS) ---
 btnExportExcel.addEventListener(click, () => {
 if (!currentResults || currentResults.length === 0) {
 alert(エクスポートするデータがありません。);
 return;
 }

 const storeName = inputStoreName.value.trim() || 競合店舗;
 const surveyDate = inputSurveyDate.value || today;

 // Excel用データ成形
 const excelRows = currentResults.map(b => ({
 カテゴリ: b.category || ,
 メーカー: b.maker || ,
 車種名・モデル名: b.model_name || ,
 型番/品番: b.model_code || ,
 年式: b.model_year || 不明,
 税込価格(円): parseInt(b.price_tax_included) || 0,
 税抜価格(円): parseInt(b.price_tax_excluded) || 0,
 台数: parseInt(b.quantity) || 1,
 特記事項・POP: b.spec_notes || ,
 確認時間: b.timestamp || 
 }));

 const ws = XLSX.utils.json_to_sheet(excelRows);

 // 列幅の自動調整
 ws[!cols] = [
 { wch: 16 }, // カテゴリ
 { wch: 16 }, // メーカー
 { wch: 26 }, // 車種名
 { wch: 16 }, // 型番
 { wch: 10 }, // 年式
 { wch: 14 }, // 税込価格
 { wch: 14 }, // 税抜価格
 { wch: 8 }, // 台数
 { wch: 24 }, // 特記事項
 { wch: 12 } // 確認時間
 ];

 const wb = XLSX.utils.book_new();
 XLSX.utils.book_append_sheet(wb, ws, 競合店調査結果);

 // ファイル保存
 const fileName = 競合店調査結果__.xlsx;
 XLSX.writeFile(wb, fileName);
 });

 // --- CSV ダウンロード機能 ---
 btnExportCsv.addEventListener(click, () => {
 if (!currentResults || currentResults.length === 0) {
 alert(エクスポートするデータがありません。);
 return;
 }

 const storeName = inputStoreName.value.trim() || 競合店舗;
 const surveyDate = inputSurveyDate.value || today;

 const headers = [カテゴリ, メーカー, 車種名・モデル名, 型番/品番, 年式, 税込価格, 税抜価格, 台数, 特記事項・POP, 確認時間];
 const rows = currentResults.map(b => [
 ,
 ,
 ,
 ,
 ,
 parseInt(b.price_tax_included) || 0,
 parseInt(b.price_tax_excluded) || 0,
 parseInt(b.quantity) || 1,
 ,
 
 ]);

 const csvContent = \uFEFF + [headers.join(,), ...rows.map(r => r.join(,))].join(\r\n);
 const blob = new Blob([csvContent], { type: text/csv;charset=utf-8; });
 const link = document.createElement(a);
 link.href = URL.createObjectURL(blob);
 link.download = 競合店調査結果__.csv;
 link.click();
 });

 function escapeHtml(str) {
 if (!str) return ;
 return String(str)
 .replace(/&/g, &amp;)
 .replace(/</g, &lt;)
 .replace(/>/g, &gt;)
 .replace(//g, &quot;)
      .replace(/'/g, &#039;);
  }
});
