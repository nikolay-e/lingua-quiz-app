from datetime import datetime
import json

from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn
import typer

from ...analysis.full_report_generator import FullReportGenerator
from ..auto_config import (
    build_migration_path,
    get_smart_output_dir,
    get_smart_top_n,
    resolve_language_alias,
)
from ..output.formatters import print_error, print_header, print_success

console = Console()


def fill(
    language_level: str | None = typer.Argument(
        None,
        help="Language and level (e.g., es-a1, spanish-a1)",
        show_default=False,
    ),
) -> None:
    if not language_level:
        console.print("\n[yellow]Interactive mode will be available in Phase 3[/yellow]")
        console.print("For now, please specify language-level: [cyan]vocab-tools fill es-a1[/cyan]\n")
        raise typer.Exit(1)

    try:
        lang_code, level = resolve_language_alias(language_level)
        migration_file = build_migration_path(lang_code, level)
        top_n = get_smart_top_n("analyze")
        output_dir = get_smart_output_dir("reports")

        print_header(
            f"FILLING PLACEHOLDERS: {lang_code.upper()} {level}",
            "Automatically filling missing word entries",
        )
        console.print(f"Migration file: [cyan]{migration_file}[/cyan]\n")

        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            console=console,
        ) as progress:
            task = progress.add_task("Generating vocabulary report...", total=None)

            generator = FullReportGenerator(lang_code, migration_file, top_n)
            result = generator.generate_full_report(output_dir)

            progress.update(task, completed=True)

        missing_words_json = result["files"]["json"]
        console.print(f"Report generated: [dim]{missing_words_json.name}[/dim]\n")

        console.print("Loading migration file...")
        with open(migration_file, encoding="utf-8") as f:
            migration_data = json.load(f)

        placeholders = [(i, pair) for i, pair in enumerate(migration_data["word_pairs"]) if pair["source_word"] == "[PLACEHOLDER]"]

        console.print(f"Found [cyan]{len(placeholders)}[/cyan] placeholder entries\n")

        if not placeholders:
            console.print("[yellow]INFO: No placeholders to fill[/yellow]\n")
            return

        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            console=console,
        ) as progress:
            task = progress.add_task(" Filling placeholders...", total=None)

            from ...scripts.fill_placeholders import fill_placeholders as fill_func

            timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
            backup_path = migration_file.parent / f"{migration_file.stem}.backup-{timestamp}.json"
            console.print(f"Creating backup: [dim]{backup_path.name}[/dim]")

            with open(backup_path, "w", encoding="utf-8") as f:
                json.dump(migration_data, f, ensure_ascii=False, indent=2)

            filled_count = fill_func(migration_file, missing_words_json, output_file=None)

            progress.update(task, completed=True)

        console.print()
        console.print(f"Filled: [bold green]{filled_count}[/bold green] entries")
        console.print(f"Backup: [dim]{backup_path}[/dim]")
        console.print(f"Updated: [cyan]{migration_file}[/cyan]")

        print_success("PLACEHOLDERS FILLED")

    except ValueError as e:
        print_error(f"Invalid input: {e}")
        raise typer.Exit(1)
    except FileNotFoundError as e:
        print_error(f"File not found: {e}")
        raise typer.Exit(1)
    except Exception as e:
        print_error("Fill operation failed", e)
        import traceback

        console.print("[dim]" + traceback.format_exc() + "[/dim]")
        raise typer.Exit(1)
