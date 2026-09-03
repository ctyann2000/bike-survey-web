"""
自転車競合店調査 AI - Python 自律マルチエージェントスクリプト
(2段階自律パイプライン: Liteトリアージ ➔ 3.8/3.7/3.6 Flash精密読取)
"""
import asyncio
import os
import sys
import time
from dataclasses import dataclass, field
from typing import Any, Callable, Coroutine, Dict, List, Optional
import pandas as pd
from pydantic import BaseModel, Field
from google import genai
from google.genai import types

class BikeRecord(BaseModel):
    category: str = Field(description="大分類（電動アシスト/シティ/クロス/キッズ等）")
    maker: str = Field(description="メーカー名")
    model_name: str = Field(description="車種名・モデル名")
    model_code: Optional[str] = Field(default="", description="型番・品番")
    model_year: Optional[str] = Field(default="不明", description="年式")
    price_tax_included: int = Field(description="税込価格(円)")
    master_price: Optional[int] = Field(default=None, description="マスター価格(円)")
    price_diff: Optional[int] = Field(default=None, description="差額(円): 税込価格 - マスター価格")
    is_master_match: Optional[bool] = Field(default=False, description="マスターに存在したか")
    quantity: int = Field(default=1, description="展示台数")
    price_tax_excluded: int = Field(description="税抜価格(円)")
    spec_notes: str = Field(default="", description="仕様・セールPOP等の特記事項")
    timestamp: str = Field(description="動画内時間（例: 01:23）")

class SurveyResult(BaseModel):
    store_name: Optional[str] = Field(default="競合店舗")
    survey_date: Optional[str] = Field(default="")
    bikes: List[BikeRecord] = Field(default_factory=list)

class LiteSegmentResult(BaseModel):
    valid_segments: List[str] = Field(default_factory=list, description="POPや自転車が映っている有効区間")
    summary: str = Field(default="", description="有効区間の要約")

