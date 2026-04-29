
-- 1. Extend booking_status enum with 'no_show'
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'no_show' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'booking_status')) THEN
    ALTER TYPE public.booking_status ADD VALUE 'no_show';
  END IF;
END $$;

-- 2. barbers.phone
ALTER TABLE public.barbers ADD COLUMN IF NOT EXISTS phone text;

-- 3. bookings.cancel_token (random UUID per booking)
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS cancel_token uuid NOT NULL DEFAULT gen_random_uuid();

-- 4. Staff allowlist
CREATE TABLE IF NOT EXISTS public.staff_allowlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  full_name text,
  phone text,
  barber_id uuid REFERENCES public.barbers(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);
ALTER TABLE public.staff_allowlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage allowlist" ON public.staff_allowlist
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated can read own allowlist row" ON public.staff_allowlist
  FOR SELECT TO authenticated
  USING (lower(email) = lower(coalesce((auth.jwt() ->> 'email'), '')));

-- 5. Admin logs
CREATE TABLE IF NOT EXISTS public.admin_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid,
  actor_email text,
  action text NOT NULL,
  target_type text,
  target_id uuid,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read logs" ON public.admin_logs
  FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins insert logs" ON public.admin_logs
  FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'employee'::app_role));

-- 6. App settings
CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read settings" ON public.app_settings FOR SELECT TO public USING (true);
CREATE POLICY "Admins write settings" ON public.app_settings FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.app_settings(key, value) VALUES
  ('booking_buffer_minutes', '10'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- 7. Update working hours close_time to 23:30
UPDATE public.working_hours SET close_time = '23:30:00' WHERE close_time = '23:59:00';

-- 8. Deactivate fake barbers, keep Nawras and add phone
UPDATE public.barbers SET active = false
  WHERE name IN ('Master Barber', 'Style Specialist', 'Beard Expert');
UPDATE public.barbers SET phone = '+962798175723', bio = COALESCE(bio, 'Master Barber') WHERE name ILIKE '%nawras%';

-- 9. Auto-link staff role on signup if email in allowlist
CREATE OR REPLACE FUNCTION public.handle_new_user_staff_link()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.staff_allowlist;
BEGIN
  SELECT * INTO _row FROM public.staff_allowlist WHERE lower(email) = lower(NEW.email) LIMIT 1;
  IF FOUND THEN
    -- Grant employee role
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'employee'::app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
    -- Link barber to this user if assigned
    IF _row.barber_id IS NOT NULL THEN
      UPDATE public.barbers SET user_id = NEW.id WHERE id = _row.barber_id AND user_id IS NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_staff ON auth.users;
CREATE TRIGGER on_auth_user_created_staff
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_staff_link();

-- 10. Manual claim function (works for existing accounts already signed in)
CREATE OR REPLACE FUNCTION public.claim_staff_role()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _email text;
  _row public.staff_allowlist;
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;
  _email := lower(coalesce((auth.jwt() ->> 'email'), ''));
  IF _email = '' THEN RETURN false; END IF;
  SELECT * INTO _row FROM public.staff_allowlist WHERE lower(email) = _email LIMIT 1;
  IF NOT FOUND THEN RETURN false; END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (auth.uid(), 'employee'::app_role)
  ON CONFLICT (user_id, role) DO NOTHING;
  IF _row.barber_id IS NOT NULL THEN
    UPDATE public.barbers SET user_id = auth.uid() WHERE id = _row.barber_id AND user_id IS NULL;
  END IF;
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_staff_role() TO authenticated;

-- 11. Revoke staff role when removed from allowlist
CREATE OR REPLACE FUNCTION public.handle_allowlist_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid;
BEGIN
  SELECT id INTO _user_id FROM auth.users WHERE lower(email) = lower(OLD.email) LIMIT 1;
  IF _user_id IS NOT NULL THEN
    DELETE FROM public.user_roles WHERE user_id = _user_id AND role = 'employee'::app_role;
    UPDATE public.barbers SET user_id = NULL WHERE user_id = _user_id;
  END IF;
  -- audit log
  INSERT INTO public.admin_logs (actor_user_id, actor_email, action, target_type, target_id, details)
    VALUES (auth.uid(), coalesce(auth.jwt() ->> 'email', ''), 'staff_removed', 'staff_allowlist', OLD.id,
      jsonb_build_object('email', OLD.email, 'barber_id', OLD.barber_id));
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS on_allowlist_delete ON public.staff_allowlist;
CREATE TRIGGER on_allowlist_delete
AFTER DELETE ON public.staff_allowlist
FOR EACH ROW EXECUTE FUNCTION public.handle_allowlist_delete();

-- 12. Audit log for booking status change
CREATE OR REPLACE FUNCTION public.log_booking_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.admin_logs (actor_user_id, actor_email, action, target_type, target_id, details)
      VALUES (auth.uid(), coalesce(auth.jwt() ->> 'email', ''), 'booking_status_changed', 'bookings', NEW.id,
        jsonb_build_object('from', OLD.status, 'to', NEW.status, 'customer', NEW.customer_name));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_booking_status_changed ON public.bookings;
CREATE TRIGGER on_booking_status_changed
AFTER UPDATE ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.log_booking_status_change();

-- 13. Customer cancel via token (no login needed, just the token from confirmation page)
CREATE OR REPLACE FUNCTION public.customer_cancel_booking(_booking_id uuid, _token uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _ok boolean;
BEGIN
  UPDATE public.bookings
  SET status = 'cancelled'::booking_status, updated_at = now()
  WHERE id = _booking_id AND cancel_token = _token AND status NOT IN ('cancelled', 'completed');
  GET DIAGNOSTICS _ok = ROW_COUNT;
  RETURN _ok > 0;
END;
$$;
GRANT EXECUTE ON FUNCTION public.customer_cancel_booking(uuid, uuid) TO public;

-- 14. Customer reschedule via token
CREATE OR REPLACE FUNCTION public.customer_reschedule_booking(_booking_id uuid, _token uuid, _new_starts timestamptz, _new_ends timestamptz)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _ok int;
BEGIN
  IF _new_starts <= now() OR _new_ends <= _new_starts THEN RETURN false; END IF;
  UPDATE public.bookings
  SET starts_at = _new_starts, ends_at = _new_ends, status = 'pending'::booking_status, updated_at = now()
  WHERE id = _booking_id AND cancel_token = _token AND status NOT IN ('cancelled', 'completed');
  GET DIAGNOSTICS _ok = ROW_COUNT;
  RETURN _ok > 0;
END;
$$;
GRANT EXECUTE ON FUNCTION public.customer_reschedule_booking(uuid, uuid, timestamptz, timestamptz) TO public;

-- 15. Has-active-booking check (used to prompt "book for another person?")
CREATE OR REPLACE FUNCTION public.has_active_booking_by_phone(_phone text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.bookings
    WHERE customer_phone = _phone
      AND starts_at > now()
      AND status IN ('pending','confirmed')
  );
$$;
GRANT EXECUTE ON FUNCTION public.has_active_booking_by_phone(text) TO public;

-- 16. Insights helpers (admins only)
CREATE OR REPLACE FUNCTION public.insights_summary()
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'peak_hour', (
      SELECT to_char(date_trunc('hour', starts_at AT TIME ZONE 'Asia/Amman'), 'HH24:00')
      FROM public.bookings
      WHERE status <> 'cancelled' AND starts_at > now() - interval '60 days'
      GROUP BY 1 ORDER BY count(*) DESC LIMIT 1
    ),
    'peak_dow', (
      SELECT to_char(starts_at AT TIME ZONE 'Asia/Amman', 'Day')
      FROM public.bookings
      WHERE status <> 'cancelled' AND starts_at > now() - interval '60 days'
      GROUP BY 1 ORDER BY count(*) DESC LIMIT 1
    ),
    'top_barber', (
      SELECT b.name FROM public.bookings bk JOIN public.barbers b ON b.id = bk.barber_id
      WHERE bk.status <> 'cancelled' AND bk.starts_at > now() - interval '60 days'
      GROUP BY b.name ORDER BY count(*) DESC LIMIT 1
    ),
    'total_60d', (
      SELECT count(*) FROM public.bookings
      WHERE status <> 'cancelled' AND starts_at > now() - interval '60 days'
    )
  );
$$;
GRANT EXECUTE ON FUNCTION public.insights_summary() TO authenticated;
