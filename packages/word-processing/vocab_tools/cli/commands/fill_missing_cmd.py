"""CLI command for filling missing words."""

from pathlib import Path

import typer
from rich import box
from rich.console import Console
from rich.panel import Panel
from rich.table import Table

from ...commands.fill_missing import fill_missing_words
from ..auto_config import resolve_language_alias

console = Console()


def fill_missing(
    language_level: str = typer.Argument(..., help="Language and level (e.g., 'en-a1', 'spanish-a2')"),
    target: int = typer.Option(1000, "--target", "-t", help="Target number of words"),
    output: Path | None = typer.Option(
        None, "--output", "-o", help="Directory containing analysis JSON (default: /tmp/analysis_<lang>_<level>)"
    ),
    dry_run: bool = typer.Option(False, "--dry-run", help="Show what would be added without saving"),
):
    """
    Fill missing high-frequency words in migrations.

    Adds words from frequency lists that are missing from the migration file.
    Words are filtered by frequency rank appropriate for the CEFR level.

    Example:
        vocab-tools fill-missing en-a1
        vocab-tools fill-missing spanish-a2 --target 1000
        vocab-tools fill-missing de-a1 --dry-run
    """
    try:
        lang_code, level = resolve_language_alias(language_level)
    except ValueError as e:
        console.print(f"[red]Error:[/red] {e}")
        raise typer.Exit(1) from None

    # Default output directory (same as analyze command)
    if output is None:
        output = Path("/tmp")

    # Show header
    console.print()
    console.print(
        Panel.fit(
            f"[bold]FILLING MISSING WORDS: {lang_code.upper()} {level.upper()}[/bold]\nTarget: {target:,} words",
            border_style="blue",
        )
    )

    try:
        # Run fill operation
        stats = fill_missing_words(
            lang_code=lang_code, level=level, target_count=target, output_dir=output, dry_run=dry_run
        )

        # Display statistics
        console.print()
        console.print(f"Current: [cyan]{stats['current_count']:,}[/cyan] words")
        console.print()

        # Missing words breakdown
        missing_table = Table(title="📊 Missing Words Available", box=box.ROUNDED)
        missing_table.add_column("Priority", style="bold")
        missing_table.add_column("Count", justify="right")

        missing_table.add_row("🔴 Critical (<100)", f"{stats['missing_critical']:,}")
        missing_table.add_row("🟠 High priority (<500)", f"{stats['missing_high']:,}")
        missing_table.add_row("🟡 Medium priority (<1000)", f"{stats['missing_medium']:,}")
        missing_table.add_row("Total", f"{stats['missing_available']:,}", style="bold")

        console.print(missing_table)
        console.print()

        if stats["to_add_count"] <= 0:
            console.print(f"[green]✅ Already at target ({stats['current_count']:,}/{target:,})[/green]")
            return

        # Words to add
        console.print(f"[bold]➕ Will add:[/bold] {stats['to_add_count']:,} words")
        console.print()

        if dry_run:
            console.print("[yellow]DRY RUN MODE - No changes saved[/yellow]")
            console.print()
            console.print("First 20 words that would be added:")
            for i, word in enumerate(stats["words_added"][:20], 1):
                console.print(f"  {i:2d}. {word}")
        else:
            # Show results
            console.print(f"[green]✅ Added {stats['to_add_count']:,} words[/green]")
            console.print(f"   New total: [cyan]{stats['new_total']:,}/{target:,}[/cyan]")
            console.print(f"   Saved to: [dim]{stats['file_path']}[/dim]")
            console.print()
            console.print("[green]FILL COMPLETE[/green]")

    except FileNotFoundError as e:
        console.print(f"[red]Error:[/red] {e}")
        console.print()
        console.print("[yellow]Run analysis first:[/yellow]")
        console.print(f"  vocab-tools analyze {language_level} --format json --output {output}")
        raise typer.Exit(1) from None
    except Exception as e:
        console.print(f"[red]Error:[/red] {e}")
        raise typer.Exit(1) from None
