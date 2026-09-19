-- PontoFlow - adiciona o papel superadmin
-- Precisa rodar sozinho (ALTER TYPE ... ADD VALUE nao pode ser usado na mesma
-- transacao em que o valor e lido).

alter type user_role add value if not exists 'superadmin';
