#!/usr/bin/env python3
"""Lightweight SAOS structure checks for TypeScript and JavaScript projects."""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Iterable


CODE_EXTENSIONS = {".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"}
INDEX_NAMES = {
    "index.ts",
    "index.tsx",
    "index.js",
    "index.jsx",
    "index.mjs",
    "index.cjs",
}
IGNORED_DIRS = {
    ".git",
    ".next",
    ".nuxt",
    ".expo",
    ".turbo",
    ".vercel",
    "android",
    "build",
    "coverage",
    "dist",
    "ios",
    "node_modules",
    "out",
    "vendor",
}
DUMPING_GROUND_DIRS = {"helpers", "misc", "stuff", "shared2", "common"}
IMPORT_RE = re.compile(
    r"""
    (?:
        (?:import|export)\s+(?:[^;"']*?\s+from\s+)?["']([^"']+)["']
        |
        require\(\s*["']([^"']+)["']\s*\)
        |
        import\(\s*["']([^"']+)["']\s*\)
    )
    """,
    re.VERBOSE | re.MULTILINE,
)


@dataclass(frozen=True)
class Issue:
    severity: str
    code: str
    path: str
    line: int
    message: str
    hint: str


def relative_path(path: Path, root: Path) -> str:
    try:
        return path.relative_to(root).as_posix()
    except ValueError:
        return path.as_posix()


def should_skip_dir(path: Path) -> bool:
    return path.name in IGNORED_DIRS or path.name.startswith(".")


def walk_dirs(root: Path) -> Iterable[Path]:
    for current, dirnames, _ in os.walk(root):
        current_path = Path(current)
        dirnames[:] = [name for name in dirnames if not should_skip_dir(current_path / name)]
        yield current_path


def walk_code_files(root: Path) -> Iterable[Path]:
    for current, dirnames, filenames in os.walk(root):
        current_path = Path(current)
        dirnames[:] = [name for name in dirnames if not should_skip_dir(current_path / name)]
        for filename in filenames:
            path = current_path / filename
            if path.suffix in CODE_EXTENSIONS:
                yield path


def read_code(path: Path) -> str | None:
    try:
        return path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        try:
            return path.read_text(encoding="utf-8", errors="ignore")
        except OSError:
            return None
    except OSError:
        return None


def module_roots(root: Path) -> Iterable[Path]:
    for directory in walk_dirs(root):
        if directory.name != "modules":
            continue
        for child in sorted(directory.iterdir()):
            if child.is_dir() and not child.name.startswith((".", "_")) and not should_skip_dir(child):
                yield child


def has_index(directory: Path) -> bool:
    return any((directory / name).is_file() for name in INDEX_NAMES)


def line_number_for_offset(text: str, offset: int) -> int:
    return text.count("\n", 0, offset) + 1


def import_sources(text: str) -> Iterable[tuple[str, int]]:
    for match in IMPORT_RE.finditer(text):
        source = next((group for group in match.groups() if group), None)
        if source:
            yield source, line_number_for_offset(text, match.start())


def deep_module_tail(source: str) -> list[str] | None:
    normalized = source.split("?", 1)[0].replace("\\", "/")
    marker = "modules/"
    if marker not in normalized:
        return None
    tail = normalized.split(marker, 1)[1]
    parts = [part for part in tail.split("/") if part and part not in {".", ".."}]
    if len(parts) >= 2:
        return parts
    return None


def is_framework_surface(path: Path) -> bool:
    parts = set(path.parts)
    return "app" in parts or "pages" in parts


def check_missing_module_indexes(root: Path) -> list[Issue]:
    issues: list[Issue] = []
    for module in module_roots(root):
        if not has_index(module):
            issues.append(
                Issue(
                    severity="error",
                    code="missing-public-api",
                    path=relative_path(module, root),
                    line=1,
                    message="Semantic module is missing a public index file.",
                    hint="Add index.ts or index.tsx and export the module's intentional public API.",
                )
            )
    return issues


