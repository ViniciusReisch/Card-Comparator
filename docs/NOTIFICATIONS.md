# Notificacoes

O monitor pode enviar aviso no celular e no desktop quando um anuncio novo e encontrado.

Providers disponiveis:

- `ntfy`: prioridade do projeto, leve e sem servico pago obrigatorio.
- `Telegram`: opcional, via Telegram Bot API.

As notificacoes sao enviadas depois que o anuncio novo e salvo no SQLite e publicado na UI em tempo real. O backend registra entregas por `run_id`, `offer_id` e `provider` para evitar duplicidade na mesma execucao.

O corpo do aviso inclui preco em BRL, idioma com bandeira, extras detectados como `Reverse Foil`, `Foil`, `Holo`, `Stamped` e similares, estado, colecao, quantidade, vendedor, fonte e link direto da oferta quando disponivel.

## ntfy no celular e desktop

1. Escolha um topico dificil de adivinhar, por exemplo `rayquaza-monitor-seu-nome-123`.
2. Instale o app ntfy no celular ou acesse `https://ntfy.sh` no navegador.
3. Assine o topico escolhido.
4. Configure o `.env`:

```env
NTFY_ENABLED=true
NTFY_BASE_URL=https://ntfy.sh
NTFY_TOPIC=rayquaza-monitor-seu-nome-123
NTFY_PRIORITY=default
```

Prioridades aceitas pelo ntfy incluem `min`, `low`, `default`, `high` e `urgent`.

## Telegram

1. Abra o `@BotFather` no Telegram.
2. Crie um bot e copie o token.
3. Envie uma mensagem qualquer para o bot.
4. Descubra seu `chat_id` usando `getUpdates` ou outro metodo de sua preferencia.
5. Configure o `.env`:

```env
TELEGRAM_ENABLED=true
TELEGRAM_BOT_TOKEN=123456:ABC...
TELEGRAM_CHAT_ID=123456789
```

## Testar envio

Com a aplicacao rodando:

```bash
curl -X POST http://localhost:3333/api/notifications/test
```

Ou use o botao `Enviar teste` no painel `Notificacoes` do Dashboard.

Resposta esperada quando ha provider configurado:

```json
{
  "status": "sent",
  "results": [
    {
      "provider": "ntfy",
      "status": "sent",
      "message": "Notification sent."
    }
  ]
}
```

## Evitar spam

- Use apenas um provider se quiser menos notificacoes.
- Deixe `TELEGRAM_ENABLED=false` se o ntfy ja for suficiente.
- Use `NTFY_PRIORITY=low` para avisos discretos.
- A cada execucao, o backend nao envia duas vezes para o mesmo `offer_id` no mesmo provider.
- Se muitos anuncios novos aparecerem de uma vez, a UI continua recebendo todos em tempo real, mas voce pode pausar o agendador com `POST /api/monitor/pause`.

## Variaveis completas

```env
NTFY_ENABLED=false
NTFY_BASE_URL=https://ntfy.sh
NTFY_TOPIC=
NTFY_PRIORITY=default
TELEGRAM_ENABLED=false
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
```

Referencias oficiais:

- ntfy publish API: https://docs.ntfy.sh/publish/
- Telegram Bot API `sendMessage`: https://core.telegram.org/bots/api#sendmessage
