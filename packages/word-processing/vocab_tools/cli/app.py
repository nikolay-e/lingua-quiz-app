import sys

from rich.console import Console
import typer

from .commands import analyze as analyze_cmd
from .commands import fill as fill_cmd
from .commands import generate as generate_cmd

app = typer.Typer(
    name="vocab-tools",
    help="Vocabulary processing toolkit for LinguaQuiz CEFR word lists",
    add_completion=True,
    rich_markup_mode="rich",
    no_args_is_help=False,
)

console = Console()

app.command(name="analyze", help="Analyze vocabulary and generate comprehensive report with validation")(analyze_cmd.analyze)
app.command(name="generate", help="Generate frequency word lists from subtitle data")(generate_cmd.generate)
app.command(name="fill", help="Fill placeholder entries with missing words")(fill_cmd.fill)


def main():
    if len(sys.argv) == 1:
        console.print("\n[bold blue]Starting interactive mode...[/bold blue]")
        console.print("[dim]Tip: Use 'vocab-tools <command>' for direct execution[/dim]\n")

        from vocab_tools.cli.interactive_mode import run_interactive_mode

        run_interactive_mode()
    else:
        app()


if __name__ == "__main__":
    main()
