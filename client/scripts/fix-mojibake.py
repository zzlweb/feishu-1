#!/usr/bin/env python3
"""Fix UTF-8 misread as GBK (common mojibake in this repo)."""
from __future__ import annotations

import re
import sys
from pathlib import Path

MOJIBAKE_MARKERS = (
    '鐢', '鍒', '鏂', '瀛', '闄', '璇', '鎵', '瑙', '琛', '脳', '缂', '鍙', '鎺',
    '鍗', '闄', '涓', '灏', '濉', '鑷', '閿', '纭', '浠', '缁', '鏃', '鏍', '閫',
    '瀹', '闅', '鏄', '鎼', '鐪', '鍒', '缁', '鍒', '鍒',
)


def looks_mojibake(text: str) -> bool:
    return any(marker in text for marker in MOJIBAKE_MARKERS)


def fix_text(text: str) -> str:
    if not looks_mojibake(text):
        return text
    try:
        fixed = text.encode('gbk').decode('utf-8')
    except UnicodeError:
        return text
    return fixed if fixed else text


def fix_file(path: Path) -> int:
    original = path.read_text(encoding='utf-8')
    changed = 0

    def repl(match: re.Match[str]) -> str:
        nonlocal changed
        quote = match.group(1)
        body = match.group(2)
        if not looks_mojibake(body):
            return match.group(0)
        fixed_body = fix_text(body)
        if fixed_body != body:
            changed += 1
        return f"{quote}{fixed_body}{quote}"

    # Fix quoted strings in TS/TSX/JSON
    updated = re.sub(r"(['\"])(.*?)(?<!\\)\1", repl, original, flags=re.DOTALL)

    # Fix template literals without ${}
    def tpl_repl(match: re.Match[str]) -> str:
        nonlocal changed
        body = match.group(1)
        if '${' in body or not looks_mojibake(body):
            return match.group(0)
        fixed_body = fix_text(body)
        if fixed_body != body:
            changed += 1
        return f'`{fixed_body}`'

    updated = re.sub(r'`([^`\\]*(?:\\.[^`\\]*)*)`', tpl_repl, updated)

    # Fix bare mojibake between tags, e.g. >脳<
    def bare_repl(match: re.Match[str]) -> str:
        nonlocal changed
        body = match.group(1)
        if not looks_mojibake(body):
            return match.group(0)
        fixed_body = fix_text(body.strip())
        if fixed_body != body.strip():
            changed += 1
            return f'>{fixed_body}<'
        return match.group(0)

    updated = re.sub(r'>([^<>{}\n]{1,20})<', bare_repl, updated)

    if updated != original:
        path.write_text(updated, encoding='utf-8', newline='\n')
    return changed


def main(argv: list[str]) -> int:
    roots = [Path(p) for p in argv[1:]] if len(argv) > 1 else [
        Path(__file__).resolve().parents[1] / 'src',
        Path(__file__).resolve().parents[2] / 'server' / 'data' / 'db.json',
    ]
    total = 0
    for root in roots:
        files = [root] if root.is_file() else root.rglob('*')
        for file in files:
            if file.suffix.lower() not in {'.ts', '.tsx', '.json', '.less', '.md'}:
                continue
            if not file.is_file():
                continue
            count = fix_file(file)
            if count:
                print(f'{file}: {count} strings fixed')
                total += count
    print(f'Total fixed: {total}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main(sys.argv))
