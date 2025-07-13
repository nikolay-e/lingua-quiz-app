# Answer Comparison Logic

## Overview
LinguaQuiz uses four types of separators in translation answers to provide flexible learning experiences. Each separator type has specific behavior for how user answers are validated.

## Answer Formats

### Comma Separation `,` - Multiple Distinct Meanings
**What it means**: The word has multiple DIFFERENT meanings that cannot substitute for each other. The user must learn ALL meanings.

**User requirement**: Must provide ALL comma-separated parts (order doesn't matter).

**When to use**: When a Spanish word translates to multiple unrelated Russian words.

**Example**:
- Spanish word: `piso` (means both "floor" AND "apartment")
- Translation stored/shown: `этаж, квартира`
- ✅ Accepted answers: `этаж, квартира` or `квартира, этаж`
- ❌ Rejected answers: `этаж` or `квартира` (incomplete - user must know both meanings)

### Pipe Separation `|` - Alternative Values (Synonyms)
**What it means**: Multiple ways to express the SAME meaning - synonyms or regional variations.

**User requirement**: Provide any ONE of the alternatives.

**Display behavior**: Only the first alternative is shown to the user.

**When to use**: When there are different but equally correct ways to translate the same meaning.

**Example**:
- Spanish word: `gracias` 
- Translation stored: `спасибо|благодарю`
- Translation shown: `спасибо`
- ✅ Accepted answers: `спасибо` OR `благодарю` (either synonym is correct)
- ❌ Rejected answers: `пожалуйста` (wrong meaning)

### Parentheses Grouping `()` - Operation Priority Groups
**What it means**: Groups alternatives together to determine parsing priority when combining with commas.

**User requirement**: Must match the pattern for each comma-separated group.

**When to use**: When you have multiple meanings AND alternatives within those meanings.

**Problem without grouping**:
- `равный|одинаковый, сейчас|сразу` is ambiguous - could be parsed as:
  - `равный | (одинаковый, сейчас) | сразу` (3 alternatives where user can choose any one)
  - `(равный|одинаковый), (сейчас|сразу)` (2 meaning groups where user must know both)

**Solution with grouping**:
- Translation stored: `(равный|одинаковый), (сейчас|сразу)`
- ✅ Accepted answers: 
  - `равный, сейчас` - first alternative from each group
  - `одинаковый, сразу` - other alternatives from each group
  - `равный, сразу` - mixing alternatives across groups
- ❌ Rejected answers: 
  - `равный` - incomplete (missing second meaning group)

### Square Brackets `[]` - Optional Clarifications
**What it means**: Additional context to help understanding or disambiguation. The bracketed part is NOT a separate meaning.

**User requirement**: Can include or exclude the bracketed content.

**Display behavior**: Full text with brackets is shown to provide helpful context.

**When to use**: To clarify which specific meaning is intended when a word could be ambiguous.

**Example**:
- Spanish word: `mundo` 
- Translation shown: `мир [вселенная]`
- ✅ Accepted answers: 
  - `мир` - main word only
  - `мир вселенная` - with clarification (with space)
  - `мирвселенная` - with clarification (without space)
- ❌ Rejected answers: 
  - `вселенная` - clarification alone is insufficient
  - `мир, вселенная` - NOT accepted (brackets don't indicate separate meanings)

**Special Case - Verb Suffixes**:
- Spanish word: `park`
- Translation shown: `парковать[ся]`
- ✅ Accepted answers:
  - `парковать` - base verb only
  - `парковаться` - with reflexive suffix (no space)
  - `парковать ся` - with reflexive suffix (with space)

## Decision Guide for Translators

### Use COMMAS when:
- The Spanish word has multiple distinct, unrelated meanings
- Example: `banco` → `банк, скамейка` (bank, bench - completely different things)
- Example: `hombre` → `мужчина, человек` (man, person - different concepts)

### Use PIPES when:
- There are synonyms or equally valid translations for the same concept
- Example: `bonito|hermoso|lindo` → all mean "beautiful"
- Example: `empezar|comenzar|iniciar` → all mean "to begin"

### Use PARENTHESES when:
- You have both multiple meanings AND alternatives within those meanings
- You need to avoid parsing ambiguity with mixed commas and pipes
- Example: `(равный|одинаковый), (сейчас|сразу)` → two meaning groups with alternatives in each

### Use SQUARE BRACKETS when:
- You need to disambiguate between similar words
- Example: `paz` → `мир [гармония]` to distinguish from `mundo` → `мир [вселенная]`
- The clarification helps but isn't essential for understanding

## Complete Examples

### Example 1: Comma Separation (Multiple Meanings)
**Spanish**: `carta` (means letter, card, AND menu)
**Translation**: `письмо, карта, меню`
- ✅ `письмо, карта, меню` - all three meanings
- ✅ `меню, письмо, карта` - any order
- ❌ `письмо` - incomplete (missing two meanings)
- ❌ `письмо, карта` - incomplete (missing menu)

### Example 2: Pipe Separation (Synonyms)
**Spanish**: `coche` (car)
**Translation stored**: `машина|автомобиль`
**Translation shown**: `машина`
- ✅ `машина` - first synonym
- ✅ `автомобиль` - alternative synonym
- ❌ `машина, автомобиль` - don't need both synonyms

### Example 3: Brackets (Clarification)
**Spanish**: `planta` (in context of building levels)
**Translation**: `этаж (здания)`
- ✅ `этаж` - main word sufficient
- ✅ `этаж здания` - with clarification
- ❌ `здания` - clarification alone not accepted

### Example 4: Parentheses Grouping (Multiple Meanings with Alternatives)
**German**: `gleich` (means both "equal/same" AND "now/immediately")  
**Translation**: `(равный|одинаковый), (сейчас|сразу)`
- ✅ `равный, сейчас` - first alternative from each group
- ✅ `одинаковый, сразу` - other alternatives from each group  
- ✅ `сейчас, равный` - order doesn't matter
- ❌ `равный` - incomplete (missing second meaning group)
- ❌ `равный, одинаковый, сейчас` - wrong (treating as 3 separate meanings)

### Example 5: Combined Usage
**Spanish**: `tiempo` (means both time AND weather)
**Translation**: `время, погода`
- NOT `время|погода` (these are different meanings, not synonyms)
- NOT `время [погода]` (weather is not a clarification of time)

## General Rules

### Case Sensitivity
All comparisons are case-insensitive.

### Whitespace
All whitespace is removed during comparison.

### German Text Normalization
German umlauts and ß are normalized:
- `ä/ae → a`, `ö/oe → o`, `ü/ue → u`, `ß → ss`
- Example: `Müller` and `Mueller` are considered equal

### Spanish Text Normalization  
Accented characters are normalized to their base forms:
- Example: `José` and `Jose` are considered equal

### Cyrillic Text Normalization
For languages using Cyrillic script (Russian, etc.), the following character equivalences are applied:

1. **ё/е Equivalence**: The letters ё and е are treated as identical during comparison
   - Example: `тёмный` and `темный` are considered equal

2. **Latin/Cyrillic Similar Characters**: Visually similar Latin and Cyrillic characters are normalized to their Cyrillic equivalents
   - Latin characters that look like Cyrillic are converted: `c→с`, `p→р`, `o→о`, `a→а`, `e→е`, `x→х`, `y→у`, etc.
   - This prevents confusion when users accidentally type Latin characters that look identical to Cyrillic ones

### Important Notes
1. **Use parentheses to avoid ambiguity** when mixing commas and pipes
2. **Commas = must know all**, Pipes = any one is fine, Parentheses = grouping for priority, Square brackets = helpful context
3. **Parsing order**: Parentheses first, then commas, then pipes within groups
4. When in doubt, prefer clarity over complexity