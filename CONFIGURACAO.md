# Configuração (uma vez só)

Troque `SEU-SITE` pelo endereço publicado (ex.: `barbearia-agendament.vercel.app`).

## 1. Supabase → Authentication → URL Configuration
- **Site URL:** `https://SEU-SITE`
- **Redirect URLs:** `https://SEU-SITE/**` e, para testar no computador, `http://localhost:3000/**`

O mesmo vale para o login com Google e para os links dos e-mails. Se algo voltar para `localhost:3000` no celular, é porque o endereço de onde a pessoa saiu não está nessa lista.

## 2. Supabase → Authentication → Sign In / Providers
- **Email:** deixe *Confirm email* ligado e coloque **Minimum password length = 8**.
- **Google:** ative e cole o Client ID e o Client Secret (o secret só existe aqui, nunca no código).

## 3. Google Cloud → Credenciais → seu cliente OAuth
- **Origens JavaScript autorizadas:** `https://SEU-SITE` (e `http://localhost:3000` para testes)
- **URI de redirecionamento autorizado:** `https://<seu-projeto>.supabase.co/auth/v1/callback`
- Tela de consentimento em *Testando* só deixa entrar os e-mails de teste. Antes de divulgar, publique o app.

## 4. E-mails personalizados (Supabase → Authentication → Emails)
- **Templates:** cole `docs/emails/email-confirmar-cadastro.html` em *Confirm signup* (assunto: `Confirme sua conta na Barbearia`) e `docs/emails/email-redefinir-senha.html` em *Reset password* (assunto: `Redefinir sua senha na Barbearia`).
- Os links usam `{{ .SiteURL }}` e funcionam em qualquer navegador.
- **Remetente "Supabase Auth":** só muda com SMTP próprio (*SMTP Settings*, com Resend, Brevo etc.; *Sender name* = `Barbearia`). O envio padrão também tem limite baixo de e-mails por hora, então para uso real configure SMTP.

## 5. Definir o proprietário
Ninguém vira dono pelo cadastro. Depois que a pessoa criar a conta no site, rode `database/bootstrap-owner.sql` no *SQL Editor* do Supabase com o e-mail dela. Depois, o dono cadastra gerentes e profissionais pelo painel (profissionais e horários) e pode promover pessoas com o mesmo SQL (`manager` ou `staff`).

## 6. Dados reais
No painel (menu **Barbearia**): nome, endereço, telefone, WhatsApp, horários e regras. Em **Serviços e preços**: valores e durações. Os textos da landing (endereço, WhatsApp, e-mail e Instagram do rodapé) ainda estão como exemplo em `index.html`.

## Sobre pagamentos
Ainda não há pagamento online. O cliente pede o plano, combina o pagamento com a barbearia (Pix, dinheiro ou cartão) e o dono confirma em **Financeiro → Assinaturas**, o que libera as visitas. "Recebido" no Financeiro só soma atendimentos concluídos e planos que o dono confirmou.
