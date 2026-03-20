# SmartQueue — Fila Inteligente 🚀

> Sistema SaaS de gestão de filas inteligentes para instituições públicas e privadas, com agendamento online, prioridade automática por grupos especiais e painel administrativo em tempo real.

![SmartQueue](https://img.shields.io/badge/SmartQueue-v1.0-7c6aff?style=for-the-badge)
![React](https://img.shields.io/badge/React-18-61dafb?style=for-the-badge&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?style=for-the-badge&logo=typescript)
![Supabase](https://img.shields.io/badge/Supabase-Backend-3ecf8e?style=for-the-badge&logo=supabase)
![Tailwind](https://img.shields.io/badge/Tailwind-CSS-06b6d4?style=for-the-badge&logo=tailwindcss)

---

## 📋 Sobre o Projeto

O **SmartQueue** é uma aplicação web responsiva (mobile + desktop) que resolve o problema das filas presenciais em clínicas, órgãos públicos, bancos, empresas e qualquer instituição que precise gerenciar atendimentos.

### Problema resolvido
- ❌ Filas desorganizadas e longas esperas
- ❌ Sem visibilidade de quanto tempo falta
- ❌ Grupos prioritários não atendidos adequadamente
- ❌ Sem histórico e relatórios de atendimento

### Solução
- ✅ Agendamento online pelo celular ou computador
- ✅ Acompanhamento da posição na fila em tempo real
- ✅ Prioridade automática por lei federal
- ✅ Painel administrativo completo com relatórios

---

## 🎯 Funcionalidades

### Para o Usuário
- 📱 Cadastro e login com confirmação de email
- 📅 Agendamento online em 4 etapas (unidade → serviço → data/hora → confirmação)
- 🎫 Geração automática de senha (ex: A-001, P-002)
- 📊 Acompanhamento da posição na fila em tempo real
- 🔔 Notificações quando a vez está chegando
- ❌ Cancelamento de agendamento
- 👤 Perfil com foto (câmera ou galeria)

### Para o Administrador
- 🖥️ Painel administrativo completo
- 📋 Visualização de todos os agendamentos com filtros
- ⚡ Fila em tempo real com Supabase Realtime
- 👥 Gestão de usuários (editar, ativar/desativar)
- ➕ Cadastro de novos usuários pela recepção
- 📅 Agendamento presencial direto pelo painel
- 📈 Relatórios diários e mensais com gráficos
- 📊 Exportação de dados em CSV
- 🤖 Marcação automática de "Não compareceu" via pg_cron

### Prioridade Automática (Lei Federal)
| Grupo | Pontuação |
|---|---|
| Pessoa com deficiência | 100 |
| Idoso (60+) | 90 |
| Gestante | 85 |
| Lactante | 80 |
| Obesidade grave | 70 |
| Normal | 0 |

---

## 🛠️ Tecnologias

### Frontend
| Tecnologia | Uso |
|---|---|
| React 18 + Vite | Framework e bundler |
| TypeScript | Tipagem estática |
| Tailwind CSS | Estilização |
| Shadcn/UI | Componentes |
| React Router v6 | Navegação |
| TanStack Query | Gerenciamento de estado servidor |
| Recharts | Gráficos nos relatórios |
| Lucide React | Ícones |

### Backend (Supabase)
| Recurso | Uso |
|---|---|
| PostgreSQL | Banco de dados |
| Auth | Autenticação e autorização |
| Row Level Security | Segurança por usuário |
| Realtime | Fila ao vivo |
| Storage | Avatares dos usuários |
| Edge Functions | Lógica serverless |
| pg_cron | Jobs automáticos |

---

## 🏗️ Arquitetura

```
smartqueue/
├── frontend/                    # React + TypeScript
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Login.tsx
│   │   │   ├── Cadastro.tsx
│   │   │   ├── Dashboard.tsx    # Dashboard do usuário
│   │   │   ├── Agendar.tsx      # Agendamento em 4 etapas
│   │   │   ├── Fila.tsx         # Posição na fila
│   │   │   ├── Perfil.tsx       # Perfil do usuário
│   │   │   ├── Admin.tsx        # Painel administrativo
│   │   │   └── Relatorios.tsx   # Relatórios gerenciais
│   │   ├── components/
│   │   │   ├── AppLayout.tsx
│   │   │   ├── Navigation.tsx
│   │   │   ├── BottomNav.tsx
│   │   │   ├── ProtectedRoute.tsx
│   │   │   ├── NovoAtendimentoModal.tsx
│   │   │   └── CadastroUsuarioModal.tsx
│   │   ├── contexts/
│   │   │   └── AuthContext.tsx
│   │   └── integrations/
│   │       └── supabase/
│   │           └── client.ts
└── supabase/
    └── functions/
        ├── previsao-espera/        # Calcula tempo estimado
        ├── notificar-fila/         # Envia notificações
        └── criar-usuario-admin/    # Cadastro via admin
```

---

## 🗄️ Banco de Dados

### Tabelas principais

| Tabela | Descrição |
|---|---|
| `perfis` | Dados dos usuários |
| `unidades` | Unidades de atendimento |
| `administradores_unidades` | Vínculo admin ↔ unidade |
| `tipos_atendimento` | Serviços por unidade |
| `horarios_funcionamento` | Funcionamento por dia |
| `agendamentos` | Agendamentos dos usuários |
| `fila` | Posições em tempo real |
| `notificacoes` | Avisos ao usuário |
| `historico_atendimentos` | Log para relatórios |
| `relatorios` | Relatórios gerados |

### Automações via Triggers
- ✅ Criação automática de perfil após cadastro
- ✅ Geração de senha/ticket (A-001 normal, P-001 prioritário)
- ✅ Cálculo automático de pontuação de prioridade
- ✅ Inserção na fila ao mudar status para `aguardando`
- ✅ Registro no histórico ao finalizar atendimento
- ✅ Job automático (00:01) marca `nao_compareceu`

---

## ⚡ Edge Functions

### `previsao-espera`
Calcula o tempo estimado de espera baseado na posição na fila e duração média dos serviços.

```
POST /functions/v1/previsao-espera
{ "agendamento_id": "uuid" }
```

### `notificar-fila`
Verifica a fila e envia notificações para usuários próximos de serem atendidos.

```
POST /functions/v1/notificar-fila
{ "unidade_id": "uuid", "limite_pessoas": 3 }
```

### `criar-usuario-admin`
Permite que recepcionistas cadastrem novos usuários pelo painel admin.

```
POST /functions/v1/criar-usuario-admin
{ "nome_completo", "email", "senha", "cpf", "telefone" }
```

---

## 🚀 Como rodar localmente

### Pré-requisitos
- Node.js 18+
- Conta no [Supabase](https://supabase.com)
- Supabase CLI instalado

### 1. Clone o repositório
```bash
git clone https://github.com/LenildoLima/smart-queue.git
cd smart-queue/frontend
```

### 2. Instale as dependências
```bash
npm install
```

### 3. Configure as variáveis de ambiente
Crie um arquivo `.env` na pasta `frontend`:
```env
VITE_SUPABASE_URL=https://SEU_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sua_anon_key
```

### 4. Configure o banco de dados
No SQL Editor do Supabase, execute o arquivo:
```
supabase/smartqueue_supabase_pt.sql
```

### 5. Deploy das Edge Functions
```bash
cd ..
supabase link --project-ref SEU_PROJECT_REF
supabase functions deploy previsao-espera
supabase functions deploy notificar-fila
supabase functions deploy criar-usuario-admin
```

### 6. Inicie o servidor
```bash
cd frontend
npm run dev
```

Acesse: `http://localhost:8080`

---

## 👤 Perfis de Acesso

| Perfil | Acesso |
|---|---|
| `usuario` | Dashboard, Agendar, Fila, Perfil |
| `administrador` | Painel Admin, Relatórios, Perfil |

Para tornar um usuário administrador:
```sql
UPDATE perfis
SET perfil = 'administrador'
WHERE email = 'seu@email.com';
```

---

## 💰 Modelo de Negócio (Freemium)

| Recurso | Gratuito | Premium |
|---|---|---|
| Unidades cadastradas | 1 | Ilimitadas |
| Relatórios | Básicos | Avançados |
| Dashboard | Simples | Completo |
| Previsão de espera | ✅ | ✅ |
| Suporte | Comunidade | Prioritário |

---

## 📸 Screenshots

> Sistema com design dark mode moderno, responsivo para mobile e desktop.

- **Login** — Tela dividida com identidade visual
- **Dashboard** — Agendamento ativo com senha em destaque
- **Agendamento** — Fluxo em 4 etapas com calendário
- **Fila** — Posição em tempo real com barra de progresso
- **Admin** — Painel completo com KPIs e fila ao vivo
- **Relatórios** — Gráficos de pizza e barras com histórico

---

## 🤝 Autor

**Lenildo Lima da Silva**

[![LinkedIn](https://img.shields.io/badge/LinkedIn-Lenildo_Lima-0077b5?style=for-the-badge&logo=linkedin)](https://linkedin.com/in/lenildolima)
[![GitHub](https://img.shields.io/badge/GitHub-LenildoLima-333?style=for-the-badge&logo=github)](https://github.com/LenildoLima)

---

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

---

<div align="center">
  <p>Feito com ❤️ e muito ☕</p>
  <p><strong>SmartQueue</strong> — Chega de filas. Seja inteligente.</p>
</div>
