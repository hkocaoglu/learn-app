-- 5-6. sınıf desteği: grade CHECK kısıtlarını gerçekten genişletir (onarım).
--
-- Neden bu migration gerekli?
--   20260911080000_grades_and_passages.sql içindeki genişletme bloğu kısıtı tanım
--   metnine göre arıyordu:
--       pg_get_constraintdef(c.oid) ILIKE '%grade%between 1 and 4%'
--   PostgreSQL BETWEEN ifadesini >= / <= olarak saklar; pg_get_constraintdef bunu
--       CHECK (((grade >= 1) AND (grade <= 4)))
--   biçiminde döndürür. "between 1 and 4" metni hiçbir zaman geçmediği için o blok
--   hiçbir satırı eşleştirmedi ve eski kurulumlarda kısıt 1-4 olarak kaldı. Sonuç:
--       ERROR: new row for relation "classes" violates check constraint "classes_grade_check"
--
-- Bu migration kısıtı tanım metnine bakmadan bulur: yalnızca "grade" kolonuna başvuran
-- tek kolonlu CHECK kısıtlarını düşürür, yerine CHECK (grade BETWEEN 1 AND 6) ekler.
-- Tekrar çalıştırılabilir (idempotent).

DO $$
DECLARE
  target_tables text[] := ARRAY[
    'classes', 'question_bank', 'tests', 'reading_assignments', 'reading_passages'
  ];
  constraint_oids oid[];
  con_oid oid;
  rec RECORD;
BEGIN
  -- 1) Yalnızca grade kolonuna başvuran tek kolonlu CHECK kısıtlarını topla.
  --    (Kısıt adı varsayımına veya tanım metnine bağlı değildir.)
  SELECT array_agg(c.oid)
    INTO constraint_oids
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = c.connamespace
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
   WHERE c.contype = 'c'
     AND n.nspname = 'public'
     AND t.relname = ANY (target_tables)
     AND a.attname = 'grade'
     AND array_length(c.conkey, 1) = 1;

  -- 2) Düşür. Cursor'ın altından satır silmemek için önce oid listesi alındı.
  IF constraint_oids IS NOT NULL THEN
    FOREACH con_oid IN ARRAY constraint_oids LOOP
      SELECT n.nspname AS schema_name, t.relname AS table_name, c.conname AS con_name
        INTO rec
        FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        JOIN pg_namespace n ON n.oid = c.connamespace
       WHERE c.oid = con_oid;

      EXECUTE format('ALTER TABLE %I.%I DROP CONSTRAINT %I',
                     rec.schema_name, rec.table_name, rec.con_name);
      RAISE NOTICE 'grade kısıtı düşürüldü: %.%.%', rec.schema_name, rec.table_name, rec.con_name;
    END LOOP;
  END IF;

  -- 3) grade kolonu olan her hedef tabloya 1-6 kısıtını ekle.
  --    Tablo yoksa (henüz oluşturulmamışsa) sessizce atlanır.
  FOR rec IN
    SELECT n.nspname AS schema_name, t.relname AS table_name
      FROM pg_class t
      JOIN pg_namespace n ON n.oid = t.relnamespace
      JOIN pg_attribute a
        ON a.attrelid = t.oid
       AND a.attname = 'grade'
       AND a.attnum > 0
       AND NOT a.attisdropped
     WHERE n.nspname = 'public'
       AND t.relkind = 'r'
       AND t.relname = ANY (target_tables)
  LOOP
    EXECUTE format('ALTER TABLE %I.%I ADD CONSTRAINT %I CHECK (grade BETWEEN 1 AND 6)',
                   rec.schema_name, rec.table_name, rec.table_name || '_grade_check');
    RAISE NOTICE 'grade kısıtı eklendi: %.% -> grade BETWEEN 1 AND 6',
                 rec.schema_name, rec.table_name;
  END LOOP;
END $$;
