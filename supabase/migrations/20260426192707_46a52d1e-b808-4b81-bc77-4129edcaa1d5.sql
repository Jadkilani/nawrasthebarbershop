-- Fix search_path on trigger function
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

-- Tighten booking INSERT policy
DROP POLICY "Anyone can create booking" ON public.bookings;
CREATE POLICY "Anyone can create booking"
ON public.bookings FOR INSERT
WITH CHECK (
  status = 'pending'
  AND length(trim(customer_name)) BETWEEN 2 AND 100
  AND length(trim(customer_phone)) BETWEEN 6 AND 20
  AND starts_at > now()
  AND ends_at > starts_at
  AND ends_at - starts_at <= interval '4 hours'
);

-- Tighten review INSERT policy
DROP POLICY "Anyone submit review" ON public.reviews;
CREATE POLICY "Anyone submit review"
ON public.reviews FOR INSERT
WITH CHECK (
  approved = false
  AND length(trim(customer_name)) BETWEEN 2 AND 100
  AND rating BETWEEN 1 AND 5
  AND (comment IS NULL OR length(comment) <= 1000)
);