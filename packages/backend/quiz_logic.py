"""
Modern Quiz Service - Replaces the old mega-function approach
Clean, testable, maintainable code with proper separation of concerns
"""
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass, asdict
from psycopg2.extras import RealDictCursor
import logging

logger = logging.getLogger(__name__)

@dataclass
class QuizState:
    """Clean data structure for quiz state"""
    session_id: int
    word_list_id: int
    direction: str  # 'normal' or 'reverse'
    current_word_id: Optional[int]
    level_counts: Dict[str, int]

@dataclass 
class WordInfo:
    """Clean data structure for word information"""
    translation_id: int
    source_word: str
    target_word: str
    source_language: str
    target_language: str
    source_example: Optional[str]
    target_example: Optional[str]

@dataclass
class QuizQuestion:
    """Clean data structure for quiz questions"""
    word_id: int
    displayed_word: str
    direction: str
    source_language: str
    target_language: str
    session_id: int

@dataclass
class AnswerResult:
    """Clean data structure for answer results"""
    is_correct: bool
    correct_answer: str
    submission_id: int
    word_info: WordInfo
    level_changed: bool
    old_level: Optional[str]
    new_level: Optional[str]

class QuizManager:
    """
    Modern quiz service that handles business logic in Python
    Uses focused SQL functions for data access only
    """
    
    # Configuration constants (easily testable and changeable)
    MAX_FOCUS_WORDS = 20
    MAX_LAST_ASKED_WORDS = 7
    CORRECT_ANSWERS_TO_MASTER = 3
    MISTAKES_IN_LAST_ATTEMPTS = 3
    LAST_ATTEMPTS_COUNT = 10
    
    def __init__(self, db_pool):
        self.db_pool = db_pool
    
    def get_or_create_session(self, user_id: int, word_list_name: str) -> Dict:
        """Get or create quiz session with proper error handling"""
        conn = None
        try:
            conn = self.db_pool.getconn()
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                # Use simple SQL function for session creation
                cur.execute("""
                    SELECT create_or_get_quiz_session(%s, %s) as session_id
                """, (user_id, word_list_name))
                
                result = cur.fetchone()
                if not result or not result['session_id']:
                    return {'error': 'Word list not found'}
                
                session_id = result['session_id']
                
                # Get session info
                cur.execute("""
                    SELECT * FROM get_session_info(%s, %s)
                """, (user_id, word_list_name))
                
                session_info = cur.fetchone()
                if not session_info:
                    return {'error': 'Session not found'}
                
                # Get level counts
                cur.execute("""
                    SELECT * FROM count_user_words_by_level(%s, %s)
                """, (user_id, session_info['word_list_id']))
                
                counts = cur.fetchone()
                
                # Populate focus words if needed (business logic in Python)
                if counts['level_1_count'] < self.MAX_FOCUS_WORDS and counts['level_0_count'] > 0:
                    self._populate_focus_words(cur, user_id, session_info['word_list_id'])
                    # Re-fetch counts
                    cur.execute("""
                        SELECT * FROM count_user_words_by_level(%s, %s)
                    """, (user_id, session_info['word_list_id']))
                    counts = cur.fetchone()
                
                conn.commit()
                
                # Get actual word lists for each level
                word_lists = self._get_word_lists_by_level(cur, user_id, session_info['word_list_id'])
                
                return {
                    'session_id': session_id,
                    'word_list_id': session_info['word_list_id'],
                    'direction': session_info['direction'],
                    'current_translation_id': session_info.get('current_word_id'),
                    'source_language': word_lists.get('source_language', 'German'),
                    'target_language': word_lists.get('target_language', 'Russian'),
                    'level_0_words': word_lists['level_0'],
                    'level_1_words': word_lists['level_1'],
                    'level_2_words': word_lists['level_2'],
                    'level_3_words': word_lists['level_3'],
                    'level_counts': {
                        'level_0': int(counts['level_0_count']),
                        'level_1': int(counts['level_1_count']), 
                        'level_2': int(counts['level_2_count']),
                        'level_3': int(counts['level_3_count']),
                        'total': int(counts['total_words'])
                    }
                }
                
        except Exception as e:
            logger.error(f"Failed to get/create session: {e}")
            if conn:
                conn.rollback()
            raise
        finally:
            if conn:
                self.db_pool.putconn(conn)
    
    def get_next_question(self, user_id: int, word_list_name: str) -> Optional[Dict]:
        """Get next question using focused SQL functions"""
        conn = None
        try:
            conn = self.db_pool.getconn()
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                # Use the optimized SQL function
                cur.execute("""
                    SELECT * FROM get_next_quiz_question(%s, %s)
                """, (user_id, word_list_name))
                
                result = cur.fetchone()
                if not result:
                    # Check if quiz is complete
                    session_data = self.get_or_create_session(user_id, word_list_name)
                    if 'level_counts' in session_data:
                        counts = session_data['level_counts']
                        if counts['level_3'] == counts['total'] and counts['total'] > 0:
                            return {
                                'completed': True,
                                'message': 'Congratulations! You\'ve mastered all words!',
                                'word': '🎉 Quiz Complete! 100% Mastered! 🎉',
                                'totalWords': counts['total'],
                                'masteredWords': counts['level_3']
                            }
                    return {'error': 'No questions available'}
                
                conn.commit()
                
                return {
                    'word': result['displayed_word'],
                    'translationId': result['word_id'],
                    'direction': 'normal' if result['direction'] else 'reverse',
                    'sourceLanguage': result['source_language'],
                    'targetLanguage': result['target_language']
                }
                
        except Exception as e:
            logger.error(f"Failed to get next question: {e}")
            if conn:
                conn.rollback()
            raise
        finally:
            if conn:
                self.db_pool.putconn(conn)
    
    def submit_answer(self, user_id: int, word_list_name: str, translation_id: int, 
                     user_answer: str, displayed_word: str = None) -> Dict:
        """Submit answer with business logic in Python"""
        conn = None
        try:
            conn = self.db_pool.getconn()
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                # Get session ID first
                cur.execute("""
                    SELECT qs.id as session_id, qs.direction
                    FROM quiz_session qs
                    JOIN word_list wl ON wl.id = qs.word_list_id
                    WHERE qs.user_id = %s AND wl.name = %s
                """, (user_id, word_list_name))
                
                session_info = cur.fetchone()
                if not session_info:
                    return {'error': 'Session not found'}
                
                session_id = session_info['session_id']
                
                # Validate translation_id belongs to this word list
                cur.execute("""
                    SELECT 1 FROM word_list_entry wle
                    JOIN quiz_session qs ON qs.word_list_id = wle.word_list_id
                    WHERE qs.id = %s AND wle.translation_id = %s
                """, (session_id, translation_id))
                
                if not cur.fetchone():
                    return {'error': 'Invalid translation ID for this quiz'}
                
                # Process answer using focused SQL function
                cur.execute("""
                    SELECT * FROM process_quiz_answer(%s, %s, %s, %s, %s)
                """, (user_id, session_id, translation_id, user_answer, displayed_word))
                
                answer_result = cur.fetchone()
                if not answer_result:
                    return {'error': 'Invalid submission'}
                
                # Check if level should change
                cur.execute("""
                    SELECT * FROM check_level_progression(%s, %s, %s, %s)
                """, (user_id, translation_id, session_id, session_info['direction']))
                
                progression = cur.fetchone()
                
                level_changed = False
                old_level = progression['current_level']
                new_level = progression['new_level']
                
                # Apply level change if needed
                if progression['should_advance'] or progression['should_degrade']:
                    cur.execute("""
                        SELECT update_user_word_level(%s, %s, %s) as updated
                    """, (user_id, translation_id, new_level))
                    
                    level_changed = cur.fetchone()['updated']
                    
                    # Handle post-level-change actions (business logic)
                    if level_changed:
                        self._handle_level_change(cur, user_id, session_id, old_level, new_level)
                
                conn.commit()
                
                # Prepare response (compatible with old API format)
                response = {
                    'feedback': {
                        'message': 'Correct!' if answer_result['is_correct'] 
                                  else f"{answer_result['source_word']} ↔ {answer_result['target_word']}",
                        'isSuccess': answer_result['is_correct']
                    },
                    'usageExamples': {
                        'source': answer_result['source_example'] or 'No source example available',
                        'target': answer_result['target_example'] or 'No target example available'
                    },
                    'statusChanged': level_changed
                }
                
                if level_changed:
                    response['levelChange'] = {
                        'oldLevel': old_level,
                        'newLevel': new_level
                    }
                
                # Get next question for seamless flow
                try:
                    next_question = self.get_next_question(user_id, word_list_name)
                    if next_question and 'error' not in next_question:
                        response['nextQuestion'] = next_question
                except:
                    logger.warning("Failed to get next question after answer submission")
                
                # Get updated word lists to include in response
                cur.execute("""
                    SELECT word_list_id FROM quiz_session WHERE id = %s
                """, (session_id,))
                word_list_id = cur.fetchone()['word_list_id']
                
                # Get updated counts and word lists
                cur.execute("""
                    SELECT * FROM count_user_words_by_level(%s, %s)
                """, (user_id, word_list_id))
                counts = cur.fetchone()
                
                # Get actual word lists for each level
                word_lists = self._get_word_lists_by_level(cur, user_id, word_list_id)
                
                response['wordLists'] = {
                    'level0': word_lists['level_0'],
                    'level1': word_lists['level_1'],
                    'level2': word_lists['level_2'],
                    'level3': word_lists['level_3']
                }
                
                return response
                
        except Exception as e:
            logger.error(f"Failed to submit answer: {e}")
            if conn:
                conn.rollback()
            raise
        finally:
            if conn:
                self.db_pool.putconn(conn)
    
    def toggle_direction(self, user_id: int, word_list_name: str) -> Dict:
        """Toggle quiz direction"""
        conn = None
        try:
            conn = self.db_pool.getconn()
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("""
                    UPDATE quiz_session 
                    SET direction = NOT direction, 
                        current_translation_id = NULL,
                        updated_at = CURRENT_TIMESTAMP
                    FROM word_list
                    WHERE quiz_session.word_list_id = word_list.id
                    AND quiz_session.user_id = %s 
                    AND word_list.name = %s
                    RETURNING quiz_session.direction
                """, (user_id, word_list_name))
                
                result = cur.fetchone()
                if not result:
                    return {'error': 'Quiz session not found'}
                
                # Get updated level counts
                cur.execute("""
                    SELECT wl.id as word_list_id FROM word_list wl WHERE wl.name = %s
                """, (word_list_name,))
                word_list_id = cur.fetchone()['word_list_id']
                
                cur.execute("""
                    SELECT * FROM count_user_words_by_level(%s, %s)
                """, (user_id, word_list_id))
                counts = cur.fetchone()
                
                conn.commit()
                
                return {
                    'direction': 'normal' if result['direction'] else 'reverse',
                    'level_counts': {
                        'level_0': int(counts['level_0_count']),
                        'level_1': int(counts['level_1_count']), 
                        'level_2': int(counts['level_2_count']),
                        'level_3': int(counts['level_3_count']),
                        'total': int(counts['total_words'])
                    }
                }
                
        except Exception as e:
            logger.error(f"Failed to toggle direction: {e}")
            if conn:
                conn.rollback()
            raise
        finally:
            if conn:
                self.db_pool.putconn(conn)
    
    def _populate_focus_words(self, cursor, user_id: int, word_list_id: int) -> int:
        """Private method to populate focus words (business logic)"""
        cursor.execute("""
            SELECT COUNT(*) as level_1_count
            FROM word_list_entry wle
            JOIN user_translation_progress utp 
                ON utp.word_pair_id = wle.translation_id 
                AND utp.user_id = %s
            WHERE wle.word_list_id = %s AND utp.status = 'LEVEL_1'
        """, (user_id, word_list_id))
        
        current_count = cursor.fetchone()['level_1_count']
        spaces_available = self.MAX_FOCUS_WORDS - current_count
        
        if spaces_available <= 0:
            return 0
        
        # Get LEVEL_0 words to promote
        cursor.execute("""
            SELECT t.id
            FROM word_list_entry wle
            JOIN translation t ON t.id = wle.translation_id
            LEFT JOIN user_translation_progress utp 
                ON utp.word_pair_id = t.id AND utp.user_id = %s
            WHERE wle.word_list_id = %s 
            AND (utp.status = 'LEVEL_0' OR utp.status IS NULL)
            ORDER BY RANDOM()
            LIMIT %s
        """, (user_id, word_list_id, spaces_available))
        
        words_to_promote = cursor.fetchall()
        
        # Promote words to LEVEL_1
        for word in words_to_promote:
            cursor.execute("""
                INSERT INTO user_translation_progress (user_id, word_pair_id, status)
                VALUES (%s, %s, 'LEVEL_1'::translation_status)
                ON CONFLICT (user_id, word_pair_id)
                DO UPDATE SET status = 'LEVEL_1'::translation_status, updated_at = CURRENT_TIMESTAMP
            """, (user_id, word['id']))
        
        return len(words_to_promote)
    
    def _handle_level_change(self, cursor, user_id: int, session_id: int, 
                           old_level: str, new_level: str) -> None:
        """Handle post-level-change actions (business logic)"""
        # If word moved from L1 to L2 or degraded to L0, replenish L1
        if new_level in ('LEVEL_2', 'LEVEL_0'):
            cursor.execute("""
                SELECT word_list_id FROM quiz_session WHERE id = %s
            """, (session_id,))
            word_list_id = cursor.fetchone()['word_list_id']
            self._populate_focus_words(cursor, user_id, word_list_id)
        
        # If word moved from L2 to L3 or L1, check if L2 is empty and switch direction
        if new_level in ('LEVEL_1', 'LEVEL_3') and old_level == 'LEVEL_2':
            cursor.execute("""
                SELECT COUNT(*) as l2_count
                FROM word_list_entry wle
                JOIN user_translation_progress utp 
                    ON utp.word_pair_id = wle.translation_id 
                    AND utp.user_id = %s
                JOIN quiz_session qs ON qs.word_list_id = wle.word_list_id
                WHERE qs.id = %s AND utp.status = 'LEVEL_2'
            """, (user_id, session_id))
            
            l2_count = cursor.fetchone()['l2_count']
            
            # If L2 is empty, switch to normal direction
            if l2_count == 0:
                cursor.execute("""
                    UPDATE quiz_session 
                    SET direction = true, current_translation_id = NULL
                    WHERE id = %s
                """, (session_id,))
    
    def _get_word_lists_by_level(self, cursor, user_id: int, word_list_id: int) -> Dict:
        """Get word lists organized by level"""
        # Get all words with their current status
        cursor.execute("""
            SELECT 
                t.id,
                util_clean_pipe_alternatives(sw.text) as source,
                util_clean_pipe_alternatives(tw.text) as target,
                sl.name as source_language,
                tl.name as target_language,
                sw.usage_example as source_example,
                tw.usage_example as target_example,
                COALESCE(utp.status::TEXT, 'LEVEL_0') as status
            FROM word_list_entry wle
            JOIN translation t ON t.id = wle.translation_id
            JOIN word sw ON t.source_word_id = sw.id
            JOIN word tw ON t.target_word_id = tw.id
            JOIN language sl ON sw.language_id = sl.id
            JOIN language tl ON tw.language_id = tl.id
            LEFT JOIN user_translation_progress utp 
                ON utp.word_pair_id = t.id AND utp.user_id = %s
            WHERE wle.word_list_id = %s
            ORDER BY t.id
        """, (user_id, word_list_id))
        
        words = cursor.fetchall()
        
        # Organize by level
        levels = {
            'level_0': [],
            'level_1': [],
            'level_2': [],
            'level_3': [],
            'source_language': None,
            'target_language': None
        }
        
        for word in words:
            word_data = {
                'id': word['id'],
                'source': word['source'],
                'target': word['target'],
                'sourceExample': word['source_example'],
                'targetExample': word['target_example']
            }
            
            # Set languages from first word
            if levels['source_language'] is None:
                levels['source_language'] = word['source_language']
                levels['target_language'] = word['target_language']
            
            # Add to appropriate level
            status = word['status'].lower()
            if status in levels:
                levels[status].append(word_data)
        
        return levels