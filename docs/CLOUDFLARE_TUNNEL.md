# Cloudflare Tunnel

Este modo permite acessar a aplicacao pelo celular fora da rede local enquanto o PC estiver ligado.

O projeto nao cria conta Cloudflare, nao faz login automatico e nao grava credenciais. Ele deixa o alvo local e os scripts prontos.

## Alvo local

Em producao local, a aplicacao roda em:

```text
http://localhost:3333
```

O tunnel deve apontar para:

```env
CLOUDFLARE_TUNNEL_TARGET=http://localhost:3333
```

Como o frontend usa `/api` na mesma origem quando `VITE_API_URL=` esta vazio, a API, o SSE e os assets funcionam tanto em `localhost` quanto no dominio publico.

## Variaveis

No `.env`:

```env
ENABLE_REMOTE_ACCESS=true
REMOTE_ACCESS_MODE=cloudflare_tunnel
APP_PUBLIC_URL=
API_PUBLIC_URL=
CLOUDFLARED_BIN=cloudflared
CLOUDFLARE_TUNNEL_NAME=pokemon-rayquaza-monitor
CLOUDFLARE_TUNNEL_TARGET=http://localhost:3333
CLOUDFLARE_TUNNEL_HOSTNAME=
```

- `APP_PUBLIC_URL`: URL publica final do web app, quando voce tiver uma.
- `API_PUBLIC_URL`: deixe vazio se API e frontend ficam na mesma URL.
- `CLOUDFLARE_TUNNEL_NAME`: nome local do tunnel no Cloudflare.
- `CLOUDFLARE_TUNNEL_HOSTNAME`: dominio fixo, por exemplo `rayquaza.seudominio.com`.

## Teste rapido com TryCloudflare

1. Suba a aplicacao:

```bash
npm run build
npm run start
```

2. Em outro terminal, rode:

Windows:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/setup-cloudflared.ps1 -RunQuickTunnel
```

Linux/macOS:

```bash
bash scripts/setup-cloudflared.sh --run-quick-tunnel
```

O `cloudflared` vai imprimir uma URL temporaria `trycloudflare.com`. Abra essa URL no celular.

## Dominio fixo

Depois de instalar `cloudflared` e autenticar sua conta:

```bash
cloudflared tunnel login
cloudflared tunnel create pokemon-rayquaza-monitor
cloudflared tunnel route dns pokemon-rayquaza-monitor rayquaza.seudominio.com
cloudflared tunnel run pokemon-rayquaza-monitor
```

Ou use o script do projeto:

```powershell
npm run tunnel:setup -- -Hostname rayquaza.seudominio.com
npm run tunnel:run
```

Atualize o `.env`:

```env
APP_PUBLIC_URL=https://rayquaza.seudominio.com
CLOUDFLARE_TUNNEL_NAME=pokemon-rayquaza-monitor
CLOUDFLARE_TUNNEL_HOSTNAME=rayquaza.seudominio.com
```

Rebuild recomendado depois de alterar variaveis de frontend:

```bash
npm run build
npm run pm2:restart
```

No Windows, `scripts/start-on-login.ps1` sobe o tunnel junto com a aplicacao. Se `CLOUDFLARE_TUNNEL_HOSTNAME` estiver vazio, ele usa TryCloudflare temporario. Se estiver preenchido e existir `~/.cloudflared/config.yml`, ele sobe o named tunnel fixo.

## Observacoes

- Nao use Docker para este fluxo.
- O PC precisa continuar ligado.
- Se usar PM2, deixe a aplicacao no ar com `npm run pm2:start` e rode o tunnel em outro terminal ou como servico do Cloudflare.
- O endpoint `GET /api/health` ajuda a validar se o dominio publico esta chegando no backend.

Docs oficiais usadas como referencia:

- https://developers.cloudflare.com/tunnel/setup/
- https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/do-more-with-tunnels/trycloudflare/
- https://developers.cloudflare.com/tunnel/routing/
