import nltk
import re
from nltk.stem import WordNetLemmatizer
from nltk.corpus import wordnet, words as nltk_words
import pandas as pd
import logging

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

def download_nltk_resources():
    resources = ['wordnet', 'averaged_perceptron_tagger', 'averaged_perceptron_tagger_eng', 'omw-1.4', 'words']
    for resource in resources:
        try:
            nltk.download(resource, quiet=True)
            logging.info(f"Downloaded NLTK resource: {resource}")
        except Exception as e:
            logging.error(f"Failed to download {resource}: {str(e)}")

def load_contractions(filepath):
    contractions = {}
    try:
        with open(filepath, 'r', encoding='utf-8') as file:
            for line in file:
                contraction, expanded = line.strip().split('=')
                contractions[contraction] = expanded
        return contractions
    except Exception as e:
        logging.error(f"Error loading contractions: {str(e)}")
        return {}

def preprocess_contractions(text, contractions):
    pattern = re.compile(r'\b(' + '|'.join(re.escape(key) for key in contractions.keys()) + r')\b', re.IGNORECASE)
    return pattern.sub(lambda x: contractions[x.group().lower()], text)

def extract_unique_words(text, contractions):
    text = re.sub('’', '\'', text).lower()
    text = re.sub('\n', ' ', text).lower()
    text = re.sub('—', ' ', text).lower()
    text = re.sub(r'\d+', '', text).lower()
    text = re.sub(r"[^a-zA-Z-\s]", '', text)
    text = re.sub(r' +', ' ', text).lower()

    text = preprocess_contractions(text, contractions)

    return set(text.split())

def get_wordnet_pos(word):
    tag = nltk.pos_tag([word])[0][1][0].upper()
    tag_dict = {"J": wordnet.ADJ, "N": wordnet.NOUN, "V": wordnet.VERB, "R": wordnet.ADV}
    return tag_dict.get(tag, wordnet.NOUN)

def lemmatize_words(words):
    lemmatizer = WordNetLemmatizer()
    valid_words = set(nltk_words.words())
    lemmatized = (lemmatizer.lemmatize(word, get_wordnet_pos(word)) for word in words)
    return set(word for word in lemmatized if word.lower() in valid_words)

def load_frequency_dict(filepath):
    try:
        df = pd.read_csv(filepath).dropna(subset=['Headword'])
        return {row['Headword'].lower(): int(row['Band']) for _, row in df.iterrows()}
    except Exception as e:
        logging.error(f"Error loading frequency dictionary: {str(e)}")
        return {}

def filter_and_sort_by_frequency(words, frequency):
    return sorted((word for word in words if word.lower() in frequency), 
                  key=lambda x: frequency.get(x.lower(), float('inf')),
                  reverse=True)  # Sorting in reverse order

def process_text(text_filepath, contractions_filepath, frequency_filepath):
    contractions = load_contractions(contractions_filepath)
    frequency_dict = load_frequency_dict(frequency_filepath)
    
    try:
        with open(text_filepath, 'r', encoding='utf-8') as file:
            text = file.read()
    except Exception as e:
        logging.error(f"Error reading text file: {str(e)}")
        return []

    unique_words = extract_unique_words(text, contractions)
    lemmatized_words = lemmatize_words(unique_words)
    return filter_and_sort_by_frequency(lemmatized_words, frequency_dict)

def main():
    download_nltk_resources()
    result = process_text("./treasure_island.txt", 
                          "./contractions.txt", 
                          "./2+2+3frq.csv")

    # Save the result to a CSV file
    df = pd.DataFrame(result, columns=['Words'])
    output_filepath = "./treasure_island_lemmatized_words.csv"
    df.to_csv(output_filepath, index=False, header=False)
    logging.info(f"Words saved to {output_filepath}")

if __name__ == "__main__":
    main()
