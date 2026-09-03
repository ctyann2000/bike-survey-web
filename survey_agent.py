"""
自転車競合店調査 AI - Python 自律マルチエージェントスクリプト
(複数動画一括受付 ＆ 2段階自律パイプライン ＆ 自動マージ対応版)
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

    def analyze_videos_to_excel(
        self,
        video_paths: List[str],
        output_excel_path: str,
        store_name: str = "競合店舗",
        master_excel_path: Optional[str] = None
    ):
        total_videos = len(video_paths)
        print(f"🎬 合計 {total_videos} 本の動画を順次解析します。")

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

        combined_bikes: List[BikeRecord] = []

        for idx, v_path in enumerate(video_paths):
            v_label = f"[動画{idx + 1}] " if total_videos > 1 else ""
            print(f"\n==========================================")
            print(f"▶ 動画 {idx + 1}/{total_videos} の処理開始: {v_path}")
            print(f"==========================================")

            print("クラウドへアップロード中...")
            video_file = self.client.files.upload(file=v_path)
            while video_file.state.name == "PROCESSING":
                print("⏳ クラウド処理完了を待機中...")
                time.sleep(5)
                video_file = self.client.files.get(name=video_file.name)
                
            if video_file.state.name == "FAILED":
                print(f"⚠️ 動画 {v_path} の処理に失敗しました。スキップします。")
                continue

            # Stage 1: Flash-Lite トリアージ
            print("⚡ 【Stage 1】Flash-Lite による有効区間特定中...")
            lite_prompt = "この動画から、自転車や値札・POPが明確に映っている有効な時間区間（例: 00:15 - 00:45）を特定してください。"
            try:
                lite_res = self.client.models.generate_content(
                    model="gemini-3.5-flash-lite",
                    contents=[lite_prompt, video_file],
                    config={"response_mime_type": "application/json", "response_schema": LiteSegmentResult}
                )
                seg = LiteSegmentResult.model_validate_json(lite_res.text)
                seg_hint = f"有効区間: {', '.join(seg.valid_segments)}"
            except Exception:
                seg_hint = "全編有効"

            # Stage 2: Flash 精密読取
            print("🔍 【Stage 2】Flash高精度モデルによる精密解析中...")
            prec_prompt = f"""
            店舗名: {store_name}
            【有効区間情報】: {seg_hint}
            動画内の自転車の値札・プライスカードPOPを読み取り、全商品を抽出してください。
            {master_context}
            """

            survey_res = None
            for model in ["gemini-3.8-flash", "gemini-3.7-flash", "gemini-3.6-flash"]:
                try:
                    res = self.client.models.generate_content(
                        model=model,
                        contents=[prec_prompt, video_file],
                        config={"response_mime_type": "application/json", "response_schema": SurveyResult}
                    )
                    survey_res = SurveyResult.model_validate_json(res.text)
                    print(f"✓ モデル {model} で抽出成功！ ({len(survey_res.bikes)} SKU)")
                    break
                except Exception as ex:
                    print(f"モデル {model} リトライ: {ex}")

            if survey_res and survey_res.bikes:
                for b in survey_res.bikes:
                    b.timestamp = f"{v_label}{b.timestamp}"
                    combined_bikes.append(b)

        # 重複統合
        print("\n📊 全動画のデータを統合・Excelへ書き出し中...")
        bike_map = {}
        for b in combined_bikes:
            key = f"{(b.model_name or '').strip()}|{(b.model_code or '').strip()}|{b.price_tax_included}"
            if key in bike_map:
                existing = bike_map[key]
                existing.quantity += b.quantity
                if b.timestamp not in existing.timestamp:
                    existing.timestamp += f", {b.timestamp}"
            else:
                bike_map[key] = b

        final_bikes = list(bike_map.values())
        rows = []
        for b in final_bikes:
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
            ws = writer.sheets["調査結果"]
            for col in ws.columns:
                max_len = max(len(str(cell.value or '')) for cell in col)
                col_letter = col[0].column_letter
                ws.column_dimensions[col_letter].width = max(max_len + 3, 12)

        print(f"🎉 完了！ 統合Excelを出力しました: {output_excel_path}")
        print(f"合計展示台数: {df['台数'].sum()} 台 (統合後SKU数: {len(df)})")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("使用法: python survey_agent.py <動画1> [動画2] ... [出力Excelパス]")
        sys.exit(1)
    
    agent = BikeSurveyAgentSystem()
    v_paths = [a for a in sys.argv[1:] if a.endswith(('.mp4', '.mov', '.webm', '.avi'))]
    out_p = "競合調査統合結果.xlsx"
    agent.analyze_videos_to_excel(v_paths, out_p)
