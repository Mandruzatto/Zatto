create policy "Only analysts can delete tickets"
  on tickets for delete
  to authenticated
  using (
    exists (
      select 1 from profiles
      where id = auth.uid() and role = 'analyst'
    )
  );
