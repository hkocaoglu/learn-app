-- Okuma metni görseli (opsiyonel): veri URI'si (dosyadan yüklenen) veya https bağlantısı.
alter table public.reading_assignments
  add column if not exists image text not null default '';

alter table public.reading_passages
  add column if not exists image text not null default '';
