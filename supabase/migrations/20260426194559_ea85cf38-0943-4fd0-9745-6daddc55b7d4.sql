
DROP POLICY IF EXISTS "Anyone can insert booking services" ON public.booking_services;

CREATE POLICY "Anyone can insert booking services"
ON public.booking_services FOR INSERT TO public
WITH CHECK (
  price_jod >= 0
  AND price_jod <= 1000
  AND duration_minutes > 0
  AND duration_minutes <= 480
  AND EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.id = booking_id
      AND b.created_at > now() - interval '10 minutes'
  )
);
