# Banco de dados (Supabase)

O banco já está criado no projeto Supabase e **não** é recriado por este repositório.
As migrações (tabelas, políticas RLS e funções) foram aplicadas direto no projeto e ainda não estão como arquivos `.sql` aqui.
Para versionar, exporte com a CLI: `supabase db dump --linked -f database/schema.sql`.

Resumo do que existe:
- **Tabelas:** shops, profiles, staff, shop_members, services, staff_services, business_hours, blocked_times, business_settings, plans, subscriptions, subscription_credits, appointments, appointment_services, audit_logs, consents (RLS em todas, `shop_id` em tudo para várias barbearias).
- **Funções (chamadas pelo site):** get_availability, book_appointment, cancel_appointment, create_subscription, activate_subscription, complete_registration, discard_unregistered_account, my_appointments, admin_appointments, admin_set_appointment_status, admin_customers, admin_subscriptions, admin_finance.
- **Proteção contra reserva dupla:** trava por profissional + restrição de exclusão do Postgres (`no_overlap`).
- **Proprietário:** `bootstrap-owner.sql`.
