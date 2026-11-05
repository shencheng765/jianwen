"""Render the usage diagram. Optional dependency: Pillow. Does not open an app."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "images" / "jianwen-guide.png"
REG = Path("C:/Windows/Fonts/msyh.ttc")
BOLD = Path("C:/Windows/Fonts/msyhbd.ttc")
NAVY, INK, MUTED = "#173C62", "#182E45", "#5D7185"
BG, LINE, BLUE = "#F1F5FA", "#DCE5EF", "#2875D8"
im = Image.new("RGB", (2100, 2700), BG)
d = ImageDraw.Draw(im)

def font(size, bold=False):
    return ImageFont.truetype(str(BOLD if bold else REG), size)

def text(x, y, value, size=30, color=INK, bold=False):
    d.text((x, y), value, font=font(size, bold), fill=color)

def box(rect, fill="white", radius=24, outline=None, width=2):
    d.rounded_rectangle(rect, radius=radius, fill=fill, outline=outline, width=width)

def badge(x, y, value, color=BLUE, r=24):
    d.ellipse((x-r, y-r, x+r, y+r), fill=color)
    d.text((x, y-2), str(value), font=font(27, True), fill="white", anchor="mm")

def label(x, y, n, title, detail):
    badge(x+25, y+26, n)
    text(x+66, y-1, title, 32, bold=True)
    text(x+66, y+49, detail, 25, MUTED)

def arrow(points):
    d.line(points, fill="#95A9BF", width=3, joint="curve")
    x, y = points[-1]
    d.ellipse((x-5, y-5, x+5, y+5), fill=BLUE)

# Header
d.rectangle((0, 0, 2100, 332), fill=NAVY)
logo = Image.open(ROOT / "assets/icon.png").convert("RGBA")
logo.thumbnail((140, 140))
im.paste(logo, (96, 91), logo)
text(267, 69, "简文", 84, "white", True)
text(273, 185, "把想法写下来，让文字更清晰。", 35, "#D8E7F8")
box((1645, 94, 1988, 157), "#2C5278", 30)
text(1682, 107, "1.5.7  /  Windows", 28, "white")
text(1663, 193, "一分钟上手指南", 33, "#D8E7F8")

# Start strip
text(100, 385, "从一页文字开始", 46, bold=True)
text(100, 456, "记笔记 · 编辑命令与配置 · Markdown · 自选模型的 AI 助手", 29, MUTED)
for x, n, title, hint in [
    (100, "01", "新建 / 打开", "Ctrl+N  /  Ctrl+O"),
    (750, "02", "编辑并保存", "Ctrl+S  保存修改"),
    (1400, "03", "按需开启 AI", "配置后 Ctrl+Enter 发送"),
]:
    box((x, 535, x+600, 690), "white")
    text(x+29, 561, n, 44, BLUE, True)
    text(x+119, 554, title, 34, bold=True)
    text(x+119, 612, hint, 25, MUTED)

# Diagram with explicit schematic label
text(100, 748, "认识编辑界面", 43, bold=True)
text(1490, 766, "功能布局示意 · 非实拍截图", 25, MUTED)
label(105, 845, 1, "多标签与新建", "一页一个任务，拖动标签可排序")
label(1050, 845, 2, "菜单与外观", "保存、查找、主题与 Markdown")

sx, sy, ex, ey = 100, 995, 2000, 1715
box((sx, sy, ex, ey), "white", 25, LINE)
box((sx+2, sy+2, ex-2, sy+70), "#E9EFF6", 23)
d.rectangle((sx+2, sy+36, ex-2, sy+70), fill="#E9EFF6")
ico=logo.resize((36,36))
im.paste(ico,(sx+22,sy+16),ico)
box((sx+75, sy+10, sx+430, sy+69), "white", 12)
text(sx+99, sy+21, "欢迎使用简文       ×", 25)
text(sx+467, sy+13, "+", 37, MUTED)
text(ex-171, sy+17, "−     □     ×", 25, MUTED)
text(sx+30, sy+91, "文件     编辑     查看", 25)
text(ex-267, sy+91, "AI 助手", 25, BLUE)
gx, gy = ex-147, sy+110
d.ellipse((gx-11,gy-11,gx+11,gy+11),outline=BLUE,width=3)
d.ellipse((gx-3,gy-3,gx+3,gy+3),outline=BLUE,width=2)
for dx,dy in [(0,17),(0,-17),(17,0),(-17,0)]:
    d.line((gx+dx*.7,gy+dy*.7,gx+dx,gy+dy),fill=BLUE,width=3)
d.line((sx,sy+138,ex,sy+138), fill=LINE, width=2)
px = 1450
d.rectangle((px,sy+139,ex-2,ey-48),fill="#F7FAFE")
d.line((px,sy+139,px,ey-48),fill=LINE,width=2)

lines = [
    ("# 我的工作笔记", BLUE),
    ("", INK),
    ("把重要的事，写清楚。", INK),
    ("", INK),
    ("- 记录灵感和待办", INK),
    ("- 整理命令、脚本与配置", INK),
    ("- 使用 Markdown 排版预览", INK),
    ("", INK),
    ("按 Ctrl+S，保存这一页。", MUTED),
]
for i, (value, color) in enumerate(lines):
    yy=sy+179+i*49
    text(sx+32,yy,str(i+1),23,"#9AAABC")
    text(sx+104,yy,value,30,color,i==0)
text(px+31, sy+162, "AI 助手", 31, bold=True)
text(px+31, sy+213, "当前页 · 我的工作笔记", 23, MUTED)
box((px+29,sy+266,ex-30,sy+325),BLUE,12)
text(px+91,sy+279,"检查当前文本",25,"white",True)
text(px+31,sy+363,"连接自己的模型后，即可检查、",24,MUTED)
text(px+31,sy+406,"改写文字，或提出问题。",24,MUTED)
box((px+28,sy+473,ex-28,ey-85),"white",13,LINE)
text(px+46,sy+490,"想怎么修改当前文本？",23,"#8394A6")
text(px+46,ey-129,"Ctrl + Enter 发送",21,MUTED)
d.line((sx,ey-48,ex,ey-48),fill=LINE,width=2)
text(sx+26,ey-35,"行 1，列 1     ·     已保存",20,MUTED)
text(sx+1060,ey-35,"100%    Markdown    自动换行    CRLF    UTF-8",20,MUTED)

# Mark exact areas, arrows originate outside the application schematic.
badge(535,1050,1); badge(737,1110,2); badge(1790,1175,4)
badge(174,1400,3); badge(1850,1590,5); badge(1050,1688,6)
arrow([(390,949),(390,976),(535,976),(535,1021)])
arrow([(1370,949),(1370,971),(737,971),(737,1081)])
label(110,1765,3,"正文编辑区","文本、命令与代码；底部选择高亮语言")
label(1100,1765,4,"AI 检查与设置","填写接口地址、Key 和模型，先测试连接")
label(110,1885,5,"提问与可撤销写入","Ctrl+Enter 发送；AI 写入后 Ctrl+Z 撤销")
label(1100,1885,6,"状态栏","查看行列、缩放、语言、换行与编码")

# Lower practical cards
box((100,2050,1018,2515),"white")
box((1060,2050,2000,2515),"white")
text(140,2087,"常用快捷键",36,bold=True)
for i,(key,desc) in enumerate([
    ("Ctrl+F / Ctrl+H","查找 / 替换"),
    ("Ctrl+Shift+M","Markdown 排版预览"),
    ("Ctrl+Shift+C","复制为纯文本"),
    ("Ctrl+Shift+T","恢复最近关闭的标签"),
    ("Ctrl+Shift+N","新建窗口"),
]):
    yy=2160+i*61
    text(142,yy,key,26,BLUE,True)
    text(527,yy,desc,26)
text(1100,2087,"AI 配置，三步就好",36,bold=True)
for i,(title,detail) in enumerate([
    ("展开 AI 助手 → AI 设置","准备好服务商的接口、密钥与模型名"),
    ("测试连接 → 保存","接口需支持 Responses API"),
    ("检查当前文本 / 输入问题","大文件模式下只读取当前片段"),
]):
    yy=2164+i*104
    badge(1120,yy+20,i+1,r=19)
    text(1161,yy-1,title,28,bold=True)
    text(1161,yy+42,detail,24,MUTED)

text(101,2557,"普通编辑与离线拼写无需连接 AI；AI 请求会将当前文本与相关对话发送到你配置的服务商。",25,MUTED)
text(101,2621,"JIANWEN  /  简文",27,NAVY,True)
text(1415,2621,"MIT 开源  ·  Windows x64",26,MUTED)
OUT.parent.mkdir(parents=True, exist_ok=True)
im.save(OUT, optimize=True)
print(str(OUT))
