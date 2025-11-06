#!/usr/bin/env python3

import csv
from pathlib import Path

from ..core.stanza_lemmatizer import get_stanza_lemmatizer


def generate_lemmatized_csv(language_code: str, data_dir: Path):
    input_file = data_dir / f"{language_code}_50k.txt"
    output_file = data_dir / f"{language_code}_50k_lemmatized.csv"

    if not input_file.exists():
        print(f"Input file not found: {input_file}")
        return

    print(f"\n Processing {language_code.upper()} frequency list...")
    print(f"   Input:  {input_file}")
    print(f"   Output: {output_file}")

    lemmatizer = get_stanza_lemmatizer(language_code)

    if not lemmatizer.is_available():
        print(f"Stanza not available for {language_code}")
        print(f"   Install with: python -c \"import stanza; stanza.download('{language_code}')\"")
        return

    words_data = []

    with open(input_file, encoding="utf-8") as f:
        for line in f:
            parts = line.strip().split()
            if len(parts) >= 2:
                word = parts[0].lower()
                frequency = parts[1]
                words_data.append((word, frequency))

    print(f"   Loaded {len(words_data)} words")

    print("   Lemmatizing with Stanza (batch processing)...")

    words = [w for w, f in words_data]
    _ = [f for _, f in words_data]

    batch_size = 1000
    all_lemmas = []

    for batch_start in range(0, len(words), batch_size):
        batch_end = min(batch_start + batch_size, len(words))
        batch = words[batch_start:batch_end]

        lemmas = lemmatizer.lemmatize_batch(batch)
        all_lemmas.extend(lemmas)

        if (batch_end % 5000) == 0:
            print(f"   Progress: {batch_end}/{len(words)} words processed")

    print("   Writing CSV file...")

    with open(output_file, "w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["word", "lemma", "frequency"])

        for i, (word, frequency) in enumerate(words_data):
            lemma = all_lemmas[i]
            writer.writerow([word, lemma, frequency])

    print(f"Generated {output_file}")
    print(f"   Total: {len(words_data)} words with lemmas")


def main():
    data_dir = Path(__file__).parent.parent / "data" / "subtitle_frequencies"

    if not data_dir.exists():
        print(f"Data directory not found: {data_dir}")
        return

    languages = ["es", "en", "de"]

    print("=" * 70)
    print("GENERATING LEMMATIZED FREQUENCY CSV FILES")
    print("=" * 70)

    for lang in languages:
        generate_lemmatized_csv(lang, data_dir)

    print("\n" + "=" * 70)
    print("ALL DONE!")
    print("=" * 70)


if __name__ == "__main__":
    main()
