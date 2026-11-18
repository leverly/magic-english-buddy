"""Expand the ten numbered L1 lessons to a real story length.

Level 1 stays inside its own register (nouns, present simple, concrete words),
but each lesson grows from ~24 words to ~95 words so "2 minutes per story" is
true and a child actually spends time with the language.

Word timings are placeholders: the runtime highlights from
src/data/audio/manifest.json, which scripts/generate-audio.py rebuilds from the
same text. What must stay exact is the word sequence, because
scripts/export-audio-input.mjs asserts it against the paragraph text.
"""
import re
from pathlib import Path

STORY_FILE = Path("src/data/stories/l1/index.ts")

CONTENT = {
    "l1_001": [
        ("Once upon a time, there was a red apple on a small hill.",
         "从前，小山坡上有一个红苹果。"),
        ("The apple was very big and very shiny.",
         "这个苹果又大又亮。"),
        ("A little rabbit came to the hill. The rabbit was hungry.",
         "一只小兔子来到山坡上。兔子饿了。"),
        ("The rabbit looked at the red apple. It was happy.",
         "兔子看着红苹果。它很高兴。"),
        ("A little bird came too. The bird was hungry and sad.",
         "一只小鸟也来了。小鸟又饿又难过。"),
        ("The rabbit said, come and eat with me.",
         "兔子说，来和我一起吃吧。"),
        ("The rabbit and the bird ate the apple. They were happy.",
         "兔子和鸟一起吃了苹果。它们都很开心。"),
        ("Sharing makes a small apple a big happy day.",
         "分享让一个小苹果变成快乐的一天。"),
    ],
    "l1_002": [
        ("I have a little cat. My cat is white and soft.",
         "我有一只小猫。我的猫又白又软。"),
        ("My cat has two green eyes and a long tail.",
         "我的猫有两只绿眼睛和一条长尾巴。"),
        ("The cat likes to play with a small ball.",
         "小猫喜欢玩一个小球。"),
        ("It runs in the room. It jumps on the bed.",
         "它在房间里跑。它跳到床上。"),
        ("It drinks milk in the morning. It sleeps in the sun.",
         "它早上喝牛奶。它在太阳下睡觉。"),
        ("My cat is funny. My cat is my good friend.",
         "我的猫很有趣。我的猫是我的好朋友。"),
        ("I love my little cat. I love its soft white fur.",
         "我爱我的小猫。我爱它柔软的白毛。"),
    ],
    "l1_003": [
        ("Look at the sky. The sky is blue today.",
         "看看天空。今天天空是蓝色的。"),
        ("Look at the grass. The grass is green.",
         "看看草地。草地是绿色的。"),
        ("Look at the sun. The sun is big and yellow.",
         "看看太阳。太阳又大又黄。"),
        ("Look at the flower. The flower is red and small.",
         "看看花。花是红色的小花。"),
        ("Look at the cloud. The cloud is white and soft.",
         "看看云。云是白色的，软软的。"),
        ("Look at the bird. The bird is brown and happy.",
         "看看小鸟。小鸟是棕色的，很快乐。"),
        ("Red and yellow and green and blue. The world is beautiful.",
         "红色、黄色、绿色和蓝色。世界真美。"),
        ("What color do you like? I like green.",
         "你喜欢什么颜色？我喜欢绿色。"),
    ],
    "l1_004": [
        ("This is my family. We are happy together.",
         "这是我的家人。我们在一起很快乐。"),
        ("This is my mom. She is kind and she is tall.",
         "这是我妈妈。她很温柔，也很高。"),
        ("This is my dad. He is strong and he is funny.",
         "这是我爸爸。他很强壮，也很有趣。"),
        ("This is my sister. She is small and she likes songs.",
         "这是我妹妹。她很小，她喜欢唱歌。"),
        ("This is my brother. He likes balls and games.",
         "这是我哥哥。他喜欢球和游戏。"),
        ("We eat breakfast and dinner at one table.",
         "我们在一张桌子上吃早饭和晚饭。"),
        ("My mom reads a story to us at night.",
         "晚上妈妈给我们读故事。"),
        ("I love my family. My family loves me.",
         "我爱我的家人。我的家人也爱我。"),
    ],
    "l1_005": [
        ("Good morning! The sun is up.",
         "早上好！太阳出来了。"),
        ("I wake up at seven. I wash my face.",
         "我七点起床。我洗脸。"),
        ("I brush my teeth and put on my clothes.",
         "我刷牙，然后穿好衣服。"),
        ("I eat breakfast with my family. I eat bread and eggs.",
         "我和家人吃早饭。我吃面包和鸡蛋。"),
        ("I put my books in my bag. My bag is blue.",
         "我把书放进书包。我的书包是蓝色的。"),
        ("I walk to school with my friend. We talk and laugh.",
         "我和朋友走路上学。我们聊天、大笑。"),
        ("At school I read and I count and I sing.",
         "在学校我读书、数数，还唱歌。"),
        ("Good morning, school! Good morning, my friend!",
         "早上好，学校！早上好，我的朋友！"),
    ],
    "l1_006": [
        ("Let us count. One, two, three.",
         "我们来数数。一，二，三。"),
        ("I have one apple and two oranges.",
         "我有一个苹果和两个橘子。"),
        ("I have three bananas and four grapes.",
         "我有三根香蕉和四颗葡萄。"),
        ("I have five strawberries in my hand.",
         "我手里有五颗草莓。"),
        ("My friend has six eggs and seven cakes.",
         "我的朋友有六个鸡蛋和七块蛋糕。"),
        ("Eight, nine, ten. Ten little fingers.",
         "八，九，十。十个小小的手指。"),
        ("Ten and ten is twenty. We can count together.",
         "十加十是二十。我们可以一起数。"),
        ("Numbers are fun. I like to count with you.",
         "数字很有趣。我喜欢和你一起数数。"),
    ],
    "l1_007": [
        ("This is my dog. My dog is big and brown.",
         "这是我的狗。我的狗又大又棕。"),
        ("My dog has long ears and a short tail.",
         "我的狗有长长的耳朵和短短的尾巴。"),
        ("The dog can run very fast in the park.",
         "狗在公园里能跑得很快。"),
        ("The dog can jump and catch a red ball.",
         "狗能跳起来接住一个红球。"),
        ("Every morning we walk to the park together.",
         "每天早上我们一起去公园散步。"),
        ("The dog plays with the children. It is very happy.",
         "狗和孩子们一起玩。它非常开心。"),
        ("At night the dog sleeps near my bed.",
         "晚上狗睡在我的床边。"),
        ("My dog is my best friend. I love my dog.",
         "我的狗是我最好的朋友。我爱我的狗。"),
    ],
    "l1_008": [
        ("Today I go to the park with my dad.",
         "今天我爸爸带我去公园。"),
        ("The park is big and green. There are many trees.",
         "公园又大又绿。那里有很多树。"),
        ("I see a red flower and a small yellow bird.",
         "我看见一朵红花和一只小黄鸟。"),
        ("The bird can sing. It sings in the tree.",
         "小鸟会唱歌。它在树上唱歌。"),
        ("There is a boy and a girl near the water.",
         "水边有一个男孩和一个女孩。"),
        ("They play with a ball and they laugh.",
         "他们玩球，还大笑。"),
        ("My dad and I sit on a bench. We look at the sky.",
         "我和爸爸坐在长椅上。我们看天空。"),
        ("The park is a happy place. I want to come again.",
         "公园是个快乐的地方。我想再来。"),
    ],
    "l1_009": [
        ("These are my toys. I keep them in a big box.",
         "这些是我的玩具。我把它们放在一个大箱子里。"),
        ("I have a brown bear. My bear is soft.",
         "我有一只棕色的熊。我的熊很软。"),
        ("I have a small red car. It can go fast.",
         "我有一辆红色的小汽车。它跑得很快。"),
        ("I have a doll with long yellow hair.",
         "我有一个长着黄色长发的娃娃。"),
        ("I have four blocks and one blue ball.",
         "我有四块积木和一个蓝球。"),
        ("I play with my toys after school.",
         "放学后我玩我的玩具。"),
        ("At night I put my toys in the box.",
         "晚上我把玩具放进箱子。"),
        ("My toys are not new, but I love them all.",
         "我的玩具不新，但我都喜欢它们。"),
    ],
    "l1_010": [
        ("The sun is down. The moon is up.",
         "太阳落山了。月亮升起来了。"),
        ("The sky is dark and the stars are small and bright.",
         "天空黑了，星星又小又亮。"),
        ("I put on my warm clothes. I wash my face.",
         "我穿上暖和的衣服。我洗脸。"),
        ("My mom reads a story to me in bed.",
         "妈妈在床上给我读故事。"),
        ("The story is about a cat and a big moon.",
         "这个故事讲的是一只猫和一轮大月亮。"),
        ("The cat looks at the stars. The cat goes to sleep.",
         "猫看着星星。猫睡着了。"),
        ("I close my eyes. I dream of the moon and the stars.",
         "我闭上眼睛。我梦见月亮和星星。"),
        ("Good night, moon. Good night, my little cat.",
         "晚安，月亮。晚安，我的小猫。"),
    ],
}


