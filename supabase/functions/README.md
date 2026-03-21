# SmartQueue – Edge Functions

## Estrutura

```
supabase/
└── functions/
    ├── _compartilhado/
    │   └── supabase.ts          ← cliente e tipos reutilizáveis
    ├── previsao-espera/
    │   └── index.ts             ← calcula tempo estimado de espera
    ├── notificar-fila/
    │   └── index.ts             ← envia notificações por proximidade
    └── automacoes.sql           ← trigger + cron job no banco
```

---

## Pré-requisitos

- [Supabase CLI](https://supabase.com/docs/guides/cli) instalado
- Projeto Supabase criado e com o banco já migrado (`smartqueue_supabase_pt.sql`)
- [Deno](https://deno.land/) instalado localmente (para testes)

---

## Deploy passo a passo

### 1. Login e link do projeto

```bash
supabase login
supabase link --project-ref SEU_PROJECT_REF
```

### 2. Deploy das funções

```bash
# Previsão de espera
supabase functions deploy previsao-espera

# Notificar fila
supabase functions deploy notificar-fila
```

### 3. Configurar automações no banco

1. Abra o **SQL Editor** no dashboard do Supabase
2. Abra o arquivo `automacoes.sql`
3. **Substitua** `SEU_PROJECT_REF` e `SUA_SERVICE_ROLE_KEY` pelos valores reais
4. Execute o script

> As chaves estão em: Supabase Dashboard → Settings → API

---

## Endpoints

### `POST /functions/v1/previsao-espera`

Calcula o tempo estimado de espera de um agendamento.

**Body:**
```json
{
  "agendamento_id": "uuid-do-agendamento"
}
```

**Resposta:**
```json
{
  "agendamento_id": "...",
  "posicao_atual": 5,
  "pessoas_a_frente": 4,
  "minutos_estimados": 60,
  "previsao_horario": "14:30",
  "duracao_media_servico": 15,
  "prioridades_a_frente": 2,
  "alerta": "chegando",
  "calculado_em": "2025-01-01T14:00:00Z"
}
```

**Valores de `alerta`:**

| Valor       | Significado                        |
|-------------|------------------------------------|
| `longe`     | Mais de 5 pessoas à frente         |
| `chegando`  | Entre 3 e 5 pessoas à frente       |
| `proximo`   | 1 ou 2 pessoas à frente            |
| `agora`     | É a vez do usuário                 |

---

### `POST /functions/v1/notificar-fila`

Verifica a fila e envia notificações para quem está próximo.

**Body:**
```json
{
  "unidade_id": "uuid-da-unidade",
  "limite_pessoas": 3
}
```

**Resposta:**
```json
{
  "unidade_id": "...",
  "notificacoes_enviadas": 2,
  "detalhes": [
    {
      "agendamento_id": "...",
      "usuario_id": "...",
      "numero_senha": "A-005",
      "posicao": 3,
      "pessoas_a_frente": 2,
      "titulo": "⏳ Quase lá! Falta 1 pessoa."
    }
  ],
  "verificado_em": "2025-01-01T14:00:00Z"
}
```

---

## Lógica de notificação

```
Fila: [P1] [P2] [P3] [P4] [P5] [P6] [P7]
                          ↑
                     limite = 3
                     Notifica P3, P4, P5
```

- **Evita spam:** não re-notifica o mesmo usuário dentro de 5 minutos
- **Prioritários:** recebem mensagem personalizada
- **Automático:** dispara via trigger ao mover a fila e via cron a cada 1 minuto

---

## Testar localmente

```bash
# Inicia o servidor local
supabase functions serve --env-file .env.local

# Testa previsão de espera
curl -X POST http://localhost:54321/functions/v1/previsao-espera \
  -H "Content-Type: application/json" \
  -d '{"agendamento_id": "SEU_UUID"}'

# Testa notificar fila
curl -X POST http://localhost:54321/functions/v1/notificar-fila \
  -H "Content-Type: application/json" \
  -d '{"unidade_id": "a0000000-0000-0000-0000-000000000001", "limite_pessoas": 3}'
```

---

## Variáveis de ambiente (.env.local)

```env
SUPABASE_URL=https://SEU_PROJECT_REF.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sua_service_role_key
SUPABASE_ANON_KEY=sua_anon_key
```
