# **LinguaQuiz System Architecture**

## **Overview**

LinguaQuiz implements a learning system driven by a **decoupled, portable logic core** with an **intelligent,
batch-based persistence strategy**. The architecture completely separates the **business logic** (the portable core)
from the **data storage layer** (the backend) and the **presentation layer** (the client application). This design
maximizes performance, scalability, and code reusability across multiple platforms.

## **Core Architecture Principles**

### **1. Decoupled & Portable Business Logic**

- The entire learning algorithm is encapsulated in **`quiz-core`**, a standalone, framework-agnostic TypeScript package.
- This package can be imported and used by any client (web, mobile, desktop), ensuring consistent logic everywhere.
- It manages level-based mastery, word queues, and answer validation internally.

### **2. Client-Side Logic Execution**

- All learning algorithm calculations run on the client device during a session.
- This provides real-time feedback and level progression without any server-side latency.
- The user's active session state (e.g., current queue positions, consecutive correct counters) is managed entirely in the client's memory and is considered ephemeral.

### **3. Backend as a Simple Persistence Layer**

- The backend's sole responsibility is **simple CRUD operations** for translations, word lists, and user progress.
- It performs **no business logic validation** and acts purely as a data storage and retrieval service.
- All API endpoints are **stateless**.

### **4. Asynchronous & Batched Progress Persistence**

- To minimize network traffic and eliminate UI delays, progress is **not saved after every answer**.
- Changes are queued on the client and saved to the backend in batches, triggered by specific events. This ensures a highly responsive user experience.

### **5. Design Assumption: User-Motivated Progress**

- The system operates on the principle that users are intrinsically motivated to learn.
- As such, **preventing cheating by inspecting client-side data is considered out of scope**. This simplifies the architecture by removing the need for server-side answer validation.

## **System Flow**

### **Learning Session Lifecycle**

```
1. Session Initialization
   ├── Frontend requests: /api/word-sets/user?wordListName=X (GET)
   ├── Backend returns: word translations + current user progress
   ├── Frontend builds: level queues + quiz state in memory using quiz-core.ts
   └── User begins practice

2. Question Presentation
   ├── quiz-core.ts selects the next word from the appropriate level queue
   ├── Determines direction based on level (e.g., LEVEL_1=normal, LEVEL_2=reverse)
   ├── Frontend UI displays the question and starts a response timer

3. Answer Submission
   ├── User submits an answer
   ├── quiz-core.ts validates the answer using its complex parsing logic
   ├── quiz-core.ts updates its internal state (queue positions, level progression, stats)
   ├── Frontend UI receives immediate feedback from the core module
   └── Level changes are persisted to backend via /api/word-sets/user (POST)

4. Progress Persistence (Simple Strategy)
   ├── Only level changes are persisted to the backend
   ├── Uses existing /api/word-sets/user endpoint (POST)
   ├── Session state is ephemeral and managed entirely in frontend
   └── No complex batching or session management needed

5. Next Session Initialization
   ├── On the next launch, frontend fetches latest progress via /api/word-sets/user
   ├── quiz-core.ts rebuilds queues and state from saved progress
   └── Ensures progress continuity across sessions with simple persistence
```

## **Level-Based Learning System**

_(This logic is contained within `quiz-core` and remains unchanged)_

### **Word Progression Path**

```
LEVEL_0 (New)
    ↓ [Auto-promotion to focus pool]
LEVEL_1 (Learning: source → target)
    ↓ [T_promo consecutive correct]
LEVEL_2 (Learning: target → source)
    ↓ [T_promo consecutive correct]
LEVEL_3 (Examples: source → target)
    ↓ [T_promo consecutive correct]
LEVEL_4 (Examples: target → source)
    ↓ [T_promo consecutive correct]
LEVEL_5 (Mastered)
```

### **Queue-Based Word Selection**

- **Deterministic ordering**: No randomization.
- **Error-based positioning**: Incorrect answers → position F (Focus Loop Size = 5).
- **Success-based spacing**: Correct answers → position (K × F) × consecutive_correct = 10 × consecutive_correct.

## **Answer Validation System**

_(This logic is contained within `quiz-core` and remains unchanged)_

### **Multi-Format Answer Support**

```
Format               | Example              | User Must Provide
---------------------|---------------------|-------------------
Comma-separated      | этаж, квартира      | ALL parts (any order)
Pipe-separated       | спасибо|благодарю    | ANY ONE alternative
Parentheses groups   | (равный|одинаковый), (сейчас|сразу) | One from each group
Square brackets      | мир [вселенная]     | Main word ± clarification
```

- Features: Case-insensitive, whitespace normalization, order-independent comparison.

## **Simple Progress Tracking**

### **Level Progress Persistence**

Word-level progress sent to `/api/word-sets/user` when levels change:

```json
{
  "status": "LEVEL_2",
  "wordPairIds": [123]
}
```

Note: Detailed analytics and submission logging are not implemented in the simplified architecture. Focus is on core learning functionality with minimal persistence.

## **System Benefits**

### **Maximum Responsiveness**

- **Zero-latency feedback**: Answer validation is instant as it's purely a client-side function call.
- **Uninterrupted flow**: The UI is never blocked by network requests during the core learning loop.

### **Platform Agnostic & Reusable**

- **Write Once, Run Anywhere**: The `quiz-core` package ensures identical learning logic on web, mobile, and desktop clients.
- **Faster Development**: New clients can be developed rapidly by integrating the existing logic core.

### **Highly Scalable Architecture**

- **Minimal Server Load**: The backend only handles simple data storage, and the batching strategy dramatically reduces the number of API calls.
- **Stateless Backend**: Easy and cheap to scale horizontally.

### **Algorithm Flexibility & Maintenance**

- **Independent Updates**: The learning algorithm inside `quiz-core` can be updated, tested, and versioned independently of the client applications.
- **A/B Testing Ready**: Different versions of the `quiz-core` package can be deployed to different user segments.

## **Future Enhancement Opportunities**

### **Advanced Analytics**

- **Machine learning integration**: Predictive difficulty assessment using collected submission data.
- **Personalized spacing**: Individual-optimized queue positioning based on user performance.
- **Smart level recommendations**: Algorithm-suggested practice levels.

### **Enhanced Tracking & State Management**

- **Detailed submission logging**: Analyze _what_ kind of mistakes users make.
- **Improved Asynchronous Sync**: Develop strategies to make the non-real-time sync feel more seamless to the user, perhaps with UI indicators for "syncing" or "saved" status.
- **Long-term retention testing**: Implement features for spaced recall verification to test if words are truly "Mastered."
