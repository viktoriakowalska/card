from __future__ import annotations

import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CONTENT_DIR = ROOT / "content"
OUTPUT_FILE = CONTENT_DIR / "languages.json"
PATTERN = re.compile(r"^content\.([a-z0-9-]+)\.md$", re.IGNORECASE)
DEFAULT_LANG = "pl"


def main() -> None:
    languages = []

    for entry in CONTENT_DIR.iterdir():
        if not entry.is_file():
            continue

        match = PATTERN.match(entry.name)
        if match:
            languages.append(match.group(1).lower())

    languages = sorted(set(languages))
    default_lang = DEFAULT_LANG if DEFAULT_LANG in languages else (languages[0] if languages else DEFAULT_LANG)

    OUTPUT_FILE.write_text(
        json.dumps(
            {
                "default": default_lang,
                "languages": languages,
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
