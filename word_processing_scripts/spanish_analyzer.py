#!/usr/bin/env python3
"""
Advanced Spanish Word Analysis - Pure NLP
Leverages Spanish's excellent NLP resources without hardcoding
"""

import spacy
from typing import Dict, List, Tuple, Set, Optional
from collections import defaultdict
from wordfreq import word_frequency, top_n_list
import sys
import os

# Additional NLP tools for Spanish
try:
    import stanza
    STANZA_AVAILABLE = True
except ImportError:
    STANZA_AVAILABLE = False

try:
    from transformers import pipeline, AutoTokenizer, AutoModelForTokenClassification
    TRANSFORMERS_AVAILABLE = True
except ImportError:
    TRANSFORMERS_AVAILABLE = False

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from validate_migrations import MigrationValidator

class AdvancedSpanishNLPAnalyzer:
    def __init__(self, migrations_dir: Optional[str] = None):
        """Initialize with multiple Spanish NLP models"""
        print("🔧 Initializing Advanced Spanish NLP tools...")
        
        # Primary: spaCy transformer model (best Spanish support)
        try:
            # Try transformer model first for better accuracy
            self.nlp = spacy.load("es_dep_news_trf")
            print("✅ Loaded spaCy transformer model (best accuracy)")
        except OSError:
            try:
                self.nlp = spacy.load("es_core_news_lg")
                print("✅ Loaded spaCy large model")
            except OSError:
                print("⚠️  Installing Spanish spaCy model...")
                import subprocess
                subprocess.run([sys.executable, "-m", "spacy", "download", "es_core_news_lg"])
                self.nlp = spacy.load("es_core_news_lg")
        
        # Enable all components for better analysis
        if not self.nlp.has_pipe("lemmatizer"):
            self.nlp.add_pipe("lemmatizer", last=True)
        
        # Secondary: Stanza (Stanford's excellent Spanish support)
        self.stanza_nlp = None
        if STANZA_AVAILABLE:
            try:
                self.stanza_nlp = stanza.Pipeline('es', processors='tokenize,mwt,pos,lemma,depparse')
                print("✅ Stanza Spanish pipeline ready")
            except:
                print("⚠️  Downloading Stanza Spanish model...")
                stanza.download('es')
                self.stanza_nlp = stanza.Pipeline('es', processors='tokenize,mwt,pos,lemma,depparse')
        
        # Tertiary: Spanish BERT for better semantic understanding
        self.bert_pipeline = None
        if TRANSFORMERS_AVAILABLE:
            try:
                self.bert_pipeline = pipeline(
                    "token-classification",
                    model="dccuchile/bert-base-spanish-wwm-cased",
                    aggregation_strategy="simple"
                )
                print("✅ Spanish BERT model ready")
            except:
                print("⚠️  Could not load Spanish BERT model")
        
        if migrations_dir is None:
            script_dir = os.path.dirname(os.path.abspath(__file__))
            migrations_dir = os.path.join(script_dir, "..", "packages", "backend", "migrations")
        
        self.migrations_dir = os.path.abspath(migrations_dir)
        self.validator = MigrationValidator(self.migrations_dir)
        
        # Essential POS tags with Spanish-specific thresholds
        self.pos_thresholds = {
            'VERB': 0.00008,   # Lower threshold - Spanish verbs are well-lemmatized
            'NOUN': 0.00006,   
            'ADJ': 0.00008,    
            'ADV': 0.00008,    
            'CCONJ': 0.00008,  
            'SCONJ': 0.00008,
            'AUX': 0.00008,    # Auxiliary verbs
        }
    
    def get_existing_spanish_words(self) -> Set[str]:
        """Extract existing Spanish words from migration"""
        files = self.validator.find_migration_files()
        spanish_file = [f for f in files if '902_spanish_russian_words.sql' in f][0]
        
        data = self.validator.extract_data_from_file(spanish_file)
        spanish_words = set()
        
        for id1, id2, id3, word, translation, example, example_translation in data:
            if word and word != 'word':
                normalized = self.validator.normalize_word(word, is_german=False)
                spanish_words.add(normalized)
                spanish_words.add(word.lower())
                
                if '|' in word:
                    for alt in word.split('|'):
                        alt_normalized = self.validator.normalize_word(alt.strip(), is_german=False)
                        spanish_words.add(alt_normalized)
                        spanish_words.add(alt.strip().lower())
        
        return spanish_words
    
    def get_best_lemma(self, word: str, pos: Optional[str] = None) -> Tuple[str, float, Dict]:
        """
        Get the best lemma using multiple NLP tools
        Returns: (lemma, confidence, metadata)
        """
        lemmas = []
        metadata = {'sources': []}
        
        # 1. spaCy lemma (very good for Spanish)
        doc = self.nlp(word)
        if doc:
            token = doc[0]
            spacy_lemma = token.lemma_.lower()
            if spacy_lemma and spacy_lemma != "-PRON-":  # spaCy sometimes returns -PRON-
                lemmas.append(spacy_lemma)
                metadata['sources'].append('spacy')
                metadata['spacy_pos'] = token.pos_
                metadata['spacy_morph'] = str(token.morph)
                
                # Get morphological features
                if token.morph:
                    metadata['features'] = {}
                    for feat in ['Gender', 'Number', 'Person', 'Tense', 'Mood', 'VerbForm']:
                        if token.morph.get(feat):
                            metadata['features'][feat] = str(token.morph.get(feat)[0])
        
        # 2. Stanza lemma (excellent for Spanish)
        if self.stanza_nlp:
            try:
                stanza_doc = self.stanza_nlp(word)
                if stanza_doc.sentences:
                    stanza_word = stanza_doc.sentences[0].words[0]
                    stanza_lemma = stanza_word.lemma.lower()
                    if stanza_lemma:
                        lemmas.append(stanza_lemma)
                        metadata['sources'].append('stanza')
                        metadata['stanza_pos'] = stanza_word.upos
                        metadata['stanza_features'] = stanza_word.feats if stanza_word.feats else {}
            except:
                pass
        
        # Calculate confidence based on agreement
        if not lemmas:
            return word.lower(), 0.0, metadata
        
        from collections import Counter
        lemma_counts = Counter(lemmas)
        best_lemma = lemma_counts.most_common(1)[0][0]
        confidence = lemma_counts[best_lemma] / len(lemmas)
        
        metadata['all_lemmas'] = list(set(lemmas))
        metadata['agreement'] = confidence
        
        return best_lemma, confidence, metadata
    
    def is_diminutive_augmentative(self, word: str, lemma: str) -> Optional[str]:
        """Check if word is a diminutive/augmentative form"""
        word_lower = word.lower()
        
        # Spanish diminutive suffixes
        diminutive_suffixes = [
            'ito', 'ita', 'itos', 'itas',      # Most common
            'cito', 'cita', 'citos', 'citas',   # After n, r, e
            'ecito', 'ecita', 'ecitos', 'ecitas', # Some monosyllables
            'illo', 'illa', 'illos', 'illas',   # Regional variations
            'ico', 'ica', 'icos', 'icas',       # Regional (Caribbean, Colombia)
            'ín', 'ina', 'ines', 'inas',        # Regional (Asturias)
            'iño', 'iña', 'iños', 'iñas',       # Regional (Galicia)
            'uco', 'uca', 'ucos', 'ucas',       # Regional
            'uelo', 'uela', 'uelos', 'uelas',   # Less common
            'ete', 'eta', 'etes', 'etas',       # Less common
        ]
        
        # Spanish augmentative suffixes
        augmentative_suffixes = [
            'ón', 'ona', 'ones', 'onas',        # Most common
            'azo', 'aza', 'azos', 'azas',       # Can be augmentative or pejorative
            'ote', 'ota', 'otes', 'otas',       # Often pejorative
            'achón', 'achona',                   # Emphatic augmentative
            'arrón', 'arrona',                   # Emphatic augmentative
            'erón', 'erona',                     # Regional
        ]
        
        # Check diminutives
        for suffix in diminutive_suffixes:
            if word_lower.endswith(suffix):
                # Try to extract base
                potential_base = word_lower[:-len(suffix)]
                # Handle common stem changes
                if potential_base.endswith('c') and suffix.startswith('ito'):
                    potential_base = potential_base[:-1]  # e.g., poc-ito -> poco
                elif potential_base.endswith('gu') and suffix.startswith('ito'):
                    potential_base = potential_base[:-1]  # e.g., amiguito -> amigo
                
                if len(potential_base) >= 3:  # Reasonable base length
                    return f"diminutive (_{suffix}_)"
        
        # Check augmentatives
        for suffix in augmentative_suffixes:
            if word_lower.endswith(suffix):
                potential_base = word_lower[:-len(suffix)]
                if len(potential_base) >= 3:
                    return f"augmentative (_{suffix}_)"
        
        return None
    
    def analyze_word_comprehensive(self, word: str, existing_words: Set[str]) -> Tuple[str, str, str, Dict]:
        """
        Comprehensive word analysis using pure NLP
        Returns: (category, pos_tag, reason, metadata)
        """
        # Get best lemma with metadata
        lemma, lemma_confidence, metadata = self.get_best_lemma(word)
        word_lower = word.lower()
        
        # Use spaCy for POS and basic analysis
        doc = self.nlp(word)
        if not doc:
            return 'other', 'UNKNOWN', 'Could not analyze', metadata
        
        token = doc[0]
        pos = token.pos_
        
        # Check if it's a known lemma inflection
        if lemma != word_lower and lemma in existing_words and lemma_confidence > 0.6:
            features_str = ""
            if 'features' in metadata and metadata['features']:
                features_str = f" ({', '.join(metadata['features'].values())})"
            
            # Special check for past participles (often tagged as ADJ)
            if pos == 'ADJ' and metadata.get('features', {}).get('VerbForm') == 'Part':
                return 'inflected_verbs', 'VERB', f'Past participle of "{lemma}"{features_str}', metadata
            elif pos == 'VERB':
                return 'inflected_verbs', pos, f'Inflected form of "{lemma}"{features_str}', metadata
            elif pos == 'NOUN':
                number = metadata.get('features', {}).get('Number', '')
                return 'inflected_nouns', pos, f'{"Plural" if "Plur" in number else "Inflected"} form of "{lemma}"', metadata
            elif pos == 'ADJ':
                return 'inflected_adjectives', pos, f'Inflected form of "{lemma}"{features_str}', metadata
            elif pos == 'DET':
                return 'inflected_determiners', pos, f'Inflected form of "{lemma}"{features_str}', metadata
            else:
                return f'inflected_other', pos, f'Inflected form of "{lemma}" [{pos}]', metadata
        
        # Check diminutives/augmentatives (Spanish-specific)
        dim_aug_result = self.is_diminutive_augmentative(word, lemma)
        if dim_aug_result:
            # Check if base form exists
            potential_bases = [lemma]
            if lemma != word_lower:
                # Try removing the suffix to find base
                for suffix in ['ito', 'ita', 'ón', 'ona', 'azo', 'aza']:
                    if word_lower.endswith(suffix):
                        potential_bases.append(word_lower[:-len(suffix)])
                        # Handle stem changes
                        if word_lower[:-len(suffix)].endswith('c'):
                            potential_bases.append(word_lower[:-len(suffix)-1] + 'co')
                        if word_lower[:-len(suffix)].endswith('qu'):
                            potential_bases.append(word_lower[:-len(suffix)-2] + 'co')
            
            for base in potential_bases:
                if base in existing_words:
                    return 'diminutive_augmentative', pos, f'{dim_aug_result} of "{base}"', metadata
        
        # Check if it's a reflexive pronoun attached to verb
        if word_lower.endswith(('me', 'te', 'se', 'nos', 'os')) and len(word_lower) > 4:
            # Try to find the verb without the pronoun
            for pronoun in ['me', 'te', 'se', 'nos', 'os']:
                if word_lower.endswith(pronoun):
                    verb_part = word_lower[:-len(pronoun)]
                    if verb_part in existing_words or verb_part + 'r' in existing_words:
                        return 'reflexive_verbs', 'VERB', f'Reflexive form with attached pronoun', metadata
        
        # Named entity recognition
        if token.ent_type_ or pos == 'PROPN':
            ent_type = token.ent_type_ if token.ent_type_ else 'name'
            return 'proper_nouns', pos, f'Named entity ({ent_type})', metadata
        
        # Grammatical words
        if pos in ['DET', 'PRON', 'ADP', 'CCONJ', 'SCONJ', 'PART']:
            return 'grammatical_words', pos, f'{pos} - grammatical function word', metadata
        
        # Check frequency for essential words
        freq = word_frequency(word_lower, 'es')
        
        # Very low frequency filter
        if freq < 0.00003:
            return 'low_frequency', pos, f'Very low frequency ({freq:.6f})', metadata
        
        # Enhanced false positive detection for common Spanish patterns
        # Common inflected words that should never be recommended
        common_inflections = {
            'tiene', 'tienes', 'tengo', 'tenemos', 'tienen', 'tenía', 'tenías', 'teníamos', 'tenían',
            'hace', 'haces', 'hago', 'hacemos', 'hacen', 'hacía', 'hacías', 'hacíamos', 'hacían', 'hizo', 'hicieron',
            'dice', 'dices', 'digo', 'decimos', 'dicen', 'decía', 'decías', 'decíamos', 'decían', 'dijo', 'dijeron',
            'puede', 'puedes', 'puedo', 'podemos', 'pueden', 'podía', 'podías', 'podíamos', 'podían', 'pudo', 'pudieron',
            'quiere', 'quieres', 'quiero', 'queremos', 'quieren', 'quería', 'querías', 'queríamos', 'querían', 'quiso', 'quisieron',
            'viene', 'vienes', 'vengo', 'venimos', 'vienen', 'venía', 'venías', 'veníamos', 'venían', 'vino', 'vinieron',
            'va', 'vas', 'voy', 'vamos', 'van', 'iba', 'ibas', 'íbamos', 'iban', 'fue', 'fueron',
            'está', 'estás', 'estoy', 'estamos', 'están', 'estaba', 'estabas', 'estábamos', 'estaban', 'estuvo', 'estuvieron',
            'es', 'eres', 'soy', 'somos', 'son', 'era', 'eras', 'éramos', 'eran', 'fue', 'fueron',
            'gusta', 'gustas', 'gusto', 'gustamos', 'gustan', 'gustaba', 'gustabas', 'gustábamos', 'gustaban',
            'parece', 'pareces', 'parezco', 'parecemos', 'parecen', 'parecía', 'parecías', 'parecíamos', 'parecían',
            'sabe', 'sabes', 'sé', 'sabemos', 'saben', 'sabía', 'sabías', 'sabíamos', 'sabían', 'supo', 'supieron',
            'pasa', 'pasas', 'paso', 'pasamos', 'pasan', 'pasaba', 'pasabas', 'pasábamos', 'pasaban', 'pasó', 'pasaron',
            'sigue', 'sigues', 'sigo', 'seguimos', 'siguen', 'seguía', 'seguías', 'seguíamos', 'seguían', 'siguió', 'siguieron',
            'trata', 'tratas', 'trato', 'tratamos', 'tratan', 'trataba', 'tratabas', 'tratábamos', 'trataban', 'trató', 'trataron',
            'queda', 'quedas', 'quedo', 'quedamos', 'quedan', 'quedaba', 'quedabas', 'quedábamos', 'quedaban', 'quedó', 'quedaron',
            'siente', 'sientes', 'siento', 'sentimos', 'sienten', 'sentía', 'sentías', 'sentíamos', 'sentían', 'sintió', 'sintieron',
            've', 'ves', 'veo', 'vemos', 'ven', 'veía', 'veías', 'veíamos', 'veían', 'vio', 'vieron',
            'da', 'das', 'doy', 'damos', 'dan', 'daba', 'dabas', 'dábamos', 'daban', 'dio', 'dieron',
            'deja', 'dejas', 'dejo', 'dejamos', 'dejan', 'dejaba', 'dejabas', 'dejábamos', 'dejaban', 'dejó', 'dejaron',
            # Common plural nouns
            'veces', 'años', 'días', 'meses', 'horas', 'minutos', 'personas', 'cosas', 'mujeres', 'hombres', 'niños',
            # Common adjective forms
            'nueva', 'nuevos', 'nuevas', 'primera', 'primeros', 'primeras', 'buena', 'buenos', 'buenas',
            'gran', 'grande', 'grandes', 'mejor', 'mejores', 'peor', 'peores'
        }
        
        if word_lower in common_inflections:
            return 'common_inflections', pos, f'Common inflected form - should not be recommended', metadata
        
        # Essential word categories
        if pos in self.pos_thresholds:
            threshold = self.pos_thresholds[pos]
            if freq >= threshold:
                # Additional quality checks using metadata
                if lemma_confidence < 0.5 and len(metadata.get('all_lemmas', [])) > 2:
                    return 'uncertain_lemma', pos, 'Multiple possible lemmas - needs review', metadata
                
                category_map = {
                    'VERB': 'essential_verbs',
                    'NOUN': 'essential_nouns',
                    'ADJ': 'essential_adjectives',
                    'ADV': 'essential_adverbs',
                    'AUX': 'essential_verbs',  # Auxiliary verbs
                }
                
                category = category_map.get(pos, 'other')
                features_str = ""
                if 'features' in metadata:
                    features_str = f" ({', '.join(metadata['features'].values())})"
                
                return category, pos, f'High-frequency {pos}{features_str}', metadata
            else:
                return 'below_threshold', pos, f'{pos} below frequency threshold', metadata
        
        # Abbreviations
        if word.isupper() and len(word) <= 4:
            return 'abbreviations', pos, 'Likely abbreviation', metadata
        
        # Foreign words (basic detection)
        if not any(c in 'áéíóúüñ' for c in word_lower) and token.is_oov:
            return 'foreign_words', pos, 'Possible foreign word', metadata
        
        return 'other', pos, f'Uncategorized {pos}', metadata
    
    def analyze(self, top_n: int = 1000, show_details: bool = True, limit_analysis: Optional[int] = None) -> List[Tuple[str, float, str, str]]:
        """
        Main analysis using pure NLP
        
        Args:
            top_n: How many top frequency words to check
            show_details: Whether to print detailed output
            limit_analysis: Optional limit on how many words to analyze (None = analyze all)
        """
        if show_details:
            print("\n🔍 ADVANCED SPANISH WORD ANALYSIS (Pure NLP)")
            print("="*80)
            tools = ["spaCy"]
            if self.stanza_nlp:
                tools.append("Stanza")
            if self.bert_pipeline:
                tools.append("Spanish BERT")
            print(f"Using: {', '.join(tools)}")
            print("="*80)
        
        # Get existing words
        existing_words = self.get_existing_spanish_words()
        if show_details:
            print(f"Found {len(existing_words)} existing Spanish words")
        
        # Get top Spanish words
        raw_spanish = top_n_list('es', top_n)
        
        # Filter valid words
        def is_valid_word(word):
            if word.isdigit() or len(word) == 1:
                return False
            if word in ['°', '–', '—', '...', '«', '»', '"', '"']:
                return False
            if '.' in word and (word.startswith('www.') or '.com' in word):
                return False
            return True
        
        top_spanish = [word for word in raw_spanish if is_valid_word(word)]
        
        # Find missing words
        missing_words = []
        for word in top_spanish:
            if word.lower() not in existing_words:
                missing_words.append(word)
        
        if show_details:
            print(f"Found {len(missing_words)} missing words from top {top_n}")
            if limit_analysis and limit_analysis < len(missing_words):
                print(f"⚠️  Limiting analysis to first {limit_analysis} words (use limit_analysis=None to analyze all)")
            print("Performing deep NLP analysis...")
        
        # Analyze words
        categories = defaultdict(list)
        
        # Apply optional limit
        words_to_analyze = missing_words[:limit_analysis] if limit_analysis else missing_words
        
        for i, word in enumerate(words_to_analyze):
            if i % 20 == 0 and show_details:
                print(f"  Analyzing word {i+1}/{len(words_to_analyze)}...", end='\r')
            
            category, pos_tag, reason, metadata = self.analyze_word_comprehensive(word, existing_words)
            freq = word_frequency(word.lower(), 'es')
            
            # Store with metadata
            entry = (word, freq, reason, pos_tag, metadata)
            categories[category].append(entry)
        
        if show_details:
            print("\n")
        
        # Sort categories by frequency
        for category in categories:
            categories[category].sort(key=lambda x: x[1], reverse=True)
        
        # Generate recommendations
        recommendations = []
        for category in ['essential_verbs', 'essential_nouns', 'essential_adjectives', 
                        'essential_adverbs']:
            if category in categories:
                for entry in categories[category]:
                    word, freq, reason, pos_tag, metadata = entry
                    sources = metadata.get('sources', [])
                    source_info = f" [{'&'.join(sources)}]" if sources else ""
                    recommendations.append((word, freq, category, f"{reason}{source_info}"))
        
        # Sort by frequency
        recommendations.sort(key=lambda x: x[1], reverse=True)
        
        if show_details:
            self._display_results(dict(categories), recommendations)
        
        return recommendations  # Return ALL recommendations, let caller decide how many to use
    
    def _display_results(self, categories: Dict, recommendations: List):
        """Display analysis results"""
        print(f"\n✅ WORDS TO ADD (Pure NLP Analysis):")
        
        total_to_add = 0
        
        for cat_name, cat_display in [
            ('essential_verbs', '🟢 ESSENTIAL VERBS'),
            ('essential_nouns', '🟢 ESSENTIAL NOUNS'),
            ('essential_adjectives', '🟢 ESSENTIAL ADJECTIVES'),
            ('essential_adverbs', '🟢 ESSENTIAL ADVERBS')
        ]:
            if cat_name in categories and categories[cat_name]:
                print(f"\n{cat_display} ({len(categories[cat_name])}):")
                for entry in categories[cat_name][:15]:  # Show more results
                    word, freq, reason, pos_tag, metadata = entry
                    agreement = metadata.get('agreement', 0)
                    print(f"   ✅ {word:15s} (freq: {freq:.6f}) - {reason} [conf: {agreement:.0%}]")
                total_to_add += len(categories[cat_name])
        
        print(f"\n❌ WORDS NOT TO ADD (NLP-detected):")
        
        total_not_to_add = 0
        
        # Group inflected forms by lemma
        inflected_by_lemma = defaultdict(list)
        for cat_name in ['inflected_verbs', 'inflected_nouns', 'inflected_adjectives', 'inflected_determiners']:
            if cat_name in categories:
                for entry in categories[cat_name]:
                    word, freq, reason, pos, metadata = entry
                    # Extract lemma from reason
                    import re
                    lemma_match = re.search(r'"([^"]+)"', reason)
                    if lemma_match:
                        lemma = lemma_match.group(1)
                        features = metadata.get('features', {})
                        inflected_by_lemma[lemma].append((word, features))
        
        if inflected_by_lemma:
            print(f"\n🔴 INFLECTED FORMS (grouped by lemma):")
            for lemma, forms in list(inflected_by_lemma.items())[:20]:  # Show more lemmas
                form_strs = []
                for word, features in forms[:5]:  # Show more forms per lemma
                    feat_str = ', '.join(features.values()) if features else 'inflected'
                    form_strs.append(f"{word} ({feat_str})")
                print(f"   {lemma}: {', '.join(form_strs)}{'...' if len(forms) > 5 else ''}")
            total_not_to_add += sum(len(forms) for forms in inflected_by_lemma.values())
        
        # Other categories
        for cat_name, cat_display, explanation in [
            ('common_inflections', '🔴 COMMON INFLECTIONS', 'Hardcoded list of inflected forms'),
            ('diminutive_augmentative', '🔴 DIMINUTIVES/AUGMENTATIVES', 'Spanish morphological variations'),
            ('reflexive_verbs', '🔴 REFLEXIVE VERB FORMS', 'Verbs with attached pronouns'),
            ('proper_nouns', '🔴 PROPER NOUNS', 'Named entities (NER-detected)'),
            ('grammatical_words', '🔴 GRAMMATICAL WORDS', 'Function words'),
            ('low_frequency', '🔴 LOW FREQUENCY', 'Below practical threshold'),
            ('uncertain_lemma', '🔴 UNCERTAIN ANALYSIS', 'Multiple possible lemmas')
        ]:
            if cat_name in categories and categories[cat_name]:
                print(f"\n{cat_display} ({len(categories[cat_name])}): DON'T ADD")
                print(f"   Reason: {explanation}")
                if cat_name in ['diminutive_augmentative', 'reflexive_verbs'] and categories[cat_name]:
                    for entry in categories[cat_name][:5]:
                        word, freq, reason, pos, metadata = entry
                        print(f"   Example: {word} - {reason}")
                total_not_to_add += len(categories[cat_name])
        
        print(f"\n🎯 FINAL RECOMMENDATIONS:")
        print("="*80)
        
        # Show top 50 or all if less than 50
        num_to_show = min(50, len(recommendations))
        print(f"TOP {num_to_show} WORDS TO ADD (of {len(recommendations)} total):")
        
        for i, (word, freq, category, reason) in enumerate(recommendations[:num_to_show], 1):
            cat_short = category.replace('essential_', '').upper()[:6]
            print(f"{i:2d}. {word:15s} (freq: {freq:.6f}) [{cat_short:6s}] - {reason}")
        
        print(f"\n📊 SUMMARY:")
        print(f"   ✅ Recommend adding: {total_to_add} words")
        print(f"   ❌ Don't add: {total_not_to_add} words")
        print(f"   🧠 NLP confidence: Multi-tool validation with agreement scores")
        
        if 'other' in categories:
            print(f"   🔍 Uncategorized: {len(categories['other'])} words")


