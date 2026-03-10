export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      administradores_unidades: {
        Row: {
          criado_em: string
          id: string
          unidade_id: string
          usuario_id: string
        }
        Insert: {
          criado_em?: string
          id?: string
          unidade_id: string
          usuario_id: string
        }
        Update: {
          criado_em?: string
          id?: string
          unidade_id?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "administradores_unidades_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "administradores_unidades_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
        ]
      }
      agendamentos: {
        Row: {
          atualizado_em: string
          cancelado_em: string | null
          criado_em: string
          data_agendamento: string
          grupo_prioridade: Database["public"]["Enums"]["grupo_prioridade"]
          hora_agendamento: string
          id: string
          motivo_cancelamento: string | null
          numero_senha: string | null
          observacoes: string | null
          pontuacao_prioridade: number
          status: Database["public"]["Enums"]["status_agendamento"]
          tipo_atendimento_id: string
          unidade_id: string
          usuario_id: string
        }
        Insert: {
          atualizado_em?: string
          cancelado_em?: string | null
          criado_em?: string
          data_agendamento: string
          grupo_prioridade?: Database["public"]["Enums"]["grupo_prioridade"]
          hora_agendamento: string
          id?: string
          motivo_cancelamento?: string | null
          numero_senha?: string | null
          observacoes?: string | null
          pontuacao_prioridade?: number
          status?: Database["public"]["Enums"]["status_agendamento"]
          tipo_atendimento_id: string
          unidade_id: string
          usuario_id: string
        }
        Update: {
          atualizado_em?: string
          cancelado_em?: string | null
          criado_em?: string
          data_agendamento?: string
          grupo_prioridade?: Database["public"]["Enums"]["grupo_prioridade"]
          hora_agendamento?: string
          id?: string
          motivo_cancelamento?: string | null
          numero_senha?: string | null
          observacoes?: string | null
          pontuacao_prioridade?: number
          status?: Database["public"]["Enums"]["status_agendamento"]
          tipo_atendimento_id?: string
          unidade_id?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agendamentos_tipo_atendimento_id_fkey"
            columns: ["tipo_atendimento_id"]
            isOneToOne: false
            referencedRelation: "tipos_atendimento"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agendamentos_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agendamentos_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
        ]
      }
      fila: {
        Row: {
          agendamento_id: string
          atendimento_fim: string | null
          atendimento_inicio: string | null
          chamado_em: string | null
          criado_em: string
          id: string
          numero_guiche: number | null
          posicao: number
          unidade_id: string
        }
        Insert: {
          agendamento_id: string
          atendimento_fim?: string | null
          atendimento_inicio?: string | null
          chamado_em?: string | null
          criado_em?: string
          id?: string
          numero_guiche?: number | null
          posicao: number
          unidade_id: string
        }
        Update: {
          agendamento_id?: string
          atendimento_fim?: string | null
          atendimento_inicio?: string | null
          chamado_em?: string | null
          criado_em?: string
          id?: string
          numero_guiche?: number | null
          posicao?: number
          unidade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fila_agendamento_id_fkey"
            columns: ["agendamento_id"]
            isOneToOne: true
            referencedRelation: "agendamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fila_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      historico_atendimentos: {
        Row: {
          agendamento_id: string
          atendido_por: string | null
          criado_em: string
          data_atendimento: string
          duracao_minutos: number | null
          grupo_prioridade: Database["public"]["Enums"]["grupo_prioridade"]
          id: string
          status: Database["public"]["Enums"]["status_agendamento"]
          tempo_espera_minutos: number | null
          tipo_atendimento_id: string
          unidade_id: string
          usuario_id: string
        }
        Insert: {
          agendamento_id: string
          atendido_por?: string | null
          criado_em?: string
          data_atendimento: string
          duracao_minutos?: number | null
          grupo_prioridade?: Database["public"]["Enums"]["grupo_prioridade"]
          id?: string
          status: Database["public"]["Enums"]["status_agendamento"]
          tempo_espera_minutos?: number | null
          tipo_atendimento_id: string
          unidade_id: string
          usuario_id: string
        }
        Update: {
          agendamento_id?: string
          atendido_por?: string | null
          criado_em?: string
          data_atendimento?: string
          duracao_minutos?: number | null
          grupo_prioridade?: Database["public"]["Enums"]["grupo_prioridade"]
          id?: string
          status?: Database["public"]["Enums"]["status_agendamento"]
          tempo_espera_minutos?: number | null
          tipo_atendimento_id?: string
          unidade_id?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "historico_atendimentos_agendamento_id_fkey"
            columns: ["agendamento_id"]
            isOneToOne: false
            referencedRelation: "agendamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historico_atendimentos_atendido_por_fkey"
            columns: ["atendido_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historico_atendimentos_tipo_atendimento_id_fkey"
            columns: ["tipo_atendimento_id"]
            isOneToOne: false
            referencedRelation: "tipos_atendimento"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historico_atendimentos_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historico_atendimentos_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
        ]
      }
      horarios_funcionamento: {
        Row: {
          aberto: boolean
          abre_as: string
          dia_semana: number
          fecha_as: string
          id: string
          unidade_id: string
        }
        Insert: {
          aberto?: boolean
          abre_as: string
          dia_semana: number
          fecha_as: string
          id?: string
          unidade_id: string
        }
        Update: {
          aberto?: boolean
          abre_as?: string
          dia_semana?: number
          fecha_as?: string
          id?: string
          unidade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "horarios_funcionamento_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      notificacoes: {
        Row: {
          agendamento_id: string | null
          criado_em: string
          enviada_em: string | null
          id: string
          lida_em: string | null
          mensagem: string
          status: Database["public"]["Enums"]["status_notificacao"]
          titulo: string
          usuario_id: string
        }
        Insert: {
          agendamento_id?: string | null
          criado_em?: string
          enviada_em?: string | null
          id?: string
          lida_em?: string | null
          mensagem: string
          status?: Database["public"]["Enums"]["status_notificacao"]
          titulo: string
          usuario_id: string
        }
        Update: {
          agendamento_id?: string | null
          criado_em?: string
          enviada_em?: string | null
          id?: string
          lida_em?: string | null
          mensagem?: string
          status?: Database["public"]["Enums"]["status_notificacao"]
          titulo?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notificacoes_agendamento_id_fkey"
            columns: ["agendamento_id"]
            isOneToOne: false
            referencedRelation: "agendamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificacoes_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
        ]
      }
      perfis: {
        Row: {
          atualizado_em: string
          cpf: string | null
          criado_em: string
          data_nascimento: string | null
          grupo_prioridade: Database["public"]["Enums"]["grupo_prioridade"]
          id: string
          nome_completo: string
          perfil: Database["public"]["Enums"]["perfil_usuario"]
          telefone: string | null
          url_avatar: string | null
        }
        Insert: {
          atualizado_em?: string
          cpf?: string | null
          criado_em?: string
          data_nascimento?: string | null
          grupo_prioridade?: Database["public"]["Enums"]["grupo_prioridade"]
          id: string
          nome_completo: string
          perfil?: Database["public"]["Enums"]["perfil_usuario"]
          telefone?: string | null
          url_avatar?: string | null
        }
        Update: {
          atualizado_em?: string
          cpf?: string | null
          criado_em?: string
          data_nascimento?: string | null
          grupo_prioridade?: Database["public"]["Enums"]["grupo_prioridade"]
          id?: string
          nome_completo?: string
          perfil?: Database["public"]["Enums"]["perfil_usuario"]
          telefone?: string | null
          url_avatar?: string | null
        }
        Relationships: []
      }
      relatorios: {
        Row: {
          dados_extras: Json | null
          data_referencia: string
          gerado_em: string
          id: string
          media_duracao_minutos: number | null
          media_espera_minutos: number | null
          tipo_relatorio: Database["public"]["Enums"]["tipo_relatorio"]
          total_agendados: number
          total_atendidos: number
          total_cancelados: number
          total_nao_compareceu: number
          unidade_id: string
        }
        Insert: {
          dados_extras?: Json | null
          data_referencia: string
          gerado_em?: string
          id?: string
          media_duracao_minutos?: number | null
          media_espera_minutos?: number | null
          tipo_relatorio: Database["public"]["Enums"]["tipo_relatorio"]
          total_agendados?: number
          total_atendidos?: number
          total_cancelados?: number
          total_nao_compareceu?: number
          unidade_id: string
        }
        Update: {
          dados_extras?: Json | null
          data_referencia?: string
          gerado_em?: string
          id?: string
          media_duracao_minutos?: number | null
          media_espera_minutos?: number | null
          tipo_relatorio?: Database["public"]["Enums"]["tipo_relatorio"]
          total_agendados?: number
          total_atendidos?: number
          total_cancelados?: number
          total_nao_compareceu?: number
          unidade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "relatorios_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      tipos_atendimento: {
        Row: {
          ativo: boolean
          atualizado_em: string
          criado_em: string
          descricao: string | null
          duracao_media_minutos: number
          id: string
          nome: string
          unidade_id: string
          vagas_maximas_dia: number
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          descricao?: string | null
          duracao_media_minutos?: number
          id?: string
          nome: string
          unidade_id: string
          vagas_maximas_dia?: number
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          descricao?: string | null
          duracao_media_minutos?: number
          id?: string
          nome?: string
          unidade_id?: string
          vagas_maximas_dia?: number
        }
        Relationships: [
          {
            foreignKeyName: "tipos_atendimento_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      unidades: {
        Row: {
          ativa: boolean
          atualizado_em: string
          cidade: string | null
          criado_em: string
          descricao: string | null
          email: string | null
          endereco: string | null
          estado: string | null
          id: string
          nome: string
          plano: Database["public"]["Enums"]["tipo_plano"]
          plano_expira_em: string | null
          telefone: string | null
        }
        Insert: {
          ativa?: boolean
          atualizado_em?: string
          cidade?: string | null
          criado_em?: string
          descricao?: string | null
          email?: string | null
          endereco?: string | null
          estado?: string | null
          id?: string
          nome: string
          plano?: Database["public"]["Enums"]["tipo_plano"]
          plano_expira_em?: string | null
          telefone?: string | null
        }
        Update: {
          ativa?: boolean
          atualizado_em?: string
          cidade?: string | null
          criado_em?: string
          descricao?: string | null
          email?: string | null
          endereco?: string | null
          estado?: string | null
          id?: string
          nome?: string
          plano?: Database["public"]["Enums"]["tipo_plano"]
          plano_expira_em?: string | null
          telefone?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      chamar_notificar_fila: {
        Args: { p_unidade_id: string }
        Returns: undefined
      }
    }
    Enums: {
      grupo_prioridade:
        | "normal"
        | "idoso"
        | "gestante"
        | "deficiente"
        | "lactante"
        | "obeso"
      perfil_usuario: "usuario" | "administrador" | "super_administrador"
      status_agendamento:
        | "agendado"
        | "aguardando"
        | "em_atendimento"
        | "concluido"
        | "cancelado"
        | "nao_compareceu"
      status_notificacao: "pendente" | "enviada" | "lida"
      tipo_plano: "gratuito" | "premium"
      tipo_relatorio: "diario" | "mensal"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      grupo_prioridade: [
        "normal",
        "idoso",
        "gestante",
        "deficiente",
        "lactante",
        "obeso",
      ],
      perfil_usuario: ["usuario", "administrador", "super_administrador"],
      status_agendamento: [
        "agendado",
        "aguardando",
        "em_atendimento",
        "concluido",
        "cancelado",
        "nao_compareceu",
      ],
      status_notificacao: ["pendente", "enviada", "lida"],
      tipo_plano: ["gratuito", "premium"],
      tipo_relatorio: ["diario", "mensal"],
    },
  },
} as const
