// Database types for Supabase
// In production, these would be generated from the database schema

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      zoning_docs: {
        Row: {
          id: string;
          slug: string;
          city_name: string;
          code_name: string;
          region: string | null;
          source_url: string;
          is_featured: boolean;
          source_type: string;
          status: string;
          error_message: string | null;
          chunk_count: number;
          last_crawled_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          city_name: string;
          code_name: string;
          region?: string | null;
          source_url: string;
          is_featured?: boolean;
          source_type?: string;
          status?: string;
          error_message?: string | null;
          chunk_count?: number;
          last_crawled_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          city_name?: string;
          code_name?: string;
          region?: string | null;
          source_url?: string;
          is_featured?: boolean;
          source_type?: string;
          status?: string;
          error_message?: string | null;
          chunk_count?: number;
          last_crawled_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      zoning_embeddings: {
        Row: {
          id: number;
          doc_id: string;
          chunk_index: number;
          content: string;
          section_ref: string | null;
          token_count: number | null;
          embedding: number[] | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          doc_id: string;
          chunk_index: number;
          content: string;
          section_ref?: string | null;
          token_count?: number | null;
          embedding?: number[] | null;
          created_at?: string;
        };
        Update: {
          id?: number;
          doc_id?: string;
          chunk_index?: number;
          content?: string;
          section_ref?: string | null;
          token_count?: number | null;
          embedding?: number[] | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "zoning_embeddings_doc_id_fkey";
            columns: ["doc_id"];
            referencedRelation: "zoning_docs";
            referencedColumns: ["id"];
          }
        ];
      };
      preapproval_requests: {
        Row: {
          id: string;
          doc_id: string;
          city_name: string;
          user_input: Json;
          site_plan_metadata: Json | null;
          packet_summary: string | null;
          packet_full: Json | null;
          overall_risk: string | null;
          status: string;
          error_message: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          doc_id: string;
          city_name: string;
          user_input?: Json;
          site_plan_metadata?: Json | null;
          packet_summary?: string | null;
          packet_full?: Json | null;
          overall_risk?: string | null;
          status?: string;
          error_message?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          doc_id?: string;
          city_name?: string;
          user_input?: Json;
          site_plan_metadata?: Json | null;
          packet_summary?: string | null;
          packet_full?: Json | null;
          overall_risk?: string | null;
          status?: string;
          error_message?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "preapproval_requests_doc_id_fkey";
            columns: ["doc_id"];
            referencedRelation: "zoning_docs";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      match_zoning_sections: {
        Args: {
          query_embedding: number[];
          match_doc_id: string;
          match_count?: number;
          match_threshold?: number;
        };
        Returns: {
          id: number;
          doc_id: string;
          chunk_index: number;
          content: string;
          section_ref: string | null;
          similarity: number;
        }[];
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
