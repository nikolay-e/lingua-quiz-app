# LinguaQuiz Learning Algorithm Documentation

## Overview

LinguaQuiz implements a **level-based mastery system** rather than a traditional time-based spaced repetition algorithm.
The system focuses on immediate mastery through repeated practice, tracking word knowledge in both translation directions.

## Algorithm Parameters

This section defines the core parameters that control the learning dynamics. The default values are balanced for a typical learning scenario.

| Parameter          | Default Value | Description                                                                                                                  |
| :----------------- | :------------ | :--------------------------------------------------------------------------------------------------------------------------- |
| `F`                | 5             | **Focus Loop Size.** The queue position for an incorrect answer. Defines the number of difficult words actively circulating. |
| `K`                | 2             | **Promotion Coefficient.** The multiplier for `F` that determines the base spacing for a correct answer.                     |
| `T_promo`          | 3             | **Promotion Threshold.** The number of _consecutive correct answers_ required to advance to the next level.                  |
| `MistakeThreshold` | 3             | **Degradation Threshold.** The number of mistakes within the `MistakeWindow` that triggers a level degradation.              |
| `MistakeWindow`    | 10            | **Degradation Window.** The number of recent attempts to consider when checking for the `MistakeThreshold`.                  |

## Core Algorithm Components

### 1. Level System

The algorithm uses 6 levels to track word mastery:

- **LEVEL_0**: New/unlearned words (initial state).
- **LEVEL_1**: Focus pool - actively learning words.
- **LEVEL_2**: Translation mastered in one direction.
- **LEVEL_3**: Translation mastered in both directions.
- **LEVEL_4**: Usage examples mastered in one direction.
- **LEVEL_5**: Usage examples mastered in both directions (complete mastery).

### 2. Progression Rules

#### Advancement Criteria

- **`T_promo` consecutive correct answers** → advance to the next level.
- Tracked per session and direction.
- No time component - purely performance-based.

#### Degradation Criteria

- Degradation is checked **after every incorrect answer**. If the number of mistakes for a word within its last `MistakeWindow` attempts reaches the `MistakeThreshold`, the word is degraded one level.
- This check is continuous and does not require the full `MistakeWindow` to be populated with attempts.
- On degradation, the word is moved to the **very end of the previous level's queue**.

### 3. Word Selection Algorithm

The system intelligently selects which word to present next based on its position in a deterministic queue.

#### Queue Management Rules

- **Level transitions**: When a word moves to any level (advancement or degradation), it is added to the end of that level's queue.
- **Incorrect answer**: The word moves to position **`F`**.
- **Correct answer**: The word moves to position **`(K × F) × T`**, where `T` is the number of consecutive correct answers.

### 4. Focus Pool Management

The system maintains a **dynamic focus pool** (LEVEL_1) to prevent cognitive overload while ensuring queue integrity.

- The maximum size of the focus pool is determined by the formula: **`MaxFocusPoolSize = K × F × T_promo`**.
- With default parameters, the maximum size is `2 × 5 × 3 = 30` words.
- **Automatic replenishment**: The system fills the focus pool up to `MaxFocusPoolSize` whenever there is space and new words are available in LEVEL_0.

### 5. Automatic Practice Level Selection

Practice level selection is **fully automated** to provide a guided and efficient learning path. The user does not choose the level.

#### Selection Logic

1. A practice session always begins by finding the **lowest-numbered level** (from `LEVEL_1` to `LEVEL_4`) that contains practiceable words.
2. The system presents all words from the selected level's queue until it is depleted.
3. Once the current level's queue is empty, the system **automatically rescans** for the new lowest available level and seamlessly transitions to it.
4. This creates a natural, bottom-up progression, ensuring foundational knowledge is solid before advancing.

#### Practice Types per Level

- **LEVEL_1 Practice**: Normal direction translation (source → target). Draws from `LEVEL_0` and `LEVEL_1` queues.
- **LEVEL_2 Practice**: Reverse direction translation (target → source). Draws from `LEVEL_2` queue.
- **LEVEL_3 Practice**: Normal direction usage examples. Draws from `LEVEL_3`, `LEVEL_4`, and `LEVEL_5` queues.
- **LEVEL_4 Practice**: Reverse direction usage examples. Draws from `LEVEL_3`, `LEVEL_4`, and `LEVEL_5` queues.

## Algorithm Flow

```
1. Start Session
   ↓
2. Determine Practice Level
   - Find the lowest level (from LEVEL_1 to LEVEL_4) with a non-empty queue.
   - If no such level exists → End session ("No questions available").
   ↓
3. Check Focus Pool (LEVEL_1)
   - Calculate MaxFocusPoolSize = K × F × T_promo.
   - If current pool count < MaxFocusPoolSize → Move words from LEVEL_0 to LEVEL_1.
   ↓
4. Select Next Word
   - Take the first word from the current practice level's queue.
   ↓
5. User Answers
   ↓
6. Update Queue Position
   - Correct: Move word to position (K × F) × T.
   - Incorrect: Move word to position F and reset consecutive correct answer count (T).
   ↓
7. Check Progression Rules
   - If consecutive correct answers (T) equals T_promo → Advance word to the next level.
   - If the answer was incorrect, check for degradation:
     - If mistakes in last MistakeWindow attempts ≥ MistakeThreshold → Degrade word to the previous level.
   ↓
8. Check Queue State
   - If the current level's queue has more words → Repeat from step 4.
   - If the current level's queue is empty → Repeat from step 2.
```

## Advantages of This Approach

1. **Immediate Feedback Loop**: No waiting for scheduled reviews.
2. **Adaptive Difficulty**: Automatically adjusts to user performance in real-time.
3. **Focused Learning**: A dynamic focus pool prevents cognitive overload.
4. **Automated Focus**: The system automatically directs the user to the most foundational material available, removing the cognitive load of choosing what to study.
5. **Deterministic Spacing**: The queue-based system provides predictable, logical spacing between repetitions within a session.
6. **Progressive Intervals**: Correct answers progressively push words further back in the queue.
7. **Responsive Error Recovery**: Incorrect answers are immediately brought back for reinforcement, and consistent failure leads to swift degradation.
8. **Fully Parametrized**: The entire learning dynamic can be fine-tuned by adjusting the core parameters, allowing for high flexibility in implementation.

## Differences from Traditional SRS

| Feature        | LinguaQuiz                       | Traditional SRS (e.g., Anki)           |
| :------------- | :------------------------------- | :------------------------------------- |
| Scheduling     | Performance-based                | Time-based intervals                   |
| Review Timing  | Immediate                        | Scheduled (hours/days/months)          |
| Focus          | Immediate Mastery                | Long-term retention                    |
| Word Selection | Automatic level & queue priority | Due date priority                      |
| User Control   | None (fully guided path)         | High (deck options, scheduling tweaks) |

## Future Enhancement Possibilities

To implement true spaced repetition for long-term retention, the system could be enhanced with:

1. **Time-based scheduling**: Add a `next_review_date` field to words that reach `LEVEL_5`.
2. **Interval calculation**: Implement an algorithm like SM-2 for words in a long-term review state.
3. **Ease factor**: Track individual word difficulty over long periods.
4. **Review history**: Maintain a persistent log of all answers for a word.
5. **Forgetting curve modeling**: Use performance data to optimize review timing.
