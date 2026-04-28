# Deploy futuro em VM Linux

Este guia e opcional. Ele deixa um caminho para rodar a mesma aplicacao em uma VM Linux no futuro, por exemplo Oracle Cloud Always Free, sem transformar o projeto em cloud-only agora.

Nao e necessario fazer deploy em VM para usar a aplicacao no PC.

## Modelo sugerido

- VM Linux pequena.
- Node.js 20+.
- PM2 para manter o processo vivo.
- SQLite em disco local da VM.
- Cloudflare Tunnel ou dominio/reverse proxy apontando para a porta `3333`.

## Preparar a VM

1. Clone o repositorio na VM.
2. Entre na pasta do projeto.
3. Rode:

```bash
bash scripts/vm-bootstrap.sh
```

O script instala dependencias basicas, Node.js se necessario, PM2, dependencias npm, Chromium do Playwright, builda o projeto e inicia o PM2.

Antes de expor publicamente, revise o `.env` gerado:

```env
PORT=3333
DATABASE_PATH=./storage/monitor.sqlite
ENABLE_BACKGROUND_SCHEDULER=true
MONITOR_INTERVAL_MINUTES=10
RUN_ON_BOOT=true
VITE_API_URL=
```

## Atualizar a VM depois

No diretorio do projeto:

```bash
bash scripts/vm-update.sh
```

O script faz:

- `git pull --ff-only`
- `npm ci`
- `npm run build`
- `npm run pm2:restart`

## Persistencia

Arquivos que devem ficar na VM e nao no Git:

- `.env`
- `storage/*.sqlite`
- logs
- screenshots de falhas
- credenciais do Cloudflare Tunnel

Faca backup periodico do SQLite se a VM virar ambiente principal.

## Porta e acesso

Aplicacao local na VM:

```text
http://localhost:3333
```

Para acesso publico, escolha uma destas opcoes:

- Cloudflare Tunnel apontando para `http://localhost:3333`.
- Reverse proxy HTTPS apontando para `localhost:3333`.

O projeto ja esta preparado para frontend e API na mesma origem publica.
