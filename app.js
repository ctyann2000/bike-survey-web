// ========================================================
// 自転車競合店調査 AI - メインアプリケーションロジック
// (複数動画一括受付 ＆ 2段階自律パイプライン ＆ 自動統合出力版)
// ========================================================

document.addEventListener("DOMContentLoaded", () => {
  if (window.lucide) {
    window.lucide.createIcons();
  }

  // --- DOM要素 ---
  const inputApiKey = document.getElementById("input-api-key");
  const btnSaveKey = document.getElementById("btn-save-key");
  const apiKeyBanner = document.getElementById("api-key-banner");
  const btnToggleApiSettings = document.getElementById("btn-toggle-api-settings");
  const btnCloseApiBanner = document.getElementById("btn-close-api-banner");

  const inputStoreName = document.getElementById("input-store-name");
  const inputSurveyDate = document.getElementById("input-survey-date");

  // 複数動画アップロード要素
  const dropZone = document.getElementById("drop-zone");
  const fileInput = document.getElementById("file-input");
  const selectedFilesContainer = document.getElementById("selected-files-container");
  const selectedFilesCount = document.getElementById("selected-files-count");
  const selectedFilesList = document.getElementById("selected-files-list");
  const btnClearAllVideos = document.getElementById("btn-clear-all-videos");
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
  const summaryUnmatchedCount = document.getElementById("summary-unmatched-count");
  const summaryEbikeRatio = document.getElementById("summary-ebike-ratio");
  const summaryAvgPrice = document.getElementById("summary-avg-price");

  const btnExportExcel = document.getElementById("btn-export-excel");
  const btnExportCsv = document.getElementById("btn-export-csv");

  // --- 状態変数 ---
  let selectedVideoFiles = []; // 複数動画ファイル配列
  let masterDataRecords = null;
  let currentResults = [];

  // --- 初期化 ---
  const today = new Date().toISOString().split("T")[0];
  inputSurveyDate.value = today;

  let activeApiKey = "";
  if (typeof CONFIG !== "undefined" && CONFIG.GEMINI_API_KEY && CONFIG.GEMINI_API_KEY.trim() !== "") {
    activeApiKey = CONFIG.GEMINI_API_KEY.trim();
    inputApiKey.value = activeApiKey;
    apiKeyBanner.classList.add("hidden");
  } else {
    const savedKey = localStorage.getItem("gemini_api_key");
    if (savedKey) {
      activeApiKey = savedKey;
      inputApiKey.value = savedKey;
      apiKeyBanner.classList.add("hidden");
    } else {
      apiKeyBanner.classList.remove("hidden");
      apiKeyBanner.classList.add("bg-amber-50", "border-amber-200");
    }
  }

  if (btnToggleApiSettings) {
    btnToggleApiSettings.addEventListener("click", () => {
      apiKeyBanner.classList.toggle("hidden");
    });
  }

  if (btnCloseApiBanner) {
    btnCloseApiBanner.addEventListener("click", () => {
      apiKeyBanner.classList.add("hidden");
    });
  }

  btnSaveKey.addEventListener("click", () => {
    const key = inputApiKey.value.trim();
    if (key) {
      localStorage.setItem("gemini_api_key", key);
      alert("APIキーを保存しました！");
      apiKeyBanner.classList.add("hidden");
    } else {
      localStorage.removeItem("gemini_api_key");
      alert("APIキーをクリアしました。");
    }
    updateStartButtonState();
  });

  // ========================================================
  // 1. 複数動画ファイルの選択 ＆ 管理
  // ========================================================
  dropZone.addEventListener("click", () => fileInput.click());
  dropZone.addEventListener("dragover", (e) => { e.preventDefault(); dropZone.classList.add("dragover"); });
  dropZone.addEventListener("dragleave", () => dropZone.classList.remove("dragover"));
  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("dragover");
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addVideoFiles(e.dataTransfer.files);
    }
  });

  fileInput.addEventListener("change", (e) => {
    if (e.target.files && e.target.files.length > 0) {
      addVideoFiles(e.target.files);
    }
  });

  function addVideoFiles(files) {
    let addedCount = 0;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.type.startsWith("video/") || file.name.match(/\.(mp4|mov|webm|avi|mkv)$/i)) {
        // 重複除外
        if (!selectedVideoFiles.some(f => f.name === file.name && f.size === file.size)) {
          selectedVideoFiles.push(file);
          addedCount++;
        }
      }
    }
    if (addedCount > 0) {
      renderVideoFilesList();
      updateStartButtonState();
    } else {
      alert("有効な動画ファイル（MP4 / MOV / WEBM）を選択してください。");
    }
  }

  function renderVideoFilesList() {
    if (selectedVideoFiles.length === 0) {
      selectedFilesContainer.classList.add("hidden");
      return;
    }

    selectedFilesContainer.classList.remove("hidden");
    const totalBytes = selectedVideoFiles.reduce((acc, f) => acc + f.size, 0);
    const totalMb = (totalBytes / (1024 * 1024)).toFixed(1);
    selectedFilesCount.textContent = `選択された動画: ${selectedVideoFiles.length} 本 (合計 ${totalMb} MB)`;

    selectedFilesList.innerHTML = "";
    selectedVideoFiles.forEach((file, idx) => {
      const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
      const row = document.createElement("div");
      row.className = "flex items-center justify-between p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700";
      row.innerHTML = `
        <div class="flex items-center space-x-2 truncate">
          <span class="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 font-bold rounded text-[10px]">動画${idx + 1}</span>
          <i data-lucide="file-video" class="w-4 h-4 text-indigo-600 flex-shrink-0"></i>
          <span class="font-medium truncate max-w-[220px] sm:max-w-xs">${escapeHtml(file.name)}</span>
          <span class="text-slate-400 text-[11px]">(${sizeMb} MB)</span>
        </div>
        <button data-index="${idx}" class="btn-remove-video text-slate-400 hover:text-rose-600 p-1 font-bold ml-2 transition">✕</button>
      `;
      selectedFilesList.appendChild(row);
    });

    // 個別削除イベント
    selectedFilesList.querySelectorAll(".btn-remove-video").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const removeIdx = parseInt(btn.getAttribute("data-index"));
        selectedVideoFiles.splice(removeIdx, 1);
        renderVideoFilesList();
        updateStartButtonState();
      });
    });

    if (window.lucide) window.lucide.createIcons();
  }

  btnClearAllVideos.addEventListener("click", (e) => {
    e.stopPropagation();
    selectedVideoFiles = [];
    fileInput.value = "";
    renderVideoFilesList();
    updateStartButtonState();
  });

  // ========================================================
  // 2. 店舗マスターExcelドラッグ＆ドロップ
  // ========================================================
  masterDropZone.addEventListener("click", () => masterFileInput.click());
  masterDropZone.addEventListener("dragover", (e) => { e.preventDefault(); masterDropZone.classList.add("border-emerald-500", "bg-emerald-50/50"); });
  masterDropZone.addEventListener("dragleave", () => masterDropZone.classList.remove("border-emerald-500", "bg-emerald-50/50"));
  masterDropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    masterDropZone.classList.remove("border-emerald-500", "bg-emerald-50/50");
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) handleMasterFileSelected(e.dataTransfer.files[0]);
  });
  masterFileInput.addEventListener("change", (e) => {
    if (e.target.files && e.target.files.length > 0) handleMasterFileSelected(e.target.files[0]);
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

  function getEffectiveApiKey() {
    return inputApiKey.value.trim() || 
           (typeof CONFIG !== "undefined" && CONFIG.GEMINI_API_KEY && CONFIG.GEMINI_API_KEY.trim()) || 
           localStorage.getItem("gemini_api_key") || "";
  }

  function updateStartButtonState() {
    const hasKey = !!getEffectiveApiKey();
    const hasVideos = selectedVideoFiles.length > 0;
    btnStartAnalysis.disabled = !(hasKey && hasVideos);
  }

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
  // 3. 解析実行パイプライン（複数動画の順次解析 ＆ 自動マージ）
  // ========================================================
  btnStartAnalysis.addEventListener("click", async () => {
    const apiKey = getEffectiveApiKey();
    if (!apiKey) { alert("APIキーを入力してください。"); return; }
    if (selectedVideoFiles.length === 0) { alert("動画ファイルを選択してください。"); return; }

    btnStartAnalysis.disabled = true;
    progressCard.classList.remove("hidden");
    resultCard.classList.add("hidden");
    progressLog.innerHTML = "";

    const totalVideos = selectedVideoFiles.length;
    updateProgress(5, "準備中...", `合計 ${totalVideos} 本の動画を順次解析します`, `複数動画パイプライン開始 (合計 ${totalVideos} 本)`);

    let combinedBikes = [];
    const hasMaster = masterDataRecords && masterDataRecords.length > 0;

    try {
      for (let i = 0; i < totalVideos; i++) {
        const file = selectedVideoFiles[i];
        const videoPrefix = totalVideos > 1 ? `[動画${i + 1}] ` : "";
        const basePercent = Math.round((i / totalVideos) * 90);
        const perVideoStep = Math.round(90 / totalVideos);

        updateProgress(
          basePercent + Math.round(perVideoStep * 0.1),
          `動画 ${i + 1}/${totalVideos} をアップロード中...`,
          `ファイル名: ${file.name} (${(file.size / (1024 * 1024)).toFixed(1)}MB)`,
          `▶ 動画 ${i + 1}/${totalVideos} (${file.name}) の処理を開始`
        );

        // 1. Files API アップロード
        const fileData = await uploadToGeminiFilesApi(file, apiKey);
        
        updateProgress(
          basePercent + Math.round(perVideoStep * 0.3),
          `動画 ${i + 1}/${totalVideos} 待機中...`,
          "Google側で動画インデックス作成中",
          `アップロード完了 (URI: ${fileData.file.uri})`
        );
        await waitForFileActive(fileData.file.name, apiKey);

        // 2. Stage 1: Flash-Lite によるトリアージ（有効区間特定）
        updateProgress(
          basePercent + Math.round(perVideoStep * 0.5),
          `動画 ${i + 1}/${totalVideos} Stage 1: 有効区間判別中...`,
          "Flash-Lite (1日500回枠) で移動時間をカットし有効区間を特定",
          `Liteトリアージ実行中...`
        );
        const segmentAnalysis = await analyzeValidSegmentsWithLite(fileData.file.uri, apiKey);

        // 3. Stage 2: Flash 高精度モデルによる精密読取
        updateProgress(
          basePercent + Math.round(perVideoStep * 0.8),
          `動画 ${i + 1}/${totalVideos} Stage 2: 精密解析中...`,
          "Gemini 3.8/3.7/3.6 Flash でPOP・差額を精密抽出中",
          `Flash高精度モデル呼び出し中...`
        );
        const surveyData = await executePrecisionOcrWithFallback(fileData.file.uri, segmentAnalysis, masterDataRecords, apiKey);

        const bikesThisVideo = surveyData.bikes || [];
        // 確認時間に動画番号プレフィックスを付与
        bikesThisVideo.forEach(b => {
          b.timestamp = `${videoPrefix}${b.timestamp || "00:00"}`;
        });

        combinedBikes = combinedBikes.concat(bikesThisVideo);
        updateProgress(
          basePercent + perVideoStep,
          `動画 ${i + 1}/${totalVideos} 完了`,
          `この動画から ${bikesThisVideo.length} SKU を抽出（累計: ${combinedBikes.length} SKU）`,
          `✓ 動画 ${i + 1}/${totalVideos} 抽出完了 (+${bikesThisVideo.length} SKU)`
        );
      }

      // 重複統合（同一車種名・型番・同一価格のレコードがあれば台数を合算）
      updateProgress(95, "全動画のデータ統合中...", "複数動画間の重複排除と集計を実行中", "全動画データの統合・マージ中...");
      const mergedBikes = mergeDuplicateBikes(combinedBikes);

      currentResults = mergedBikes;
      renderResults(currentResults, hasMaster);

      updateProgress(100, "完了！", `全 ${totalVideos} 本の動画解析が完了しました`, `全工程完了！合計 ${currentResults.length} SKU を抽出`);
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

  // --- 重複SKUのマージ関数 ---
  function mergeDuplicateBikes(bikes) {
    const map = new Map();
    bikes.forEach(b => {
      // 一致キー: 車種名 + 型番 + 税込価格
      const key = `${(b.model_name || '').trim()}|${(b.model_code || '').trim()}|${b.price_tax_included}`;
      if (map.has(key)) {
        const existing = map.get(key);
        existing.quantity = (parseInt(existing.quantity) || 1) + (parseInt(b.quantity) || 1);
        // 確認時間をカンマ区切りで追記（例: [動画1] 01:23, [動画2] 00:45）
        if (b.timestamp && !existing.timestamp.includes(b.timestamp)) {
          existing.timestamp += `, ${b.timestamp}`;
        }
      } else {
        map.set(key, Object.assign({}, b));
      }
    });
    return Array.from(map.values());
  }

  // --- Files API アップロード ---
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

  // --- ACTIVE待機 ---
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

  // --- Stage 1: Flash-Lite によるトリアージ ---
  async function analyzeValidSegmentsWithLite(fileUri, apiKey) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${apiKey}`;
    
    const prompt = `
    この動画は自転車売場の歩き撮り映像です。
    動画全体を確認し、以下の2点を抽出してください：
    1. 自転車や値札・POPが明確に映っている【有効な時間区間（タイムスタンプ）】のリスト（例: "00:15 - 00:45", "01:20 - 02:05"...）
    2. 単なる移動、ブレ、床や天井のみが映っている無効な区間を省いたサマリー
    `;

    const schema = {
      type: "OBJECT",
      properties: {
        valid_segments: { type: "ARRAY", items: { type: "STRING" } },
        summary: { type: "STRING" }
      },
      required: ["valid_segments", "summary"]
    };

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }, { file_data: { mime_type: "video/mp4", file_uri: fileUri } }] }],
          generationConfig: { responseMimeType: "application/json", responseSchema: schema }
        })
      });

      if (!response.ok) {
        return { valid_segments: [], summary: "全編有効" };
      }

      const resJson = await response.json();
      return JSON.parse(resJson.candidates[0].content.parts[0].text);
    } catch (e) {
      return { valid_segments: [], summary: "全編有効" };
    }
  }

  // --- Stage 2: 高精度Flashモデル (3.8 ➔ 3.7 ➔ 3.6 フォールバック) ---
  async function executePrecisionOcrWithFallback(fileUri, segmentInfo, masterRecords, apiKey) {
    const fallbackChain = ["gemini-3.8-flash", "gemini-3.7-flash", "gemini-3.6-flash"];

    let masterContext = "";
    if (masterRecords && masterRecords.length > 0) {
      masterContext = `
      【店舗マスターExcel情報】
      ${JSON.stringify(masterRecords.slice(0, 300))}
      
      【マスター照合ルール】
      1. 動画内に映るPOPを、上記マスターと照合してください。
      2. 一致商品: is_master_match=true, master_price=マスター価格, price_diff=税込 - マスター価格
      3. マスター外商品: is_master_match=false, master_price=null, price_diff=null, spec_notesに「【マスター外】」と付記し、POPの文字を正確に抽出。
      `;
    }

    const segmentsHint = (segmentInfo.valid_segments && segmentInfo.valid_segments.length > 0)
      ? `【有効区間情報】Liteモデルにより以下の区間にPOPが集中していることが判明しています: ${segmentInfo.valid_segments.join(", ")}。これらの区間に特に注視して精密に文字認識してください。`
      : "";

    const prompt = `
    あなたは自転車小売業の競合店舗調査の専門エキスパートです。
    この動画は自転車売場の通路を歩いて撮影したものです。
    ${segmentsHint}
    動画に映っているすべての自転車の【値札・プライスカードPOP】を時系列で読み取り、
    重複を排除して全商品の詳細情報を漏れなく抽出してください。
    ${masterContext}

    【抽出項目】
    - category: 大分類（電動アシスト / シティ・ファミリー / スポーツ・クロス / キッズ・ジュニア / 折りたたみ・ミニベロ / その他）
    - maker: メーカー（パナソニック / ブリヂストン / ヤマハ / GIANT / あさひPB / その他）
    - model_name: 車種名・モデル名
    - model_code: 型番/品番（POPに記載があれば）
    - model_year: 年式（例: 2024年, 2023年型落ち, 不明）
    - price_tax_included: 税込価格（円・数値）
    - master_price: マスター価格（マスターに存在する場合のみ数値、ない場合はnull）
    - price_diff: 差額（税込価格 − マスター価格。ない場合はnull）
    - is_master_match: マスターに存在したかどうかのブール値（true/false）
    - quantity: 展示台数（同モデル・同価格の並び台数）
    - price_tax_excluded: 税抜価格（円・数値）
    - spec_notes: 仕様・セールPOPメモ（例: 16.0Ah、内装3段、店頭特価等）
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
              master_price: { type: "INTEGER" },
              price_diff: { type: "INTEGER" },
              is_master_match: { type: "BOOLEAN" },
              quantity: { type: "INTEGER" },
              price_tax_excluded: { type: "INTEGER" },
              spec_notes: { type: "STRING" },
              timestamp: { type: "STRING" }
            },
            required: ["category", "maker", "model_name", "price_tax_included", "price_tax_excluded", "quantity", "timestamp"]
          }
        }
      },
      required: ["bikes"]
    };

    let lastError = null;

    for (const model of fallbackChain) {
      try {
        console.log(`モデル ${model} で精密解析を実行中...`);
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }, { file_data: { mime_type: "video/mp4", file_uri: fileUri } }] }],
            generationConfig: { responseMimeType: "application/json", responseSchema: responseSchema }
          })
        });

        if (response.ok) {
          const resJson = await response.json();
          const candidate = resJson.candidates?.[0];
          if (candidate && candidate.content?.parts?.[0]?.text) {
            console.log(`✓ モデル ${model} で解析成功！`);
            return JSON.parse(candidate.content.parts[0].text);
          }
        }

        const errText = await response.text();
        console.warn(`モデル ${model} エラー (${response.status}): ${errText}`);
        lastError = new Error(`モデル ${model} エラー: ${errText}`);

      } catch (err) {
        console.warn(`モデル ${model} 呼び出し例外: ${err.message}`);
        lastError = err;
      }
    }

    throw lastError || new Error("すべてのFlashモデルでの解析に失敗しました。");
  }

  // ========================================================
  // 4. 解析結果の描画
  // ========================================================
  function renderResults(bikes, hasMaster) {
    tableBody.innerHTML = "";
    let totalQty = 0;
    let totalPrice = 0;
    let ebikeQty = 0;
    let unmatchedCount = 0;

    if (hasMaster) {
      badgeMasterStatus.classList.remove("hidden");
    } else {
      badgeMasterStatus.classList.add("hidden");
    }

    bikes.forEach((bike) => {
      const qty = parseInt(bike.quantity) || 1;
      const priceInc = parseInt(bike.price_tax_included) || 0;
      totalQty += qty;
      totalPrice += priceInc * qty;

      if (bike.category && (bike.category.includes("電動") || bike.category.toLowerCase().includes("e-bike"))) {
        ebikeQty += qty;
      }

      const isMatch = bike.is_master_match === true;
      if (!isMatch && hasMaster) {
        unmatchedCount += 1;
      }

      const mPrice = (isMatch && bike.master_price !== null && bike.master_price !== undefined && bike.master_price > 0)
        ? `¥${parseInt(bike.master_price).toLocaleString()}`
        : "-";

      let diffHtml = "-";
      if (isMatch && bike.price_diff !== null && bike.price_diff !== undefined) {
        const diff = parseInt(bike.price_diff);
        if (diff < 0) {
          diffHtml = `<span class="text-rose-600 font-bold font-mono">¥${diff.toLocaleString()}</span>`;
        } else if (diff > 0) {
          diffHtml = `<span class="text-blue-600 font-bold font-mono">+¥${diff.toLocaleString()}</span>`;
        } else {
          diffHtml = `<span class="text-slate-400 font-mono">¥0</span>`;
        }
      }

      let modelHtml = escapeHtml(bike.model_name || "-");
      if (hasMaster && !isMatch) {
        modelHtml += ` <span class="ml-1.5 px-1.5 py-0.5 text-[9px] font-bold bg-amber-100 text-amber-800 rounded">マスター外</span>`;
      }

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="px-3 py-2 whitespace-nowrap"><span class="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700">${escapeHtml(bike.category || "一般")}</span></td>
        <td class="px-3 py-2 whitespace-nowrap font-medium text-slate-900">${escapeHtml(bike.maker || "-")}</td>
        <td class="px-3 py-2 font-semibold text-indigo-950">${modelHtml}</td>
        <td class="px-3 py-2 font-mono text-slate-500 text-[11px]">${escapeHtml(bike.model_code || "-")}</td>
        <td class="px-3 py-2 whitespace-nowrap text-slate-600">${escapeHtml(bike.model_year || "不明")}</td>
        <td class="px-3 py-2 text-right font-bold text-slate-900 whitespace-nowrap">¥${priceInc.toLocaleString()}</td>
        <td class="px-3 py-2 text-right text-slate-500 whitespace-nowrap font-mono">${mPrice}</td>
        <td class="px-3 py-2 text-right whitespace-nowrap">${diffHtml}</td>
        <td class="px-3 py-2 text-center font-bold text-indigo-600">${qty}</td>
        <td class="px-3 py-2 text-slate-500 text-[11px]">${escapeHtml(bike.spec_notes || "")}</td>
        <td class="px-3 py-2 text-center font-mono text-xs text-indigo-700 bg-indigo-50/50 rounded font-semibold whitespace-nowrap">${escapeHtml(bike.timestamp || "00:00")}</td>
      `;
      tableBody.appendChild(tr);
    });

    badgeTotalCount.textContent = `${totalQty} 台`;
    summaryTotalQty.textContent = `${totalQty} 台`;
    summarySkuCount.textContent = `${bikes.length} SKU`;
    summaryUnmatchedCount.textContent = hasMaster ? `${unmatchedCount} 件` : "-";
    summaryEbikeRatio.textContent = totalQty > 0 ? `${Math.round((ebikeQty / totalQty) * 100)} %` : "0 %";
    summaryAvgPrice.textContent = totalQty > 0 ? `¥${Math.round(totalPrice / totalQty).toLocaleString()}` : "¥0";

    const storeName = inputStoreName.value.trim() || "競合店舗";
    const surveyDate = inputSurveyDate.value || today;
    const videoCountLabel = selectedVideoFiles.length > 1 ? ` (動画計${selectedVideoFiles.length}本)` : "";
    resultMetaInfo.textContent = `店舗名: ${storeName} | 調査日: ${surveyDate}${videoCountLabel} | 合計展示台数: ${totalQty}台`;
  }

  // ========================================================
  // 5. Excel (.xlsx) ダウンロード機能
  // ========================================================
  btnExportExcel.addEventListener("click", () => {
    if (!currentResults || currentResults.length === 0) {
      alert("エクスポートするデータがありません。");
      return;
    }

    const storeName = inputStoreName.value.trim() || "競合店舗";
    const surveyDate = inputSurveyDate.value || today;

    const excelRows = currentResults.map(b => {
      const isMatch = b.is_master_match === true;
      const hasMPrice = isMatch && b.master_price !== null && b.master_price !== undefined && b.master_price > 0;
      return {
        "カテゴリ": b.category || "",
        "メーカー": b.maker || "",
        "車種名・モデル名": b.model_name || "",
        "型番/品番": b.model_code || "",
        "年式": b.model_year || "不明",
        "税込価格(円)": parseInt(b.price_tax_included) || 0,
        "マスター価格(円)": hasMPrice ? parseInt(b.master_price) : "-",
        "差額(円)": hasMPrice && b.price_diff !== null && b.price_diff !== undefined ? parseInt(b.price_diff) : "-",
        "台数": parseInt(b.quantity) || 1,
        "税抜価格(円)": parseInt(b.price_tax_excluded) || 0,
        "特記事項・POP": b.spec_notes || "",
        "確認時間": b.timestamp || ""
      };
    });

    const ws = XLSX.utils.json_to_sheet(excelRows);

    ws["!cols"] = [
      { wch: 16 }, { wch: 16 }, { wch: 28 }, { wch: 16 }, { wch: 10 },
      { wch: 15 }, { wch: 16 }, { wch: 14 }, { wch: 8 },  { wch: 15 },
      { wch: 26 }, { wch: 20 } // 確認時間は動画番号が入るため少し幅広に設定
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "競合店調査結果");

    const fileName = `競合店調査結果_${storeName}_${surveyDate}.xlsx`;
    XLSX.writeFile(wb, fileName);
  });

  // 6. CSV エクスポート
  btnExportCsv.addEventListener("click", () => {
    if (!currentResults || currentResults.length === 0) {
      alert("エクスポートするデータがありません。");
      return;
    }

    const storeName = inputStoreName.value.trim() || "競合店舗";
    const surveyDate = inputSurveyDate.value || today;

    const headers = ["カテゴリ", "メーカー", "車種名・モデル名", "型番/品番", "年式", "税込価格", "マスター価格", "差額", "台数", "税抜価格", "特記事項・POP", "確認時間"];
    const rows = currentResults.map(b => {
      const isMatch = b.is_master_match === true;
      const hasMPrice = isMatch && b.master_price !== null && b.master_price !== undefined && b.master_price > 0;
      return [
        `"${(b.category || "").replace(/"/g, '""')}"`,
        `"${(b.maker || "").replace(/"/g, '""')}"`,
        `"${(b.model_name || "").replace(/"/g, '""')}"`,
        `"${(b.model_code || "").replace(/"/g, '""')}"`,
        `"${(b.model_year || "").replace(/"/g, '""')}"`,
        parseInt(b.price_tax_included) || 0,
        hasMPrice ? parseInt(b.master_price) : "-",
        hasMPrice && b.price_diff !== null && b.price_diff !== undefined ? parseInt(b.price_diff) : "-",
        parseInt(b.quantity) || 1,
        parseInt(b.price_tax_excluded) || 0,
        `"${(b.spec_notes || "").replace(/"/g, '""')}"`,
        `"${(b.timestamp || "").replace(/"/g, '""')}"`
      ];
    });

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
