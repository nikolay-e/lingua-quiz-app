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

def convert_txt_to_csv(input_file_path, output_file_path):
    # Initialize variables
    bands = []
    current_band = None
    current_headword = None

    # Process the input file
    with open(input_file_path, 'r') as file:
        for line in file:
            line = line.rstrip()
            
            # Check if the line indicates a new band
            if line.startswith('-----'):
                current_band = line.split()[1]  # Extract the band number
            elif line.startswith(' ') and current_headword:
                # This line is an inflection for the current headword
                inflections = line.strip().split(', ')
                # Append the headword and its inflections to the current band
                bands.append([current_band, current_headword, ", ".join(inflections)])
                current_headword = None
            else:
                # If there is an ongoing headword, we should save it with no inflections
                if current_headword is not None:
                    bands.append([current_band, current_headword, ""])
                # This line is a new headword
                current_headword = line

    # Handle the last headword if it was missed
    if current_headword:
        bands.append([current_band, current_headword, ""])

    # Write the processed data to a CSV file
    with open(output_file_path, 'w', newline='') as csvfile:
        writer = csv.writer(csvfile)
        writer.writerow(['Band', 'Headword', 'Inflections'])
        writer.writerows(bands)

# Example usage:
input_file_path = '2+2+3frq.txt'
output_file_path = '2+2+3frq.csv'
convert_txt_to_csv(input_file_path, output_file_path)
