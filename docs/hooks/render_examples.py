"""MkDocs hook: renders .cpd examples with the Calcpad CLI and injects
virtual category pages into the docs build.

Which examples are built and in what order is controlled by docs/examples.yml.
Each top-level key becomes an examples/<slug>.md page showing source code
alongside the rendered HTML output in a two-column grid.
"""

import logging
import os
import re
import shutil
import subprocess
import tempfile
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import mkdocs.structure.files as mkdocs_files

log = logging.getLogger("mkdocs")

_temp_dir: str | None = None


# ---------------------------------------------------------------------------
# Hook entry points
# ---------------------------------------------------------------------------


def on_config(config, **kwargs):
    """Inject the Examples nav entries from docs/examples.yml."""
    repo_root = Path(config["config_file_path"]).parent
    examples = _load_examples(repo_root)

    for group_name, categories in examples.items():
        cat_nav = [
            {f"{_display_name(cat)} ({len(stems)})": f"examples/{_slugify(cat)}.md"}
            for cat, stems in categories.items()
        ]
        config["nav"].append({group_name: cat_nav})
    return config


def on_files(files, config, **kwargs):
    """Generate category pages and inject them as virtual MkDocs files."""
    global _temp_dir

    repo_root = Path(config["config_file_path"]).parent
    examples_root = repo_root / "Examples"
    examples = _load_examples(repo_root)
    group_folders = _group_folders(repo_root)

    cli_path = _find_cli(repo_root)

    # Resolve every listed entry to a concrete .cpd path (fail fast on missing files)
    all_cpd: list[tuple[str, Path]] = []
    for group_name, categories in examples.items():
        folder = group_folders[group_name]
        for category, stems in categories.items():
            for stem in stems:
                cpd_file = examples_root / folder / category / f"{stem}.cpd"
                if not cpd_file.exists():
                    raise SystemExit(
                        f"render_examples: Listed example not found on disk:\n"
                        f"  {cpd_file}\n"
                        f"Either add the file or remove the entry from docs/examples.yml."
                    )
                all_cpd.append((category, cpd_file))

    # Render all fragments in parallel
    fragments: dict[Path, str] = {}
    workers = min(os.cpu_count() or 1, len(all_cpd))
    with ThreadPoolExecutor(max_workers=workers) as pool:
        future_to_cpd = {
            pool.submit(_render_fragment, cpd_file, cli_path, f"{cat}/{cpd_file.stem}"): cpd_file
            for cat, cpd_file in all_cpd
        }
        for future in as_completed(future_to_cpd):
            cpd_file = future_to_cpd[future]
            fragments[cpd_file] = future.result()

    # Write generated .md files to a temp directory so MkDocs can read them
    _temp_dir = tempfile.mkdtemp(prefix="calcpad-examples-")
    examples_temp = Path(_temp_dir) / "examples"
    examples_temp.mkdir()

    all_files = list(files)

    group_folders = _group_folders(repo_root)
    for group_name, categories in examples.items():
        folder = group_folders[group_name]
        for category, stems in categories.items():
            cpd_files = [examples_root / folder / category / f"{stem}.cpd" for stem in stems]
            content = _render_category_page(category, cpd_files, fragments)
            slug = _slugify(category)
            dest = examples_temp / f"{slug}.md"
            dest.write_text(content, encoding="utf-8")

            virtual = mkdocs_files.File(
                path=f"examples/{slug}.md",
                src_dir=_temp_dir,
                dest_dir=config["site_dir"],
                use_directory_urls=config["use_directory_urls"],
            )
            all_files.append(virtual)

    # Inject asset files (e.g. .js, .css, images) referenced by examples.
    # Assets are referenced from example pages via relative URLs like ./Models/bolt_and_nut.glb.
    # With use_directory_urls=false the page is at examples/<slug>.html, so the URL resolves to
    # examples/Models/bolt_and_nut.glb — we must preserve sub-directory structure relative to
    # the category folder, not flatten everything to examples/<filename>.
    _ASSET_SUFFIXES = {".js", ".css", ".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".txt", ".glb"}
    assets_temp = Path(_temp_dir) / "assets"
    assets_examples = assets_temp / "examples"
    assets_examples.mkdir(parents=True)
    seen_asset_paths: set[str] = set()
    for group_name, categories in examples.items():
        folder = group_folders[group_name]
        for category in categories:
            cat_dir = examples_root / folder / category
            for asset in cat_dir.rglob("*"):
                if asset.suffix.lower() not in _ASSET_SUFFIXES:
                    continue
                rel = asset.relative_to(cat_dir)  # e.g. Models/bolt_and_nut.glb
                path_key = rel.as_posix()
                if path_key in seen_asset_paths:
                    continue
                seen_asset_paths.add(path_key)
                dest = assets_examples / rel
                dest.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(asset, dest)
                log.info(f"Copying asset {asset.relative_to(examples_root)}")
                virtual_asset = mkdocs_files.File(
                    path=f"examples/{path_key}",
                    src_dir=str(assets_temp),
                    dest_dir=config["site_dir"],
                    use_directory_urls=False,
                )
                all_files.append(virtual_asset)

    return mkdocs_files.Files(all_files)


def on_post_build(config, **kwargs):
    _cleanup_temp()


def on_build_error(error, **kwargs):
    _cleanup_temp()


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _cleanup_temp():
    global _temp_dir
    if _temp_dir and os.path.exists(_temp_dir):
        shutil.rmtree(_temp_dir, ignore_errors=True)
        _temp_dir = None


def _slugify(text: str) -> str:
    """Convert a category name to a URL-safe slug."""
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def _display_name(name: str) -> str:
    """Convert a filesystem-safe name to a display name.

    Replaces the safe separator ' - ' with ': ' so that folder names like
    'Reinforced Concrete - Punching' render as 'Reinforced Concrete: Punching'.
    """
    return name.replace(" - ", ": ")


def _load_examples(repo_root: Path) -> dict[str, dict[str, list[str]]]:
    """Read docs/examples.yml and return {group: {category: [stem, ...]}}."""
    yaml_path = repo_root / "docs" / "examples.yml"
    if not yaml_path.exists():
        raise SystemExit(
            f"render_examples: docs/examples.yml not found."
        )

    # Minimal hand-rolled YAML parser — avoids a hard PyYAML import.
    # Format (3 levels):
    #   GroupName:
    #     CategoryName:
    #       - stem
    examples: dict[str, dict[str, list[str]]] = {}
    current_group: str | None = None
    current_category: str | None = None
    for lineno, raw in enumerate(yaml_path.read_text(encoding="utf-8").splitlines(), 1):
        line = raw.rstrip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("    - "):          # 4-space list item → stem
            if current_category is None:
                raise SystemExit(f"render_examples: examples.yml line {lineno}: list item before any category key")
            examples[current_group][current_category].append(line[6:])
        elif line.startswith("  ") and line.endswith(":"):  # 2-space category key
            if current_group is None:
                raise SystemExit(f"render_examples: examples.yml line {lineno}: category before any group key")
            current_category = line.strip()[:-1]
            examples[current_group][current_category] = []
        elif not line.startswith(" ") and line.endswith(":"):  # top-level group key
            current_group = line[:-1]
            current_category = None
            examples[current_group] = {}
        else:
            raise SystemExit(f"render_examples: examples.yml line {lineno}: unexpected format: {line!r}")

    return examples


def _group_folders(repo_root: Path) -> dict[str, str]:
    """Return a mapping from group display name to its folder inside Examples/.

    The mapping is derived from the docs/examples.yml group names by matching
    them against actual sub-folders of Examples/.
    """
    examples_root = repo_root / "Examples"
    available = {d.name for d in examples_root.iterdir() if d.is_dir()}

    # Try an explicit well-known mapping first; fall back to matching by name.
    known: dict[str, str] = {
        "Structural Engineering Examples": "Structural",
        "Other Examples": "Engineering",
    }
    result: dict[str, str] = {}
    for group_name in _load_examples(repo_root):
        if group_name in known and known[group_name] in available:
            result[group_name] = known[group_name]
        else:
            # Fall back: look for a folder whose name appears in the group display name
            match = next((f for f in available if f.lower() in group_name.lower()), None)
            if match is None:
                raise SystemExit(
                    f"render_examples: Cannot map group '{group_name}' to a folder in Examples/.\n"
                    f"Available folders: {sorted(available)}"
                )
            result[group_name] = match
    return result


def _find_cli(repo_root: Path) -> Path:
    """Return the path to an existing Cli executable.

    Searches (in order):
      1. cli-build/     — output of the explicit CI publish step
      2. Release publish — dotnet publish -c Release
      3. Debug publish   — dotnet publish -c Debug
      4. Debug build     — dotnet build -c Debug (default local build)
      5. Release build   — dotnet build -c Release

    Raises SystemExit with a clear message when the binary is not found.
    """
    is_win = os.name == "nt"
    exe_name = "Cli.exe" if is_win else "Cli"
    rid = "win-x64" if is_win else "linux-x64"
    tfm = "net10.0"

    candidates = [
        repo_root / "cli-build" / exe_name,
        repo_root / "Calcpad.Cli" / "bin" / "Release" / tfm / rid / "publish" / exe_name,
        repo_root / "Calcpad.Cli" / "bin" / "Debug" / tfm / rid / "publish" / exe_name,
        repo_root / "Calcpad.Cli" / "bin" / "Debug" / tfm / exe_name,
        repo_root / "Calcpad.Cli" / "bin" / "Release" / tfm / exe_name,
    ]

    for candidate in candidates:
        if candidate.exists():
            log.info(f"Using CLI at {candidate}")
            return candidate

    searched = "\n  ".join(str(c) for c in candidates)
    raise SystemExit(
        f"render_examples: Cli executable not found.\n"
        f"Searched:\n  {searched}\n"
        f"Build it first with:\n"
        f"  dotnet build Calcpad.Cli/"
    )


def _render_fragment(cpd_file: Path, cli_path: Path, label: str = "") -> str:
    """Run the CLI in body-only silent mode and return the HTML fragment.

    Raises SystemExit on any CLI error, timeout, or empty output.
    """
    name = label or cpd_file.name
    tmp_fd, out_path = tempfile.mkstemp(suffix=".html")
    os.close(tmp_fd)
    try:
        result = subprocess.run(
            [str(cli_path), str(cpd_file), out_path, "-b", "-s"],
            capture_output=True,
            timeout=30,
        )
        if result.returncode != 0:
            stderr = result.stderr.decode(errors="replace").strip()
            stdout = result.stdout.decode(errors="replace").strip()
            raise SystemExit(
                f"render_examples: CLI failed (exit {result.returncode}) for {cpd_file.name}"
                + (f"\n  stderr: {stderr}" if stderr else "")
                + (f"\n  stdout: {stdout}" if stdout else "")
            )
        if not (os.path.exists(out_path) and os.path.getsize(out_path) > 0):
            raise SystemExit(
                f"render_examples: CLI produced no output for {cpd_file.name}"
            )
        log.info(f"Rendered  {name}")
        return Path(out_path).read_text(encoding="utf-8")
    except subprocess.TimeoutExpired:
        raise SystemExit(f"render_examples: CLI timed out rendering {cpd_file.name}")
    except OSError as exc:
        raise SystemExit(f"render_examples: Failed to run CLI for {cpd_file.name}: {exc}")
    finally:
        if os.path.exists(out_path):
            os.unlink(out_path)


def _strip_headings(fragment: str) -> str:
    """Replace <h1>–<h6> tags with divs so they don't appear in the MkDocs TOC."""
    fragment = re.sub(r"<(h[1-6])([ >])", r'<div class="calcpad-\1"\2', fragment)
    fragment = re.sub(r"</(h[1-6])>", r"</div>", fragment)
    return fragment


def _render_category_page(category: str, cpd_files: list[Path], fragments: dict[Path, str]) -> str:
    """Build the Markdown content for one category page from pre-rendered fragments."""
    lines = [f"# {_display_name(category)}\n"]

    for cpd_file in cpd_files:
        name = cpd_file.stem
        lines.append(f"\n## {name}\n")

        source = cpd_file.read_text(encoding="utf-8", errors="replace")
        fragment = _strip_headings(fragments[cpd_file])

        lines.append('<div class="example-grid" markdown="block">')
        lines.append('<div class="example-source" markdown="block">\n')
        lines.append("```")
        lines.append(source.rstrip())
        lines.append("```\n")
        lines.append("</div>")
        lines.append('<div class="example-output">\n')
        lines.append(fragment)
        lines.append("</div>")
        lines.append("</div>\n")

    return "\n".join(lines)
