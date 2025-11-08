from pathlib import Path
from typing import Any

from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.tree import Tree

console = Console()


def print_header(title: str, subtitle: str = "") -> None:
    text = f"[bold white]{title}[/bold white]\n[dim]{subtitle}[/dim]" if subtitle else f"[bold white]{title}[/bold white]"
    console.print(Panel(text, border_style="blue", expand=False))


def print_config_info(config: dict[str, Any]) -> None:
    table = Table(show_header=False, box=None, padding=(0, 2))
    table.add_column("Key", style="cyan")
    table.add_column("Value", style="white")

    for key, value in config.items():
        if isinstance(value, Path):
            value = str(value)
        table.add_row(f"{key}:", str(value))

    console.print(table)


def print_vocabulary_stats(stats: dict[str, Any]) -> None:
    tree = Tree("[bold cyan]Vocabulary Statistics[/bold cyan]")

    tree.add(f"Total words: [bold]{stats['total_words']:,}[/bold]")
    tree.add(f"Unique lemmas: [bold]{stats['unique_lemmas']:,}[/bold]")

    in_vocab = tree.add(" [cyan]In Vocabulary[/cyan]")
    in_vocab.add(f"English words: [yellow]{stats['in_vocabulary']['english']}[/yellow]")
    in_vocab.add(f"Very rare (>10k): [dim]{stats['in_vocabulary']['very_rare']}[/dim]")
    in_vocab.add(f"Low priority (5-10k): [white]{stats['in_vocabulary']['low_priority']}[/white]")
    in_vocab.add(f"Moderate (1-5k): [green]{stats['in_vocabulary']['moderate']}[/green]")
    in_vocab.add(f"High frequency (<1k): [bold green]{stats['in_vocabulary']['high_frequency']}[/bold green]")

    missing = tree.add(f"[magenta]Missing Words[/magenta] (total: {stats['missing']['total']:,})")
    missing.add(f" Critical (< 100): [bold red]{stats['missing']['critical']}[/bold red]")
    missing.add(f" High priority (< 500): [bold yellow]{stats['missing']['high_priority']}[/bold yellow]")
    missing.add(f" Medium priority (< 1000): [yellow]{stats['missing']['medium_priority']}[/yellow]")
    missing.add(f"⚪ Low priority (> 1000): [dim]{stats['missing']['low_priority']}[/dim]")

    console.print(tree)


def print_file_list(files: dict[str, Path]) -> None:
    console.print("\n [bold]Generated files:[/bold]")
    for name, path in files.items():
        path_obj = Path(path) if isinstance(path, str) else path

        try:
            display_path = path_obj.relative_to(Path.cwd())
        except ValueError:
            display_path = path_obj

        console.print(f"   • [cyan]{name}:[/cyan] {display_path}")


def print_success(message: str) -> None:
    console.print(f"\n[bold green]{message}[/bold green]\n")


def print_error(message: str, exception: Exception = None) -> None:
    console.print(f"\n[bold red]{message}[/bold red]")
    if exception:
        console.print(f"[dim]{type(exception).__name__}: {exception}[/dim]")


def print_warning(message: str) -> None:
    console.print(f"⚠️  [yellow]{message}[/yellow]")
