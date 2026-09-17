# 时光书 H5 Demo 资产版规划与生图提示词

## 1. 参考图风格提取

参考目录：`D:\ai_biancheng\时光书\风格参考`

核心参考风格：

1. 粉白、浅紫、奶油黄、薄荷绿、浅蓝组成的柔和治愈色系。
2. Q 版大头角色，圆眼、柔软发丝、低攻击性表情。
3. 角色资产板结构清晰：主角三视图、表情、日常卡片、陪伴角色、道具、装饰、背景、容器。
4. UI 语言是浅色卡片、软圆角、细线、轻阴影、粉色主按钮。
5. 背景和装饰是轻量手账感：云朵、月亮、星星、花、爱心、虚线分隔、相纸框、便签纸、贴纸。

重构方向：

原参考是猫咪健康/生活记录主题。时光书必须重构为亲子记忆主题，不出现咖啡、睡眠实验室等原主题元素。保留柔和、Q版、资产板式组织方式，替换为：

1. 父母与孩子的温柔陪伴。
2. 成长照片、时光书、日记卡、画笔、相册、时间轴。
3. AI 叙事助手以“记忆小精灵/书页精灵”表达，不做强科技感。
4. 场景围绕家庭、书桌、窗边、相册、毕业、生日、日常拥抱。

## 2. 资产版一：角色与插画资产版

### 2.1 目标

生成一张完整资产板，用于指导后续 H5 Demo 的角色插画和情绪图资产。

### 2.2 必须包含

1. 主角色：父母记录者，温柔年轻妈妈形象，可作为用户情感代理。
2. 孩子角色：可爱孩子，年龄 6-10 岁之间，中性气质，不绑定具体性别。
3. 陪伴角色：时光书小精灵，像一本有表情的小书或纸页精灵。
4. 主角色三视图：正面、侧面、背面。
5. 角色表情：微笑、感动、思考、惊喜、认真记录、温柔拥抱。
6. 亲子日常卡片：看相册、写日记、拥抱、生日、毕业、睡前讲故事、窗边聊天。
7. 生成类型小插画：文章、漫画、日记卡三个入口的代表插画。
8. 道具：相册、手机、照片、画笔、信封、日记本、星星贴纸、时间轴丝带。
9. 装饰元素：爱心、星星、小花、胶带、相纸角标、虚线箭头。

### 2.3 风格要求

1. 中文资产板布局，标题为“时光书 角色与插画资产版”。
2. 白底或极浅粉底，网格分区，像专业设计资产板。
3. 使用柔和粉白、浅紫、奶油黄、薄荷绿、浅蓝。
4. 线条干净，手绘感，轻水彩或柔和赛璐璐质感。
5. 角色大眼 Q 版，但父母角色不要幼稚化。
6. 画面不要出现真实 UI 页面，不要手机界面截图。
7. 不要复制参考图中的猫娘、猫咖、睡眠、咖啡主题。

### 2.4 生图提示词

```text
Use case: illustration-story
Asset type: product illustration asset board for a parent-child memory H5 app
Input images: use the provided reference images only for overall asset-board structure, soft pastel palette, Q-version character proportions, rounded hand-drawn illustration style, tiny decorative motifs, and clean labeled design-board layout. Do not copy any existing character, cat-girl, coffee, sleep, or cat health theme.

Primary request:
Create a complete Chinese-labeled character and illustration asset board for the product “时光书”, a parent-child memory journal app. The board should feel like a professional cute healing design asset sheet, heavily reconstructed for parent-child memory recording.

Board title text:
“01 角色与插画资产版”

Required board sections with Chinese labels:
1. “父母记录者（主角）” - a warm young mother/parent character holding a photo book and pen, front view large pose.
2. “三视图” - front, side, back views of the parent character.
3. “孩子角色” - a cute child aged 6-10, neutral gender feeling, holding a small photo.
4. “时光书小精灵” - a tiny living book/page spirit companion with soft eyes, bookmark tail, and paper wings.
5. “表情” - six small expressions: 微笑, 感动, 思考, 惊喜, 认真记录, 温柔拥抱.
6. “亲子日常卡片” - small scene cards: 看相册, 写日记, 拥抱, 生日, 毕业, 睡前故事, 窗边聊天.
7. “生成入口插画” - three mini illustrations: 生成文章, 生成漫画, 日记卡.
8. “小物与道具” - album, phone, photo print, pen, envelope, diary notebook, ribbon timeline, star stickers.
9. “装饰元素” - hearts, stars, flowers, tapes, photo corners, dotted arrows, tiny sparkles.

Style/medium:
Cute soft hand-drawn digital illustration, pastel anime-chibi influence, gentle watercolor texture, clean thin outlines, soft cell shading, high polish, professional mobile app asset board.

Composition/framing:
Landscape design board, organized into clean grid sections with thin pastel dividers, lots of breathing room, small neat Chinese section labels, assets displayed separately, not as a UI screen.

Color palette:
warm blush pink, milky white, soft lavender, pale sky blue, butter yellow, mint green, warm brown line art. Avoid saturated neon colors.

Mood:
Warm, tender, memory-preserving, parent-child intimacy, gentle but usable for a polished H5 product.

Constraints:
No copied cat-girl character, no coffee theme, no sleep tracking theme, no medical/experiment theme, no real UI page, no app screenshots, no watermark. Keep all assets original for 时光书. Chinese labels should be short and readable where possible.
```

