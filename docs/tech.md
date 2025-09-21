# **LinguaQuiz Technical Documentation**

This document outlines the system architecture, core learning algorithm, and development standards for LinguaQuiz.

---

## **System Architecture**

The system is built on a decoupled architecture that separates business logic from the presentation and persistence layers.

- **`quiz-core` (Portable Logic):** A standalone TypeScript package containing the entire learning and answer validation algorithm. It is framework-agnostic and can run on any client (web, mobile, etc.).
- **Client (Frontend):** Executes all `quiz-core` logic locally for a zero-latency user experience. It manages the active session state in memory and is responsible for displaying the UI.
- **Backend (Persistence Layer):** A stateless CRUD API. Its only role is to store and retrieve user progress and word data. It performs **no business logic validation**.

### **Session & Persistence Flow**

1.  **Start Session:** The client fetches word data and the user's latest saved progress from the backend.
2.  **In-Memory Learning:** The `quiz-core` module builds the learning queues in the client's memory. The entire session (answering questions, updating queues, leveling up) runs locally.
3.  **Asynchronous Persistence:** To maintain UI responsiveness, progress is saved to the backend **only when a word's level changes**. The session's detailed state (like queue positions) is ephemeral and not saved.

---

## **Learning Algorithm**

For detailed information about LinguaQuiz's adaptive learning algorithm, see [LearningAlgorithm.md](LearningAlgorithm.md).

---

## **Answer Validation Logic (`quiz-core`)**

The system uses special characters in the correct answer string to handle various answer types. User input is normalized before comparison.

### **Separators and Rules**

| Separator | Name        | Rule                                                                                     | Example                             | Required User Input                                                   |
| :-------- | :---------- | :--------------------------------------------------------------------------------------- | :---------------------------------- | :-------------------------------------------------------------------- |
| `,`       | Comma       | **All Parts Required.** For words with multiple distinct meanings. Order doesn't matter. | `floor, apartment`                  | Must provide both "floor" AND "apartment".                            |
| `\|`      | Pipe        | **Any Part Required.** For synonyms or alternative phrasings.                            | `car\|automobile`                   | Must provide either "car" OR "automobile".                            |
| `()`      | Parentheses | **Grouped Alternatives.** Requires one choice from each comma-separated group.           | `(equal\|same), (now\|immediately)` | One from the first group AND one from the second (e.g., "same, now"). |
| `[]`      | Brackets    | **Optional Content.** For clarifications or optional suffixes.                           | `world [universe]`                  | "world" is sufficient; "world universe" is also correct.              |

### **Text Normalization**

Before comparison, all input (user answer and correct answer) is normalized:

- **Case-insensitive** (`Word` → `word`)
- **Whitespace removed** (`my answer` → `myanswer`)
- **Diacritics stripped** (`José` → `jose`)
- **German characters converted** (`ä` → `a`, `ö` → `o`, `ü` → `u`, `ß` → `ss`)
- **Cyrillic characters normalized** (`ё` → `е`, and Latin lookalikes converted `p` → `р`)

---

## **Development & Testing**

This project prioritizes development velocity via LLM assistance, overseen by human architectural guidance.

### **Core Principles**

- **Self-Documenting Code:** Use clear, descriptive names for variables, functions, and files.
- **Separation of Tasks:** Work is strictly divided into two types: **Feature Tasks** and **Architectural Tasks**.
- **Minimal Change Principle (for Feature Tasks):** Only commit changes without which the new feature will not work. Revert all other changes (e.g., reformatting, unrelated refactoring).
- **Human-led Architecture:** All architectural changes, refactoring, and dependency upgrades are initiated by a human in a dedicated **Architectural Task**.

### **Git & PR Guidelines**

- **Commit Messages:** A single, concise line (50-72 characters) in the imperative mood.
  - ✅ `Fix level switching and normalize Cyrillic text`
  - ❌ A multi-line message with bullet points.
- **Pull Requests:** The title should follow the commit message format. The description should be a brief summary.

---

## **Database Migration IDs**

A deterministic scheme is used to assign unique IDs to translations and words.

### **Base Offsets by Language**

| Language | Base ID   | Level | Level Base Offset |
| :------- | :-------- | :---- | :---------------- |
| German   | 3,000,000 | A1    | 3,000,000         |
| Spanish  | 4,000,000 | A1    | 4,000,000         |
| English  | 8,000,000 | A1    | 8,000,000         |
|          |           | A2    | 8,010,000         |
|          |           | B1    | 9,000,000         |
|          |           | B2    | 9,005,000         |

### **ID Assignment Formula**

For each translation entry within a level (where `sequence_number` starts at `0` and increments by `1`):

- `translation_id = level_base_offset + sequence_number`
- `source_word_id = level_base_offset + (sequence_number * 2) + 1`
- `target_word_id = level_base_offset + (sequence_number * 2) + 2`
