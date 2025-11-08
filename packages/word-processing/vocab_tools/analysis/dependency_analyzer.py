from collections import defaultdict
from dataclasses import dataclass, field

try:
    from spacy.matcher import DependencyMatcher

    MATCHER_AVAILABLE = True
except ImportError:
    MATCHER_AVAILABLE = False


@dataclass
class GrammarPattern:
    pattern_type: str
    structure: str
    example: str
    complexity: float
    components: list[str] = field(default_factory=list)


@dataclass
class SentenceAnalysis:
    sentence: str
    patterns: list[GrammarPattern] = field(default_factory=list)
    complexity_score: float = 0.0
    cefr_level: str | None = None

    def get_complexity_description(self) -> str:
        if self.complexity_score < 0.3:
            return "simple"
        if self.complexity_score < 0.6:
            return "moderate"
        return "complex"


class DependencyAnalyzer:
    def __init__(self, nlp_model, language_code: str):
        self.nlp = nlp_model
        self.language = language_code
        self._matcher = None

        if MATCHER_AVAILABLE:
            self._matcher = DependencyMatcher(nlp_model.vocab)
            self._register_patterns()
        else:
            print("⚠️  spaCy DependencyMatcher not available")

    def _register_patterns(self):
        passive_pattern = [
            {"RIGHT_ID": "verb", "RIGHT_ATTRS": {"POS": "VERB"}},
            {"LEFT_ID": "verb", "REL_OP": ">", "RIGHT_ID": "aux", "RIGHT_ATTRS": {"DEP": {"IN": ["aux:pass", "auxpass"]}}},
        ]
        self._matcher.add("PASSIVE", [passive_pattern])

        svo_pattern = [
            {"RIGHT_ID": "verb", "RIGHT_ATTRS": {"POS": "VERB"}},
            {"LEFT_ID": "verb", "REL_OP": ">", "RIGHT_ID": "subject", "RIGHT_ATTRS": {"DEP": {"IN": ["nsubj", "nsubjpass"]}}},
            {"LEFT_ID": "verb", "REL_OP": ">", "RIGHT_ID": "object", "RIGHT_ATTRS": {"DEP": {"IN": ["obj", "dobj"]}}},
        ]
        self._matcher.add("SVO", [svo_pattern])

        subordinate_pattern = [
            {"RIGHT_ID": "main_verb", "RIGHT_ATTRS": {"POS": "VERB"}},
            {"LEFT_ID": "main_verb", "REL_OP": ">", "RIGHT_ID": "sub_verb", "RIGHT_ATTRS": {"DEP": {"IN": ["ccomp", "xcomp", "advcl"]}}},
        ]
        self._matcher.add("SUBORDINATE", [subordinate_pattern])

    def analyze_sentence(self, sentence: str) -> SentenceAnalysis:
        if not self._matcher:
            return SentenceAnalysis(sentence=sentence)

        doc = self.nlp(sentence)
        matches = self._matcher(doc)

        patterns = []
        for match_id, token_ids in matches:
            pattern_name = self.nlp.vocab.strings[match_id]
            pattern = self._create_pattern(pattern_name, doc, token_ids, sentence)
            patterns.append(pattern)

        analysis = SentenceAnalysis(sentence=sentence, patterns=patterns)

        analysis.complexity_score = self._calculate_complexity(doc, patterns)
        analysis.cefr_level = self._assign_cefr_level(analysis.complexity_score)

        return analysis

    def _create_pattern(self, pattern_type: str, doc, token_ids: list, sentence: str) -> GrammarPattern:
        tokens = [doc[i] for i in token_ids]
        structure = f"{pattern_type}: " + " + ".join(t.text for t in tokens)

        complexity_map = {
            "PASSIVE": 0.6,
            "SVO": 0.2,
            "SUBORDINATE": 0.7,
        }

        return GrammarPattern(
            pattern_type=pattern_type.lower(),
            structure=structure,
            example=sentence,
            complexity=complexity_map.get(pattern_type, 0.5),
            components=[t.text for t in tokens],
        )

    def _calculate_complexity(self, doc, patterns: list[GrammarPattern]) -> float:
        depth_score = min(self._get_dependency_depth(doc) / 10.0, 0.4)

        pattern_score = 0.0
        if patterns:
            pattern_score = min(sum(p.complexity for p in patterns) / len(patterns), 0.3)

        clause_count = sum(1 for token in doc if token.dep_ in ["ccomp", "xcomp", "advcl"])
        clause_score = min(clause_count / 5.0, 0.3)

        return depth_score + pattern_score + clause_score

    def _get_dependency_depth(self, doc) -> int:
        def get_depth(token, current_depth=0):
            children = list(token.children)
            if not children:
                return current_depth
            return max(get_depth(child, current_depth + 1) for child in children)

        roots = [token for token in doc if token.head == token]
        if not roots:
            return 0

        return max(get_depth(root) for root in roots)

    def _assign_cefr_level(self, complexity: float) -> str:
        if complexity < 0.3:
            return "A1-A2"
        if complexity < 0.5:
            return "B1"
        if complexity < 0.7:
            return "B2"
        return "C1-C2"

    def extract_patterns_from_corpus(self, texts: list[str], min_complexity: float = 0.0, max_complexity: float = 1.0) -> list[GrammarPattern]:
        all_patterns = []

        for text in texts:
            analysis = self.analyze_sentence(text)

            if min_complexity <= analysis.complexity_score <= max_complexity:
                all_patterns.extend(analysis.patterns)

        pattern_counts = defaultdict(int)
        for pattern in all_patterns:
            key = (pattern.pattern_type, pattern.structure)
            pattern_counts[key] += 1

        unique_patterns = []
        seen = set()
        for pattern in all_patterns:
            key = (pattern.pattern_type, pattern.structure)
            if key not in seen:
                seen.add(key)
                unique_patterns.append(pattern)

        return sorted(unique_patterns, key=lambda p: pattern_counts[(p.pattern_type, p.structure)], reverse=True)

    def get_statistics(self, patterns: list[GrammarPattern]) -> dict:
        if not patterns:
            return {}

        by_type = defaultdict(int)
        for pattern in patterns:
            by_type[pattern.pattern_type] += 1

        avg_complexity = sum(p.complexity for p in patterns) / len(patterns)

        return {
            "total_patterns": len(patterns),
            "pattern_types": dict(by_type),
            "average_complexity": round(avg_complexity, 3),
            "most_common_type": max(by_type, key=by_type.get) if by_type else None,
        }
