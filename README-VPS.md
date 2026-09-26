# Rodando no VPS com Docker

O app usa **PostgreSQL puro** e roda inteiro em containers Docker: um container para o
banco e outro para o app (frontend + backend juntos). A interface já vem otimizada
para celular, com modo escuro cyberpunk e modo claro holográfico. A única configuração obrigatória
é o arquivo `.env`.

## 1. Configurar o `.env`

```bash
cp .env.example .env
# edite usuário, senha e banco se quiser
```

Variáveis principais:

| Variável            | Padrão     | Uso                                   |
| ------------------- | ---------- | ------------------------------------- |
| `POSTGRES_USER`     | `delivery` | usuário do banco                      |
| `POSTGRES_PASSWORD` | `delivery` | senha do banco (**troque!**)          |
| `POSTGRES_DB`       | `delivery` | nome do banco                         |
| `APP_PORT`          | `3000`     | porta onde o app fica exposto no VPS  |

## 2. Subir tudo (banco + app)

```bash
docker compose up -d --build
```

Isso faz tudo:

1. Sobe o PostgreSQL e, na **primeira** subida, aplica `db/schema.sql` automaticamente
   (cria as tabelas e insere o cardápio de exemplo, as senhas das rotas e um entregador
   de teste). O script é idempotente — pode ser reaplicado sem duplicar dados.
2. Constrói a imagem do app a partir do `Dockerfile` e o sobe conectado ao banco.

O app fica em `http://seu-vps:3000`. Coloque um Nginx (ou Caddy/Traefik) na frente
para HTTPS e domínio próprio.

### Subir só o banco (app fora do Docker)

Se preferir rodar o app direto na máquina (sem container):

```bash
docker compose up -d postgres
bun install
NITRO_PRESET=node-server bun run build
DATABASE_URL=postgresql://delivery:delivery@localhost:5432/delivery bun .output/server/index.mjs
# ou com pm2:
# pm2 start "bun .output/server/index.mjs" --name delivery
```

## 3. Comandos úteis

```bash
docker compose logs -f app        # logs do app
docker compose logs -f postgres   # logs do banco
docker compose up -d --build app  # reconstruir o app após mudanças no código
docker compose down               # parar tudo (dados do banco são mantidos)
```

## 4. Acessos iniciais

| Rota       | Senha inicial |
| ---------- | ------------- |
| `/admin`   | `admin123`    |
| `/cozinha` | `cozinha123`  |
| `/entrega` | `entrega123`  |
| `/caixa`   | `caixa123`    |

Entregador de exemplo: **Carlos Entregador**, senha `1234`.

Troque todas as senhas em **/admin → Senhas** logo no primeiro acesso.

## 5. Backup

```bash
docker exec delivery-postgres pg_dump -U delivery delivery > backup-$(date +%F).sql
```

Restaurar:

```bash
cat backup.sql | docker exec -i delivery-postgres psql -U delivery -d delivery
```

## Observações

- Todos os dados ficam no volume `postgres-data`, persistido entre reinícios.
- As telas de cozinha, entrega, caixa, admin e o acompanhamento do cliente se atualizam
  automaticamente por recarga periódica (a cada 5–15 segundos).
- Nunca exponha a porta 5432 na internet; mantenha o banco acessível só ao app.
  (Se quiser máxima segurança, remova o bloco `ports:` do serviço `postgres` — o app
  continua alcançando o banco pela rede interna do compose.)

## 6. Erro 502 Bad Gateway no Nginx

502 significa que o Nginx está no ar, mas não conseguiu falar com o app. Verifique nesta ordem:

```bash
docker compose ps                 # o container delivery-app está "Up"?
docker compose logs --tail=100 app
curl -I http://127.0.0.1:3000     # deve responder 200
```

Casos mais comuns:

1. **O container do app não subiu / caiu** (build falhou ou erro de conexão com o banco):
   ```bash
   docker compose up -d --build app
   docker compose logs -f app
   ```
2. **Porta errada no Nginx**: o app escuta na `3000` (ou no valor de `APP_PORT`).
3. **`proxy_pass` usando `localhost`**: em algumas máquinas resolve para IPv6 (`::1`)
   e o app só escuta em IPv4. Use `127.0.0.1`.

Configuração de Nginx que funciona:

```nginx
server {
    listen 80;
    server_name delivery.seudominio.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 300s;
    }
}
```

Depois: `sudo nginx -t && sudo systemctl reload nginx`.

## 7. Mini SaaS de vendas VendeFácil

A tela inicial agora funciona como um **PDV de uma única tela**, preservando a estética holográfica/cyberpunk do projeto base:

