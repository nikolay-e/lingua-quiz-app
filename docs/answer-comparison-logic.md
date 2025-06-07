# Answer Comparison Logic

## Overview

LinguaQuiz uses three types of separators in translation answers to provide flexible learning experiences. Each separator type has specific behavior for how user answers are validated.

## Answer Formats

### Comma Separation `,` - Multiple Required Values
**What it means**: All comma-separated words represent different meanings that the user must know.

**User requirement**: Must provide ALL parts, but order doesn't matter.

**Example**:
- Translation shown: `начало, принцип`
- ✅ Accepted answers: `начало, принцип` or `принцип, начало`
- ❌ Rejected answers: `начало` or `принцип` (incomplete)

### Pipe Separation `|` - Alternative Values  
**What it means**: Multiple ways to say the same thing - any one is correct.

**User requirement**: Provide any ONE of the alternatives.

**Display behavior**: Only the first alternative is shown to the user.

**Example**:
- Translation stored: `до свидания|пока|прощай`
- Translation shown: `до свидания`
- ✅ Accepted answers: `до свидания`, `пока`, or `прощай`

### Round Brackets `()` - Optional Clarifications
**What it means**: Extra context to help understanding, but not required for correctness.

**User requirement**: Can include or ignore the bracketed content completely.

**Display behavior**: Full text with brackets is shown to provide context.

**Example**:
- Translation shown: `есть (имеется)`
- ✅ Accepted answers: 
  - `есть` (just the main word)
  - `есть имеется` (with clarification as one phrase)
  - `есть, имеется`
- ❌ Rejected answers: `имеется` (clarification alone is insufficient)

## Complete Examples

### Brackets - Optional Clarifications
**Translation**: `есть (имеется)`
- ✅ `есть` - main word only
- ✅ `есть имеется` - with clarification  
- ✅ `есть, имеется` - treating as separate meanings
- ✅ `ЕСТЬ` - case doesn't matter
- ❌ `имеется` - clarification alone isn't enough
- ❌ `быть` - completely wrong word

### Comma Separation - All Parts Required  
**Translation**: `начало, принцип`
- ✅ `начало, принцип` - correct order
- ✅ `принцип, начало` - any order works
- ✅ `  принцип  ,  начало  ` - extra spaces ignored
- ❌ `начало` - missing second part
- ❌ `принцип` - missing first part  
- ❌ `старт, принцип` - wrong word

### Pipe Separation - Any Alternative Works
**Translation stored**: `до свидания|пока|прощай`  
**Translation shown**: `до свидания`
- ✅ `до свидания` - the shown option
- ✅ `пока` - alternative option
- ✅ `прощай` - another alternative
- ✅ `ПОКА` - case doesn't matter
- ❌ `привет` - not one of the alternatives

### Complex Cases
**Translation**: `оставаться (встречаться)`
- ✅ `оставаться` - main word only
- ✅ `оставаться встречаться` - with clarification
- ✅ `оставаться, встречаться` - as separate meanings
- ❌ `встречаться` - clarification alone

**Translation**: `его, её, их`  
- ✅ `его, её, их` - correct order
- ✅ `её, его, их` - different order
- ✅ `их, её, его` - any order
- ❌ `его, её` - missing third part
- ❌ `его` - incomplete answer

## General Rules

### Case Sensitivity
All comparisons are case-insensitive. `ЕСТЬ`, `есть`, and `Есть` are treated the same.

### Whitespace
Extra spaces before, after, or around commas are ignored.

### Punctuation
Most punctuation is ignored during comparison, except for the special separators (commas, pipes, brackets).

### Partial Answers
- For comma-separated translations: partial answers are rejected
- For pipe-separated translations: any single alternative is accepted
- For bracketed translations: the main word alone is accepted