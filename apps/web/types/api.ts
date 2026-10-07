export type ApiErrorPayload = {
  error?: {
    code?: string;
    message?: string;
  };
  message?: string | string[];
};