- cadastro com nome, login, senha, WhatsApp e email;
- ativação por PIN de 6 dígitos com expiração de 15 minutos;
- workspace individual por estabelecimento, pronto para operadores adicionais;
- cards de produtos com foto/ícone, valor de custo, preço de venda, estoque atual e estoque mínimo;
- clientes consumindo com carrinho acumulado e cliente padrão **Consumidor**;
- pagamento por dinheiro, cartão, PIX ou outros;
- abertura automática do primeiro turno ao registrar uma venda;
- baixa de estoque e alerta visual de estoque mínimo;
- fechamento de turno pela tela **/caixa**, com resumo detalhado e base para exportação/envio;
- catálogo inicial de alimentos, bebidas, salgados e doces; o admin continua disponível em **/admin**.

### PIN de email via MailerSend

Configure no `.env` ou nos secrets do deploy:

```bash
MAILERSEND_API_TOKEN=mlsn.seu_token
MAILERSEND_FROM_EMAIL=no-reply@seu-dominio-verificado.com
MAILERSEND_FROM_NAME=VendeFácil
```

`MAILERSEND_FROM_EMAIL` precisa ser um remetente de domínio verificado no MailerSend. O cadastro gera um PIN de 6 dígitos, envia pela API oficial e o código expira em 15 minutos. O token não deve ser commitado nem incluído no pacote distribuído.

Como alternativa legada, configure `EMAIL_WEBHOOK_URL` no `.env` para conectar um provedor HTTP de email. O endpoint recebe:

```json
{ "to": "cliente@email.com", "subject": "Seu PIN de ativação — VendeFácil", "text": "Seu código de confirmação é 123456. Ele expira em 15 minutos." }
```

Sem MailerSend ou webhook configurado, o cadastro é recusado para evitar criar contas sem possibilidade de confirmação.

### Multiusuário

O schema cria `workspaces` e `app_users`. O cadastro inicial cria o workspace do estabelecimento como `owner`; a próxima etapa natural é adicionar convites de operadores e aplicar `workspace_id` nas consultas de produtos, pedidos, turnos e relatórios para isolamento completo entre estabelecimentos.


## 8. Atualizações do PDV

O menu superior agora concentra:

- acesso Admin;
- abrir turno, quando ainda não houver turno iniciado;
- cadastro do caixa inicial/troco;
- importação de produtos CSV;
- acesso ao catálogo geral de sugestões;
- criação de nova mesa/cliente.

O topo passa a mostrar os produtos selecionados e o botão **Finalizar**. Os cards foram reduzidos para aumentar a densidade na tela.

### CSV de produtos

O CSV aceita cabeçalhos como:

```csv
nome,categoria,preco,preco_compra,estoque,estoque_minimo
Coxinha,Salgados,7.50,3.20,30,8
```

### Fiado

Na finalização é possível informar quanto será pago agora. A diferença fica como saldo devedor do cliente. O saldo é persistido em `customers.credit_balance`, vinculado às compras seguintes pelo nome do cliente.

### Atualizar um banco já existente

Como o PostgreSQL mantém volume persistente, o script inicial do Docker não roda novamente. Execute a migração uma vez:

```bash
docker compose exec -T postgres psql -U delivery -d delivery < db/migrations/20260926_vendefacil_sales.sql
docker compose up -d --build --force-recreate app
```

## 9. Vender e Ver vendas

- A tela principal usa o botão **Vender** para selecionar um cliente existente ou incluir um novo.
- Os itens podem ser acumulados no consumo e são enviados juntos ao finalizar.
- **Ver vendas** fica no menu superior e mostra vendas em aberto, finalizadas e canceladas.
- Uma venda pode ser cancelada sem considerar seu valor no faturamento; o estoque é devolvido e o lançamento financeiro é anulado.
- A exclusão física só é permitida para uma venda cancelada e exige a senha do Admin.
- Vendas canceladas continuam aparecendo no relatório detalhado do turno.

Para bancos já existentes, aplique também:

```bash
docker compose exec -T postgres psql -U delivery -d delivery < db/migrations/20260926_sales_admin.sql
docker compose up -d --build --force-recreate app
```

## 10. Correção do banco e personalização

A migração `db/migrations/20260926_sales_admin.sql` agora é consolidada e inclui `customers`, `orders.customer_id`, `amount_paid`, `credit_amount`, `payment_status` e `cash_entries.voided`. Ela pode ser executada com segurança em banco existente:

```bash
docker compose exec -T postgres psql -U delivery -d delivery < db/migrations/20260926_sales_admin.sql
docker compose up -d --build --force-recreate app
```

O menu do PDV inclui **Fechar turno** e **Personalizar**. As preferências de tamanho da fonte e cor principal ficam salvas no navegador do usuário.
