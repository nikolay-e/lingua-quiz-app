"""Quiz logic module for managing quiz sessions and algorithms"""
import random
import unicodedata
import re
from typing import Dict, List, Optional, Tuple
import psycopg2
from psycopg2.extras import RealDictCursor

class QuizManager:
    MAX_FOCUS_WORDS = 20
    MAX_LAST_ASKED_WORDS = 7
    CORRECT_ANSWERS_TO_MASTER = 3
    MAX_MISTAKES_BEFORE_DEGRADATION = 3
    
    def __init__(self, db_pool):
        self.db_pool = db_pool
    
    def normalize_text(self, text: str) -> str:
        """Normalize text for comparison"""
        if not text:
            return ''
        # Normalize unicode, remove accents, keep only letters/numbers/spaces
        normalized = unicodedata.normalize('NFD', text.lower())
        # Remove combining characters (accents)
        no_accents = ''.join(c for c in normalized if unicodedata.category(c) != 'Mn')
        # Remove non-alphanumeric except spaces
        clean = re.sub(r'[^\w\s]', '', no_accents)
        # Normalize whitespace
        return re.sub(r'\s+', ' ', clean).strip()
    
    def get_or_create_session(self, user_id: int, word_list_name: str) -> Dict:
        """Get or create quiz session and return full state"""
        conn = None
        try:
            conn = self.db_pool.getconn()
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                # Get quiz state using the function
                cur.execute("SELECT * FROM get_quiz_state(%s, %s)", (user_id, word_list_name))
                state = cur.fetchone()
                
                if not state:
                    return {"error": "Word list not found"}
                
                # Populate focus words if needed
                level_1_count = len(state['level_1_words'] or [])
                level_0_count = len(state['level_0_words'] or [])
                
                if level_1_count < self.MAX_FOCUS_WORDS and level_0_count > 0:
                    self._populate_focus_words(conn, user_id, state['session_id'])
                    # Re-fetch state after population
                    cur.execute("SELECT * FROM get_quiz_state(%s, %s)", (user_id, word_list_name))
                    state = cur.fetchone()
                
                conn.commit()
                # JSONB fields are automatically converted to Python objects by psycopg2 RealDictCursor
                state_dict = dict(state)
                # Ensure word lists are always arrays (COALESCE in SQL should handle this)
                for key in ['level_0_words', 'level_1_words', 'level_2_words', 'level_3_words']:
                    if state_dict[key] is None:
                        state_dict[key] = []
                return state_dict
        finally:
            if conn:
                self.db_pool.putconn(conn)
    
    def _populate_focus_words(self, conn, user_id: int, session_id: int):
        """Move words from LEVEL_0 to LEVEL_1"""
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Get current LEVEL_1 count for this word list
            cur.execute("""
                SELECT COUNT(*) as count
                FROM user_translation_progress utp
                JOIN word_list_entry wle ON wle.translation_id = utp.word_pair_id
                WHERE wle.word_list_id = (SELECT word_list_id FROM quiz_session WHERE id = %s)
                AND utp.user_id = (SELECT user_id FROM quiz_session WHERE id = %s)
                AND utp.status = 'LEVEL_1'
            """, (session_id, session_id))
            result = cur.fetchone()
            current_count = result['count'] if result else 0
            
            spaces_available = self.MAX_FOCUS_WORDS - current_count
            if spaces_available <= 0:
                return
            
            # Get LEVEL_0 words for this quiz
            cur.execute("""
                SELECT t.id
                FROM quiz_session qs
                JOIN word_list_entry wle ON wle.word_list_id = qs.word_list_id
                JOIN translation t ON t.id = wle.translation_id
                LEFT JOIN user_translation_progress utp ON utp.word_pair_id = t.id AND utp.user_id = %s
                WHERE qs.id = %s AND (utp.status = 'LEVEL_0' OR utp.status IS NULL)
                ORDER BY RANDOM()
                LIMIT %s
            """, (user_id, session_id, spaces_available))
            
            words_to_move = [row['id'] for row in cur.fetchall()]
            
            # Move words to LEVEL_1
            for word_id in words_to_move:
                cur.execute("""
                    INSERT INTO user_translation_progress (user_id, word_pair_id, status)
                    VALUES (%s, %s, 'LEVEL_1')
                    ON CONFLICT (user_id, word_pair_id)
                    DO UPDATE SET status = 'LEVEL_1', updated_at = CURRENT_TIMESTAMP
                """, (user_id, word_id))
    
    def get_next_question(self, user_id: int, word_list_name: str) -> Optional[Dict]:
        """Get next question based on algorithm"""
        conn = None
        try:
            conn = self.db_pool.getconn()
            return self._get_next_question_internal(conn, user_id, word_list_name)
        except Exception as e:
            if conn:
                try:
                    conn.rollback()
                except:
                    pass
            raise
        finally:
            if conn:
                self.db_pool.putconn(conn)
    
    def _get_next_question_internal(self, conn, user_id: int, word_list_name: str) -> Optional[Dict]:
        """Internal method to get next question using existing connection"""
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
                # Get session with row-level lock that persists through transaction
                cur.execute("""
                    SELECT qs.*, wl.name as word_list_name
                    FROM quiz_session qs
                    JOIN word_list wl ON wl.id = qs.word_list_id
                    WHERE qs.user_id = %s AND wl.name = %s
                    FOR UPDATE
                """, (user_id, word_list_name))
                session = cur.fetchone()
                
                if not session:
                    return {"error": "No quiz session found"}
                
                # Auto-toggle direction based on available words
                self._auto_toggle_direction(cur, session)
                
                # Get word sets based on direction
                if session['direction']:  # Normal direction
                    primary_status = 'LEVEL_1'
                    fallback_status = 'LEVEL_2'  # Allow L2 words in normal direction as fallback
                else:  # Reverse direction
                    primary_status = 'LEVEL_2'
                    fallback_status = 'LEVEL_1'
                
                # Get candidate words
                candidates = self._get_candidate_words(cur, user_id, session['word_list_id'], primary_status)
                
                # Exclude the current word to avoid immediate repetition
                current_word = session.get('current_translation_id')
                if current_word and current_word in candidates:
                    candidates.remove(current_word)
                
                
                if not candidates and fallback_status:
                    candidates = self._get_candidate_words(cur, user_id, session['word_list_id'], fallback_status)
                    
                    # Exclude current word from fallback candidates too
                    if current_word and current_word in candidates:
                        candidates.remove(current_word)
                    
                
                if not candidates:
                    # Try to populate more words if in normal direction
                    if session['direction']:
                        self._populate_focus_words(conn, user_id, session['id'])
                        candidates = self._get_candidate_words(cur, user_id, session['word_list_id'], primary_status)
                        
                        # Exclude current word from newly populated candidates
                        if current_word and current_word in candidates:
                            candidates.remove(current_word)
                    else:
                        # In reverse direction, if no L2 words, check if we should switch to normal
                        # to give L2 words more chances to reach L3
                        cur.execute("""
                            SELECT COUNT(*) as l2_count
                            FROM word_list_entry wle
                            JOIN user_translation_progress utp 
                                ON utp.word_pair_id = wle.translation_id 
                                AND utp.user_id = %s
                            WHERE wle.word_list_id = %s AND utp.status = 'LEVEL_2'
                        """, (user_id, session['word_list_id']))
                        
                        l2_result = cur.fetchone()
                        if l2_result['l2_count'] > 0:
                            # Force switch to normal direction to practice L2 words
                            cur.execute("""
                                UPDATE quiz_session 
                                SET direction = true
                                WHERE id = %s
                            """, (session['id'],))
                            
                            # Get L2 words as candidates (they can be practiced in normal direction too)
                            candidates = self._get_candidate_words(cur, user_id, session['word_list_id'], 'LEVEL_2')
                            if current_word and current_word in candidates:
                                candidates.remove(current_word)
                        
                    
                    # Check if quiz is complete FIRST (all words at L3)
                    cur.execute("""
                        SELECT COUNT(*) as total,
                               COUNT(CASE WHEN COALESCE(utp.status, 'LEVEL_0') = 'LEVEL_3' THEN 1 END) as mastered
                        FROM word_list_entry wle
                        LEFT JOIN user_translation_progress utp 
                            ON utp.word_pair_id = wle.translation_id 
                            AND utp.user_id = %s
                        WHERE wle.word_list_id = %s
                    """, (user_id, session['word_list_id']))
                    
                    progress = cur.fetchone()
                    if progress['mastered'] == progress['total']:
                        return {
                            "completed": True,
                            "message": "Congratulations! You've mastered all words!",
                            "word": "🎉 Quiz Complete! 100% Mastered! 🎉",
                            "totalWords": progress['total'],
                            "masteredWords": progress['mastered']
                        }
                    
                    if not candidates:
                        return {"error": "No more questions available", "word": "No more questions available."}
                
                # Select next word based on algorithm
                next_translation_id = self._select_next_word(cur, session, candidates)
                
                # Update session - ensure transaction is committed
                cur.execute("""
                    UPDATE quiz_session 
                    SET current_translation_id = %s,
                        last_asked_words = array_append(
                            (SELECT COALESCE(array_agg(elem), ARRAY[]::INTEGER[]) FROM (
                                SELECT unnest(COALESCE(last_asked_words, ARRAY[]::INTEGER[])) as elem 
                                ORDER BY array_position(COALESCE(last_asked_words, ARRAY[]::INTEGER[]), unnest(COALESCE(last_asked_words, ARRAY[]::INTEGER[]))) 
                                OFFSET GREATEST(0, COALESCE(array_length(last_asked_words, 1), 0) - %s + 1)
                            ) sub),
                            %s
                        ),
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = %s
                """, (next_translation_id, self.MAX_LAST_ASKED_WORDS, next_translation_id, session['id']))
                
                # Verify the update was successful
                cur.execute("SELECT current_translation_id FROM quiz_session WHERE id = %s", (session['id'],))
                updated_current = cur.fetchone()
                
                # Commit the transaction to persist the changes
                conn.commit()
                
                # Get word details
                cur.execute("""
                    SELECT t.id, sw.text as source_word, tw.text as target_word,
                           sl.name as source_language, tl.name as target_language
                    FROM translation t
                    JOIN word sw ON t.source_word_id = sw.id
                    JOIN word tw ON t.target_word_id = tw.id
                    JOIN language sl ON sw.language_id = sl.id
                    JOIN language tl ON tw.language_id = tl.id
                    WHERE t.id = %s
                """, (next_translation_id,))
                word_data = cur.fetchone()
                
                return {
                    "word": word_data['source_word'] if session['direction'] else word_data['target_word'],
                    "translationId": word_data['id'],
                    "direction": "normal" if session['direction'] else "reverse",
                    "sourceLanguage": word_data['source_language'],
                    "targetLanguage": word_data['target_language']
                }
    
    def _auto_toggle_direction(self, cur, session: Dict):
        """Auto-toggle direction based on available words - DISABLED to prevent race conditions"""
        # DISABLED: Auto-toggle causes race conditions where frontend doesn't know about direction changes
        # This leads to session state mismatches and wrong answer validation
        return
    
    def _get_candidate_words(self, cur, user_id: int, word_list_id: int, status: str) -> List[int]:
        """Get candidate words for given status"""
        cur.execute("""
            SELECT DISTINCT t.id
            FROM word_list_entry wle
            JOIN translation t ON t.id = wle.translation_id
            LEFT JOIN user_translation_progress utp ON utp.word_pair_id = t.id AND utp.user_id = %s
            WHERE wle.word_list_id = %s 
            AND (
                (%s = 'LEVEL_0' AND (utp.status = 'LEVEL_0' OR utp.status IS NULL)) OR
                (utp.status = %s)
            )
        """, (user_id, word_list_id, status, status))
        return [row['id'] for row in cur.fetchall()]
    
    def _select_next_word(self, cur, session: Dict, candidates: List[int]) -> int:
        """Select next word based on error frequency and recency"""
        
        if not candidates:
            raise Exception("No candidates provided to _select_next_word")
        
        # Get error counts
        cur.execute("""
            SELECT translation_id, SUM(incorrect) as error_count
            FROM quiz_session_stats
            WHERE session_id = %s AND translation_id = ANY(%s)
            GROUP BY translation_id
        """, (session['id'], candidates))
        
        error_counts = {row['translation_id']: row['error_count'] for row in cur.fetchall()}
        
        # Sort by error count (descending) with randomization for ties
        sorted_candidates = sorted(candidates, key=lambda x: (error_counts.get(x, 0), random.random()), reverse=True)
        
        # Get top candidates
        top_candidates = sorted_candidates[:10]
        
        # Filter out recently asked
        last_asked = session['last_asked_words'] or []
        available = [c for c in top_candidates if c not in last_asked[-self.MAX_LAST_ASKED_WORDS:]]
        
        if not available:
            available = top_candidates
        
        if not available:
            raise Exception(f"No available candidates after filtering. Top candidates: {top_candidates}, Last asked: {last_asked[-self.MAX_LAST_ASKED_WORDS:]}")
        
        selected = random.choice(available)
        return selected
    
    def submit_answer(self, user_id: int, word_list_name: str, translation_id: int, user_answer: str, displayed_word: str = None) -> Dict:
        """Process answer submission with optional displayed word validation"""
        conn = None
        try:
            conn = self.db_pool.getconn()
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                # Get session and validate translation_id matches current question with row lock
                cur.execute("""
                    SELECT qs.*, sw.text as source_word, tw.text as target_word,
                           sw.usage_example as source_example, tw.usage_example as target_example
                    FROM quiz_session qs
                    JOIN word_list wl ON wl.id = qs.word_list_id
                    JOIN translation t ON t.id = %s
                    JOIN word sw ON t.source_word_id = sw.id
                    JOIN word tw ON t.target_word_id = tw.id
                    WHERE qs.user_id = %s AND wl.name = %s
                    FOR UPDATE OF qs
                """, (translation_id, user_id, word_list_name))
                
                data = cur.fetchone()
                if not data:
                    return {"error": "Invalid session or translation"}
                
                # Validate the displayed word matches what we expect
                if displayed_word:
                    expected_word = data['source_word'] if data['direction'] else data['target_word']
                    if displayed_word != expected_word:
                        return {
                            "error": "Session out of sync. The question has changed.",
                            "needsRefresh": True,
                            "currentWord": expected_word
                        }
                
                # Validate that the translation_id matches the current question
                if data['current_translation_id'] != translation_id:
                    return {
                        "error": "This question has already been answered. Moving to next question.",
                        "needsRefresh": True
                    }
                
                # Determine correct answer
                correct_answer = data['target_word'] if data['direction'] else data['source_word']
                normalized_user = self.normalize_text(user_answer)
                normalized_correct = self.normalize_text(correct_answer)
                
                # Check for intentionally wrong answers first
                if "INTENTIONALLY_WRONG" in user_answer:
                    is_correct = False  # Force to be incorrect for test purposes
                else:
                    is_correct = normalized_user == normalized_correct
                
                # Update statistics
                direction = 'normal' if data['direction'] else 'reverse'
                cur.execute("""
                    INSERT INTO quiz_session_stats 
                    (session_id, translation_id, direction, attempts, correct, incorrect, consecutive_mistakes)
                    VALUES (%s, %s, %s, 1, %s, %s, %s)
                    ON CONFLICT (session_id, translation_id, direction)
                    DO UPDATE SET
                        attempts = quiz_session_stats.attempts + 1,
                        correct = quiz_session_stats.correct + %s,
                        incorrect = quiz_session_stats.incorrect + %s,
                        consecutive_mistakes = CASE WHEN %s THEN 0 ELSE quiz_session_stats.consecutive_mistakes + 1 END,
                        last_answered_at = CURRENT_TIMESTAMP
                """, (data['id'], translation_id, direction, 
                      1 if is_correct else 0, 0 if is_correct else 1, 0 if is_correct else 1,
                      1 if is_correct else 0, 0 if is_correct else 1, is_correct))
                
                # Get updated stats
                cur.execute("""
                    SELECT * FROM quiz_session_stats 
                    WHERE session_id = %s AND translation_id = %s AND direction = %s
                """, (data['id'], translation_id, direction))
                stats = cur.fetchone()
                
                # Check for status changes
                status_changed = False
                new_status = None
                
                # Check for level advancement (aggregate correct answers from both directions)
                if is_correct:
                    # Check current status first
                    cur.execute("""
                        SELECT status FROM user_translation_progress 
                        WHERE user_id = %s AND word_pair_id = %s
                    """, (user_id, translation_id))
                    current = cur.fetchone()
                    current_status = current['status'] if current else 'LEVEL_0'
                    
                    # Get correct answers since last status change
                    # We use the stats that were just updated above
                    cur.execute("""
                        SELECT correct, direction FROM quiz_session_stats 
                        WHERE session_id = %s AND translation_id = %s
                    """, (data['id'], translation_id))
                    all_stats = cur.fetchall()
                    
                    # Sum up correct answers from both directions
                    total_correct = sum(stat['correct'] for stat in all_stats)
                    
                    
                    # Each level requires 3 correct answers to advance
                    required_correct = self.CORRECT_ANSWERS_TO_MASTER
                    
                    if total_correct >= required_correct:
                        # Simple progression: each level advances to the next after 3 correct answers
                        upgrade_map = {
                            'LEVEL_0': 'LEVEL_1',
                            'LEVEL_1': 'LEVEL_2', 
                            'LEVEL_2': 'LEVEL_3'
                        }
                        
                        if current_status in upgrade_map:
                            new_status = upgrade_map[current_status]
                            status_changed = True
                
                elif not is_correct and stats['consecutive_mistakes'] >= self.MAX_MISTAKES_BEFORE_DEGRADATION:
                    # Degrade status
                    cur.execute("""
                        SELECT status FROM user_translation_progress 
                        WHERE user_id = %s AND word_pair_id = %s
                    """, (user_id, translation_id))
                    current = cur.fetchone()
                    if current:
                        degrade_map = {
                            'LEVEL_3': 'LEVEL_2',
                            'LEVEL_2': 'LEVEL_1', 
                            'LEVEL_1': 'LEVEL_0'
                        }
                        if current['status'] in degrade_map:
                            new_status = degrade_map[current['status']]
                            status_changed = True
                
                # Update status if changed
                if status_changed and new_status:
                    cur.execute("""
                        INSERT INTO user_translation_progress (user_id, word_pair_id, status)
                        VALUES (%s, %s, %s)
                        ON CONFLICT (user_id, word_pair_id)
                        DO UPDATE SET status = %s, updated_at = CURRENT_TIMESTAMP
                    """, (user_id, translation_id, new_status, new_status))
                    
                    # Reset stats for both directions when status changes (up or down)
                    cur.execute("""
                        UPDATE quiz_session_stats 
                        SET correct = 0, consecutive_mistakes = 0 
                        WHERE session_id = %s AND translation_id = %s
                    """, (data['id'], translation_id))
                    
                    # If a word moved from L1 to L2, replenish L1 from L0
                    if new_status == 'LEVEL_2':
                        self._populate_focus_words(conn, user_id, data['id'])
                
                # Get updated state
                cur.execute("SELECT * FROM get_quiz_state(%s, %s)", (user_id, word_list_name))
                updated_state = cur.fetchone()
                
                # JSONB fields are automatically converted to Python objects by psycopg2 RealDictCursor
                updated_state_dict = dict(updated_state)
                # Ensure word lists are always arrays (COALESCE in SQL should handle this)
                for key in ['level_0_words', 'level_1_words', 'level_2_words', 'level_3_words']:
                    if updated_state_dict[key] is None:
                        updated_state_dict[key] = []
                
                conn.commit()
                
                # Prepare response
                feedback_message = "Correct!" if is_correct else f"{data['source_word']}' ↔ '{data['target_word']}'"
                
                feedback = {
                    "message": feedback_message,
                    "isSuccess": is_correct
                }
                
                usage_examples = {
                    "source": data['source_example'] or "No source example available",
                    "target": data['target_example'] or "No target example available"
                }
                
                # Get next question before returning
                next_question = self._get_next_question_internal(conn, user_id, word_list_name)
                
                return {
                    "feedback": feedback,
                    "usageExamples": usage_examples,
                    "statusChanged": status_changed,
                    "wordLists": {
                        "level0": updated_state_dict['level_0_words'],
                        "level1": updated_state_dict['level_1_words'],
                        "level2": updated_state_dict['level_2_words'],
                        "level3": updated_state_dict['level_3_words']
                    },
                    "nextQuestion": next_question
                }
        finally:
            if conn:
                self.db_pool.putconn(conn)
    
    def toggle_direction(self, user_id: int, word_list_name: str) -> Dict:
        """Toggle quiz direction"""
        conn = None
        try:
            conn = self.db_pool.getconn()
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                # Get session
                cur.execute("""
                    UPDATE quiz_session qs
                    SET direction = NOT direction, 
                        current_translation_id = NULL,  -- Reset current question to force new selection
                        updated_at = CURRENT_TIMESTAMP
                    FROM word_list wl
                    WHERE qs.word_list_id = wl.id 
                    AND qs.user_id = %s 
                    AND wl.name = %s
                    RETURNING qs.direction
                """, (user_id, word_list_name))
                
                result = cur.fetchone()
                conn.commit()
                
                if result:
                    # Return updated quiz state including word lists
                    cur.execute("SELECT * FROM get_quiz_state(%s, %s)", (user_id, word_list_name))
                    updated_state = cur.fetchone()
                    
                    if updated_state:
                        # JSONB fields are automatically converted to Python objects by psycopg2 RealDictCursor
                        state_dict = dict(updated_state)
                        # Ensure word lists are always arrays (COALESCE in SQL should handle this)
                        for key in ['level_0_words', 'level_1_words', 'level_2_words', 'level_3_words']:
                            if state_dict[key] is None:
                                state_dict[key] = []
                        
                        return {
                            "direction": "normal" if result['direction'] else "reverse",
                            "wordLists": {
                                "level0": state_dict['level_0_words'],
                                "level1": state_dict['level_1_words'],
                                "level2": state_dict['level_2_words'],
                                "level3": state_dict['level_3_words']
                            }
                        }
                    else:
                        return {"direction": "normal" if result['direction'] else "reverse"}
                else:
                    return {"error": "Quiz session not found"}
        finally:
            if conn:
                self.db_pool.putconn(conn)