-- Employees view ONLY their own barber's bookings
CREATE POLICY "Employees view own bookings"
ON public.bookings
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'employee')
  AND barber_id IN (SELECT id FROM public.barbers WHERE user_id = auth.uid())
);

CREATE POLICY "Employees update own bookings"
ON public.bookings
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'employee')
  AND barber_id IN (SELECT id FROM public.barbers WHERE user_id = auth.uid())
)
WITH CHECK (
  public.has_role(auth.uid(), 'employee')
  AND barber_id IN (SELECT id FROM public.barbers WHERE user_id = auth.uid())
);

CREATE POLICY "Employees view booking services for own bookings"
ON public.booking_services
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'employee')
  AND booking_id IN (
    SELECT id FROM public.bookings
    WHERE barber_id IN (SELECT id FROM public.barbers WHERE user_id = auth.uid())
  )
);