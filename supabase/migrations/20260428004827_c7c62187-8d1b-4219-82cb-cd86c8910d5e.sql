-- Keep role checks server-side but move the callable helper out of the public API surface
CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;

-- Keep the existing public helper for policy compatibility, but prevent direct API calls
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;

-- Update policies to use the private helper
DROP POLICY IF EXISTS "Admins manage unavailability" ON public.barber_unavailability;
CREATE POLICY "Admins manage unavailability"
ON public.barber_unavailability
FOR ALL
TO authenticated
USING (private.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins manage barbers" ON public.barbers;
CREATE POLICY "Admins manage barbers"
ON public.barbers
FOR ALL
TO authenticated
USING (private.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Public view active barbers" ON public.barbers;
CREATE POLICY "Public view active barbers"
ON public.barbers
FOR SELECT
USING ((active = true) OR private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins manage booking services" ON public.booking_services;
CREATE POLICY "Admins manage booking services"
ON public.booking_services
FOR ALL
TO authenticated
USING (private.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins view booking services" ON public.booking_services;
CREATE POLICY "Admins view booking services"
ON public.booking_services
FOR SELECT
TO authenticated
USING (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Employees view booking services for own bookings" ON public.booking_services;
CREATE POLICY "Employees view booking services for own bookings"
ON public.booking_services
FOR SELECT
TO authenticated
USING (
  private.has_role(auth.uid(), 'employee'::public.app_role)
  AND booking_id IN (
    SELECT bookings.id
    FROM public.bookings
    WHERE bookings.barber_id IN (
      SELECT barbers.id FROM public.barbers WHERE barbers.user_id = auth.uid()
    )
  )
);

DROP POLICY IF EXISTS "Admins delete bookings" ON public.bookings;
CREATE POLICY "Admins delete bookings"
ON public.bookings
FOR DELETE
TO authenticated
USING (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins update bookings" ON public.bookings;
CREATE POLICY "Admins update bookings"
ON public.bookings
FOR UPDATE
TO authenticated
USING (private.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins view bookings" ON public.bookings;
CREATE POLICY "Admins view bookings"
ON public.bookings
FOR SELECT
TO authenticated
USING (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Employees update own bookings" ON public.bookings;
CREATE POLICY "Employees update own bookings"
ON public.bookings
FOR UPDATE
TO authenticated
USING (
  private.has_role(auth.uid(), 'employee'::public.app_role)
  AND barber_id IN (SELECT barbers.id FROM public.barbers WHERE barbers.user_id = auth.uid())
)
WITH CHECK (
  private.has_role(auth.uid(), 'employee'::public.app_role)
  AND barber_id IN (SELECT barbers.id FROM public.barbers WHERE barbers.user_id = auth.uid())
);

DROP POLICY IF EXISTS "Employees view own bookings" ON public.bookings;
CREATE POLICY "Employees view own bookings"
ON public.bookings
FOR SELECT
TO authenticated
USING (
  private.has_role(auth.uid(), 'employee'::public.app_role)
  AND barber_id IN (SELECT barbers.id FROM public.barbers WHERE barbers.user_id = auth.uid())
);

DROP POLICY IF EXISTS "Admins manage closed days" ON public.closed_days;
CREATE POLICY "Admins manage closed days"
ON public.closed_days
FOR ALL
TO authenticated
USING (private.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins delete reviews" ON public.reviews;
CREATE POLICY "Admins delete reviews"
ON public.reviews
FOR DELETE
TO authenticated
USING (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins manage reviews" ON public.reviews;
CREATE POLICY "Admins manage reviews"
ON public.reviews
FOR UPDATE
TO authenticated
USING (private.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Public view approved reviews" ON public.reviews;
CREATE POLICY "Public view approved reviews"
ON public.reviews
FOR SELECT
USING ((approved = true) OR private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins manage services" ON public.services;
CREATE POLICY "Admins manage services"
ON public.services
FOR ALL
TO authenticated
USING (private.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Public view active services" ON public.services;
CREATE POLICY "Public view active services"
ON public.services
FOR SELECT
USING ((active = true) OR private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins manage roles" ON public.user_roles;
CREATE POLICY "Admins manage roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (private.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins manage working hours" ON public.working_hours;
CREATE POLICY "Admins manage working hours"
ON public.working_hours
FOR ALL
TO authenticated
USING (private.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

-- Barber display and linked account
UPDATE public.barbers
SET name = 'Nawras',
    name_ar = 'نورس',
    bio = 'Master Barber',
    user_id = (SELECT id FROM auth.users WHERE lower(email) = lower('Jadkilaniking2010@gmail.com') LIMIT 1)
WHERE id = '1580cc50-dda9-456f-bd43-c5d03c81972b'
   OR name ILIKE '%Nawras%';

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role
FROM auth.users
WHERE lower(email) = lower('Jadkilaniking2010@gmail.com')
ON CONFLICT (user_id, role) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'employee'::public.app_role
FROM auth.users
WHERE lower(email) = lower('Jadkilaniking2010@gmail.com')
ON CONFLICT (user_id, role) DO NOTHING;

-- Monday protection for Nawras bookings
CREATE OR REPLACE FUNCTION public.validate_booking_business_rules()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _barber_name text;
BEGIN
  SELECT name INTO _barber_name
  FROM public.barbers
  WHERE id = NEW.barber_id;

  IF _barber_name ILIKE '%Nawras%' AND EXTRACT(DOW FROM NEW.starts_at AT TIME ZONE 'Asia/Amman') = 1 THEN
    RAISE EXCEPTION 'Nawras is not available on Monday';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_booking_business_rules_trigger ON public.bookings;
CREATE TRIGGER validate_booking_business_rules_trigger
BEFORE INSERT OR UPDATE OF barber_id, starts_at ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.validate_booking_business_rules();

REVOKE ALL ON FUNCTION public.validate_booking_business_rules() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_taken_slots(uuid, date) FROM PUBLIC, anon, authenticated;

-- Narrow public photo access to actual readable files instead of bucket-wide object listing
DROP POLICY IF EXISTS "Public read barber photos" ON storage.objects;
CREATE POLICY "Public read barber photos"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'barber-photos'
  AND lower(storage.extension(name)) IN ('jpg', 'jpeg', 'png', 'webp')
  AND position('/' in name) = 0
);

DROP POLICY IF EXISTS "Admins upload barber photos" ON storage.objects;
CREATE POLICY "Admins upload barber photos"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'barber-photos' AND private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins update barber photos" ON storage.objects;
CREATE POLICY "Admins update barber photos"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'barber-photos' AND private.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (bucket_id = 'barber-photos' AND private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins delete barber photos" ON storage.objects;
CREATE POLICY "Admins delete barber photos"
ON storage.objects
FOR DELETE
USING (bucket_id = 'barber-photos' AND private.has_role(auth.uid(), 'admin'::public.app_role));