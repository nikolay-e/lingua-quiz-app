# **LinguaQuiz Learning Algorithm**

The system uses a level-based mastery and queueing system, not a traditional time-based Spaced Repetition System (SRS).

## **Algorithm Parameters**

| Param              | Value | Description                                                                                            |
| :----------------- | :---- | :----------------------------------------------------------------------------------------------------- |
| `F`                | 5     | **Focus Loop Size:** The queue position an incorrectly answered word moves to.                         |
| `K`                | 2     | **Promotion Coefficient:** A multiplier for `F` to determine spacing for correct answers.              |
| `T_promo`          | 3     | **Promotion Threshold:** Consecutive correct answers needed to advance to the next level.              |
| `MistakeThreshold` | 3     | **Degradation Threshold:** Number of mistakes within the `MistakeWindow` to trigger level degradation. |
| `MistakeWindow`    | 10    | **Degradation Window:** The number of recent attempts checked for degradation.                         |

## **Mastery Levels**

| Level | Name     | Purpose                                                              |
| :---- | :------- | :------------------------------------------------------------------- |
| **0** | New      | Unseen words.                                                        |
| **1** | Learning | Mastering the primary translation direction (e.g., source → target). |
| **2** | Learning | Mastering the reverse translation direction (e.g., target → source). |
| **3** | Examples | Mastering usage examples in the primary direction.                   |
| **4** | Examples | Mastering usage examples in the reverse direction.                   |
| **5** | Mastered | Word is considered fully learned.                                    |

## **Progression & Queue Logic**

- **Correct Answer:**
  - The consecutive correct answer count (`T`) for the word increases.
  - The word is moved to queue position `(K × F) × T`.
  - If `T` reaches `T_promo` (3), the word advances to the next level.
- **Incorrect Answer:**
  - The consecutive correct count `T` resets to 0.
  - The word moves to queue position `F` (5).
  - The system checks if the mistake count within the last `MistakeWindow` (10 attempts) has reached the `MistakeThreshold` (3). If so, the word is degraded one level.
