import z from "zod";
import { User } from "@/generated/prisma/client";

export const UserSchema = z.object({
  name: z.string().min(2, "O nome deve ter pelo menos 2 caracteres"),
  email: z.email("Insira um e-mail válido"),
  password: z.string().min(6, "A senha deve ter no mínimo 6 caracteres"),
  image: z.string().optional(),
});

export const login = z.object({
  email: z.email(),
  password: z.string().min(8),
});

export type ContatoLista = {
  id: string;
  tipo: number;
  rede_url: string;
};

export type UserForm = z.infer<typeof UserSchema>;

export type UsuarioSemSenha = Omit<User, "password">;