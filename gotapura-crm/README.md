# Gotapura CRM

CRM próprio da Gotapura, inspirado na estrutura do Insightly e alargado com telefonia integrada (SIP/WebRTC), WhatsApp Business, redes sociais, construtor de website, gestão documental, automações, utilizadores ilimitados e interface bilingue (PT/EN).

**Pilha:** React + Vite (interface) · Supabase (base de dados PostgreSQL, autenticação, ficheiros, tempo real, Edge Functions) · Vercel (alojamento gratuito).

---

## 1. Colocar em funcionamento (cerca de 30 minutos)

### 1.1 Supabase (base de dados e contas)
1. Crie uma conta em https://supabase.com e um projecto novo (região: **Europe West (London)** ou **Frankfurt** — menor latência a partir de Luanda). Guarde a palavra-passe da base de dados.
2. Abra **SQL Editor → New query**, cole todo o conteúdo de `supabase/schema.sql` e execute (**Run**). Cria tabelas, permissões, automações, recorrência de tarefas e dados iniciais. Depois execute, da mesma forma, `supabase/migracao-02.sql` (logótipo, moedas, campos personalizados, etiquetas). Em projectos já existentes basta correr a migração.
3. Em **Authentication → Providers → Email**, mantenha *Email* activo. Se quiser que os utilizadores entrem sem confirmar o e-mail, desligue *Confirm email*.
4. Em **Project Settings → API**, copie o **Project URL** e a **anon public key**.

### 1.2 Interface (Vercel)
1. Crie uma conta em https://github.com e carregue esta pasta num repositório privado (`gotapura-crm`).
2. Crie uma conta em https://vercel.com com o GitHub, escolha **Add New → Project**, seleccione o repositório. O Vercel detecta o Vite automaticamente.
3. Em **Environment Variables** adicione:
   - `VITE_SUPABASE_URL` = Project URL
   - `VITE_SUPABASE_ANON_KEY` = anon public key
4. **Deploy**. O CRM fica em `https://gotapura-crm.vercel.app` (pode mudar o nome em Settings → Domains; um domínio próprio pode ser ligado mais tarde).
5. Em Supabase → **Authentication → URL Configuration**, coloque o endereço do Vercel em *Site URL* e em *Redirect URLs*.

### 1.3 Primeiro acesso
- Em Supabase → Authentication → Sign In / Providers → Email, desligue *Confirm email* se não quiser que os colaboradores tenham de confirmar o e-mail.
- O **primeiro utilizador** a criar conta torna-se automaticamente **Administrador**.
- Os restantes colaboradores criam conta na página de entrada (sem limite de utilizadores), ou o administrador cria-as em Supabase → Authentication → Users → Add user. Em **Utilizadores** atribui-se a cada um a função, o departamento e a extensão telefónica.

| Função | Permissões |
|---|---|
| Consulta | Vê tudo, sem alterar |
| Agente | Cria e edita registos, tarefas e cotações; não elimina |
| Gestor | O anterior, mais eliminar e gerir automações e integrações |
| Administrador | Tudo, incluindo utilizadores e permissões |

### 1.4 Carregar os dados existentes
No menu **Importar e exportar**, pela ordem: Organizações → Contactos → Produtos. A pasta `dados/` contém os contactos migrados do Odoo já no formato correcto (`contactos-odoo-para-crm.xlsx`). Use os ficheiros da pasta `modelos/` (ou qualquer Excel cuja primeira linha tenha títulos). Registos já existentes são ignorados, pelo que a importação pode repetir-se sem criar duplicados.

### 1.5 Funções de servidor
**admin-users (gestão de utilizadores a partir do CRM)** — necessária para criar e eliminar utilizadores e definir palavras-passe em Utilizadores. Publica-se sem instalar nada: no painel Supabase, **Edge Functions → Deploy a new function → Via Editor**, nome `admin-users`, cole o conteúdo de `supabase/functions/admin-users/index.ts` e clique em **Deploy**. Enquanto não estiver publicada, as contas criam-se em Authentication → Users → Add user, e tudo o resto em Utilizadores funciona normalmente.

**WhatsApp, redes sociais e facturação** — necessárias apenas quando activar essas integrações; podem publicar-se da mesma forma (Via Editor, uma função de cada vez, com o conteúdo de cada `index.ts` e do ficheiro `_shared/db.ts` colado no início) ou com o CLI. Instale o CLI do Supabase (`npm i -g supabase`) e, na pasta do projecto:
```
supabase login
supabase link --project-ref <PROJECT_REF>
supabase functions deploy whatsapp-webhook --no-verify-jwt
supabase functions deploy whatsapp-send
supabase functions deploy social-publish --no-verify-jwt
supabase functions deploy invoicing-sync
```
Para publicações agendadas e lembretes automáticos, execute `supabase/cron.sql` no SQL Editor (substituindo `<PROJECT_REF>` e `<SERVICE_ROLE_KEY>`).

---

## 2. Módulos

