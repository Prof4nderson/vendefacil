# Relatório de alterações e revisão de segurança — VendeFácil

## Status

As alterações foram feitas no código-fonte e preparadas para aplicação. **Nenhum banco de dados remoto foi acessado nem modificado nesta execução.** O reset das contas só ocorre quando a migration única é aplicada, pelo app ou via SQL, após backup.

## Alterações implementadas

- Criada a migration `db/migrations/20261028_password_reset.sql`. Na primeira aplicação, redefinirá as senhas de todas as linhas em `app_users` para `123456` e a senha do SysAdm para `SysAdm2026`. O banco registra a versão `20261028_password_reset` para não repetir o reset. A migração pelo app também exige sessão da rota admin.
- Atualizados o seed de SysAdm para instalações novas e o verificador de credenciais para a senha solicitada.
- Adicionado um aviso de primeiro acesso na tela inicial, com seta ao ícone do menu e opção persistente **“Não mostrar de novo”**. O texto orienta abrir o menu e escolher **“Nova conta”**.
- Removidos o bypass de senha admin vinculado a um usuário específico e as alterações de senha com base nesse nome em migrações reaplicáveis.
- Substituídas as chaves fixas das sessões de conta, operações e SysAdm por `ACCOUNT_SESSION_SECRET`, `OPS_SESSION_SECRET` e `SYSADM_SESSION_SECRET`, independentes e configuradas no ambiente. **A configuração desses três valores é necessária antes de usar sessões; alterar as chaves invalida cookies existentes.**
- Restringidos backup e restauração ao papel admin; dados de autenticação/segredos foram removidos dos backups e as colunas restauradas são verificadas por allowlist.
- O Compose agora exige `POSTGRES_PASSWORD` e publica a porta do banco apenas em `127.0.0.1` por padrão. `.env`/variantes foram adicionados ao `.gitignore` e o `.env` original não está no pacote modificado.
- Atualizados Vite e Zod para versões corrigidas por `npm audit`.

## Avisos importantes

1. **`123456` é fraca e compartilhada.** Use-a somente para o reset pedido, informe os usuários por canal seguro e peça que cada um troque a senha imediatamente. A aplicação ainda não força a troca no próximo login. O armazenamento atual usa SHA-256 simples, sem salt/fator de custo; hashes com senhas comuns são vulneráveis a cracking offline.
2. O reset cobre `app_users` e a credencial SysAdm. **Não** redefine as senhas separadas das rotas `/admin`, `/cozinha`, `/entrega`, `/caixa` nem a senha de entregador. O repositório ainda contém padrões conhecidos para essas rotas e para o entregador de exemplo; altere-os em `/admin → Senhas` antes de expor a instalação.
3. O ZIP original incluía um arquivo `.env` com credenciais de banco e configuração de email, com permissões `0644`. Os valores não foram copiados para o pacote modificado nem reproduzidos neste relatório. Como o arquivo foi compartilhado no anexo, **rotacione a senha do banco e o token de email** se forem credenciais reais, e corrija as permissões do `.env` privado para `0600`.
4. A auditoria `npm audit --omit=dev` ainda reporta **5 advisories críticos** na família TanStack Start (`@tanstack/react-start`, `react-start-server`, `start-server-core` e componentes relacionados). A atualização testada para `@tanstack/react-start@1.169.4` removeu o export `useSession` usado pelo projeto e quebrou a compilação. Mantive a versão compatível; uma migração futura da sessão para uma API suportada é necessária para fechar esse risco. Vite e Zod foram atualizados e não aparecem no relatório residual de produção.
5. Permanecem itens para hardening posterior: limitar tentativas de login/PIN (rate limit/lockout), invalidar sessões de contas suspensas imediatamente, revisar a validação TLS de conexões remotas ao PostgreSQL e remover/alterar todos os defaults de credenciais operacionais.

## Aplicação

1. Faça backup do banco antes da mudança.
2. No `.env`, configure `POSTGRES_PASSWORD` e gere três chaves independentes com `openssl rand -base64 48` para as sessões. Consulte `.env.example` e `README-VPS.md`.
3. Com o app atualizado, autentique a rota operacional `/admin` e use **Configurações → Verificar / migrar banco → Aplicar migração**; ou execute `psql "$DATABASE_URL" -f db/migrations/20261028_password_reset.sql` com uma conta DBA.
4. Distribua a senha temporária `123456` somente aos usuários de forma segura e peça a troca imediata. Use `SysAdm2026` para o SysAdm e faça nova rotação após o primeiro acesso, se possível.

## Verificações executadas

- `npm run build`: passou.
- ESLint nos arquivos fonte alterados: 0 erros; permanece 1 aviso existente sobre dependências de `useMemo` em `src/routes/index.tsx`.
- `npm run lint` global: ainda falha por centenas de violações de formatação em arquivos do projeto fora do escopo; isso não impediu o build.
- `npx tsc --noEmit`: ainda aponta erros de tipos em vários módulos do projeto (incluindo código já existente fora desta mudança); não foi configurado teste automatizado de banco nem executada migration real.
- `npm audit --omit=dev`: 5 advisories críticos restantes na família TanStack descrita acima.
