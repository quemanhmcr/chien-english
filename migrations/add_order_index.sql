-- Add order_index column to exercises table for persistent sorting
ALTER TABLE public.exercises 
ADD COLUMN IF NOT EXISTS order_index INTEGER DEFAULT 0;

-- Update existing exercises to have a default order (optional, based on created_at)
-- This ensures they aren't all 0 mixed up initially
WITH numbered_exercises AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY lesson_id ORDER BY created_at ASC) - 1 as new_order
  FROM public.exercises
)
UPDATE public.exercises
SET order_index = numbered_exercises.new_order
FROM numbered_exercises
WHERE public.exercises.id = numbered_exercises.id;
