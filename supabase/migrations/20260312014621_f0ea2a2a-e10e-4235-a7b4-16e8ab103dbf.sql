-- Allow deletion in audio_settings (needed for admin save flow)
CREATE POLICY "Audio deletable by anyone" ON public.audio_settings FOR DELETE TO public USING (true);