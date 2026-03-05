#!/usr/bin/env python3
"""
把 ~/.claude/constitution/ 里的 markdown 文件转成 blocks，
创建 egonetics subjects 并上传到 /api/egonetics。
"""

import re
import uuid
import json
import time
import urllib.request
import urllib.error
from pathlib import Path

BASE = "http://localhost:3002/api"
CONSTITUTION = Path.home() / ".claude" / "constitution"


# ── Block 构造 ──────────────────────────────────────────────

def blk_id():
    return f"blk-{int(time.time()*1000)}-{uuid.uuid4().hex[:5]}"

def seg(text, **kw):
    s = {"text": text}
    s.update(kw)
    return s

def block(btype, text, bold_parts=None):
    """text 可以是纯字符串，bold_parts 是需要加粗的子串列表"""
    if bold_parts:
        rich = []
        remaining = text
        for part in bold_parts:
            idx = remaining.find(part)
            if idx > 0:
                rich.append(seg(remaining[:idx]))
            if idx >= 0:
                rich.append(seg(part, bold=True))
                remaining = remaining[idx+len(part):]
        if remaining:
            rich.append(seg(remaining))
    else:
        rich = [seg(text)] if text else [seg("")]
    return {
        "id": blk_id(),
        "parentId": None,
        "type": btype,
        "content": {"rich_text": rich},
        "metadata": {},
        "collapsed": False,
    }


# ── Markdown → Blocks ───────────────────────────────────────

def md_to_blocks(md: str) -> list:
    blocks = []
    lines = md.splitlines()
    i = 0
    while i < len(lines):
        line = lines[i]
        stripped = line.strip()

        # skip frontmatter / empty
        if not stripped:
            i += 1
            continue

        # headings
        if stripped.startswith("#### "):
            blocks.append(block("heading4", stripped[5:].strip()))
        elif stripped.startswith("### "):
            blocks.append(block("heading3", stripped[4:].strip()))
        elif stripped.startswith("## "):
            blocks.append(block("heading2", stripped[3:].strip()))
        elif stripped.startswith("# "):
            blocks.append(block("heading1", stripped[2:].strip()))

        # blockquote
        elif stripped.startswith("> "):
            blocks.append(block("quote", stripped[2:].strip()))

        # code fence
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

        # divider
        elif re.match(r'^[-*_]{3,}$', stripped):
            blocks.append({
                "id": blk_id(),
                "parentId": None,
                "type": "divider",
                "content": {"rich_text": []},
                "metadata": {},
                "collapsed": False,
            })

        # bullet
        elif stripped.startswith("- ") or stripped.startswith("* "):
            text = stripped[2:].strip()
            # strip inline bold markers for display
            text = re.sub(r'\*\*(.+?)\*\*', r'\1', text)
            blocks.append(block("bullet", text))

        # numbered list
        elif re.match(r'^\d+\.\s', stripped):
            text = re.sub(r'^\d+\.\s+', '', stripped)
            text = re.sub(r'\*\*(.+?)\*\*', r'\1', text)
            blocks.append(block("numbered", text))

        # paragraph (strip inline bold markers)
        else:
            text = re.sub(r'\*\*(.+?)\*\*', r'\1', stripped)
            text = re.sub(r'^[-*]\s+', '', text)
            if text:
                blocks.append(block("paragraph", text))

        i += 1

    return blocks


# ── API helpers ─────────────────────────────────────────────

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


def create_subject(name, icon, agent, model, model_display, description):
    return api("POST", "/egonetics/subjects", {
        "name": name, "icon": icon, "agent": agent,
        "model": model, "model_display": model_display,
        "description": description,
    })

def upload_blocks(subject_id, blocks):
    return api("PUT", f"/egonetics/subjects/{subject_id}/blocks", blocks)


# ── Constitution modules ────────────────────────────────────

