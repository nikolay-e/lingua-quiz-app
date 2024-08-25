-- Expanded Test Data Setup for Language Learning Database using insert_word_pair_and_add_to_list function
-- Start transaction
BEGIN;

-- Insert test languages if they don't exist
INSERT INTO
  language (id, name)
VALUES
  ('en', 'English'),
  ('es', 'Spanish')
ON CONFLICT (id) DO NOTHING;

-- Use the insert_word_pair_and_add_to_list function to add words and create word list
SELECT
  insert_word_pair_and_add_to_list (
    'hello',
    'hola',
    'en',
    'es',
    'Test Spanish',
    'Hello, how are you?',
    '¿Hola, cómo estás?'
  );

SELECT
  insert_word_pair_and_add_to_list (
    'goodbye',
    'adiós',
    'en',
    'es',
    'Test Spanish',
    'Goodbye, see you later!',
    '¡Adiós, hasta luego!'
  );

SELECT
  insert_word_pair_and_add_to_list (
    'thank you',
    'gracias',
    'en',
    'es',
    'Test Spanish',
    'Thank you very much!',
    '¡Muchas gracias!'
  );

SELECT
  insert_word_pair_and_add_to_list (
    'please',
    'por favor',
    'en',
    'es',
    'Test Spanish',
    'Please help me.',
    'Por favor, ayúdame.'
  );

SELECT
  insert_word_pair_and_add_to_list (
    'sorry',
    'lo siento',
    'en',
    'es',
    'Test Spanish',
    'I''m sorry for the mistake.',
    'Lo siento por el error.'
  );

SELECT
  insert_word_pair_and_add_to_list (
    'yes',
    'sí',
    'en',
    'es',
    'Test Spanish',
    'Yes, I agree.',
    'Sí, estoy de acuerdo.'
  );

SELECT
  insert_word_pair_and_add_to_list (
    'no',
    'no',
    'en',
    'es',
    'Test Spanish',
    'No, I don''t want that.',
    'No, no quiero eso.'
  );

SELECT
  insert_word_pair_and_add_to_list (
    'water',
    'agua',
    'en',
    'es',
    'Test Spanish',
    'Can I have some water?',
    '¿Puedo tener un poco de agua?'
  );

SELECT
  insert_word_pair_and_add_to_list (
    'food',
    'comida',
    'en',
    'es',
    'Test Spanish',
    'The food is delicious.',
    'La comida está deliciosa.'
  );

SELECT
  insert_word_pair_and_add_to_list (
    'time',
    'tiempo',
    'en',
    'es',
    'Test Spanish',
    'What time is it?',
    '¿Qué hora es?'
  );

SELECT
  insert_word_pair_and_add_to_list (
    'day',
    'día',
    'en',
    'es',
    'Test Spanish',
    'Have a nice day!',
    '¡Que tengas un buen día!'
  );

SELECT
  insert_word_pair_and_add_to_list (
    'night',
    'noche',
    'en',
    'es',
    'Test Spanish',
    'Good night, sleep well.',
    'Buenas noches, que duermas bien.'
  );

SELECT
  insert_word_pair_and_add_to_list (
    'friend',
    'amigo',
    'en',
    'es',
    'Test Spanish',
    'He is my best friend.',
    'Él es mi mejor amigo.'
  );

SELECT
  insert_word_pair_and_add_to_list (
    'family',
    'familia',
    'en',
    'es',
    'Test Spanish',
    'Family is important.',
    'La familia es importante.'
  );

SELECT
  insert_word_pair_and_add_to_list (
    'love',
    'amor',
    'en',
    'es',
    'Test Spanish',
    'Love conquers all.',
    'El amor lo conquista todo.'
  );

SELECT
  insert_word_pair_and_add_to_list (
    'hate',
    'odio',
    'en',
    'es',
    'Test Spanish',
    'Hate is a strong word.',
    'Odio es una palabra fuerte.'
  );

SELECT
  insert_word_pair_and_add_to_list (
    'happy',
    'feliz',
    'en',
    'es',
    'Test Spanish',
    'I''m happy to see you.',
    'Estoy feliz de verte.'
  );

SELECT
  insert_word_pair_and_add_to_list (
    'sad',
    'triste',
    'en',
    'es',
    'Test Spanish',
    'Why are you sad?',
    '¿Por qué estás triste?'
  );

SELECT
  insert_word_pair_and_add_to_list (
    'angry',
    'enojado',
    'en',
    'es',
    'Test Spanish',
    'Don''t be angry with me.',
    'No te enojes conmigo.'
  );

SELECT
  insert_word_pair_and_add_to_list (
    'tired',
    'cansado',
    'en',
    'es',
    'Test Spanish',
    'I''m tired, I need to rest.',
    'Estoy cansado, necesito descansar.'
  );

SELECT
  insert_word_pair_and_add_to_list (
    'hungry',
    'hambriento',
    'en',
    'es',
    'Test Spanish',
    'I''m hungry, let''s eat.',
    'Tengo hambre, vamos a comer.'
  );

SELECT
  insert_word_pair_and_add_to_list (
    'thirsty',
    'sediento',
    'en',
    'es',
    'Test Spanish',
    'I''m thirsty, I need water.',
    'Tengo sed, necesito agua.'
  );

SELECT
  insert_word_pair_and_add_to_list (
    'hot',
    'caliente',
    'en',
    'es',
    'Test Spanish',
    'It''s hot today.',
    'Hace calor hoy.'
  );

SELECT
  insert_word_pair_and_add_to_list (
    'cold',
    'frío',
    'en',
    'es',
    'Test Spanish',
    'It''s cold outside.',
    'Hace frío afuera.'
  );

SELECT
  insert_word_pair_and_add_to_list (
    'big',
    'grande',
    'en',
    'es',
    'Test Spanish',
    'That''s a big house.',
    'Esa es una casa grande.'
  );

SELECT
  insert_word_pair_and_add_to_list (
    'small',
    'pequeño',
    'en',
    'es',
    'Test Spanish',
    'The dog is small.',
    'El perro es pequeño.'
  );

SELECT
  insert_word_pair_and_add_to_list (
    'fast',
    'rápido',
    'en',
    'es',
    'Test Spanish',
    'The car is very fast.',
    'El coche es muy rápido.'
  );

SELECT
  insert_word_pair_and_add_to_list (
    'slow',
    'lento',
    'en',
    'es',
    'Test Spanish',
    'The turtle is slow.',
    'La tortuga es lenta.'
  );

SELECT
  insert_word_pair_and_add_to_list (
    'good',
    'bueno',
    'en',
    'es',
    'Test Spanish',
    'That''s a good idea.',
    'Esa es una buena idea.'
  );

SELECT
  insert_word_pair_and_add_to_list (
    'bad',
    'malo',
    'en',
    'es',
    'Test Spanish',
    'That''s a bad habit.',
    'Ese es un mal hábito.'
  );

COMMIT;
