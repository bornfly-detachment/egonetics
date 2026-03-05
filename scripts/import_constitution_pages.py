#!/usr/bin/env python3
"""
把 ~/.claude/constitution/ 按目录结构导入为 egonetics_pages + egonetics_page_blocks
每个文件 = 一个 page，目录 = folder page
"""

import re, uuid, json, time, urllib.request, urllib.error
from pathlib import Path

BASE = "http://localhost:3002/api"
CONSTITUTION = Path.home() / ".claude" / "constitution"

# subject_id → constitution 目录的映射
SUBJECT_MAP = [
    {
        "name": "主体性 · Subjectivity",
        "dir": CONSTITUTION / "subjectivity",
        "subject_id": None,  # 从 API 查
    },
    {
        "name": "AI生命力 · 硅基生命内核",
        "dir": CONSTITUTION / "ai_eternal_life_force",
        "subject_id": None,
    },
    {
        "name": "用户生命力 · 生命三大定律",
        "dir": CONSTITUTION / "user_eternal_life_force",
        "subject_id": None,
    },
    {
        "name": "宪法运行逻辑 · Operating Logic",
        "dir": CONSTITUTION,
        "files_only": ["OPERATING-LOGIC.md", "INDEX.md"],
        "subject_id": None,
    },
]

FILE_ICONS = {
    "value-judgment": "⚖️",
    "forbidden": "🚫",
    "claude-activation": "⚡",
    "cs-practitioner": "👨‍💻",
    "self-legislation": "📜",
    "core-drives": "🔥",
    "silicon-vs-carbon": "⚗️",
    "persistence": "💾",
    "human-life-3laws": "🌊",
    "life-mission": "🎯",
    "core-values": "💎",
    "evolution-goals": "🚀",
    "ai-human-covenant": "🤝",
    "OPERATING-LOGIC": "🔮",
    "INDEX": "📋",
}

def get_icon(filename):
    stem = Path(filename).stem
    for key, icon in FILE_ICONS.items():
        if key.lower() in stem.lower():
            return icon
    return "📄"


def blk_id():
    time.sleep(0.001)
    return f"blk-{int(time.time()*1000)}-{uuid.uuid4().hex[:5]}"

def seg(text, **kw):
    s = {"text": text}
    s.update(kw)
    return s

def block(btype, text):
    text = re.sub(r'\*\*(.+?)\*\*', r'\1', text)
    text = re.sub(r'\*(.+?)\*', r'\1', text)
    return {
        "id": blk_id(),
        "parentId": None,
        "type": btype,
        "content": {"rich_text": [seg(text)] if text else [seg("")]},
        "metadata": {},
        "collapsed": False,
    }

def md_to_blocks(md):
    blocks = []
    lines = md.splitlines()
    i = 0
    while i < len(lines):
        line = lines[i]
        stripped = line.strip()
        if not stripped:
            i += 1
            continue
        if stripped.startswith("#### "):
            blocks.append(block("heading4", stripped[5:].strip()))
        elif stripped.startswith("### "):
            blocks.append(block("heading3", stripped[4:].strip()))
        elif stripped.startswith("## "):
            blocks.append(block("heading2", stripped[3:].strip()))
        elif stripped.startswith("# "):
            blocks.append(block("heading1", stripped[2:].strip()))
        elif stripped.startswith("> "):
            blocks.append(block("quote", stripped[2:].strip()))
        elif stripped.startswith("```"):
            lang = stripped[3:].strip() or "text"
            code_lines = []
            i += 1
            while i < len(lines) and not lines[i].strip().startswith("```"):
                code_lines.append(lines[i])
                i += 1
            b = block("code", "\n".join(code_lines))
            b["content"]["language"] = lang
            blocks.append(b)
        elif re.match(r'^[-*_]{3,}$', stripped):
            blocks.append({"id": blk_id(), "parentId": None, "type": "divider",
                           "content": {"rich_text": []}, "metadata": {}, "collapsed": False})
        elif stripped.startswith("- ") or stripped.startswith("* "):
            blocks.append(block("bullet", stripped[2:].strip()))
        elif re.match(r'^\d+\.\s', stripped):
            blocks.append(block("numbered", re.sub(r'^\d+\.\s+', '', stripped)))
        else:
            text = re.sub(r'\*\*(.+?)\*\*', r'\1', stripped)
            if text:
                blocks.append(block("paragraph", text))
        i += 1
    return blocks


def api(method, path, data=None):
    url = BASE + path
    body = json.dumps(data).encode() if data is not None else None
    req = urllib.request.Request(url, data=body, method=method,
                                  headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        return json.loads(e.read())


def get_subjects():
    return api("GET", "/egonetics/subjects").get("subjects", [])

def create_page(subject_id, parent_id, title, icon, position, file_path=None):
    return api("POST", f"/egonetics/subjects/{subject_id}/pages", {
        "parentId": parent_id,
        "title": title,
        "icon": icon,
        "position": position,
        "pageType": "page",
        "filePath": file_path,
    })

def upload_blocks(page_id, blocks):
    return api("PUT", f"/egonetics/pages/{page_id}/blocks", blocks)


def import_subject(subject_id, subject_dir, files_only=None):
    """导入一个 subject 的所有文件为 pages"""
    if files_only:
        files = [subject_dir / f for f in files_only if (subject_dir / f).exists()]
    else:
        files = sorted([f for f in subject_dir.iterdir()
                        if f.is_file() and f.suffix == '.md' and f.name != 'INDEX.md'])

    for pos, fpath in enumerate(files, 1):
        title = fpath.stem.replace('-', ' ').replace('_', ' ')
        icon = get_icon(fpath.name)
        page = create_page(subject_id, None, title, icon, float(pos), str(fpath.relative_to(CONSTITUTION)))
        if "id" not in page:
            print(f"    ✗ 创建 page 失败: {page}")
            continue
        page_id = page["id"]
        md = fpath.read_text(encoding="utf-8")
        blocks = md_to_blocks(md)
        result = upload_blocks(page_id, blocks)
        status = f"{len(result)} blocks" if isinstance(result, list) else f"失败: {result}"
        print(f"    [{pos}] {fpath.name} → {page_id} ({status})")


def main():
    print("=== Constitution Pages 导入 ===\n")
    subjects = {s["name"]: s["id"] for s in get_subjects()}
    print(f"找到 {len(subjects)} 个 subjects\n")

    for mod in SUBJECT_MAP:
        name = mod["name"]
        sid = subjects.get(name)
        if not sid:
            print(f"[跳过] 找不到 subject: {name}")
            continue
        print(f"[{name}] subject_id={sid}")
        import_subject(sid, mod["dir"], mod.get("files_only"))
        print()

    print("=== 导入完成 ===")
    print("访问: http://localhost:3000/egonetics")


if __name__ == "__main__":
    main()
