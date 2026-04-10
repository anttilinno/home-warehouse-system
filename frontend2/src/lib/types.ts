export interface User {
  id: string;
  email: string;
  full_name: string;
  has_password: boolean;
  is_active: boolean;
  date_format: string;
  time_format: string;
  thousand_separator: string;
  decimal_separator: string;
  language: string;
  theme: string;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuthTokenResponse {
  token: string;
  refresh_token: string;
}

export interface RegisterData {
  email: string;
  password: string;
  full_name: string;
  language?: string;
}

export interface ApiError {
  message?: string;
  detail?: string;
  code?: string;
}
