-- MEB ilköğretim derslerini ekle (3. ve 5. sınıf müfredatı).
--
-- Önceki liste yalnızca matematik/geometri/turke idi. MEB haftalık ders çizelgesine
-- göre eklenen dersler:
--   3. sınıf : Hayat Bilgisi, Fen Bilimleri, Yabancı Dil
--   5. sınıf : Fen Bilimleri, Sosyal Bilgiler, Din Kültürü ve Ahlak Bilgisi,
--              Bilişim Teknolojileri ve Yazılım, Yabancı Dil
-- (Rehberlik ve Yönlendirme sınav dersi olmadığı için listeye alınmadı.)
--
-- Not: `geometri` geriye dönük uyumluluk için korunuyor; MEB'de ayrı bir ders
-- değil, Matematik dersinin öğrenme alanıdır.

alter table public.question_bank drop constraint if exists question_bank_subject_check;
alter table public.question_bank add constraint question_bank_subject_check check (
  subject in (
    'matematik', 'geometri', 'turkce',
    'hayat-bilgisi', 'fen-bilimleri', 'sosyal-bilgiler', 'din-kulturu', 'yabanci-dil', 'bilisim'
  )
);

alter table public.tests drop constraint if exists tests_subject_check;
alter table public.tests add constraint tests_subject_check check (
  subject in (
    'matematik', 'geometri', 'turkce',
    'hayat-bilgisi', 'fen-bilimleri', 'sosyal-bilgiler', 'din-kulturu', 'yabanci-dil', 'bilisim'
  )
);

alter table public.reading_assignments drop constraint if exists reading_assignments_subject_check;
alter table public.reading_assignments add constraint reading_assignments_subject_check check (
  subject in (
    'matematik', 'geometri', 'turkce',
    'hayat-bilgisi', 'fen-bilimleri', 'sosyal-bilgiler', 'din-kulturu', 'yabanci-dil', 'bilisim'
  )
);

alter table public.reading_passages drop constraint if exists reading_passages_subject_check;
alter table public.reading_passages add constraint reading_passages_subject_check check (
  subject in (
    'matematik', 'geometri', 'turkce',
    'hayat-bilgisi', 'fen-bilimleri', 'sosyal-bilgiler', 'din-kulturu', 'yabanci-dil', 'bilisim'
  )
);