def check_dumping_ground_dirs(root: Path) -> list[Issue]:
    issues: list[Issue] = []
    for directory in walk_dirs(root):
        if directory == root:
            continue
        if directory.name.lower() in DUMPING_GROUND_DIRS:
            issues.append(
                Issue(
                    severity="warning",
                    code="dumping-ground-directory",
                    path=relative_path(directory, root),
                    line=1,
                    message=f"Directory name '{directory.name}' is non-semantic.",
                    hint="Rename or dissolve it into a business module, platform adapter, service adapter, shared component, theme, constants, or lib boundary.",
                )
            )
    return issues


def check_code_files(root: Path, max_route_lines: int) -> list[Issue]:
    issues: list[Issue] = []
    for path in walk_code_files(root):
        text = read_code(path)
        if text is None:
            continue
        rel = relative_path(path, root)

        for source, line in import_sources(text):
            parts = deep_module_tail(source)
            if parts:
                issues.append(
                    Issue(
                        severity="error",
                        code="deep-module-import",
                        path=rel,
                        line=line,
                        message=f"Import reaches inside module '{parts[0]}' implementation: {source}",
                        hint="Import from the module public API or parent namespace barrel instead.",
                    )
                )

        if path.name in {"constants.ts", "constants.tsx", "constants.js", "constants.jsx"} and path.parent.name != "constants":
            issues.append(
                Issue(
                    severity="warning",
                    code="loose-constants-file",
                    path=rel,
                    line=1,
                    message="Constants file is not inside a semantic constants directory.",
                    hint="Group constants by domain under a semantic module or constants/ folder.",
                )
            )

        line_count = text.count("\n") + (0 if text.endswith("\n") else 1)
        if is_framework_surface(path) and line_count > max_route_lines:
            issues.append(
                Issue(
                    severity="warning",
                    code="thick-framework-file",
                    path=rel,
                    line=1,
                    message=f"Framework surface has {line_count} lines, above the {max_route_lines}-line threshold.",
                    hint="Keep route, page, layout, and screen files as orchestration; move reusable behavior into semantic modules.",
                )
            )
    return issues


def print_text_report(issues: list[Issue]) -> None:
    if not issues:
        print("SAOS structure check passed.")
        return

    error_count = sum(1 for issue in issues if issue.severity == "error")
    warning_count = sum(1 for issue in issues if issue.severity == "warning")
    print(f"SAOS structure check found {len(issues)} issue(s): {error_count} error(s), {warning_count} warning(s).")
    for issue in issues:
        location = f"{issue.path}:{issue.line}" if issue.line else issue.path
        print(f"{issue.severity.upper()} {issue.code} {location}")
        print(f"  {issue.message}")
        print(f"  {issue.hint}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("root", nargs="?", default=".", help="Project root to scan")
    parser.add_argument("--max-route-lines", type=int, default=220, help="Warn when app/pages files exceed this line count")
    parser.add_argument("--fail-on-warning", action="store_true", help="Exit non-zero on warnings as well as errors")
    parser.add_argument("--soft", action="store_true", help="Always exit zero after reporting")
    parser.add_argument("--json", action="store_true", help="Emit JSON instead of text")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    root = Path(args.root).expanduser().resolve()
    if not root.exists():
        print(f"error: {root} does not exist", file=sys.stderr)
        return 2
    if not root.is_dir():
        print(f"error: {root} is not a directory", file=sys.stderr)
        return 2

    issues: list[Issue] = []
    issues.extend(check_missing_module_indexes(root))
    issues.extend(check_dumping_ground_dirs(root))
    issues.extend(check_code_files(root, args.max_route_lines))
    issues.sort(key=lambda issue: (issue.path, issue.line, issue.code))

    if args.json:
        print(json.dumps([asdict(issue) for issue in issues], indent=2))
    else:
        print_text_report(issues)

    if args.soft:
        return 0
    has_error = any(issue.severity == "error" for issue in issues)
    has_warning = bool(issues) and args.fail_on_warning
    return 1 if has_error or has_warning else 0


if __name__ == "__main__":
    raise SystemExit(main())
