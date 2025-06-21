# LinguaQuiz Learning Algorithm Documentation

## Overview

LinguaQuiz implements a **level-based mastery system** rather than a traditional time-based spaced repetition algorithm. The system focuses on immediate mastery through repeated practice, tracking word knowledge in both translation directions.

## Core Algorithm Components

### 1. Level System

The algorithm uses 6 levels to track word mastery:

- **LEVEL_0**: New/unlearned words (initial state)
- **LEVEL_1**: Focus pool - actively learning words (max 20 words)
- **LEVEL_2**: Translation mastered in one direction
- **LEVEL_3**: Translation mastered in both directions
- **LEVEL_4**: Usage examples mastered in one direction
- **LEVEL_5**: Usage examples mastered in both directions (complete mastery)

### 2. Progression Rules

#### Advancement Criteria
- **3 consecutive correct answers** → advance to next level
- Tracked per session and direction
- No time component - purely performance-based

#### Degradation Criteria
- **3 mistakes in last 10 attempts** → degrade one level
- Prevents words from staying at higher levels if not truly mastered
- Ensures continuous reinforcement of difficult words

### 3. Word Selection Algorithm

The system intelligently selects which word to present next based on:

#### Queue-Based Word Selection

Every level (LEVEL_0 through LEVEL_5) maintains its own queue of words. The system uses these queues for deterministic word selection:

##### Queue Management Rules
- **Level transitions**: When a word moves to any level (advancement or degradation), it's added to the end of that level's queue
- **Incorrect answer**: Word moves to position P (default: 6) in the current level's queue
- **Correct answer**: Word moves to position P × T in the current level's queue, where:
  - P = base position parameter (default: 6)
  - T = number of consecutive correct answers at current level
  - Example: 1st correct → position 6, 2nd correct → position 12, 3rd correct → position 18

##### Level-Based Word Selection
The system selects words from the currently chosen practice level's queue:

- **LEVEL_1 Queue**: Normal direction translation (source → target)
- **LEVEL_2 Queue**: Reverse direction translation (target → source)
- **LEVEL_3 Queue**: Normal direction usage examples (source → target)
- **LEVEL_4 Queue**: Reverse direction usage examples (target → source)

##### Word Selection Process
1. Take the first word from the current level's queue
2. No randomization - purely deterministic queue order
3. No exclusion of recently asked words (queue position handles spacing)
4. If current level's queue is empty, no words are available for practice

### 4. Focus Pool Management

The system maintains a limited focus pool (LEVEL_1) to prevent cognitive overload:

- **Maximum 20 words** in LEVEL_1 at any time
- **Automatic replenishment** when words advance to LEVEL_2
- **Random selection** of new words from LEVEL_0

### 5. Level-Based Practice Selection

The algorithm supports targeted practice through manual level selection with intelligent auto-switching:

- **Level selector** allows users to choose specific practice mode
- **Automatic level adjustment** - system switches to lowest available practice level when current level has no words
- Each level has distinct learning objectives and directions

#### Practice Levels
1. **LEVEL_1**: New Words Practice - Translation in normal direction (source → target)
   - Practices words from LEVEL_0 and LEVEL_1 queues
2. **LEVEL_2**: Reverse Practice - Translation in reverse direction (target → source)
   - Practices words from LEVEL_2 queue  
3. **LEVEL_3**: Context Practice - Usage examples in normal direction (source → target)
   - Practices words from LEVEL_3, LEVEL_4, and LEVEL_5 queues
4. **LEVEL_4**: Reverse Context Practice - Usage examples in reverse direction (target → source)
   - Practices words from LEVEL_3, LEVEL_4, and LEVEL_5 queues

#### Manual Level Selection

The system supports manual level selection for targeted practice:

**Available Practice Levels:**
1. **LEVEL_1** (New Words Practice) - Normal direction translation (source → target)
2. **LEVEL_2** (Reverse Practice) - Reverse direction translation (target → source)  
3. **LEVEL_3** (Context Practice) - Normal direction usage examples (source → target)
4. **LEVEL_4** (Reverse Context) - Reverse direction usage examples (target → source)

