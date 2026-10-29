# Carvão Minas Uai — Gestão

App simples (para celular) de controle de vendas, despesas e estoque.

- Site estático: `index.html`, `app.js`, `style.css`. Não precisa de build.
- Banco e login: Supabase (projeto "Carvao Minas Uai Gestao").
- Só entra quem estiver na tabela `membros` (por e-mail). As regras de acesso (RLS) ficam no banco.

## Como funciona o estoque

Estoque = estoque inicial − quantidades vendidas (lançamentos de **entrada** com produto)
\+ quantidades compradas (lançamentos de **saída** com produto).

## Publicação

Netlify (https://minasuai.netlify.app), ligado a este repositório: cada envio para a branch `main` publica o site sozinho.
No Supabase, em Authentication → URL Configuration, o "Site URL" deve ser o endereço do site,
para o link de login do e-mail voltar para o app.
