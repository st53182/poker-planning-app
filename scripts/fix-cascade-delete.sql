-- Скрипт для настройки CASCADE DELETE для таблицы racket_ratings
-- Запустите этот скрипт в вашей базе данных, чтобы настроить автоматическое удаление связанных записей

-- Удаляем существующий внешний ключ (если есть)
DO $$ 
BEGIN
    -- Ищем все внешние ключи для racket_ratings, которые ссылаются на tennis_rackets
    FOR constraint_name IN 
        SELECT tc.constraint_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
            ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_name = 'racket_ratings'
            AND tc.constraint_type = 'FOREIGN KEY'
            AND kcu.column_name = 'racket_id'
    LOOP
        EXECUTE 'ALTER TABLE racket_ratings DROP CONSTRAINT IF EXISTS ' || constraint_name;
    END LOOP;
END $$;

-- Создаем новый внешний ключ с CASCADE DELETE
ALTER TABLE racket_ratings 
ADD CONSTRAINT fk_racket_ratings_racket_id 
FOREIGN KEY (racket_id) 
REFERENCES tennis_rackets(id) 
ON DELETE CASCADE;

-- Аналогично для других возможных связанных таблиц
DO $$ 
DECLARE
    table_name TEXT;
    fk_column TEXT;
BEGIN
    FOR table_name, fk_column IN 
        SELECT 'racket_reviews', 'racket_id'
        UNION ALL SELECT 'racket_comments', 'racket_id'
        UNION ALL SELECT 'racket_favorites', 'racket_id'
    LOOP
        -- Проверяем, существует ли таблица
        IF EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = table_name
        ) THEN
            -- Удаляем старые constraint'ы
            FOR constraint_name IN 
                SELECT tc.constraint_name
                FROM information_schema.table_constraints tc
                JOIN information_schema.key_column_usage kcu 
                    ON tc.constraint_name = kcu.constraint_name
                WHERE tc.table_name = table_name
                    AND tc.constraint_type = 'FOREIGN KEY'
                    AND kcu.column_name = fk_column
            LOOP
                EXECUTE 'ALTER TABLE ' || table_name || ' DROP CONSTRAINT IF EXISTS ' || constraint_name;
            END LOOP;
            
            -- Создаем новый с CASCADE
            BEGIN
                EXECUTE 'ALTER TABLE ' || table_name || 
                        ' ADD CONSTRAINT fk_' || table_name || '_racket_id ' ||
                        'FOREIGN KEY (' || fk_column || ') ' ||
                        'REFERENCES tennis_rackets(id) ' ||
                        'ON DELETE CASCADE';
            EXCEPTION WHEN OTHERS THEN
                -- Игнорируем ошибки, если constraint уже существует или колонка не найдена
                NULL;
            END;
        END IF;
    END LOOP;
END $$;
