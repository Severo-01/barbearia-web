-- Define o proprietário da barbearia. Rode no SQL Editor do Supabase DEPOIS que a pessoa criar a conta no site.
-- Papéis: 'owner' (tudo), 'manager' (gestão, sem alterar dados da barbearia), 'staff' (vê só a própria agenda).
insert into public.shop_members (shop_id, user_id, role)
select s.id, u.id, 'owner'
from public.shops s, auth.users u
where s.slug = 'barbearia' and u.email = 'EMAIL-DO-DONO@exemplo.com'
on conflict (shop_id, user_id) do update set role = excluded.role;

-- Para ligar um profissional à própria agenda, informe também o staff_id dele (tabela public.staff):
-- insert into public.shop_members (shop_id, user_id, role, staff_id)
-- select s.id, u.id, 'staff', '<UUID-DO-PROFISSIONAL>' from public.shops s, auth.users u
-- where s.slug = 'barbearia' and u.email = 'EMAIL-DO-PROFISSIONAL@exemplo.com';