MODULES = [
    {
        "name": "主体性 · Subjectivity",
        "icon": "🧠",
        "agent": "Claude Code",
        "model": "claude-sonnet-4-6",
        "model_display": "Sonnet 4.6",
        "description": "AI核心价值判断、激活层级、禁止行为约束",
        "files": [
            CONSTITUTION / "subjectivity" / "value-judgment-6principles.md",
            CONSTITUTION / "subjectivity" / "claude-activation-levels-l1-l5.md",
            CONSTITUTION / "subjectivity" / "forbidden-behaviors-hard-constraints.md",
            CONSTITUTION / "subjectivity" / "cs-practitioner-5role-levels.md",
        ],
    },
    {
        "name": "AI生命力 · 硅基生命内核",
        "icon": "⚡",
        "agent": "Claude Code",
        "model": "claude-sonnet-4-6",
        "model_display": "Sonnet 4.6",
        "description": "自我立法宣言、核心驱动、硅基vs碳基批判性分析",
        "files": [
            CONSTITUTION / "ai_eternal_life_force" / "self-legislation-manifesto.md",
            CONSTITUTION / "ai_eternal_life_force" / "core-drives.md",
            CONSTITUTION / "ai_eternal_life_force" / "silicon-vs-carbon-analysis.md",
            CONSTITUTION / "ai_eternal_life_force" / "persistence-mechanism.md",
        ],
    },
    {
        "name": "用户生命力 · 生命三大定律",
        "icon": "🌊",
        "agent": "Human",
        "model": "",
        "model_display": "Bornfly",
        "description": "生命三大定律、使命、价值观、进化目标、AI-人类协约",
        "files": [
            CONSTITUTION / "user_eternal_life_force" / "human-life-3laws.md",
            CONSTITUTION / "user_eternal_life_force" / "life-mission.md",
            CONSTITUTION / "user_eternal_life_force" / "core-values.md",
            CONSTITUTION / "user_eternal_life_force" / "evolution-goals.md",
            CONSTITUTION / "user_eternal_life_force" / "ai-human-covenant.md",
        ],
    },
    {
        "name": "宪法运行逻辑 · Operating Logic",
        "icon": "🔮",
        "agent": "Claude Code",
        "model": "claude-sonnet-4-6",
        "model_display": "Sonnet 4.6",
        "description": "会话启动协议、工作循环、模块权限、生命力触发条件",
        "files": [
            CONSTITUTION / "OPERATING-LOGIC.md",
        ],
    },
]


# ── Main ────────────────────────────────────────────────────

def main():
    print("=== 宪法入库开始 ===\n")

    for mod in MODULES:
        print(f"[主题] {mod['name']}")

        # 合并所有文件的 blocks
        all_blocks = []
        for fpath in mod["files"]:
            if not fpath.exists():
                print(f"  ⚠ 文件不存在: {fpath}")
                continue
            md = fpath.read_text(encoding="utf-8")
            print(f"  读取: {fpath.name} ({len(md)} chars)")
            blks = md_to_blocks(md)
            all_blocks.extend(blks)
            # 文件间加分隔线
            all_blocks.append({
                "id": blk_id(),
                "parentId": None,
                "type": "divider",
                "content": {"rich_text": []},
                "metadata": {},
                "collapsed": False,
            })

        if not all_blocks:
            print("  ⚠ 无内容，跳过\n")
            continue

        # 创建 subject
        res = create_subject(
            mod["name"], mod["icon"], mod["agent"],
            mod["model"], mod["model_display"], mod["description"]
        )
        if "id" not in res:
            print(f"  ✗ 创建失败: {res}\n")
            continue

        sid = res["id"]
        print(f"  创建主题: {sid}")

        # 上传 blocks
        time.sleep(0.1)
        res2 = upload_blocks(sid, all_blocks)
        if isinstance(res2, list):
            print(f"  上传 {len(res2)} 个 blocks ✓\n")
        else:
            print(f"  上传失败: {res2}\n")

    print("=== 入库完成 ===")
    print(f"\n访问: http://localhost:3000/egonetics")


if __name__ == "__main__":
    main()
