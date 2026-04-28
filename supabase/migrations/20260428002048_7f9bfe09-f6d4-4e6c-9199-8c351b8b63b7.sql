-- Add 'employee' enum value first (must be committed before it can be used)
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'employee';

-- Working hours: 12:00 PM to 23:59 every day (effectively midnight)
UPDATE public.working_hours SET open_time = '12:00:00', close_time = '23:59:00', is_open = true;

-- Rename Nawras
UPDATE public.barbers
SET name = 'Master Barber Nawras', name_ar = 'الحلاق الأول نورس', bio = 'Owner · Master Barber since 1992'
WHERE id = '1580cc50-dda9-456f-bd43-c5d03c81972b';

-- Hide empty placeholder barbers
UPDATE public.barbers SET active = false
WHERE id IN (
  'e877556a-ae4c-4c6a-87f4-ce07c3ac7eaa',
  'c3b21369-6f18-48cc-b823-f449638d97c1',
  '97c00717-1bd4-4448-a63c-ceb60ffaaaf2'
);

-- Service conflict logic columns
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS conflict_group TEXT;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS includes_groups TEXT[] DEFAULT '{}';

UPDATE public.services SET conflict_group = 'haircut', includes_groups = ARRAY['haircut'] WHERE name = 'Hair Cut';
UPDATE public.services SET conflict_group = 'haircut', includes_groups = ARRAY['haircut','beard'] WHERE name = 'Hair + Beard';
UPDATE public.services SET conflict_group = 'haircut', includes_groups = ARRAY['haircut'] WHERE name = 'Kids Hair Cut';
UPDATE public.services SET conflict_group = 'beard',   includes_groups = ARRAY['beard']   WHERE name = 'Beard Trim';

-- Link barber profiles to login accounts (for employee-barbers)
ALTER TABLE public.barbers ADD COLUMN IF NOT EXISTS user_id UUID;
CREATE INDEX IF NOT EXISTS idx_barbers_user_id ON public.barbers(user_id);