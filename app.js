// ========================================================
// 自転車競合店調査 AI - メインアプリケーションロジック
// (動画・写真ハイブリッド対応 ＆ サンプル即テスト ＆ 自動統合出力版)
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

  // メディア（動画・写真）アップロード要素
  const dropZone = document.getElementById("drop-zone");
  const dropZoneEmpty = document.getElementById("drop-zone-empty");
  const dropZoneFilled = document.getElementById("drop-zone-filled");
  const dropZoneFilledTitle = document.getElementById("drop-zone-filled-title");
  const dropZoneFilledSub = document.getElementById("drop-zone-filled-sub");
  const fileInput = document.getElementById("file-input");
  const selectedFilesContainer = document.getElementById("selected-files-container");
  const selectedFilesCount = document.getElementById("selected-files-count");
  const selectedFilesList = document.getElementById("selected-files-list");
  const btnClearAllVideos = document.getElementById("btn-clear-all-videos");
  const btnLoadSample = document.getElementById("btn-load-sample");
  const btnStartAnalysis = document.getElementById("btn-start-analysis");
  const btnStartStatus = document.getElementById("btn-start-status");

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
  let selectedMediaFiles = []; // 動画または写真ファイル配列
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

  // 初期状態のボタンステータスを反映
  updateStartButtonState();

  // ブラウザ全体で意図しないファイル開き・ダウンロードを抑止
  window.addEventListener("dragover", (e) => e.preventDefault());
  window.addEventListener("drop", (e) => e.preventDefault());

  // ========================================================
  // 1. メディアファイル（動画・写真）の選択 ＆ 管理
  // ========================================================
  // ドラッグ進入・移動時（dragoverでpreventDefaultしないとdropが絶対に発火しない仕様）
  ["dragenter", "dragover"].forEach(name => {
    dropZone.addEventListener(name, (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = "copy";
      dropZone.classList.add("dragover");
    });
  });

  // ドラッグ離脱時
  ["dragleave", "dragend"].forEach(name => {
    dropZone.addEventListener(name, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove("dragover");
    });
  });

  // ドロップ時（e.dataTransfer.files から確実にファイルを取得）
  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove("dragover");

    const files = e.dataTransfer ? e.dataTransfer.files : null;
    if (files && files.length > 0) {
      console.log("ドロップ成功:", files);
      addMediaFiles(files);
    }
  });

  // クリック選択（枠をクリックしたときにファイルダイアログを開く）
  dropZone.addEventListener("click", () => {
    fileInput.value = "";
    fileInput.click();
  });

  fileInput.addEventListener("change", (e) => {
    if (e.target.files && e.target.files.length > 0) {
      console.log("ファイル選択成功:", e.target.files);
      addMediaFiles(e.target.files);
    }
  });

  function isMediaFile(file) {
    if (!file) return false;
    if (file.type && (file.type.startsWith("video/") || file.type.startsWith("image/"))) return true;
    const ext = (file.name || "").split(".").pop().toLowerCase();
    const validExts = ["mp4", "mov", "webm", "avi", "mkv", "m4v", "3gp", "wmv", "flv", "jpg", "jpeg", "png", "webp", "svg", "heic", "heif", "bmp", "gif"];
    return validExts.includes(ext);
  }

  function isImageFile(file) {
    if (!file) return false;
    if (file.type && file.type.startsWith("image/")) return true;
    const ext = (file.name || "").split(".").pop().toLowerCase();
    return ["jpg", "jpeg", "png", "webp", "svg", "heic", "heif", "bmp", "gif"].includes(ext);
  }

  async function addMediaFiles(files) {
    let addedCount = 0;
    const MAX_PART_SIZE = 1500 * 1024 * 1024;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (isMediaFile(file)) {
        
        // 動画で2GB超の場合：ブラウザ内で自動分割
        if (file.size > 2000 * 1024 * 1024 && !isImageFile(file)) {
          const sizeGb = (file.size / (1024 * 1024 * 1024)).toFixed(2);
          const numParts = Math.ceil(file.size / MAX_PART_SIZE);
          
          for (let p = 0; p < numParts; p++) {
            const startByte = p * MAX_PART_SIZE;
            const endByte = Math.min((p + 1) * MAX_PART_SIZE, file.size);
            const partBlob = file.slice(startByte, endByte, file.type || "video/mp4");
            
            const partName = `${file.name.replace(/\.[^/.]+$/, "")}_part${p + 1}.mp4`;
            const partFile = new File([partBlob], partName, { type: file.type || "video/mp4" });
            partFile.isAutoSplit = true;
            partFile.partLabel = `分割 ${p + 1}/${numParts}`;
            
            selectedMediaFiles.push(partFile);
            addedCount++;
          }

          alert(`⚡ 大容量動画を自動分割しました！\n\n「${file.name}」(${sizeGb} GB) はGoogle上限を超えているため、安全に解析できるよう【${numParts}つのパート】に自動分割して登録しました。そのまま解析可能です！`);
          continue;
        }

        // 通常の動画または写真
        if (!selectedMediaFiles.some(f => f.name === file.name && f.size === file.size)) {
          selectedMediaFiles.push(file);
          addedCount++;
        }
      }
    }

    if (addedCount > 0) {
      renderMediaFilesList();
      updateStartButtonState();
    } else {
      alert("動画（MP4/MOV/WEBM）または 写真（JPG/PNG/WEBP）ファイルを選択してください。");
    }
  }

  // --- サンプル写真のクイック読み込み ---
  if (btnLoadSample) {
    btnLoadSample.addEventListener("click", async (e) => {
      e.stopPropagation();
      try {
        const response = await fetch("sample_bike_pop.svg");
        const svgBlob = await response.blob();
        const sampleFile = new File([svgBlob], "sample_bike_pop.svg", { type: "image/svg+xml" });
        selectedMediaFiles = [sampleFile];
        renderMediaFilesList();
        updateStartButtonState();
        alert("🧪 サンプル自転車POP写真（Panasonic ビビDX）をセットしました！\n\n画面下の「AI解析を開始する」ボタンをクリックしてテストをお試しください。");
      } catch (err) {
        alert("サンプル写真の読み込みに失敗しました: " + err.message);
      }
    });
  }

  function renderMediaFilesList() {
    if (selectedMediaFiles.length === 0) {
      selectedFilesContainer.classList.add("hidden");
      if (dropZoneEmpty) dropZoneEmpty.classList.remove("hidden");
      if (dropZoneFilled) dropZoneFilled.classList.add("hidden");
      dropZone.classList.remove("border-emerald-500", "bg-emerald-50/70");
      dropZone.classList.add("border-slate-300", "bg-slate-50");
      updateStartButtonState();
      return;
    }

    // 添付完了の視覚的フィードバック（緑色ハイライト ＆ 完了アイコン）
    selectedFilesContainer.classList.remove("hidden");
    if (dropZoneEmpty) dropZoneEmpty.classList.add("hidden");
    if (dropZoneFilled) dropZoneFilled.classList.remove("hidden");
    dropZone.classList.remove("border-slate-300", "bg-slate-50");
    dropZone.classList.add("border-emerald-500", "bg-emerald-50/70");

    const totalBytes = selectedMediaFiles.reduce((acc, f) => acc + f.size, 0);
    const totalMb = (totalBytes / (1024 * 1024)).toFixed(1);
    
    if (dropZoneFilledTitle) {
      dropZoneFilledTitle.textContent = `✅ ${selectedMediaFiles.length} 件のファイルを添付しました！`;
    }
    if (dropZoneFilledSub) {
      const names = selectedMediaFiles.map(f => f.name).slice(0, 2).join(", ");
      dropZoneFilledSub.textContent = `合計容量: ${totalMb} MB (${names}${selectedMediaFiles.length > 2 ? ' 他' : ''})`;
    }
    selectedFilesCount.textContent = `添付済みファイル: ${selectedMediaFiles.length} 件 (合計 ${totalMb} MB)`;

    selectedFilesList.innerHTML = "";
    selectedMediaFiles.forEach((file, idx) => {
      const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
      const isImg = isImageFile(file);
      const iconName = isImg ? "image" : "file-video";
      const iconColor = isImg ? "text-emerald-600" : "text-indigo-600";

      let tagHtml = `<span class="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 font-bold rounded text-[10px]">${isImg ? "写真" : "動画"}${idx + 1}</span>`;
      if (file.isAutoSplit) {
        tagHtml = `<span class="px-1.5 py-0.5 bg-amber-100 text-amber-800 font-bold rounded text-[10px]">${escapeHtml(file.partLabel || "自動分割")}</span>`;
      }

      const row = document.createElement("div");
      row.className = "flex items-center justify-between p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700";
      row.innerHTML = `
        <div class="flex items-center space-x-2 truncate">
          ${tagHtml}
          <i data-lucide="${iconName}" class="w-4 h-4 ${iconColor} flex-shrink-0"></i>
          <span class="font-medium truncate max-w-[220px] sm:max-w-xs">${escapeHtml(file.name)}</span>
          <span class="text-slate-400 text-[11px]">(${sizeMb} MB)</span>
        </div>
        <button data-index="${idx}" class="btn-remove-media text-slate-400 hover:text-rose-600 p-1 font-bold ml-2 transition">✕</button>
      `;
      selectedFilesList.appendChild(row);
    });

    selectedFilesList.querySelectorAll(".btn-remove-media").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const removeIdx = parseInt(btn.getAttribute("data-index"));
        selectedMediaFiles.splice(removeIdx, 1);
        renderMediaFilesList();
        updateStartButtonState();
      });
    });

    if (window.lucide) window.lucide.createIcons();
  }

  btnClearAllVideos.addEventListener("click", (e) => {
    e.stopPropagation();
    selectedMediaFiles = [];
    fileInput.value = "";
    renderMediaFilesList();
    updateStartButtonState();
  });

  // ========================================================
  // 2. 店舗マスターExcelドラッグ＆ドロップ
  // ========================================================
  ["dragenter", "dragover"].forEach(name => {
    masterDropZone.addEventListener(name, (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = "copy";
      masterDropZone.classList.add("border-emerald-500", "bg-emerald-50/50");
    });
  });

  ["dragleave", "dragend"].forEach(name => {
    masterDropZone.addEventListener(name, (e) => {
      e.preventDefault();
      e.stopPropagation();
      masterDropZone.classList.remove("border-emerald-500", "bg-emerald-50/50");
    });
  });

  masterDropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    e.stopPropagation();
    masterDropZone.classList.remove("border-emerald-500", "bg-emerald-50/50");
    const files = e.dataTransfer ? e.dataTransfer.files : null;
    if (files && files.length > 0) {
      handleMasterFileSelected(files[0]);
    }
  });

  masterDropZone.addEventListener("click", () => {
    masterFileInput.value = "";
    masterFileInput.click();
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

  function getEffectiveApiKey() {
    return inputApiKey.value.trim() || 
           (typeof CONFIG !== "undefined" && CONFIG.GEMINI_API_KEY && CONFIG.GEMINI_API_KEY.trim()) || 
           localStorage.getItem("gemini_api_key") || "";
  }

  function updateStartButtonState() {
    const hasKey = !!getEffectiveApiKey();
    const hasFiles = selectedMediaFiles.length > 0;
    
    if (btnStartStatus) {
      if (!hasKey) {
        btnStartStatus.innerHTML = `
          <span class="text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg flex items-center space-x-1.5 font-bold">
            <i data-lucide="alert-triangle" class="w-4 h-4 text-amber-600"></i>
            <span>APIキーが未設定です（右上の⚙️アイコンから設定）</span>
          </span>
        `;
      } else if (!hasFiles) {
        btnStartStatus.innerHTML = `
          <span class="text-slate-600 flex items-center space-x-1.5">
            <i data-lucide="info" class="w-4 h-4 text-indigo-600"></i>
            <span>調査ファイル（動画または写真）を選択してください</span>
          </span>
        `;
      } else {
        btnStartStatus.innerHTML = `
          <span class="text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg flex items-center space-x-1.5 font-bold">
            <i data-lucide="check-circle" class="w-4 h-4 text-emerald-600"></i>
            <span>✅ 準備完了！クリックして解析を開始できます</span>
          </span>
        `;
      }
      if (window.lucide) window.lucide.createIcons();
    }

    btnStartAnalysis.disabled = !(hasKey && hasFiles);
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
  // 3. 解析実行パイプライン（動画・写真 両対応）
  // ========================================================
  btnStartAnalysis.addEventListener("click", async () => {
    const apiKey = getEffectiveApiKey();
    if (!apiKey) { alert("APIキーを入力してください。"); return; }
    if (selectedMediaFiles.length === 0) { alert("動画または写真ファイルを選択してください。"); return; }

    btnStartAnalysis.disabled = true;
    progressCard.classList.remove("hidden");
    resultCard.classList.add("hidden");
    progressLog.innerHTML = "";

    const videoFiles = selectedMediaFiles.filter(f => !isImageFile(f));
    const imageFiles = selectedMediaFiles.filter(f => isImageFile(f));
    
    let combinedBikes = [];
    const hasMaster = masterDataRecords && masterDataRecords.length > 0;

    const totalBatches = videoFiles.length + (imageFiles.length > 0 ? 1 : 0);
    updateProgress(5, "準備中...", `動画 ${videoFiles.length}本、写真 ${imageFiles.length}枚の解析を開始します（API回数節約モード稼働）`, `解析パイプライン開始 (動画: ${videoFiles.length}本, 写真: ${imageFiles.length}枚)`);

    try {
      let currentBatch = 0;

      // ----------------------------------------------------
      // 1. 写真群の一括解析（【API節約】何十枚あってもたった1回のリクエストに集約！）
      // ----------------------------------------------------
      if (imageFiles.length > 0) {
        currentBatch++;
        const pctBase = Math.round(((currentBatch - 1) / totalBatches) * 90);
        const pctStep = Math.round(90 / totalBatches);

        updateProgress(
          pctBase + 5,
          `写真 ${imageFiles.length} 枚を一括アップロード中...`,
          "【API回数節約】全写真を1回のリクエストに集約して解析します",
          `📷 写真 ${imageFiles.length} 枚のアップロード開始 (API消費は1回のみに抑制)`
        );

        // 全写真を Files API へアップロード
        const imageItems = [];
        for (let j = 0; j < imageFiles.length; j++) {
          const imgFile = imageFiles[j];
          const mime = imgFile.type || "image/jpeg";
          const fData = await uploadToGeminiFilesApi(imgFile, mime, apiKey);
          imageItems.push({
            uri: fData.file.uri,
            mimeType: mime,
            label: `写真${j + 1}`
          });
          updateProgress(
            pctBase + Math.round((pctStep * 0.4) * ((j + 1) / imageFiles.length)),
            `写真 ${j + 1}/${imageFiles.length} アップロード完了`,
            `ファイル: ${imgFile.name}`,
            `✓ 写真 ${j + 1}/${imageFiles.length} アップロード完了`
          );
        }

        // Stage 1 (Lite): 全写真を見比べて重複・空間関係を事前マッピング（1日500回枠）
        updateProgress(
          pctBase + Math.round(pctStep * 0.5),
          `【Stage 1】Liteモデルによる事前空間マッピング中...`,
          `全写真を見比べ、同一車体の別アングル重複を整理しています`,
          `⚡ Flash-Lite (1日500回枠) で写真群の事前トリアージ実行中...`
        );
        const photoMapping = await analyzePhotoMappingWithLite(imageItems, apiKey);
        console.log("Lite写真マッピング結果:", photoMapping);

        // Stage 2 (Flash): Liteのマップを元に精密OCR ＆ 差額照合（API消費: 1回）
        updateProgress(
          pctBase + Math.round(pctStep * 0.8),
          `【Stage 2】Flash高精度モデルによる精密解析中...`,
          `Liteの空間マップを元にPOP文字・型番・差額を精密抽出中`,
          `🔍 Gemini 3.8/3.7/3.6 Flash で超精密読取中（API消費: 1回のみ）...`
        );

        const photoSurveyData = await executePrecisionOcrWithFallback(imageItems, true, photoMapping, masterDataRecords, apiKey);
        const photoBikes = photoSurveyData.bikes || [];
        combinedBikes = combinedBikes.concat(photoBikes);

        updateProgress(
          pctBase + pctStep,
          `写真 ${imageFiles.length} 枚の解析完了！`,
          `写真群から ${photoBikes.length} SKU を抽出（API消費: 1回のみ）`,
          `✓ 写真一括2段階解析完了 (+${photoBikes.length} SKU, Flash消費: 1回)`
        );
      }

      // ----------------------------------------------------
      // 2. 動画群の順次解析（動画は長尺・大容量のため1本ずつ安全処理）
      // ----------------------------------------------------
      for (let i = 0; i < videoFiles.length; i++) {
        currentBatch++;
        const file = videoFiles[i];
        const vPrefix = videoFiles.length > 1 ? `[動画${i + 1}] ` : "";
        const pctBase = Math.round(((currentBatch - 1) / totalBatches) * 90);
        const pctStep = Math.round(90 / totalBatches);

        updateProgress(
          pctBase + Math.round(pctStep * 0.1),
          `動画 ${i + 1}/${videoFiles.length} をアップロード中...`,
          `ファイル名: ${file.name} (${(file.size / (1024 * 1024)).toFixed(1)}MB)`,
          `▶ 動画 ${i + 1}/${videoFiles.length} (${file.name}) の処理を開始`
        );

        const mimeType = file.type || "video/mp4";
        const fileData = await uploadToGeminiFilesApi(file, mimeType, apiKey);

        updateProgress(
          pctBase + Math.round(pctStep * 0.3),
          `動画 ${i + 1}/${videoFiles.length} 待機中...`,
          "Google側で動画インデックス作成中",
          `アップロード完了 (URI: ${fileData.file.uri})`
        );
        await waitForFileActive(fileData.file.name, apiKey);

        // Stage 1: トリアージ
        updateProgress(
          pctBase + Math.round(pctStep * 0.5),
          `動画 ${i + 1}/${videoFiles.length} Stage 1: 有効区間判別中...`,
          "Flash-Lite で移動時間をカットし有効区間を特定",
          `Liteトリアージ実行中...`
        );
        const segmentAnalysis = await analyzeValidSegmentsWithLite(fileData.file.uri, apiKey);

        // Stage 2: 精密解析
        updateProgress(
          pctBase + Math.round(pctStep * 0.8),
          `動画 ${i + 1}/${videoFiles.length} Stage 2: 精密解析中...`,
          "Gemini 3.8/3.7/3.6 Flash でPOP文字・差額を精密抽出中",
          `Flash高精度モデル呼び出し中...`
        );
        const videoItems = [{ uri: fileData.file.uri, mimeType: mimeType, label: `動画${i + 1}` }];
        const surveyData = await executePrecisionOcrWithFallback(videoItems, false, segmentAnalysis, masterDataRecords, apiKey);

        const bikesThisVideo = surveyData.bikes || [];
        bikesThisVideo.forEach(b => {
          b.timestamp = `${vPrefix}${b.timestamp || "00:00"}`;
        });

        combinedBikes = combinedBikes.concat(bikesThisVideo);
        updateProgress(
          pctBase + pctStep,
          `動画 ${i + 1}/${videoFiles.length} 完了`,
          `この動画から ${bikesThisVideo.length} SKU を抽出`,
          `✓ 動画 ${i + 1}/${videoFiles.length} 抽出完了 (+${bikesThisVideo.length} SKU)`
        );
      }

      // ----------------------------------------------------
      // 3. 全データの最終名寄せ・重複統合（角度違い・別写真の重複を完全排除）
      // ----------------------------------------------------
      updateProgress(95, "全データの統合集計中...", "高精度名寄せエンジンで重複を最終排除中", "全データ名寄せ統合中...");
      const mergedBikes = mergeDuplicateBikes(combinedBikes);

      currentResults = mergedBikes;
      renderResults(currentResults, hasMaster);

      updateProgress(100, "完了！", "全メディアの解析・統合が完了しました", `全工程完了！合計 ${currentResults.length} SKU を抽出 (API消費を最小限に抑制)`);
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

  // --- 文字列の正規化（全角半角・記号・スペース統一） ---
  function normalizeText(str) {
    if (!str) return "";
    return String(str)
      .toLowerCase()
      .replace(/[Ａ-Ｚａ-ｚ０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0))
      .replace(/[\s・\-_/／]/g, "");
  }

  // --- 高精度・同一車体マージ関数（角度違い・別写真の重複を完全排除） ---
  function mergeDuplicateBikes(bikes) {
    const list = [];
    
    bikes.forEach(newBike => {
      const newNormName = normalizeText(newBike.model_name);
      const newNormCode = normalizeText(newBike.model_code);
      const newPrice = parseInt(newBike.price_tax_included) || 0;

      // 既存アイテムから同一車体（アングル違いの同一POP）を探索
      const existing = list.find(b => {
        const bNormName = normalizeText(b.model_name);
        const bNormCode = normalizeText(b.model_code);
        const bPrice = parseInt(b.price_tax_included) || 0;

        // 価格が異なる場合は別車体
        if (bPrice !== newPrice) return false;

        // 1. 型番が両方存在し一致する場合は100%同一車体
        if (newNormCode && bNormCode && (newNormCode === bNormCode || newNormCode.includes(bNormCode) || bNormCode.includes(newNormCode))) {
          return true;
        }

        // 2. 車種名の正規化文字列が完全一致、または一方が包含している場合（例:「ビビDX」と「パナソニック ビビDX 26インチ」）
        if (bNormName && newNormName) {
          if (bNormName === newNormName || bNormName.includes(newNormName) || newNormName.includes(bNormName)) {
            return true;
          }
        }

        return false;
      });

      if (existing) {
        // 同一車体と判定された場合：
        // 【重要】角度違い・複数枚写り込みによる台数の水増しを防止（最大値を採用）
        const newQty = parseInt(newBike.quantity) || 1;
        const existQty = parseInt(existing.quantity) || 1;
        existing.quantity = Math.max(existQty, newQty);

        // より正確で長い商品名や型番があれば補正
        if ((!existing.model_code || existing.model_code.length < 3) && newBike.model_code) {
          existing.model_code = newBike.model_code;
        }
        if (newBike.model_name && newBike.model_name.length > (existing.model_name || "").length) {
          existing.model_name = newBike.model_name;
        }

        // 確認時間の記録（写真1、写真2など別アングルをすべて追記）
        if (newBike.timestamp && !existing.timestamp.includes(newBike.timestamp)) {
          existing.timestamp += `, ${newBike.timestamp}`;
        }
      } else {
        list.push(Object.assign({}, newBike));
      }
    });

    return list;
  }

  // --- Files API アップロード ---
  async function uploadToGeminiFilesApi(file, mimeType, apiKey) {
    const initUrl = `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}`;
    const initResponse = await fetch(initUrl, {
      method: "POST",
      headers: {
        "X-Goog-Upload-Protocol": "resumable",
        "X-Goog-Upload-Command": "start",
        "X-Goog-Upload-Header-Content-Length": file.size.toString(),
        "X-Goog-Upload-Header-Content-Type": mimeType,
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
      throw new Error(`ファイル送信エラー (${uploadResponse.status}): ${errText}`);
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

  // --- Stage 1: Flash-Lite トリアージ ---
  async function analyzeValidSegmentsWithLite(fileUri, apiKey) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${apiKey}`;
    const prompt = "この動画から、自転車やPOPが明確に映っている有効な時間区間（例: 00:15 - 00:45）を特定してください。";
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

      if (!response.ok) return { valid_segments: [], summary: "全編有効" };
      const resJson = await response.json();
      return JSON.parse(resJson.candidates[0].content.parts[0].text);
    } catch (e) {
      return { valid_segments: [], summary: "全編有効" };
    }
  }

  // --- Stage 1 (写真用): Flash-Lite による写真空間マッピング ＆ 写り込みトリアージ ---
  async function analyzePhotoMappingWithLite(fileItems, apiKey) {
    if (!fileItems || fileItems.length <= 1) {
      return { overlap_summary: "単一写真", estimated_unique_bikes: 1 };
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${apiKey}`;
    const prompt = `
    これらの ${fileItems.length} 枚の写真は、同一店舗の自転車売場を撮影した写真群です。
    全写真を見比べ、以下の2点を整理してください：
    1. 写真間で「同じ自転車・同じ値札POP」が別アングルや見切れで重複して写っている組み合わせ（例: "写真1の車体は写真3にも写っている" 等）
    2. 売場全体でユニークな自転車はおおよそ何台存在するか
    `;

    const schema = {
      type: "OBJECT",
      properties: {
        overlap_summary: { type: "STRING" },
        estimated_unique_bikes: { type: "INTEGER" }
      },
      required: ["overlap_summary"]
    };

    const contentParts = [{ text: prompt }];
    fileItems.forEach(item => {
      contentParts.push({ file_data: { mime_type: item.mimeType, file_uri: item.uri } });
    });

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: contentParts }],
          generationConfig: { responseMimeType: "application/json", responseSchema: schema }
        })
      });

      if (!response.ok) return { overlap_summary: "全写真から重複排除して抽出" };
      const resJson = await response.json();
      return JSON.parse(resJson.candidates[0].content.parts[0].text);
    } catch (e) {
      return { overlap_summary: "全写真から重複排除して抽出" };
    }
  }

  // --- Stage 2: 高精度Flashモデル (3.8 ➔ 3.7 ➔ 3.6 フォールバック) ---
  // fileItems: [{ uri: string, mimeType: string, label: string }]
  async function executePrecisionOcrWithFallback(fileItems, isImage, segmentInfo, masterRecords, apiKey) {
    const fallbackChain = ["gemini-3.8-flash", "gemini-3.7-flash", "gemini-3.6-flash"];

    let masterContext = "";
    if (masterRecords && masterRecords.length > 0) {
      masterContext = `
      【店舗マスターExcel情報】
      ${JSON.stringify(masterRecords.slice(0, 300))}
      
      【マスター照合ルール】
      1. POPを上記マスターと照合してください。
      2. 一致商品: is_master_match=true, master_price=マスター税抜価格, price_diff=売場税抜価格 - マスター税抜価格
      3. マスター外商品: is_master_match=false, master_price=null, price_diff=null, spec_notesに「【マスター外】」と付記し、POPの文字を正確に抽出。
      `;
    }

    const segmentsHint = (!isImage && segmentInfo && segmentInfo.valid_segments && segmentInfo.valid_segments.length > 0)
      ? `【有効区間情報】Liteモデルにより以下の区間にPOPが集中していることが判明しています: ${segmentInfo.valid_segments.join(", ")}。`
      : "";

    const photoMappingHint = (isImage && segmentInfo && segmentInfo.overlap_summary)
      ? `【Liteモデルによる事前同一車体マッピング情報】
      全写真の事前トリアージにより、同一車体の写り込み関係が以下のように整理されています:
      ${segmentInfo.overlap_summary}
      このマッピング情報を参照し、同一車体を確実に1レコードに統合してください。`
      : "";

    const isMultiImages = isImage && fileItems.length > 1;
    const multiImageNotice = isMultiImages
      ? `【複数枚の写真一括解析モード】
      添付された ${fileItems.length} 枚の写真（写真1〜写真${fileItems.length}）は同一売場の異なるアングルから撮影されたものです。
      必ず全写真を見比べ、同じ自転車が角度違いや見切れで複数枚に写っていても1件にまとめて二重計上しないでください。
      timestamp には写っていた写真番号（例: "[写真1]", "[写真1, 写真2]"）を記録してください。`
      : "";

    const mediaLabel = isImage ? (isMultiImages ? `${fileItems.length}枚の写真` : "写真") : "動画";

    const prompt = `
    あなたは自転車小売業の競合店舗調査の専門エキスパートです。
    この${mediaLabel}に映っているすべての自転車の【値札・プライスカードPOP】を読み取り、
    全商品の詳細情報を漏れなく抽出してください。
    
    ★【重要：価格表記の基本方針】
    競合調査の実務基準として【税抜価格（本体価格）】を基本とします。
    POPに「税抜（本体価格）」と「税込」の両方が記載されている場合は、税抜価格を主軸として正確に読み取ってください。
    POPに税込価格のみ記載されている場合は、税抜価格 ＝ round(税込価格 / 1.1) で算出して記録してください。
    ${multiImageNotice}
    ${photoMappingHint}
    ${segmentsHint}
    ${masterContext}

    【抽出項目】
    - category: 大分類（電動アシスト / シティ・ファミリー / スポーツ・クロス / キッズ・ジュニア / 折りたたみ・ミニベロ / その他）
    - maker: メーカー（パナソニック / ブリヂストン / ヤマハ / GIANT / あさひPB / その他）
    - model_name: 車種名・モデル名
    - model_code: 型番/品番（POPに記載があれば）
    - model_year: 年式（例: 2024年, 2023年型落ち, 不明）
    - price_tax_excluded: 税抜価格（本体価格・円・数値。最重要基準）
    - master_price: マスター税抜価格（マスターに存在する場合のみ数値、ない場合はnull）
    - price_diff: 税抜差額（売場税抜価格 − マスター税抜価格。ない場合はnull）
    - price_tax_included: 税込価格（円・数値）
    - is_master_match: マスターに存在したかどうかのブール値（true/false）
    - quantity: 展示台数（POP記載の台数、または売場に物理的に並んでいる台数）
    - spec_notes: 仕様・セールPOPメモ（例: 16.0Ah、内装3段、特価POP等）
    - timestamp: 時間または写真番号（動画の場合は出現時間 01:23、写真の場合は「写真1」等）

    【重複排除の重要ルール（角度違い・位置違いの完全防止）】
    ・角度や距離を変えて撮影した写真、あるいは隣の自転車を撮った際に奥や横に見切れて写り込んだ同一車体・同一POPは、必ず1件にまとめて二重計上しないでください。
    ・同一車体が複数枚の写真に写っていても「展示台数」を水増しせず、売場に物理的に展示されている実台数を記録してください。
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
              price_tax_excluded: { type: "INTEGER" },
              master_price: { type: "INTEGER" },
              price_diff: { type: "INTEGER" },
              price_tax_included: { type: "INTEGER" },
              is_master_match: { type: "BOOLEAN" },
              quantity: { type: "INTEGER" },
              spec_notes: { type: "STRING" },
              timestamp: { type: "STRING" }
            },
            required: ["category", "maker", "model_name", "price_tax_excluded", "price_tax_included", "quantity", "timestamp"]
          }
        }
      },
      required: ["bikes"]
    };

    // 複数ファイルをパーツとして展開
    const contentParts = [{ text: prompt }];
    fileItems.forEach(item => {
      contentParts.push({
        file_data: { mime_type: item.mimeType, file_uri: item.uri }
      });
    });

    let lastError = null;

    for (const model of fallbackChain) {
      try {
        console.log(`モデル ${model} で解析を実行中（ファイル数: ${fileItems.length}件、API消費1回）...`);
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: contentParts }],
            generationConfig: { responseMimeType: "application/json", responseSchema: responseSchema }
          })
        });

        if (response.ok) {
          const resJson = await response.json();
          const candidate = resJson.candidates?.[0];
          if (candidate && candidate.content?.parts?.[0]?.text) {
            console.log(`✓ モデル ${model} で一括解析成功！`);
            return JSON.parse(candidate.content.parts[0].text);
          }
        }

        const errText = await response.text();
        lastError = new Error(`モデル ${model} エラー: ${errText}`);
      } catch (err) {
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
      const priceExc = parseInt(bike.price_tax_excluded) || (bike.price_tax_included ? Math.round(parseInt(bike.price_tax_included) / 1.1) : 0);
      const priceInc = parseInt(bike.price_tax_included) || Math.round(priceExc * 1.1);
      
      totalQty += qty;
      totalPrice += priceExc * qty; // 税抜価格で平均単価を集計

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
        <td class="px-3 py-2 text-right font-bold text-slate-900 whitespace-nowrap bg-indigo-50/30">¥${priceExc.toLocaleString()}</td>
        <td class="px-3 py-2 text-right text-slate-500 whitespace-nowrap font-mono">${mPrice}</td>
        <td class="px-3 py-2 text-right whitespace-nowrap">${diffHtml}</td>
        <td class="px-3 py-2 text-right text-slate-400 whitespace-nowrap text-[11px]">¥${priceInc.toLocaleString()}</td>
        <td class="px-3 py-2 text-center font-bold text-indigo-600">${qty}</td>
        <td class="px-3 py-2 text-slate-500 text-[11px]">${escapeHtml(bike.spec_notes || "")}</td>
        <td class="px-3 py-2 text-center font-mono text-xs text-indigo-700 bg-indigo-50/50 rounded font-semibold whitespace-nowrap">${escapeHtml(bike.timestamp || "確認済")}</td>
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
    const mediaCountLabel = selectedMediaFiles.length > 1 ? ` (ファイル計${selectedMediaFiles.length}件)` : "";
    resultMetaInfo.textContent = `店舗名: ${storeName} | 調査日: ${surveyDate}${mediaCountLabel} | 合計展示台数: ${totalQty}台`;
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
      const priceExc = parseInt(b.price_tax_excluded) || (b.price_tax_included ? Math.round(parseInt(b.price_tax_included) / 1.1) : 0);
      const priceInc = parseInt(b.price_tax_included) || Math.round(priceExc * 1.1);

      return {
        "カテゴリ": b.category || "",
        "メーカー": b.maker || "",
        "車種名・モデル名": b.model_name || "",
        "型番/品番": b.model_code || "",
        "年式": b.model_year || "不明",
        "税抜価格(円)": priceExc,
        "マスター税抜(円)": hasMPrice ? parseInt(b.master_price) : "-",
        "税抜差額(円)": hasMPrice && b.price_diff !== null && b.price_diff !== undefined ? parseInt(b.price_diff) : "-",
        "税込価格(円)": priceInc,
        "台数": parseInt(b.quantity) || 1,
        "特記事項・POP": b.spec_notes || "",
        "確認時間": b.timestamp || ""
      };
    });

    const ws = XLSX.utils.json_to_sheet(excelRows);

    ws["!cols"] = [
      { wch: 16 }, { wch: 16 }, { wch: 28 }, { wch: 16 }, { wch: 10 },
      { wch: 15 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 8 },
      { wch: 26 }, { wch: 20 }
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

    const headers = ["カテゴリ", "メーカー", "車種名・モデル名", "型番/品番", "年式", "税抜価格", "マスター税抜", "税抜差額", "税込価格", "台数", "特記事項・POP", "確認時間"];
    const rows = currentResults.map(b => {
      const isMatch = b.is_master_match === true;
      const hasMPrice = isMatch && b.master_price !== null && b.master_price !== undefined && b.master_price > 0;
      const priceExc = parseInt(b.price_tax_excluded) || (b.price_tax_included ? Math.round(parseInt(b.price_tax_included) / 1.1) : 0);
      const priceInc = parseInt(b.price_tax_included) || Math.round(priceExc * 1.1);

      return [
        `"${(b.category || "").replace(/"/g, '""')}"`,
        `"${(b.maker || "").replace(/"/g, '""')}"`,
        `"${(b.model_name || "").replace(/"/g, '""')}"`,
        `"${(b.model_code || "").replace(/"/g, '""')}"`,
        `"${(b.model_year || "").replace(/"/g, '""')}"`,
        priceExc,
        hasMPrice ? parseInt(b.master_price) : "-",
        hasMPrice && b.price_diff !== null && b.price_diff !== undefined ? parseInt(b.price_diff) : "-",
        priceInc,
        parseInt(b.quantity) || 1,
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