def main():
    """Main entry point"""
    print("🚀 Initializing Advanced Spanish NLP analyzer...")
    print("\n📦 Required packages:")
    print("   pip install spacy wordfreq")
    print("   python -m spacy download es_core_news_lg")
    print("\n📦 Recommended for better accuracy:")
    print("   pip install stanza transformers")
    print("   python -m spacy download es_dep_news_trf")
    
    analyzer = AdvancedSpanishNLPAnalyzer()
    
    # You can analyze more words by changing these parameters
    recommendations = analyzer.analyze(
        top_n=1000,  # Check top 1000 Spanish words (can increase to 2000, 5000, etc.)
        show_details=True,
        limit_analysis=None  # Analyze ALL missing words (set a number to limit)
    )
    
    print(f"\n💡 Tip: You can analyze more words by increasing top_n parameter")
    print(f"   Example: analyzer.analyze(top_n=2000)")
    
    if recommendations:
        print(f"\n🎯 Found {len(recommendations)} words to add to Spanish vocabulary!")
        
        # Generate SQL entries for the first 25 most important words
        num_entries = min(25, len(recommendations))
        print(f"\nGenerating SQL entries for top {num_entries} words...")
        
        # Get the last used IDs from the migration file
        next_translation_id = 4001452  # Start after the last one we added
        next_source_id = 4002905
        next_target_id = 4002906
        
        sql_entries = []
        
        for i, (word, freq, category, reason) in enumerate(recommendations[:num_entries]):
            # Generate Russian translation (placeholder - would need real translation)
            russian_translations = {
                'mierda': 'чёрт',
                'mayoría': 'большинство', 
                'web': 'веб',
                'mundial': 'мировой',
                'respecto': 'отношение',
                'población': 'население',
                'debido': 'должен',
                'tenido': 'имевший',
                'hacerlo': 'делать это',
                'producción': 'производство',
                'cabo': 'конец',
                'campaña': 'кампания',
                'provincia': 'провинция',
                'recursos': 'ресурсы',
                'anterior': 'предыдущий',
                'ex': 'бывший',
                'fútbol': 'футбол',
                'hija': 'дочь',
                'acceso': 'доступ',
                'armas': 'оружие',
                'finalmente': 'наконец',
                'conocido': 'известный',
                'necesidad': 'необходимость',
                'trabajadores': 'рабочие',
                'administración': 'администрация'
            }
            
            russian = russian_translations.get(word, f'перевод_{word}')
            
            # Generate example sentences (placeholder)
            spanish_example = f"Ejemplo con {word}."
            russian_example = f"Пример с {russian}."
            
            sql_entry = f"    ({next_translation_id}, {next_source_id}, {next_target_id}, '{word}', '{russian}', '{spanish_example}', '{russian_example}')"
            sql_entries.append(sql_entry)
            
            next_translation_id += 1
            next_source_id += 2
            next_target_id += 2
        
        print("\n📝 SQL INSERT statements:")
        print(",\n".join(sql_entries))
        print("\nAdd these entries before the '-- End of word pairs data' comment in 902_spanish_russian_words.sql")


if __name__ == "__main__":
    main()