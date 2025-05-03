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

import csv

def generate_translation_csv(input_file, output_file):
    # Define the header for the output CSV
    header = [
        "translation_id", "source_language_id", "target_language_id", "source_word_id", "target_word_id", 
        "source_word", "target_word", "source_word_example", "target_word_example"
    ]
    
    # Initialize counters for IDs
    translation_id = 1
    word_id = 1  # This will be used for both source_word_id and target_word_id
    
    # Open the input and output files
    with open(input_file, 'r') as infile, open(output_file, 'w', newline='') as outfile:
        reader = csv.reader(infile)
        writer = csv.writer(outfile)
        
        # Write the header to the output file
        writer.writerow(header)
        
        # Process each row from the input file
        for row in reader:
            source_word = row[0].strip().strip('"')  # Strip extra quotes and spaces
            source_word_example = row[1].strip().strip('"')  # Strip extra quotes and spaces
            
            # Write the row to the output file with incremented IDs
            writer.writerow([
                translation_id, "en", "ru", word_id, word_id + 1, 
                source_word, "", source_word_example, ""
            ])
            
            # Increment IDs
            translation_id += 1
            word_id += 2

if __name__ == "__main__":
    input_file = './treasure_island_lemmatized_words_with_senteces.csv'  # Input CSV file name
    output_file = './treasure_island_english_russian.csv'  # Output CSV file name
    
    generate_translation_csv(input_file, output_file)