**Level Selection Logic:**
- Users can manually select practice levels, but with validation for word availability
- **Manual Level Switching Constraints:**
  - Cannot switch to a level that has no available words
  - If attempted, the system automatically switches to the lowest available level instead
  - User receives feedback about the automatic level adjustment
- **Automatic Level Switching:**
  - When the current level runs out of words during practice, the system automatically switches to the lowest available level
  - Switching preserves the user's progress and continues seamlessly
- **Level-Specific Word Sources:**
  - LEVEL_1: Draws from LEVEL_0 and LEVEL_1 queues (prioritizes LEVEL_1)
  - LEVEL_2: Draws from LEVEL_2 queue only
  - LEVEL_3: Draws from LEVEL_3, LEVEL_4, and LEVEL_5 queues (prioritizes LEVEL_3)
  - LEVEL_4: Draws from LEVEL_3, LEVEL_4, and LEVEL_5 queues (prioritizes LEVEL_3)
- If no words are available anywhere, the system returns "No questions available"

#### Word Progression Path
1. **LEVEL_0 → LEVEL_1**: Word enters focus pool for active learning
2. **LEVEL_1 → LEVEL_2**: Translation mastered in normal direction (source → target)
3. **LEVEL_2 → LEVEL_3**: Translation mastered in reverse direction (target → source)
4. **LEVEL_3 → LEVEL_4**: Usage examples mastered in normal direction
5. **LEVEL_4 → LEVEL_5**: Usage examples mastered in reverse direction (complete mastery)

## Algorithm Flow

```
1. Start Quiz Session
   ↓
2. User Selects Practice Level (LEVEL_1, LEVEL_2, LEVEL_3, or LEVEL_4)
   ↓
3. Check Focus Pool (LEVEL_1)
   - If < 20 words → Move words from front of LEVEL_0 queue to end of LEVEL_1 queue
   ↓
4. Select Next Word
   - Take first word from the selected level's queue
   - No randomization or filtering
   ↓
5. User Answers
   ↓
6. Update Queue Position
   - Correct: Move word to position P × T (T = consecutive correct answers)
   - Incorrect: Move word to position P (default: 6)
   ↓
7. Check Progression Rules
   - If 3 consecutive correct → Move to end of next level's queue
   - If 3/10 recent incorrect → Move to end of previous level's queue
   ↓
8. Update Focus Pool if needed
   ↓
9. Repeat from step 4 (same level until user changes)
```

## Advantages of This Approach

1. **Immediate Feedback Loop**: No waiting for scheduled reviews
2. **Adaptive Difficulty**: Automatically adjusts to user performance
3. **Focused Learning**: Limited active vocabulary prevents overwhelm
4. **Targeted Practice**: Users can focus on specific directions and modes
5. **Deterministic Spacing**: Queue-based system provides predictable spacing between repetitions
6. **Progressive Intervals**: Correct answers push words further back (6th, 12th, 18th position)
7. **Error Recovery**: Incorrect answers bring words back to early positions for reinforcement
8. **User Control**: Manual level selection allows personalized learning strategies

## Differences from Traditional SRS

| Feature | LinguaQuiz | Traditional SRS (e.g., Anki) |
|---------|------------|------------------------------|
| Scheduling | Performance-based | Time-based intervals |
| Review Timing | Immediate | Scheduled (hours/days/months) |
| Focus | Mastery through repetition | Long-term retention |
| Word Selection | Level-based queue priority | Due date priority |
| Session Length | Unlimited | Fixed daily reviews |
| Practice Control | Manual level selection | Automatic card scheduling |

## Future Enhancement Possibilities

To implement true spaced repetition, the system would need:

1. **Time-based scheduling**: Add `next_review_date` field
2. **Interval calculation**: Implement SM-2 or similar algorithm
3. **Ease factor**: Track individual word difficulty
4. **Review history**: Long-term performance tracking
5. **Forgetting curve modeling**: Optimize review timing

The current system provides excellent immediate learning outcomes while maintaining simplicity and user engagement through continuous practice.