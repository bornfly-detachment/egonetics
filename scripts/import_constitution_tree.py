#!/usr/bin/env python3
"""
按照 ~/.claude/constitution 的真实目录结构，
以 constitution 为一级 Page 递归导入到指定 subject。
"""

import re, uuid, json, time, urllib.request, urllib.error
from pathlib import Path

BASE = "http://localhost:3002/api"
CONSTITUTION = Path.home() / ".claude" / "constitution"
SUBJECT_ID = "subj-1772701517857-lxfls"

DIR_ICONS = {
    "constitution":           "📜",
    "subjectivity":           "🧠",
    "ai_eternal_life_force":  "⚡",
    "user_eternal_life_force":"🌊",
    "action-rules":           "📏",
    "state-analysis":         "🔍",
    "chronicle-trace":        "📚",
    "l1-paradigm-creator":    "🎨",
    "l2-system-strategist":   "🗺️",
    "l3-architect-senior-engineer": "🏗️",
    "l4-senior-programmer":   "💻",
    "l5-implementation-engineer": "⚙️",
    "events":                 "📅",
    "archives":               "🗄️",
    "thought-experiments":    "🧪",
}

FILE_ICONS = {
    "INDEX":                      "📋",
    "OPERATING-LOGIC":            "🔮",
    "value-judgment":             "⚖️",
    "forbidden":                  "🚫",
    "claude-activation":          "⚡",
    "cs-practitioner":            "👨‍💻",
    "self-legislation":           "📜",
    "core-drives":                "🔥",
    "silicon-vs-carbon":          "⚗️",
    "persistence":                "💾",
    "human-life-3laws":           "🌊",
    "life-mission":               "🎯",
    "core-values":                "💎",
    "evolution-goals":            "🚀",
    "ai-human-covenant":          "🤝",
    "dialogue-start":             "💬",
    "dialogue-activation":        "🎚️",
    "task-user-claude":           "📊",
    "level-upgrade":              "📈",
    "coding-pre-action":          "✅",
    "coding-cross-file":          "🔀",
    "coding-read-file":           "📖",
    "coding-build-playwright":    "🎭",
    "coding-git-commit":          "🔖",
    "coding-tool-priority":       "🛠️",
    "coding-stop-and-communicate":"🛑",
}

def get_dir_icon(name):
    return DIR_ICONS.get(name, "📁")

def get_file_icon(stem):
    for key, icon in FILE_ICONS.items():
        if key.lower() in stem.lower():
            return icon
    return "📄"


# ── Block 构造 ──────────────────────────────────────────────

def blk_id():
    time.sleep(0.001)
    return f"blk-{int(time.time()*1000)}-{uuid.uuid4().hex[:5]}"

