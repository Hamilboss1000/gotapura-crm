-- Opcional: publicação automática de posts agendados e lembretes de tarefas (extensões pg_cron e pg_net).
create extension if not exists pg_cron; create extension if not exists pg_net;
-- Substituir <PROJECT_REF> e <SERVICE_ROLE_KEY>.
select cron.schedule('social-publish', '*/5 * * * *', $$
  select net.http_post('https://<PROJECT_REF>.supabase.co/functions/v1/social-publish',
    '{}'::jsonb, '{"Authorization":"Bearer <SERVICE_ROLE_KEY>","Content-Type":"application/json"}'::jsonb) $$);
-- Lembretes: notifica o responsável das tarefas que vencem hoje (07:30 Luanda = 06:30 UTC)
select cron.schedule('task-reminders', '30 6 * * *', $$
  insert into notifications (user_id, title, body, link)
  select assigned_to, 'Tarefa para hoje', title, '/tasks' from tasks
  where due_date = current_date and status in ('pendente','em curso') and assigned_to is not null $$);
