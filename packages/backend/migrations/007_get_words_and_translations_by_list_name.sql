CREATE
OR REPLACE FUNCTION get_words_and_translations_by_list_name (list_name VARCHAR) RETURNS TABLE (
  word VARCHAR(255),
  language_code VARCHAR(10),
  usage_example TEXT,
  translation VARCHAR(255),
  translation_language_code VARCHAR(10)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        w.word, 
        w.language_code, 
        w.usage_example,
        wt.word AS translation,
        wt.language_code AS translation_language_code
    FROM 
        word_list_items wl
    JOIN 
        words w ON wl.word_id = w.id
    JOIN 
        translations t ON w.id = t.word_id
    JOIN 
        words wt ON t.translation_id = wt.id
    JOIN 
        word_lists wlst ON wl.word_list_id = wlst.id
    WHERE 
        wlst.name = list_name;
END;
$$ LANGUAGE plpgsql;
