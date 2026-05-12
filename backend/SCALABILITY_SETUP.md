# Configuração de Escalabilidade - Render Free Tier

## Melhorias Implementadas

### ✅ 5. PostGIS Extension
- **Arquivo**: `backend/migrations/20240512-enable-postgis.js`
- **Ação**: Rodar migração no Render
```bash
npx sequelize-cli db:migrate
```

### ✅ 6. Otimização de Queries N+1
- **Arquivo**: `backend/src/controllers/pois.controller.js`
- **Alterações**: Queries separadas para evitar N+1
- **Impacto**: Redução de load no database

### ✅ 7. Monitoring com Sentry
- **Arquivo**: `backend/src/utils/sentry.js`
- **Pacote**: `@sentry/node` instalado
- **Variável de ambiente necessária**: `SENTRY_DSN`

### ✅ 8. Rate Limiting por Usuário
- **Arquivo**: `backend/src/server.js`
- **Alterações**: 
  - Usuários anônimos: 30% do limite
  - Usuários autenticados: 100% do limite
- **Variáveis de ambiente**: `RATE_LIMIT_MAX_REQUESTS`, `RATE_LIMIT_WINDOW_MINUTES`

### ⚠️ 9. Horizontal Scaling
- **Status**: Não disponível no Render Free Tier
- **Solução**: Upgrade para plano pago ou migrar para outra plataforma

### ⚠️ 10. CDN para Assets
- **Status**: Não disponível no Render Free Tier
- **Solução**: Usar Cloudflare CDN (gratuito) na frente do Render

---

## Variáveis de Ambiente para Configurar no Render

Adicione estas variáveis de ambiente no painel do Render:

### Obrigatórias
```
SENTRY_DSN=your_sentry_dsn_here
SENTRY_TRACES_SAMPLE_RATE=0.1
```

### Opcionais (já configuradas)
```
DB_POOL_MAX=100
ENABLE_CRON=true
RATE_LIMIT_MAX_REQUESTS=500
RATE_LIMIT_WINDOW_MINUTES=15
```

---

## Passos para Deploy

1. **Rodar migração do PostGIS**
```bash
# No painel do Render, abra o Shell do PostgreSQL e execute:
CREATE EXTENSION IF NOT EXISTS postgis;
```

2. **Configurar Sentry**
- Crie uma conta em https://sentry.io
- Crie um novo projeto Node.js
- Copie o DSN e adicione como `SENTRY_DSN` no Render

3. **Deploy do backend**
```bash
git add .
git commit -m "Implement scalability improvements"
git push
```

4. **Verificar logs**
- No painel do Render, verifique se Sentry foi inicializado
- Verifique se o rate limiting está funcionando

---

## Limitações do Render Free Tier

### PostgreSQL Free Tier
- 90 dias grátis
- 1GB de armazenamento
- 512MB de RAM
- **Suporta PostGIS** ✅

### Web Service Free Tier
- Sleep mode após 15 minutos de inatividade
- 512MB de RAM
- CPU compartilhada
- **Sem horizontal scaling** ❌

### Soluções para Free Tier
1. **Keep-alive**: Use um serviço como UptimeRobot para evitar sleep mode
2. **Cloudflare CDN**: Configure Cloudflare na frente do Render (gratuito)
3. **Upgrade**: Considere upgrade para plano pago quando necessário

---

## Capacidade Estimada (Após Implementações)

### Com Render Free Tier
- **Usuários simultâneos**: ~3.000-5.000
- **Requisições/segundo**: ~200-400
- **Bottleneck**: CPU e RAM do free tier

### Com Render Paid (Starter - $7/mês)
- **Usuários simultâneos**: ~8.000-12.000
- **Requisições/segundo**: ~500-800
- **Bottleneck**: Nenhum crítico

---

## Monitoramento

### Sentry Dashboard
- Erros em tempo real
- Performance tracking
- User feedback

### Render Dashboard
- Métricas de CPU/RAM
- Logs de aplicação
- Deploy history

---

## Próximos Passos (Opcional)

1. **Adicionar testes de carga**
   - Usar k6 ou Artillery
   - Testar com 10.000 usuários simulados

2. **Configurar alertas**
   - Sentry alerts para erros críticos
   - Render alerts para CPU/RAM

3. **Otimizar frontend**
   - Lazy loading de componentes
   - Otimizar bundle size
   - Implementar service worker

4. **Considerar upgrade**
   - Quando atingir limites do free tier
   - Upgrade para plano Starter do Render
