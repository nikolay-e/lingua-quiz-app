from pathlib import Path

from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn
from rich.table import Table
import typer

from ...analysis.full_report_generator import FullReportGenerator
from ...validation.migration_validator import MigrationValidator
from ..auto_config import (
    build_migration_path,
    get_smart_output_dir,
    get_smart_top_n,
    resolve_language_alias,
)
from ..output.formatters import (
    print_config_info,
    print_error,
    print_file_list,
    print_header,
    print_success,
    print_vocabulary_stats,
)

console = Console()


def analyze(
    language_level: str | None = typer.Argument(
        None,
        help="Language and level (e.g., es-a1, spanish-a1, de-b1)",
        show_default=False,
    ),
    format: str = typer.Option(
        "all",
        "--format",
        "-f",
        help="Output format: text (MD report), json (JSON+CSV), all",
        show_choices=True,
    ),
    top_n: int | None = typer.Option(
        None,
        "--top-n",
        "-n",
        help="Number of top frequency words to compare against (auto-detected if not specified)",
    ),
    output_dir: Path | None = typer.Option(
        None,
        "--output",
        "-o",
        help="Output directory for reports (auto-detected if not specified)",
    ),
) -> None:
    if not language_level:
        console.print("\n[yellow]Interactive mode will be available in Phase 3[/yellow]")
        console.print("For now, please specify language-level: [cyan]vocab-tools analyze es-a1[/cyan]\n")
        raise typer.Exit(1)

    try:
        lang_code, level = resolve_language_alias(language_level)
        migration_file = build_migration_path(lang_code, level)

        if top_n is None:
            top_n = get_smart_top_n("analyze", level=level, language=lang_code)
        if output_dir is None:
            output_dir = get_smart_output_dir("reports")

        print_header(
            f"ANALYZING {lang_code.upper()} {level} VOCABULARY",
            "Generating comprehensive analysis report",
        )

        config = {
            "Language": lang_code.upper(),
            "Level": level,
            "Migration file": migration_file,
            "Top-N words": f"{top_n:,}",
            "Output directory": output_dir,
        }
        print_config_info(config)
        console.print()

        validation_result = None

        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            console=console,
        ) as progress:
            task = progress.add_task("Validating migration structure...", total=None)
            validator = MigrationValidator(migrations_directory=None)
            validation_result = validator.validate_single_file(migration_file, silent=True)
            progress.update(task, completed=True)

            task = progress.add_task("Analyzing vocabulary...", total=None)
            generator = FullReportGenerator(lang_code, migration_file, top_n)
            result = generator.generate_full_report(output_dir)
            progress.update(task, completed=True)

        console.print()
        _print_validation_summary(validation_result)

        console.print()
        stats = result["stats"]
        print_vocabulary_stats(stats)

        console.print()
        print_file_list(result["files"])

        total_issues = validation_result.error_count + validation_result.warning_count

        if total_issues > 0:
            console.print(f"\n⚠️  [yellow]{total_issues} validation issues found[/yellow]")

        print_success("ANALYSIS COMPLETE")

    except ValueError as e:
        print_error(f"Invalid input: {e}")
        raise typer.Exit(1)
    except FileNotFoundError as e:
        print_error(f"File not found: {e}")
        raise typer.Exit(1)
    except Exception as e:
        print_error("Analysis failed", e)
        import traceback

        console.print("[dim]" + traceback.format_exc() + "[/dim]")
        raise typer.Exit(1)


def _print_validation_summary(validation_result) -> None:
    errors = [i for i in validation_result.issues if i.severity == "error"]
    warnings = [i for i in validation_result.issues if i.severity == "warning"]

    if errors or warnings:
        table = Table(title="Migration Validation", show_header=True)
        table.add_column("Type", style="cyan")
        table.add_column("Count", justify="right")
        table.add_column("Status", justify="center")

        error_status = "[red]✗[/red]" if errors else "[green]✓[/green]"
        warning_status = "[yellow]⚠[/yellow]" if warnings else "[green]✓[/green]"

        table.add_row("Errors", str(len(errors)), error_status)
        table.add_row("Warnings", str(len(warnings)), warning_status)

        console.print(table)

        if errors:
            console.print("\n[red]Errors:[/red]")
            for error in errors[:3]:
                console.print(f"  • {error.get_message()}")
            if len(errors) > 3:
                console.print(f"  ... and {len(errors) - 3} more")

        if warnings:
            console.print("\n[yellow]Warnings:[/yellow]")
            for warning in warnings[:3]:
                console.print(f"  • {warning.get_message()}")
            if len(warnings) > 3:
                console.print(f"  ... and {len(warnings) - 3} more")
    else:
        console.print("[green]Migration validation passed[/green]")