def block(btype, text):
    text = re.sub(r'\*\*(.+?)\*\*', r'\1', text)
    text = re.sub(r'\*(.+?)\*', r'\1', text)
    return {
        "id": blk_id(),
        "parentId": None,
        "type": btype,
        "content": {"rich_text": [{"text": text}] if text else [{"text": ""}]},
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


# ── API ─────────────────────────────────────────────────────

def api(method, path, data=None):
    url = BASE + path
    body = json.dumps(data).encode() if data is not None else None
    r = urllib.request.Request(url, data=body, method=method,
                                headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(r) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        return json.loads(e.read())

def create_page(subject_id, parent_id, title, icon, position, file_path=None):
    return api("POST", f"/egonetics/subjects/{subject_id}/pages", {
        "parentId": parent_id,
        "title": title,
        "icon": icon,
        "position": float(position),
        "pageType": "page",
        "filePath": file_path,
    })

def upload_blocks(page_id, blocks):
    return api("PUT", f"/egonetics/pages/{page_id}/blocks", blocks)

def clear_pages(subject_id):
    """删除该 subject 下所有 pages（清空重来）"""
    pages = api("GET", f"/egonetics/subjects/{subject_id}/pages")
    if isinstance(pages, list):
        for p in pages:
            api("DELETE", f"/egonetics/pages/{p['id']}")
        print(f"  已清理 {len(pages)} 个旧 pages")


# ── 递归导入目录 ─────────────────────────────────────────────

def import_dir(subject_id, dir_path, parent_page_id, depth=0):
    """
    递归导入一个目录：
    - 先创建该目录的 page（folder page，无内容）
    - 再导入目录内的文件和子目录
    返回创建的 page_id
    """
    indent = "  " * depth
    dir_name = dir_path.name
    icon = get_dir_icon(dir_name)

    # 目录本身作为一个 page（无 blocks）
    page = create_page(subject_id, parent_page_id, dir_name, icon, 0.0)
    if "id" not in page:
        print(f"{indent}✗ 目录 page 创建失败: {dir_name} → {page}")
        return None
    dir_page_id = page["id"]
    print(f"{indent}📁 {dir_name}/ → {dir_page_id}")

    # 先导入 INDEX.md（如果存在）
    index_file = dir_path / "INDEX.md"
    pos = 1
    if index_file.exists():
        _import_file(subject_id, index_file, dir_page_id, pos, depth + 1)
        pos += 1

    # 导入其他 .md 文件（按字母排序，INDEX.md 已处理）
    files = sorted([f for f in dir_path.iterdir()
                    if f.is_file() and f.suffix == '.md' and f.name != 'INDEX.md'])
    for f in files:
        _import_file(subject_id, f, dir_page_id, pos, depth + 1)
        pos += 1

    # 递归导入子目录
    subdirs = sorted([d for d in dir_path.iterdir() if d.is_dir()])
    for sd in subdirs:
        import_dir(subject_id, sd, dir_page_id, depth + 1)
        pos += 1

    return dir_page_id


def _import_file(subject_id, fpath, parent_page_id, position, depth):
    indent = "  " * depth
    stem = fpath.stem
    icon = get_file_icon(stem)
    title = stem

    page = create_page(subject_id, parent_page_id, title, icon, float(position),
                       str(fpath.relative_to(CONSTITUTION.parent)))
    if "id" not in page:
        print(f"{indent}✗ 文件 page 创建失败: {fpath.name} → {page}")
        return

    page_id = page["id"]
    md = fpath.read_text(encoding="utf-8")
    blocks = md_to_blocks(md)
    result = upload_blocks(page_id, blocks)
    n = len(result) if isinstance(result, list) else "✗"
    print(f"{indent}📄 {fpath.name} → {page_id} ({n} blocks)")


# ── Main ────────────────────────────────────────────────────

def main():
    print(f"=== 导入 constitution 目录树 → subject {SUBJECT_ID} ===\n")

    print("清理旧 pages...")
    clear_pages(SUBJECT_ID)
    print()

    # constitution 根目录作为一级 page
    print("创建根 page: constitution")
    root_page = create_page(SUBJECT_ID, None, "constitution", "📜", 1.0)
    if "id" not in root_page:
        print(f"✗ 根 page 创建失败: {root_page}")
        return
    root_id = root_page["id"]
    print(f"  根 page → {root_id}\n")

    pos = 1

    # constitution 根目录下的 .md 文件（INDEX.md 优先）
    index_file = CONSTITUTION / "INDEX.md"
    if index_file.exists():
        _import_file(SUBJECT_ID, index_file, root_id, pos, 1)
        pos += 1

    root_files = sorted([f for f in CONSTITUTION.iterdir()
                         if f.is_file() and f.suffix == '.md' and f.name != 'INDEX.md'])
    for f in root_files:
        _import_file(SUBJECT_ID, f, root_id, pos, 1)
        pos += 1

    # constitution 根目录下的子目录
    subdirs = sorted([d for d in CONSTITUTION.iterdir() if d.is_dir()])
    for sd in subdirs:
        import_dir(SUBJECT_ID, sd, root_id, depth=1)
        pos += 1

    print("\n=== 导入完成 ===")
    print(f"访问: http://localhost:3000/egonetics/{SUBJECT_ID}")


if __name__ == "__main__":
    main()
