-- Massage services should conflict with each other
UPDATE public.services SET conflict_group='massage', includes_groups='{massage}'::text[]
WHERE name IN ('Head & Neck Massage','Full Body Massage');

-- Update working hours to 10:00 - 23:00 (close at 11 PM, last slot 22:30)
UPDATE public.working_hours SET open_time='10:00', close_time='23:00', is_open=true;
