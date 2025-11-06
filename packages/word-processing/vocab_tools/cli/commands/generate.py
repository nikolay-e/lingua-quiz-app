from pathlib import Path

from rich.console import Console
from rich.progress import BarColumn, Progress, SpinnerColumn, TextColumn
from rich.table import Table
import typer

from ...core.vocabulary_processor import VocabularyProcessor
from ...core.word_source import SubtitleFrequencySource
from ...exporters.vocabulary_exporter import VocabularyExporter
from ..auto_config import get_smart_output_dir, get_smart_top_n, resolve_language_alias
from ..output.formatters import print_error, print_header, print_success

console = Console()


def _generate_impl(
    language: str | None = None,
    top_n: int | None = None,
    output_dir: Path | None = None,
) -> None:
    if language:
        try:
            lang_code, _ = resolve_language_alias(language)
            languages = [lang_code]
        except ValueError:
            print_error(f"Unknown language: {language}")
            console.print("\n[yellow]Available:[/yellow] en, es, de, ru\n")
            raise typer.Exit(1)
    else:
        languages = ["en", "de", "es", "ru"]

    if top_n is None:
        if len(languages) == 1:
            top_n = get_smart_top_n("generate", level="a1", language=languages[0])
        else:
            top_n = get_smart_top_n("generate", level="a1", language=None)
    if output_dir is None:
        output_dir = get_smart_output_dir("generate")

    output_dir.mkdir(parents=True, exist_ok=True)

    print_header(
        "GENERATING FREQUENCY LISTS",
        f"Languages: {', '.join(lang.upper() for lang in languages)}",
    )
    console.print(f"Top-N: [cyan]{top_n:,}[/cyan]")
    console.print(f"Output directory: [cyan]{output_dir}[/cyan]\n")

    results = {}

    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        BarColumn(),
        console=console,
    ) as progress:
        main_task = progress.add_task(f"Processing {len(languages)} languages...", total=len(languages))

        for lang in languages:
            try:
                progress.update(main_task, description=f" Processing {lang.upper()}...")

                from ...config.config_loader import get_config_loader

                config_loader = get_config_loader()
                multiplier = config_loader.get_raw_frequency_multiplier(lang)

                processor = VocabularyProcessor(lang, silent=True)
                source = SubtitleFrequencySource(lang, top_n=int(top_n * multiplier), lemmatize=True)
                vocab = processor.process_words(
                    source,
                    filter_inflections=True,
                    target_count=top_n,
                    collect_stats=True,
                )

                output_path = output_dir / f"{lang}_frequency_list.json"
                exporter = VocabularyExporter(output_format="json")
                exporter.export(vocab, output_path)

                results[lang] = {
                    "status": "success",
                    "file": output_path,
                    "word_count": len(vocab.words),
                }

                progress.advance(main_task)

            except Exception as e:
                results[lang] = {"status": "error", "error": str(e)}
                progress.advance(main_task)

    table = Table(title="Generation Results", show_header=True)
    table.add_column("Language", style="cyan")
    table.add_column("Status", style="green")
    table.add_column("Words", justify="right")
    table.add_column("File", style="dim")

    for lang, result in results.items():
        if result["status"] == "success":
            table.add_row(
                lang.upper(),
                "Success",
                str(result["word_count"]),
                result["file"].name,
            )
        else:
            table.add_row(lang.upper(), "Error", "-", result.get("error", "Unknown"))

    console.print()
    console.print(table)
    print_success("GENERATION COMPLETE")


def generate(
    language: str | None = typer.Argument(
        None,
        help="Language code (en, es, de, ru) or leave empty for all languages",
    ),
    top_n: int | None = typer.Option(
        None,
        "--top-n",
        "-n",
        help="Number of words to generate (auto-detected if not specified)",
    ),
    output_dir: Path | None = typer.Option(
        None,
        "--output",
        "-o",
        help="Output directory (auto-detected if not specified)",
    ),
) -> None:
    _generate_impl(language=language, top_n=top_n, output_dir=output_dir)