def words_block(text: str, step: int = 260) -> str:
    tokens = text.split()
    lines = []
    for index, token in enumerate(tokens):
        start = index * step
        end = start + step - 40
        lines.append(f"          {{ word: {token!r}, start: {start}, end: {end}, index: {index} }},")
    return "\n".join(lines)


def render_content(story_id: str, paragraphs) -> str:
    out = ["    content: ["]
    for index, (text, translation) in enumerate(paragraphs, start=1):
        start = (index - 1) * 8000
        end = start + 7500
        out.append("      {")
        out.append(f"        paragraphId: '{story_id}_p{index}',")
        out.append(f"        text: '{text}',")
        out.append(f"        translation: '{translation}',")
        out.append(f"        audioStart: {start},")
        out.append(f"        audioEnd: {end},")
        out.append("        words: [")
        out.append(words_block(text))
        out.append("        ],")
        out.append("      },")
    out.append("    ],")
    return "\n".join(out)


def word_count(paragraphs) -> int:
    return sum(len(re.findall(r"[A-Za-z']+", text)) for text, _ in paragraphs)


source = STORY_FILE.read_text()
blocks = re.split(r"(?=\n  \{\n    id: ')", source)

for story_id, paragraphs in CONTENT.items():
    for position, block in enumerate(blocks):
        if not block.strip().startswith("{"):
            continue
        if not block.lstrip().startswith(f"{{\n    id: '{story_id}'"):
            continue
        content_start = block.index("    content: [")
        quiz_start = block.index("\n    quiz: [")
        new_content = render_content(story_id, paragraphs)
        block = block[:content_start] + new_content + block[quiz_start:]

        count = word_count(paragraphs)
        # Roughly 60 spoken words per minute at 0.85x, plus a reading pass.
        minutes = max(2, round(count / 40))
        block = re.sub(r"wordCount: \d+", f"wordCount: {count}", block, count=1)
        block = re.sub(r"estimatedTime: \d+", f"estimatedTime: {minutes}", block, count=1)
        blocks[position] = block
        print(f"{story_id}: {count} words, ~{minutes} min, {len(paragraphs)} paragraphs")
        break

STORY_FILE.write_text("".join(blocks))
