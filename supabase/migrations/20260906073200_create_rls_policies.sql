-- Enable Row Level Security on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;

-------------------------------------------------------------------------------
-- PROFILES POLICIES
-------------------------------------------------------------------------------

-- 1. Profiles are viewable by everyone (public or at least authenticated)
-- We will allow public read so user names/avatars can be seen on event pages if needed.
CREATE POLICY "Profiles are viewable by everyone" 
ON profiles FOR SELECT 
USING (true);

-- 2. Users can update their own profile.
CREATE POLICY "Users can update own profile" 
ON profiles FOR UPDATE 
USING (auth.uid() = id);

-- (Insert is handled by the security definer trigger)

-------------------------------------------------------------------------------
-- EVENTS POLICIES
-------------------------------------------------------------------------------

-- 1. Anyone can read published events
CREATE POLICY "Anyone can read published events" 
ON events FOR SELECT 
USING (status = 'published');

-- 2. Organizers can read their own events regardless of status
CREATE POLICY "Organizers can read own events" 
ON events FOR SELECT 
USING (auth.uid() = organizer_id);

-- 3. Organizers can create events (organizer_id must match their uid)
CREATE POLICY "Organizers can insert own events" 
ON events FOR INSERT 
WITH CHECK (
  auth.uid() = organizer_id AND 
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() AND profiles.role = 'organizer'
  )
);

-- 4. Organizers can update their own events
CREATE POLICY "Organizers can update own events" 
ON events FOR UPDATE 
USING (
  auth.uid() = organizer_id AND 
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() AND profiles.role = 'organizer'
  )
);

-- 5. Organizers can delete their own events
CREATE POLICY "Organizers can delete own events" 
ON events FOR DELETE 
USING (
  auth.uid() = organizer_id AND 
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() AND profiles.role = 'organizer'
  )
);


-------------------------------------------------------------------------------
-- REGISTRATIONS POLICIES
-------------------------------------------------------------------------------

-- 1. Users can read their own registrations
CREATE POLICY "Users can read own registrations" 
ON registrations FOR SELECT 
USING (auth.uid() = user_id);

-- 2. Organizers can read registrations for their events
CREATE POLICY "Organizers can read registrations for own events" 
ON registrations FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM events 
    WHERE events.id = registrations.event_id 
    AND events.organizer_id = auth.uid()
  )
);

-- 3. Users can create registrations for themselves
CREATE POLICY "Users can insert own registrations" 
ON registrations FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- 4. Users can update their own registration status (e.g., to cancel)
CREATE POLICY "Users can update own registrations" 
ON registrations FOR UPDATE 
USING (auth.uid() = user_id);


-------------------------------------------------------------------------------
-- FAVORITES POLICIES
-------------------------------------------------------------------------------

-- 1. Users can read their own favorites
CREATE POLICY "Users can read own favorites" 
ON favorites FOR SELECT 
USING (auth.uid() = user_id);

-- 2. Users can create favorites for themselves
CREATE POLICY "Users can insert own favorites" 
ON favorites FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- 3. Users can delete their own favorites
CREATE POLICY "Users can delete own favorites" 
ON favorites FOR DELETE 
USING (auth.uid() = user_id);
