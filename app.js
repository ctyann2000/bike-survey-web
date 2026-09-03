// ========================================================
// 自転車競合店調査 AI - メインアプリケーションロジック
// (店舗マスターExcel連携 ＆ 差分比較対応版)
// ========================================================

document.addEventListener("DOMContentLoaded", () => {
  if (window.lucide) {
    window.lucide.createIcons();
  }

  // --- DOM要素 ---
  const inputApiKey = document.getElementById("input-api-key");
  const btnSaveKey = document.getElementById("btn-save-key");
  const apiKeyBanner = document.getElementById("api-key-banner");
  const inputStoreName = document.getElementById("input-store-name");
  const inputSurveyDate = document.getElementById("input-survey-date");
  const selectModel = document.getElementById("select-model");

  // 動画アップロード要素
  const dropZone = document.getElementById("drop-zone");
  const fileInput = document.getElementById("file-input");
  const selectedFileInfo = document.getElementById("selected-file-info");
  const fileNameDisplay = document.getElementById("file-name");
  const fileSizeDisplay = document.getElementById("file-size");
  const btnStartAnalysis = document.getElementById("btn-start-analysis");

  // 店舗マスターExcelアップロード要素
  const masterDropZone = document.getElementById("master-drop-zone");
  const masterFileInput = document.getElementById("master-file-input");
  const selectedMasterInfo = document.getElementById("selected-master-info");
  const masterFileNameDisplay = document.getElementById("master-file-name");
  const masterSkuBadge = document.getElementById("master-sku-badge");
  const btnClearMaster = document.getElementById("btn-clear-master");
  const badgeMasterStatus = document.getElementById("badge-master-status");

  // 進捗要素
  const progressCard = document.getElementById("progress-card");
  const progressTitle = document.getElementById("progress-title");
  const progressDesc = document.getElementById("progress-desc");
  const progressBar = document.getElementById("progress-bar");
  const progressPercent = document.getElementById("progress-percent");
  const progressLog = document.getElementById("progress-log");

  // 結果要素
  const resultCard = document.getElementById("result-card");
  const tableBody = document.getElementById("table-body");
  const badgeTotalCount = document.getElementById("badge-total-count");
  const resultMetaInfo = document.getElementById("result-meta-info");
  const summaryTotalQty = document.getElementById("summary-total-qty");
  const summarySkuCount = document.getElementById("summary-sku-count");
  const summaryEbikeRatio = document.getElementById("summary-ebike-ratio");
  const summaryAvgPrice = document.getElementById("summary-avg-price");

  const btnExportExcel = document.getElementById("btn-export-excel");
  const btnExportCsv = document.getElementById("btn-export-csv");

  // --- 状態変数 ---
  let selectedVideoFile = null;
  let masterDataRecords = null; // 店舗マスターExcelの行配列
  let currentResults = [];

  // --- 初期化 ---
  const today = new Date().toISOString().split("T")[0];
  inputSurveyDate.value = today;

  const savedKey = localStorage.getItem("gemini_api_key");
  if (savedKey) {
    inputApiKey.value = savedKey;
    apiKeyBanner.classList.add("bg-emerald-50", "border-emerald-200");
    apiKeyBanner.classList.remove("bg-amber-50", "border-amber-200");
  }

  btnSaveKey.addEventListener("click", () => {
    const key = inputApiKey.value.trim();
    if (key) {
      localStorage.setItem("gemini_api_key", key);
      alert("APIキーをブラウザに安全に保存しました！");
      apiKeyBanner.classList.add("bg-emerald-50", "border-emerald-200");
      apiKeyBanner.classList.remove("bg-amber-50", "border-amber-200");
    } else {
      localStorage.removeItem("gemini_api_key");
      alert("APIキーをクリアしました。");
      apiKeyBanner.classList.remove("bg-emerald-50", "border-emerald-200");
      apiKeyBanner.classList.add("bg-amber-50", "border-amber-200");
    }
    updateStartButtonState();
  });

  // ========================================================
  // 1. 動画ファイルのドラッグ＆ドロップ処理
  // ========================================================
  dropZone.addEventListener("click", () => fileInput.click());

  dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("dragover");
  });

  dropZone.addEventListener("dragleave", () => {
    dropZone.classList.remove("dragover");
  });

  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("dragover");
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleVideoSelected(e.dataTransfer.files[0]);
    }
  });

  fileInput.addEventListener("change", (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleVideoSelected(e.target.files[0]);
    }
  });

  function handleVideoSelected(file) {
    if (!file.type.startsWith("video/") && !file.name.match(/\.(mp4|mov|webm)$/i)) {
      alert("動画ファイル（MP4 / MOV / WEBM）を選択してください。");
      return;
    }
    selectedVideoFile = file;
    fileNameDisplay.textContent = file.name;
    fileSizeDisplay.textContent = `(${(file.size / (1024 * 1024)).toFixed(1)} MB)`;
    selectedFileInfo.classList.remove("hidden");
    updateStartButtonState();
  }

  // ========================================================
  // 2. 店舗マスターExcelのドラッグ＆ドロップ処理
  // ========================================================
  masterDropZone.addEventListener("click", () => masterFileInput.click());

  masterDropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    masterDropZone.classList.add("border-emerald-500", "bg-emerald-50/50");
  });

  masterDropZone.addEventListener("dragleave", () => {
    masterDropZone.classList.remove("border-emerald-500", "bg-emerald-50/50");
  });

  masterDropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    masterDropZone.classList.remove("border-emerald-500", "bg-emerald-50/50");
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleMasterFileSelected(e.dataTransfer.files[0]);
    }
  });

  masterFileInput.addEventListener("change", (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleMasterFileSelected(e.target.files[0]);
    }
  });

  async function handleMasterFileSelected(file) {
    if (!file.name.match(/\.(xlsx|xls|csv)$/i)) {
      alert("Excelファイル（.xlsx / .xls）または CSVファイルを選択してください。");
      return;
    }

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const jsonRows = XLSX.utils.sheet_to_json(worksheet);

      if (!jsonRows || jsonRows.length === 0) {
        alert("選択されたExcelシートに有効なデータ行が見つかりませんでした。");
        return;
      }

      masterDataRecords = jsonRows;
      masterFileNameDisplay.textContent = file.name;
      masterSkuBadge.textContent = `${jsonRows.length} SKU読込済`;
      selectedMasterInfo.classList.remove("hidden");
      if (window.lucide) window.lucide.createIcons();
    } catch (err) {
      console.error(err);
      alert(`マスターExcelの読み込みに失敗しました: ${err.message}`);
    }
  }

  btnClearMaster.addEventListener("click", (e) => {
    e.stopPropagation();
    masterDataRecords = null;
    masterFileInput.value = "";
    selectedMasterInfo.classList.add("hidden");
  });

  function updateStartButtonState() {
    const hasKey = !!inputApiKey.value.trim() || !!localStorage.getItem("gemini_api_key");
    const hasVideo = !!selectedVideoFile;
    btnStartAnalysis.disabled = !(hasKey && hasVideo);
  }

  // --- 進捗表示ユーティリティ ---
  function updateProgress(percent, title, desc, logMsg) {
    progressBar.style.width = `${percent}%`;
    progressPercent.textContent = `${percent}%`;
    if (title) progressTitle.textContent = title;
    if (desc) progressDesc.textContent = desc;
    if (logMsg) {
      const time = new Date().toLocaleTimeString();
      progressLog.innerHTML += `<div><span class="text-slate-400">[${time}]</span> ${logMsg}</div>`;
      progressLog.scrollTop = progressLog.scrollHeight;
    }
  }

  // ========================================================
  // 3. 解析実行パイプライン
  // ========================================================
  btnStartAnalysis.addEventListener("click", async () => {
    const apiKey = inputApiKey.value.trim() || localStorage.getItem("gemini_api_key");
    if (!apiKey) {
      alert("APIキーを入力してください。");
      return;
    }
    if (!selectedVideoFile) {
      alert("動画ファイルを選択してください。");
      return;
    }

    btnStartAnalysis.disabled = true;
    progressCard.classList.remove("hidden");
    resultCard.classList.add("hidden");
    progressLog.innerHTML = "";
    updateProgress(5, "準備中...", "動画とマスター設定の検証中", "解析パイプラインを開始しました");

    try {
      // STEP 1: 動画を Google Gemini Files API へアップロード
      updateProgress(15, "動画をアップロード中...", `ファイルサイズ: ${(selectedVideoFile.size / (1024 * 1024)).toFixed(1)}MB`, "Gemini Files API への高速アップロード開始...");
      
      const fileData = await uploadToGeminiFilesApi(selectedVideoFile, apiKey);
      updateProgress(60, "クラウド処理完了待機中...", "Google側で動画のインデックスを作成しています", `アップロード完了 (File URI: ${fileData.file.uri})`);

      // STEP 2: 動画がACTIVE状態になるまで待機
      await waitForFileActive(fileData.file.name, apiKey);
      
      const hasMaster = masterDataRecords && masterDataRecords.length > 0;
      const masterLog = hasMaster ? `マスター連携モード（${masterDataRecords.length} SKUの辞書を照合中）` : "通常モード（新規全抽出）";
      updateProgress(75, "AIマルチモーダル解析中...", "POP文字の認識とマスター照合を実行中...", `モデル呼び出し中: ${masterLog}`);

      // STEP 3: Gemini 3.7 Flash による構造化抽出
      const modelName = selectModel.value || "gemini-3.7-flash";
      const surveyData = await generateSurveyData(fileData.file.uri, modelName, apiKey, masterDataRecords);

      updateProgress(95, "結果集計中...", "価格差分とステータスの整形中", `解析完了: 合計 ${surveyData.bikes ? surveyData.bikes.length : 0} 件のSKUを検出`);

      // STEP 4: 結果の描画
      currentResults = surveyData.bikes || [];
      renderResults(currentResults, hasMaster);

      updateProgress(100, "完了！", "Excel出力の準備が整いました", "全プロセスが正常に完了しました！");
      setTimeout(() => {
        progressCard.classList.add("hidden");
        resultCard.classList.remove("hidden");
      }, 800);

    } catch (err) {
      console.error(err);
      updateProgress(0, "エラーが発生しました", err.message, `<span class="text-rose-600 font-bold">エラー: ${err.message}</span>`);
      alert(`解析中にエラーが発生しました:\n${err.message}`);
    } finally {
      btnStartAnalysis.disabled = false;
    }
  });

  // --- Files API アップロード関数 ---
  async function uploadToGeminiFilesApi(file, apiKey) {
    const initUrl = `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}`;
    const initResponse = await fetch(initUrl, {
      method: "POST",
      headers: {
        "X-Goog-Upload-Protocol": "resumable",
        "X-Goog-Upload-Command": "start",
        "X-Goog-Upload-Header-Content-Length": file.size.toString(),
        "X-Goog-Upload-Header-Content-Type": file.type || "video/mp4",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ file: { display_name: file.name } })
    });

    if (!initResponse.ok) {
      const errText = await initResponse.text();
      throw new Error(`アップロード初期化エラー (${initResponse.status}): ${errText}`);
    }

    const uploadUrl = initResponse.headers.get("X-Goog-Upload-URL");
    if (!uploadUrl) throw new Error("アップロードURLの取得に失敗しました。");

    const uploadResponse = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        "X-Goog-Upload-Offset": "0",
        "X-Goog-Upload-Command": "upload, finalize",
        "Content-Length": file.size.toString()
      },
      body: file
    });

    if (!uploadResponse.ok) {
      const errText = await uploadResponse.text();
      throw new Error(`動画データ送信エラー (${uploadResponse.status}): ${errText}`);
    }

    return await uploadResponse.json();
  }

  // --- ACTIVE待機関数 ---
  async function waitForFileActive(fileName, apiKey) {
    const checkUrl = `https://generativelanguage.googleapis.com/v1beta/${fileName}?key=${apiKey}`;
    for (let i = 0; i < 60; i++) {
      const res = await fetch(checkUrl);
      if (res.ok) {
        const data = await res.json();
        if (data.state === "ACTIVE") return true;
        if (data.state === "FAILED") throw new Error("Google側での動画処理に失敗しました。");
      }
      await new Promise(r => setTimeout(r, 4000));
    }
    throw new Error("動画処理の待機時間がタイムアウトしました。");
  }

  // --- Gemini 構造化生成リクエスト（マスター連携対応） ---
  async function generateSurveyData(fileUri, model, apiKey, masterRecords) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    let masterContext = "";
    if (masterRecords && masterRecords.length > 0) {
      // マスター情報を軽量テキストテーブル化
      const sample = masterRecords.slice(0, 300); // 最大300件を注入
      masterContext = `
      【店舗別商品マスター情報（前回調査または定番カタログ）】
      ${JSON.stringify(sample)}
      
      【マスター照合ルール】
      1. 動画内に映るPOP・値札を、上記マスターの商品（車種名・型番）と優先的に照合（名寄せ）してください。
      2. 一致した商品は正式名称を適用し、マスターの前回価格と比較して previous_price_tax_included, price_difference, status を算出してください。
      3. status は以下から判定してください:
         - 値下げ: 今回価格 < 前回価格
         - 値上げ: 今回価格 > 前回価格
         - 据置: 今回価格 == 前回価格
         - 新規追加: マスターに存在しなかった新商品
      `;
    }

    const prompt = `
    あなたは自転車小売業の競合店舗調査の専門エキスパートです。
    この動画は自転車売場の通路を歩いて撮影したものです。
    動画に映っているすべての自転車の【値札・プライスカードPOP】を時系列で読み取り、
    重複を排除して全商品の詳細情報を漏れなく抽出してください。
    ${masterContext}

    【抽出項目】
    - category: 大分類（電動アシスト / シティ・ファミリー / スポーツ・クロス / キッズ・ジュニア / 折りたたみ・ミニベロ / その他）
    - maker: メーカー（パナソニック / ブリヂストン / ヤマハ / GIANT / あさひPB / その他）
    - model_name: 車種名・モデル名
    - model_code: 型番/品番（POPに記載があれば）
    - model_year: 年式（例: 2024年, 2023年型落ち, 不明）
    - price_tax_included: 今回の税込価格（円・数値）
    - price_tax_excluded: 今回の税抜価格（円・数値）
    - previous_price_tax_included: 前回の税込価格（マスター記載の価格。不明時は今回の税込価格と同じ）
    - price_difference: 前回比差分（今回税込 - 前回税込。例: -8200、0、5000）
    - quantity: 展示台数（同モデル・同価格の並び台数）
    - status: 状態（値下げ / 値上げ / 据置 / 新規追加）
    - spec_notes: 仕様・セールPOPメモ（例: 16.0Ah、内装3段、台数限定特価等）
    - timestamp: 動画内で出現した時間（例: 01:23）

    【ルール】
    ・同一の自転車が複数秒にわたって連続して映っている場合は、重複して別レコードにせず1件にまとめてください。
    ・価格はPOPに記載された数値を確実に拾ってください。
    `;

    const responseSchema = {
      type: "OBJECT",
      properties: {
        store_name: { type: "STRING" },
        survey_date: { type: "STRING" },
        bikes: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              category: { type: "STRING" },
              maker: { type: "STRING" },
              model_name: { type: "STRING" },
              model_code: { type: "STRING" },
              model_year: { type: "STRING" },
              price_tax_included: { type: "INTEGER" },
              price_tax_excluded: { type: "INTEGER" },
              previous_price_tax_included: { type: "INTEGER" },
              price_difference: { type: "INTEGER" },
              quantity: { type: "INTEGER" },
              status: { type: "STRING" },
              spec_notes: { type: "STRING" },
              timestamp: { type: "STRING" }
            },
            required: ["category", "maker", "model_name", "price_tax_included", "price_tax_excluded", "quantity", "timestamp"]
          }
        }
      },
      required: ["bikes"]
    };

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              { file_data: { mime_type: "video/mp4", file_uri: fileUri } }
            ]
          }
        ],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: responseSchema
        }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`AI解析エラー (${response.status}): ${errText}`);
    }

    const resJson = await response.json();
    const candidate = resJson.candidates?.[0];
    if (!candidate || !candidate.content?.parts?.[0]?.text) {
      throw new Error("AIから有効な解析データが返却されませんでした。");
    }

    return JSON.parse(candidate.content.parts[0].text);
  }

  // ========================================================
  // 4. 解析結果の描画（差分表示対応）
  // ========================================================
  function renderResults(bikes, hasMaster) {
    tableBody.innerHTML = "";
    let totalQty = 0;
    let totalPrice = 0;
    let ebikeQty = 0;

    if (hasMaster) {
      badgeMasterStatus.classList.remove("hidden");
    } else {
      badgeMasterStatus.classList.add("hidden");
    }

    bikes.forEach((bike) => {
      const qty = parseInt(bike.quantity) || 1;
      const priceInc = parseInt(bike.price_tax_included) || 0;
      const diff = parseInt(bike.price_difference) || 0;
      totalQty += qty;
      totalPrice += priceInc * qty;

      if (bike.category && (bike.category.includes("電動") || bike.category.toLowerCase().includes("e-bike"))) {
        ebikeQty += qty;
      }

      // 差分バッジのスタイル
      let diffHtml = '<span class="text-slate-400 font-mono">±0</span>';
      if (diff < 0) {
        diffHtml = `<span class="text-rose-600 font-bold font-mono">▼ ¥${Math.abs(diff).toLocaleString()}</span>`;
      } else if (diff > 0) {
        diffHtml = `<span class="text-blue-600 font-bold font-mono">▲ ¥${diff.toLocaleString()}</span>`;
      }

      // ステータスバッジ
      let statusClass = "bg-slate-100 text-slate-700";
      const statusText = bike.status || (hasMaster ? "据置" : "通常");
      if (statusText === "値下げ") statusClass = "bg-rose-100 text-rose-800 font-bold";
      else if (statusText === "値上げ") statusClass = "bg-blue-100 text-blue-800 font-bold";
      else if (statusText === "新規追加") statusClass = "bg-emerald-100 text-emerald-800 font-bold";

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="px-3 py-2 whitespace-nowrap"><span class="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700">${escapeHtml(bike.category || "一般")}</span></td>
        <td class="px-3 py-2 whitespace-nowrap font-medium text-slate-900">${escapeHtml(bike.maker || "-")}</td>
        <td class="px-3 py-2 font-semibold text-indigo-950">${escapeHtml(bike.model_name || "-")}</td>
        <td class="px-3 py-2 font-mono text-slate-500 text-[11px]">${escapeHtml(bike.model_code || "-")}</td>
        <td class="px-3 py-2 whitespace-nowrap text-slate-600">${escapeHtml(bike.model_year || "不明")}</td>
        <td class="px-3 py-2 text-right font-bold text-slate-900 whitespace-nowrap">¥${priceInc.toLocaleString()}</td>
        <td class="px-3 py-2 text-right whitespace-nowrap">${diffHtml}</td>
        <td class="px-3 py-2 text-center font-bold text-indigo-600">${qty}</td>
        <td class="px-3 py-2 text-center whitespace-nowrap"><span class="px-2 py-0.5 rounded-full text-[10px] ${statusClass}">${escapeHtml(statusText)}</span></td>
        <td class="px-3 py-2 text-slate-500 text-[11px]">${escapeHtml(bike.spec_notes || "")}</td>
        <td class="px-3 py-2 text-center font-mono text-xs text-indigo-700 bg-indigo-50/50 rounded font-semibold whitespace-nowrap">${escapeHtml(bike.timestamp || "00:00")}</td>
      `;
      tableBody.appendChild(tr);
    });

    badgeTotalCount.textContent = `${totalQty} 台`;
    summaryTotalQty.textContent = `${totalQty} 台`;
    summarySkuCount.textContent = `${bikes.length} SKU`;
    summaryEbikeRatio.textContent = totalQty > 0 ? `${Math.round((ebikeQty / totalQty) * 100)} %` : "0 %";
    summaryAvgPrice.textContent = totalQty > 0 ? `¥${Math.round(totalPrice / totalQty).toLocaleString()}` : "¥0";

    const storeName = inputStoreName.value.trim() || "競合店舗";
    const surveyDate = inputSurveyDate.value || today;
    resultMetaInfo.textContent = `店舗名: ${storeName} | 調査日: ${surveyDate} | 合計展示台数: ${totalQty}台`;
  }

  // ========================================================
  // 5. Excel (.xlsx) ダウンロード機能 (差分列付き)
  // ========================================================
  btnExportExcel.addEventListener("click", () => {
    if (!currentResults || currentResults.length === 0) {
      alert("エクスポートするデータがありません。");
      return;
    }

    const storeName = inputStoreName.value.trim() || "競合店舗";
    const surveyDate = inputSurveyDate.value || today;

    const excelRows = currentResults.map(b => ({
      "カテゴリ": b.category || "",
      "メーカー": b.maker || "",
      "車種名・モデル名": b.model_name || "",
      "型番/品番": b.model_code || "",
      "年式": b.model_year || "不明",
      "今回税込価格(円)": parseInt(b.price_tax_included) || 0,
      "前回税込価格(円)": parseInt(b.previous_price_tax_included) || parseInt(b.price_tax_included) || 0,
      "前回比差分(円)": parseInt(b.price_difference) || 0,
      "状態": b.status || "据置",
      "台数": parseInt(b.quantity) || 1,
      "今回税抜価格(円)": parseInt(b.price_tax_excluded) || 0,
      "特記事項・POP": b.spec_notes || "",
      "確認時間": b.timestamp || ""
    }));

    const ws = XLSX.utils.json_to_sheet(excelRows);

    // 列幅の自動設定
    ws["!cols"] = [
      { wch: 16 }, // カテゴリ
      { wch: 16 }, // メーカー
      { wch: 26 }, // 車種名
      { wch: 16 }, // 型番
      { wch: 10 }, // 年式
      { wch: 15 }, // 今回税込価格
      { wch: 15 }, // 前回税込価格
      { wch: 14 }, // 前回比差分
      { wch: 12 }, // 状態
      { wch: 8 },  // 台数
      { wch: 15 }, // 今回税抜価格
      { wch: 24 }, // 特記事項
      { wch: 12 }  // 確認時間
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "競合店調査結果");

    const fileName = `競合店調査結果_${storeName}_${surveyDate}.xlsx`;
    XLSX.writeFile(wb, fileName);
  });

  // --- CSV エクスポート ---
  btnExportCsv.addEventListener("click", () => {
    if (!currentResults || currentResults.length === 0) {
      alert("エクスポートするデータがありません。");
      return;
    }

    const storeName = inputStoreName.value.trim() || "競合店舗";
    const surveyDate = inputSurveyDate.value || today;

    const headers = ["カテゴリ", "メーカー", "車種名・モデル名", "型番/品番", "年式", "今回税込価格", "前回税込価格", "前回比差分", "状態", "台数", "今回税抜価格", "特記事項・POP", "確認時間"];
    const rows = currentResults.map(b => [
      `"${(b.category || "").replace(/"/g, '""')}"`,
      `"${(b.maker || "").replace(/"/g, '""')}"`,
      `"${(b.model_name || "").replace(/"/g, '""')}"`,
      `"${(b.model_code || "").replace(/"/g, '""')}"`,
      `"${(b.model_year || "").replace(/"/g, '""')}"`,
      parseInt(b.price_tax_included) || 0,
      parseInt(b.previous_price_tax_included) || parseInt(b.price_tax_included) || 0,
      parseInt(b.price_difference) || 0,
      `"${(b.status || "据置").replace(/"/g, '""')}"`,
      parseInt(b.quantity) || 1,
      parseInt(b.price_tax_excluded) || 0,
      `"${(b.spec_notes || "").replace(/"/g, '""')}"`,
      `"${(b.timestamp || "").replace(/"/g, '""')}"`
    ]);

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(r => r.join(","))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `競合店調査結果_${storeName}_${surveyDate}.csv`;
    link.click();
  });

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
});
