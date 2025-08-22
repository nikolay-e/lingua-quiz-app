# LinguaQuiz Answer Comparison Guide

## Core Separators

### 1. Comma `,` — Multiple Distinct Meanings

The word has several unrelated meanings. User must provide ALL.

- **Example:** `piso` → `floor, apartment`
- ✅ `floor, apartment` (any order)
- ❌ `floor` (incomplete)

### 2. Pipe `|` — Synonyms

Multiple words for the same meaning. User provides ANY ONE.

- **Example:** `coche` → `car|automobile`
- **Display:** Only first shown (`car`)
- ✅ `car` OR `automobile`
- ❌ `car, automobile` (only one needed)

### 3. Parentheses `()` — Grouped Alternatives

Combines commas and pipes. One from each group required.

- **Example:** `gleich` → `(equal|same), (now|immediately)`
- **Display:** `equal, now`
- ✅ `equal, now` or `same, immediately` (any mix)
- ❌ `equal` (missing second group)

### 4. Square Brackets `[]` — Optional Content

Clarifications or suffixes. Can include or omit.

- **Example:** `world [universe]` or `park[ing]`
- ✅ `world` or `world universe`
- ✅ `park` or `parking`
- ❌ `universe` alone
- ⚠️ **Limitation:** Only first `[]` per group processed

## Quick Reference

|Scenario                     |Use          |Example                         |
|-----------------------------|-------------|--------------------------------|
|Multiple unrelated meanings  |`,`          |`bank, bench`                   |
|Same meaning, different words|`|`          |`car|automobile`                |
|Both meanings AND synonyms   |`()` with `,`|`(big|large), (fast|quick)`     |
|Optional clarification/suffix|`[]`         |`peace [harmony]` or `cook[ing]`|

## Text Normalization

All comparisons apply:

- **Case-insensitive:** `Word` = `word`
- **Whitespace removed:** `my answer` = `myanswer`
- **Accents stripped:** `José` = `jose`
- **German normalized:** `ä`→`a`, `ö`→`o`, `ü`→`u`, `ß`→`ss`
- **Cyrillic:** `ё`→`е`, Latin lookalikes converted (`p`→`р`, `c`→`с`, `o`→`о`)

## Display Rules

What users see:

- First option from each `|` group
- Parentheses removed when containing pipes
- Commas and brackets preserved

**Example:** `(equal|same), (now|immediately)` displays as `equal, now`

## Processing Order

1. Parse parentheses `()`
1. Split by commas `,`
1. Expand pipes `|` within groups
1. Handle brackets `[]`