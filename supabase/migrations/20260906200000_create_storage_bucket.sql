-- Create a new public storage bucket for event banners
INSERT INTO storage.buckets (id, name, public) 
VALUES ('event_banners', 'event_banners', true)
ON CONFLICT (id) DO NOTHING;

-- Policy 1: Allow public read access to the event_banners bucket
DROP POLICY IF EXISTS "Public read access to event_banners" ON storage.objects;
CREATE POLICY "Public read access to event_banners" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'event_banners');

-- Policy 2: Allow authenticated organizers to insert files to event_banners
DROP POLICY IF EXISTS "Organizers can insert files to event_banners" ON storage.objects;
CREATE POLICY "Organizers can insert files to event_banners" 
ON storage.objects FOR INSERT 
WITH CHECK (
  bucket_id = 'event_banners' AND
  auth.uid() = owner AND
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'organizer'
  )
);

-- Policy 3: Allow authenticated organizers to update their own files in event_banners
DROP POLICY IF EXISTS "Organizers can update own files in event_banners" ON storage.objects;
CREATE POLICY "Organizers can update own files in event_banners" 
ON storage.objects FOR UPDATE 
USING (
  bucket_id = 'event_banners' AND
  auth.uid() = owner AND
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'organizer'
  )
);

-- Policy 4: Allow authenticated organizers to delete their own files in event_banners
DROP POLICY IF EXISTS "Organizers can delete own files in event_banners" ON storage.objects;
CREATE POLICY "Organizers can delete own files in event_banners" 
ON storage.objects FOR DELETE 
USING (
  bucket_id = 'event_banners' AND
  auth.uid() = owner AND
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'organizer'
  )
);
