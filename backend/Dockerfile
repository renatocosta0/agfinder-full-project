FROM node:18-alpine

WORKDIR /app

# Instalar dependências do sistema
RUN apk add --no-cache python3 make g++ curl netcat-openbsd

# Definir variáveis de ambiente padrão
ENV NODE_ENV=production
ENV PORT=3001

# Copiar package.json e instalar dependências
COPY package*.json ./
RUN npm install --production

# Copiar o restante dos arquivos da aplicação
COPY . .

# Verificação de saúde será feita via HEALTHCHECK inline (sem script externo)

# Expor a porta
EXPOSE 3001

# Comando para iniciar o servidor
CMD ["npm", "start"]

# Verificação de saúde
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 CMD curl -f http://localhost:3001/health || exit 1 