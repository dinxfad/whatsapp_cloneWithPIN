/*
  # Initial Schema for WhatsApp Clone

  1. New Tables
    - `profiles`
      - `id` (uuid, primary key) - Links to auth.users
      - `private_pin` (text) - Unique PIN for user identification
      - `display_name` (text) - User's display name
      - `avatar_url` (text) - User's avatar image URL
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `connections`
      - `id` (uuid, primary key)
      - `user_id` (uuid) - User who initiated the connection
      - `connected_user_id` (uuid) - User being connected to
      - `created_at` (timestamp)
    
    - `chats`
      - `id` (uuid, primary key)
      - `sender_id` (uuid) - User sending the message
      - `receiver_id` (uuid) - User receiving the message
      - `message` (text) - Content of the message
      - `created_at` (timestamp)
      - `read` (boolean) - Message read status

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users
*/

-- Profiles table
CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id),
  private_pin text UNIQUE NOT NULL,
  display_name text NOT NULL,
  avatar_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read all profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update own profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- Connections table
CREATE TABLE connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) NOT NULL,
  connected_user_id uuid REFERENCES profiles(id) NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, connected_user_id)
);

ALTER TABLE connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own connections"
  ON connections
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id OR 
    auth.uid() = connected_user_id
  );

CREATE POLICY "Users can create own connections"
  ON connections
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Chats table
CREATE TABLE chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid REFERENCES profiles(id) NOT NULL,
  receiver_id uuid REFERENCES profiles(id) NOT NULL,
  message text NOT NULL,
  created_at timestamptz DEFAULT now(),
  read boolean DEFAULT false
);

ALTER TABLE chats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own chats"
  ON chats
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = sender_id OR 
    auth.uid() = receiver_id
  );

CREATE POLICY "Users can send messages"
  ON chats
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = sender_id);

-- Function to generate unique PIN
CREATE OR REPLACE FUNCTION generate_unique_pin()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  new_pin text;
  pin_exists boolean;
BEGIN
  LOOP
    -- Generate a 6-digit PIN
    new_pin := LPAD(FLOOR(RANDOM() * 1000000)::text, 6, '0');
    
    -- Check if PIN exists
    SELECT EXISTS (
      SELECT 1 FROM profiles WHERE private_pin = new_pin
    ) INTO pin_exists;
    
    -- Exit loop if PIN is unique
    EXIT WHEN NOT pin_exists;
  END LOOP;
  
  RETURN new_pin;
END;
$$;