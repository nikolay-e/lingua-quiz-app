#
# LinguaQuiz – Copyright © 2025 Nikolay Eremeev
#
# Dual-licensed:
#  – Non-Commercial Source-Available v2  →  see LICENSE-NONCOMMERCIAL.md
#  – Commercial License v2              →  see LICENSE-COMMERCIAL.md
#
# Contact: lingua-quiz@nikolay-eremeev.com
# Repository: https://github.com/nikolay-e/lingua-quiz
#

import re
import csv

def read_words(file_path):
    with open(file_path, 'r') as file:
        words = [line.strip() for line in file]
    return words

def find_sentence_with_word(word, sentences):
    word_lower = word.lower()
    for sentence in sentences:
        sentence_lower = sentence.lower()
        if re.search(r'\b' + re.escape(word_lower) + r'\b', sentence_lower):
            return sentence.strip()

    # If not found, try appending 's', 'es', 'd', 'ed', 'ing' to the word
    for suffix in ['s', 'es', 'd', 'ed', 'ing']:
        modified_word = word_lower + suffix
        for sentence in sentences:
            sentence_lower = sentence.lower()
            if re.search(r'\b' + re.escape(modified_word) + r'\b', sentence_lower):
                return sentence.strip()

    return None

def search_sentences(words_file, text_file, output_file):
    words = read_words(words_file)
    
    with open(text_file, 'r') as file:
        text = file.read()

    # Normalize text
    text = re.sub(r'\s+', ' ', text)  # Replace all whitespace (including newlines) with a single space

    # Split sentences more effectively
    sentences = re.split(r'(?<=\.)\s+', text)

    results = {}
    for word in words:
        sentence = find_sentence_with_word(word, sentences)
        if sentence:
            results[word] = sentence
        else:
            results[word] = ""

    # Write results to the output file using csv.writer
    with open(output_file, 'w', newline='') as file:
        writer = csv.writer(file)
        for word, sentence in results.items():
            writer.writerow([word, sentence])

if __name__ == "__main__":
    words_file = './treasure_island_lemmatized_words.csv'
    text_file = './treasure_island.txt'
    output_file = './treasure_island_lemmatized_words_with_senteces.csv'

    search_sentences(words_file, text_file, output_file)