| Módulo | O que faz |
|---|---|
| Painel | Oportunidades abertas, valor em pipeline, novos leads, taxa de conversão, tarefas do dia e em atraso, actividade recente |
| Leads | Captação (website, WhatsApp, telefone, feira, redes sociais), qualificação e **conversão** em Contacto + Organização + Oportunidade |
| Contactos / Organizações | Fichas completas, responsável, cronologia (notas, chamadas, mensagens, tarefas), **clique-para-ligar** nos números |
| Oportunidades | Pipeline **Kanban** com arrastar e largar (Qualificação → Proposta → Negociação → Ganha/Perdida), probabilidade, valor, fecho previsto |
| Projectos | Instalações, manutenções e obras ligadas a clientes e oportunidades |
| Tarefas | Prioridade, categoria, atribuição, lembretes e **recorrência** (diária, dias úteis, semanal, mensal, anual, com intervalo e data-fim). Ao concluir, a ocorrência seguinte é criada automaticamente na base de dados |
| Produtos / Cotações | Catálogo (equipamentos, filtros, recargas, serviços), cotações com linhas, IVA e totais; **envio para facturação certificada** |
| Documentos | Pastas, idioma, versões, etiquetas; ficheiros privados no Supabase Storage com ligações temporárias |
| Importar e exportar | Carregamento em massa de Organizações, Contactos, Leads e Produtos a partir de Excel/CSV, com reconhecimento automático das colunas, pré-visualização e exclusão de duplicados; exportação de qualquer módulo para Excel (botão nas listas e na página Importar e exportar); modelos na pasta `modelos/` |
| WhatsApp | Caixa de entrada por conversa em tempo real; números desconhecidos criam leads automaticamente |
| Redes sociais | Calendário de publicações PT/EN para Facebook, Instagram e LinkedIn, com agendamento |
| Website | Construtor por blocos (cabeçalho, texto, imagem, vantagens, produtos, formulário de contacto que cria leads no CRM), pré-visualização e exportação de HTML |
| Automações | Regras "quando [registo] é criado/actualizado e [condições] → criar tarefa, alterar campo, notificar, registar actividade", executadas na base de dados com histórico |
| Telefone | Softphone no navegador ligado à central SIP: marcar, atender, silenciar, identificação do contacto e registo automático das chamadas |
| Integrações | Central, WhatsApp, Facebook, Instagram, LinkedIn, facturação, e-mail; chaves de API; webhooks por evento |
| Utilizadores | Criar, editar e eliminar utilizadores; função (Administrador, Gestor, Agente, Consulta), departamento, cargo, telefones, extensão, palavra-passe, activação |
| Definições | Perfil e telefone SIP de cada utilizador; para administradores: dados da empresa e **logótipo** (menu, página de entrada e documentos), **moedas** (Kz, USD, EUR, … com taxas e moeda base) e **campos personalizados** por módulo |
| Etiquetas | Tarefas, contactos, organizações, leads, oportunidades, projectos e produtos aceitam etiquetas livres; as tarefas filtram-se por etiqueta |
| Cotações → PDF | Pré-visualização da cotação e factura pró-forma com logótipo e dados da empresa; "Guardar como PDF" na janela de impressão |

Idioma: selector PT/EN no topo da aplicação (texto de interface); registos, documentos, páginas do website e publicações têm campo de idioma próprio.

---

## 3. Telefonia (central SIP)
A central (Asterisk, FreePBX, Issabel, 3CX, …) deve ter **WebRTC activo** (transporte WSS, normalmente porta 8089) e uma **extensão SIP por utilizador**. Cada utilizador introduz em **Definições → Telefone**: extensão, URI SIP (`sip:200@central.gotapura.ao`), endereço WSS (`wss://central.gotapura.ao:8089/ws`) e palavra-passe. É obrigatório um certificado TLS válido na central. Séries previstas: 100 administrativa · 200 apoio ao cliente · 300 comercial · 400 técnica.

## 4. WhatsApp Business
Requer uma conta WhatsApp Business (Meta Cloud API). Em **Integrações → WhatsApp** introduza *Phone number ID*, *Business account ID*, token permanente e um token de verificação; na app Meta configure o webhook com o URL `https://<PROJECT_REF>.supabase.co/functions/v1/whatsapp-webhook` e subscreva *messages*.

## 5. Facturação
Em Angola as facturas devem ser emitidas por software certificado pela AGT. O CRM não emite facturas: envia a cotação aceite para a plataforma certificada (Primavera, PHC, Moloni, Odoo, …) através da função `invoicing-sync` e guarda a referência e o PDF devolvidos. Adapte a função `toProvider` ao formato da API do fornecedor escolhido.

## 6. API para outras plataformas
Todas as tabelas estão expostas por REST em `https://<PROJECT_REF>.supabase.co/rest/v1/<tabela>` (cabeçalhos `apikey` e `Authorization: Bearer <token>`), com as mesmas permissões dos utilizadores. Os **webhooks** notificam sistemas externos quando ocorrem eventos (lead criado, oportunidade ganha, cotação aceite, …).

## 7. Desenvolvimento local
```
npm install
cp .env.example .env     # preencher com os valores do Supabase
npm run dev
```

## 8. Segurança
- Autenticação Supabase com palavras-passe próprias; sessões por utilizador.
- Permissões por função aplicadas na base de dados (RLS): Consulta só lê; Agente cria e edita; Gestor também elimina; Administrador gere utilizadores, integrações e automações.
- Registo de auditoria de todas as alterações em leads, contactos, organizações, oportunidades, projectos e tarefas.
- Ficheiros privados; ligações de transferência expiram em 5 minutos.
