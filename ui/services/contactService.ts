import { z } from "zod";
import { api } from "./apiClient";

export const contactSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(120),
  email: z.string().email("Invalid email address").max(200),
  subject: z.string().min(2, "Subject must be at least 2 characters").max(160),
  message: z.string().min(5, "Message must be at least 5 characters").max(5000),
});

export type ContactFormData = z.infer<typeof contactSchema>;

export const sendContactMessage = async (data: ContactFormData) => {
  // Uses apiClient so it respects VITE_API_URL and sends auth token if present.
  return api.post<{ ok: boolean; id: string }>("/auth/contact", data);
};
