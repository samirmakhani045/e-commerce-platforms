export interface AuthUser {
  id: string;
  email: string;
  role: 'customer' | 'admin';
  firstName: string;
  lastName: string;
}

export interface LoginResponse {
  success: boolean;
  message: string;
  data: {
    token: string;
    user: AuthUser;
  };
}
