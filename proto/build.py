#!/usr/bin/env python3
"""Join the source parts into one offline HTML file: proto/jastip-flow.html."""
from pathlib import Path

ROOT = Path(__file__).parent
SRC = ROOT / "src"
OUT = ROOT / "jastip-flow.html"

CSS_PARTS = ["tokens.css", "layout.css", "components.css"]
JS_PARTS = ["data.js", "engine.js", "render-parts.js", "render-dina.js", "render-friend.js", "render-rail.js", "main.js"]


def read(name: str) -> str:
    return (SRC / name).read_text(encoding="utf-8")


def main() -> None:
    html = (
        read("shell.html")
        .replace("/*__CSS__*/", "\n".join(read(p) for p in CSS_PARTS))
        .replace("<!--__ICONS__-->", read("icons.svg"))
        .replace("/*__JS__*/", "\n".join(read(p) for p in JS_PARTS))
    )
    OUT.write_text(html, encoding="utf-8")
    print(f"wrote {OUT} ({len(html.encode('utf-8')) // 1024} KB)")


if __name__ == "__main__":
    main()
