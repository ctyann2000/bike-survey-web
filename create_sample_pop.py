from PIL import Image, ImageDraw, ImageFont
import os

# リアルな自転車値札POP画像を生成
img = Image.new('RGB', (850, 600), color='#ffffff')
draw = ImageDraw.Draw(img)

# 外枠
draw.rectangle([(15, 15), (835, 585)], outline='#0f172a', width=4)

# 赤いヘッダー帯
draw.rectangle([(15, 15), (835, 95)], fill='#b91c1c')
draw.text((40, 35), 'CYCLE SPOT SPECIAL PRICE - 店頭おすすめ特売車', fill='#ffffff')

# 商品情報
draw.text((40, 120), 'メーカー: Panasonic (パナソニック)', fill='#1e293b')
draw.text((40, 160), '車種名: ビビ・DX (ViVi DX) 26インチ 2024年モデル', fill='#0f172a')
draw.text((40, 200), '型番 / 品番: BE-FD631', fill='#475569')

# 価格エリア (黄色ハイライト)
draw.rectangle([(40, 250), (810, 420)], fill='#fef9c3', outline='#ca8a04', width=3)
draw.text((60, 270), '【期間限定】特別奉仕価格', fill='#b45309')
draw.text((60, 310), '税込 119,800 円', fill='#dc2626')
draw.text((60, 365), '（税抜 108,909 円）', fill='#64748b')

# スペック・特記
draw.text((40, 450), '■ 展示台数: 3台', fill='#0f172a')
draw.text((40, 485), '■ 仕様: 大容量16.0Ahバッテリー / 内装3段変速 / 国産フレーム', fill='#334155')
draw.text((40, 520), '■ 特記事項: 3年間盗難補償付き！店頭即納可能です', fill='#047857')

out_path = 'sample_bike_pop.png'
img.save(out_path)
print('Generated:', os.path.abspath(out_path))