## 3. 资产版二：背景与装饰资产版

### 3.1 目标

生成一张背景与装饰资产板，用于后续 H5 Demo 的背景、卡片装饰、页面空状态、加载态和生成预览容器。

### 3.2 必须包含

1. 渐变背景：清晨粉白、夜晚浅紫、纪念日暖黄、回忆书页米白。
2. 纸纹与图案：网格纸、相册纸、花朵点纹、星星点纹、淡粉格纹。
3. 室内场景背景：窗边书桌、家庭客厅、睡前床边、相册桌面。
4. 天空与云朵背景：晨光云、夜晚月亮、星光云、夕阳云。
5. 自然元素：小花、叶子、花瓣、盆栽。
6. 漂浮装饰：爱心、星星、月亮、闪光、小云。
7. 分隔线：虚线、花朵线、星星线、时间轴线。
8. 容器框：相纸框、便签纸、对话气泡、书页卡、剪贴板、日记卡底板。
9. 大块背景形状：柔和粉色块、浅紫色块、奶油黄块、窗户/书页边角。

### 3.3 风格要求

1. 中文资产板标题为“时光书 背景与装饰资产版”。
2. 不生成具体 UI 页面，只生成可复用背景和装饰元素。
3. 风格和角色资产版保持一致。
4. 装饰要可用于 H5，不要太复杂。
5. 留白、柔和、清晰分组。

### 3.4 生图提示词

```text
Use case: illustration-story
Asset type: background and decoration asset board for a parent-child memory H5 app
Input images: use the provided reference images only for pastel asset-board organization, soft decorative motifs, rounded paper/card shapes, gentle gradients, and cute hand-drawn texture. Do not copy the original cat/cat-girl/coffee/sleep theme.

Primary request:
Create a complete Chinese-labeled background and decoration asset board for the product “时光书”, a parent-child memory journal H5 app. The board should provide reusable backgrounds, page decorations, frames, dividers, and soft scene assets for timeline cards, chat pages, and generated memory previews.

Board title text:
“02 背景与装饰资产版”

Required board sections with Chinese labels:
1. “渐变背景” - four soft rounded rectangles: 清晨粉白, 夜晚浅紫, 纪念日暖黄, 回忆书页.
2. “纸纹与图案” - grid paper, album paper, tiny flower pattern, tiny star pattern, soft pink plaid.
3. “室内场景背景” - window desk, family living room, bedtime corner, photo-album tabletop.
4. “天空与云朵” - morning cloud, moonlit cloud, starry cloud, sunset cloud.
5. “自然元素” - small flowers, leaves, petals, potted plant.
6. “漂浮装饰” - hearts, stars, moon, sparkles, tiny clouds, warm light dots.
7. “装饰线条与分隔” - dotted line, flower divider, star divider, timeline line, soft arrow line.
8. “卡片与容器” - photo frame, sticky note, speech bubble, book page card, clipboard, diary card base.
9. “背景大块元素” - soft pink blob, lavender blob, butter yellow blob, book-page corner, window frame.

Style/medium:
Soft pastel hand-drawn digital illustration, gentle watercolor texture, clean thin outlines, rounded shapes, cute but mature enough for parents, polished product asset sheet.

Composition/framing:
Landscape asset board, neatly divided grid, white or very pale pink background, small readable Chinese labels, each asset isolated with generous spacing, no actual UI screens.

Color palette:
blush pink, milky white, soft lavender, pale sky blue, butter yellow, mint green, warm beige, light brown outlines. Avoid neon, heavy shadows, dark backgrounds.

Mood:
Tender, memory-book, parent-child warmth, quiet artistic H5 app assets.

Constraints:
No characters as the main focus, no cat-girl, no cat coffee, no sleep tracker, no medical lab, no phone UI screenshots, no watermark. Assets should be reusable as H5 backgrounds and decorations for 时光书.
```
