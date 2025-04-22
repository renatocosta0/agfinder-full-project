FROM node:18-alpine

WORKDIR /app

# Copiando os arquivos de dependências
COPY package*.json ./

# Instalando dependências
RUN npm install

# Copiando o restante do código-fonte
COPY . .

# Expor a porta da aplicação
EXPOSE 3000

# Definir variáveis de ambiente (podem ser sobrescritas via docker-compose)
ENV NODE_ENV=development
ENV PORT=3000

# Iniciar o servidor
CMD ["npm", "start"] 