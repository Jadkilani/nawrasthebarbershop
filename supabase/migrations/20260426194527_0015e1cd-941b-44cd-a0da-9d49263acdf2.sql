
-- Create public storage bucket for barber photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('barber-photos', 'barber-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Public read access
CREATE POLICY "Public read barber photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'barber-photos');

CREATE POLICY "Admins upload barber photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'barber-photos' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update barber photos"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'barber-photos' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete barber photos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'barber-photos' AND has_role(auth.uid(), 'admin'::app_role));

-- Add bio field uses already exists. Add a Nawras (owner) barber if not present
INSERT INTO public.barbers (name, name_ar, bio, active, sort_order)
SELECT 'Nawras', 'نورس', 'Owner · Master Barber since 1992', true, 0
WHERE NOT EXISTS (SELECT 1 FROM public.barbers WHERE name = 'Nawras');

-- Booking services join table for multiple services per booking
CREATE TABLE IF NOT EXISTS public.booking_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES public.services(id),
  price_jod numeric NOT NULL,
  duration_minutes integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_booking_services_booking ON public.booking_services(booking_id);

ALTER TABLE public.booking_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view booking services"
ON public.booking_services FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can insert booking services"
ON public.booking_services FOR INSERT TO public
WITH CHECK (true);

CREATE POLICY "Admins manage booking services"
ON public.booking_services FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
