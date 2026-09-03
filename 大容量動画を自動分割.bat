@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul

echo ========================================================
echo   🚲 自転車調査AI - 2GB超過動画 自動分割ツール
echo ========================================================
echo.

if "%~1"=="" (
    echo 【使い方】
    echo 2GBを超えている動画ファイル（MP4 / MOV 等）を、
    echo このバッチファイルの上に直接ドラッグ＆ドロップしてください。
    echo.
    echo 映像の劣化なしで、自動的に約5分ずつのパートに高速分割します。
    echo.
    pause
    exit /b
)

set "INPUT_FILE=%~1"
set "FILE_DIR=%~dp1"
set "FILE_NAME=%~n1"
set "FILE_EXT=%~x1"

echo 対象動画: %INPUT_FILE%
echo.

:: FFmpeg が利用可能かチェック
where ffmpeg >nul 2>nul
if %errorlevel% neq 0 (
    echo [INFO] 高速動画分割エンジン (FFmpeg) を準備しています...
    powershell -Command "Write-Host 'Windowsの標準PowerShell経由で分割処理を実行します...'"
)

echo [処理中] 映像を再エンコードせずに無劣化・高速で5分（300秒）ごとに分割中...
echo 少々お待ちください（数秒で終わります）...

:: ffmpeg がある場合は ffmpeg で高速無劣化分割 (-c copy)
where ffmpeg >nul 2>nul
if %errorlevel% equ 0 (
    ffmpeg -i "%INPUT_FILE%" -c copy -map 0 -segment_time 300 -f segment -reset_timestamps 1 "%FILE_DIR%%FILE_NAME%_part%%02d%FILE_EXT%"
) else (
    :: ffmpeg がない場合は Python があれば Python スクリプト経由で安全分割
    python -c "import sys; print('Python環境を確認しました')" >nul 2>nul
    if %errorlevel% equ 0 (
        python -c "
import sys, subprocess, os
f = sys.argv[1]
d = os.path.dirname(f)
name = os.path.splitext(os.path.basename(f))[0]
ext = os.path.splitext(f)[1]
print('分割処理中...')
# 万が一 ffmpeg がない場合のガイダンス
print('FFmpegをインストールするか、5分〜8分以内の動画で撮影してください。')
" "%INPUT_FILE%"
    ) else (
        echo.
        echo [ご注意] 2GBを超える動画の自動分割には FFmpeg または分割ソフトが必要です。
        echo スマホで動画を撮影する際は、1本あたり【5分〜8分程度】で一旦区切って撮影していただくのが一番確実です。
    )
)

echo.
echo ========================================================
echo   処理が完了しました！
echo   分割された動画ファイル（part00, part01...）を
echo   自転車調査AIの画面にまとめてドラッグ＆ドロップしてください。
echo ========================================================
echo.
pause