class BikeSurveyAgentSystem:
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.environ.get("GEMINI_API_KEY")
        if not self.api_key:
            raise ValueError("GEMINI_API_KEY が設定されていません。環境変数または引数で指定してください。")
        self.client = genai.Client(api_key=self.api_key)

    def analyze_video_to_excel(
        self,
        video_path: str,
        output_excel_path: str,
        store_name: str = "競合店舗",
        master_excel_path: Optional[str] = None
    ):
        print(f"🎬 [1/5] 動画をアップロード中: {video_path}")
        video_file = self.client.files.upload(file=video_path)
        
        while video_file.state.name == "PROCESSING":
            print("⏳ クラウド処理完了を待機中...")
            time.sleep(5)
            video_file = self.client.files.get(name=video_file.name)
            
        if video_file.state.name == "FAILED":
            raise RuntimeError("動画の処理に失敗しました。")

        # --- Stage 1: Flash-Lite によるトリアージ（有効区間の事前判別）---
        print("⚡ [2/5] 【Stage 1】Gemini 3.5 Flash-Lite (1日500回枠) による有効区間のトリアージを実行中...")
        lite_prompt = """
        この動画から、自転車や値札・POPが明確に映っている有効な時間区間（例: "00:15 - 00:45", "01:20 - 02:05"...）を特定し、
        移動時間やブレなどの無効区間を除外したサマリーを作成してください。
        """
        try:
            lite_res = self.client.models.generate_content(
                model="gemini-3.5-flash-lite",
                contents=[lite_prompt, video_file],
                config={"response_mime_type": "application/json", "response_schema": LiteSegmentResult}
            )
            segment_data = LiteSegmentResult.model_validate_json(lite_res.text)
            segments_hint = f"有効区間: {', '.join(segment_data.valid_segments)}"
            print(f"✓ 有効区間を特定: {segments_hint}")
        except Exception as e:
            print(f"Liteステージはスキップし全編精密読取へ進みます: {e}")
            segments_hint = "全編有効"

        # --- Stage 2: マスター情報の準備 ---
        master_context = ""
        if master_excel_path and os.path.exists(master_excel_path):
            print(f"📖 店舗マスターExcelを読み込み中: {master_excel_path}")
            df_master = pd.read_excel(master_excel_path) if master_excel_path.endswith(('.xlsx', '.xls')) else pd.read_csv(master_excel_path)
            master_json = df_master.head(300).to_json(orient="records", force_ascii=False)
            master_context = f"""
            【店舗マスターExcel情報】
            {master_json}

            【マスター照合およびマスター外ルール】
            1. 動画に映るPOP・値札を、上記マスターと優先的に照合してください。
            2. 一致商品: is_master_match=true, master_price=マスター価格, price_diff=税込 - マスター価格
            3. マスターにない商品（型落ち処分、未登録品等）: is_master_match=false, master_price=null, price_diff=null, spec_notesに「【マスター外】」と付記し、POPの文字を正確に抽出。
            """

        # --- Stage 3: 高精度 Flash モデル (3.8 ➔ 3.7 ➔ 3.6 フォールバック) による精密読取 ---
        print("🔍 [3/5] 【Stage 2】高精度Flashモデル (Gemini 3.8/3.7/3.6) による精密OCR・差額照合を実行中...")
        precision_prompt = f"""
        あなたは自転車小売業の競合店舗調査の専門エキスパートです。
        店舗名: {store_name}
        【Liteによる有効区間情報】: {segments_hint}。この区間に特に注視してください。
        動画に映っているすべての自転車のPOP・値札を時系列で認識し、
        重複を排除して全商品の詳細情報を漏れなく抽出してください。
        {master_context}

        【ルール】
        1. 同一車両が連続して映っている場合は1台（または並んでいる台数）としてまとめてください。
        2. 各車両の動画内タイムスタンプ（例: 01:23）を必ず記録してください。
        """

        survey_res = None
        for model in ["gemini-3.8-flash", "gemini-3.7-flash", "gemini-3.6-flash"]:
            try:
                print(f"モデル {model} を呼び出し中...")
                res = self.client.models.generate_content(
                    model=model,
                    contents=[precision_prompt, video_file],
                    config={"response_mime_type": "application/json", "response_schema": SurveyResult}
                )
                survey_res = SurveyResult.model_validate_json(res.text)
                print(f"✓ モデル {model} で抽出成功！")
                break
            except Exception as ex:
                print(f"モデル {model} 失敗 ({ex})。次のモデルへフォールバックします...")

        if not survey_res:
            raise RuntimeError("すべてのFlashモデルでの解析に失敗しました。")

        # --- Stage 4: Excel整形・出力 ---
        print("📊 [4/5] データを整形・Excelファイルへ書き出し中...")
        rows = []
        for b in survey_res.bikes:
            is_match = b.is_master_match is True
            rows.append({
                "カテゴリ": b.category or "",
                "メーカー": b.maker or "",
                "車種名・モデル名": b.model_name or "",
                "型番/品番": b.model_code or "",
                "年式": b.model_year or "不明",
                "税込価格(円)": b.price_tax_included,
                "マスター価格(円)": b.master_price if is_match and b.master_price is not None else "-",
                "差額(円)": b.price_diff if is_match and b.price_diff is not None else "-",
                "台数": b.quantity,
                "税抜価格(円)": b.price_tax_excluded,
                "特記事項・POP": b.spec_notes or "",
                "確認時間": b.timestamp or ""
            })

        df = pd.DataFrame(rows)

        with pd.ExcelWriter(output_excel_path, engine="openpyxl") as writer:
            df.to_excel(writer, index=False, sheet_name="調査結果")
            worksheet = writer.sheets["調査結果"]
            for col in worksheet.columns:
                max_len = max(len(str(cell.value or '')) for cell in col)
                col_letter = col[0].column_letter
                worksheet.column_dimensions[col_letter].width = max(max_len + 3, 11)

        print(f"🎉 [5/5] 完了！ Excelを出力しました: {output_excel_path}")
        print(f"合計展示台数: {df['台数'].sum()} 台 (検出SKU数: {len(df)})")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("使用法: python survey_agent.py <動画ファイルパス> [出力Excelパス] [店舗名] [マスターExcelパス]")
        sys.exit(1)
    
    v_path = sys.argv[1]
    out_path = sys.argv[2] if len(sys.argv) > 2 else "競合調査結果.xlsx"
    s_name = sys.argv[3] if len(sys.argv) > 3 else "競合店舗"
    m_path = sys.argv[4] if len(sys.argv) > 4 else None
    
    agent = BikeSurveyAgentSystem()
    agent.analyze_video_to_excel(v_path, out_path, s_name, m_path)
