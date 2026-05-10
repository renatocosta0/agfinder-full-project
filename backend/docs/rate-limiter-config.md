# Configuração do Rate Limiter com Redis

Este documento descreve como configurar e utilizar o rate limiter baseado em Redis implementado no AGFINDER.

## Visão Geral

O AGFINDER utiliza `express-rate-limit` integrado com `rate-limit-redis` para implementar limitação de requisições à API. Esta implementação:

- Usa Redis como armazenamento para contadores de requisições
- É configurável via banco de dados
- Suporta limitações específicas para diferentes tipos de endpoints
- Fornece mensagens de erro personalizadas

## Pré-requisitos

- Instância Redis em execução
- Banco de dados PostgreSQL configurado com tabela `settings`

## Configuração

### Variáveis de Ambiente

Configurar as seguintes variáveis em seu arquivo `.env` ou `.env-docker`:

```
# Redis
REDIS_HOST=localhost     # Host do Redis
REDIS_PORT=6379          # Porta do Redis
REDIS_PASSWORD=          # Senha do Redis (se aplicável)
REDIS_DB=0               # Banco de dados principal do Redis
REDIS_RATE_LIMIT_DB=1    # Banco de dados para rate limit (preferencialmente separado)
```

### Migração de Banco de Dados

Para configurar a tabela `settings` com os valores padrão do rate limiter:

```bash
node src/scripts/migrateRateLimiter.js
```

## Limitadores Disponíveis

O middleware implementa diferentes limitadores para diferentes contextos:

1. **apiLimiter**: Limita todas as requisições à API
   - Padrão: 500 requisições por 15 minutos
   
2. **contributionLimiter**: Limita requisições de contribuição
   - Padrão: 20 requisições por hora
   
3. **authLimiter**: Limita tentativas de autenticação
   - Padrão: 10 requisições por hora
   
4. **adminLimiter**: Limita acesso às funcionalidades de administração
   - Padrão: 100 requisições por hora

## Personalização via Banco de Dados

Os limitadores podem ser personalizados atualizando os seguintes registros na tabela `settings`:

| Chave | Descrição | Valor Padrão |
|-------|-----------|--------------|
| `rate_limit.api.window_ms` | Janela de tempo para API em ms | 900000 (15 min) |
| `rate_limit.api.max_requests` | Máximo de requisições por janela | 500 |
| `rate_limit.contribution.window_ms` | Janela para contribuições | 3600000 (1h) |
| `rate_limit.contribution.max_requests` | Máximo para contribuições | 20 |
| `rate_limit.auth.window_ms` | Janela para autenticação | 3600000 (1h) |
| `rate_limit.auth.max_requests` | Máximo para autenticação | 10 |
| `rate_limit.admin.window_ms` | Janela para admin | 3600000 (1h) |
| `rate_limit.admin.max_requests` | Máximo para admin | 100 |
| `rate_limit.redis.prefix` | Prefixo das chaves no Redis | rl: |
| `rate_limit.redis.expiry` | Tempo de expiração em segundos | 900 (15 min) |

### Atualização de Configurações

Para atualizar via SQL:

```sql
UPDATE settings SET value = '1000' WHERE key = 'rate_limit.api.max_requests';
```

Para atualizar via API (se implementada):

```
POST /api/admin/settings
{
  "key": "rate_limit.api.max_requests",
  "value": "1000"
}
```

## Implementação em Rotas

Para usar os limitadores nas rotas:

```javascript
const { apiLimiter, contributionLimiter } = require('../middleware/rateLimit.middleware');

// Aplicar limitador à API geral
router.use(apiLimiter);

// Aplicar limitadores específicos
router.post('/contributions', contributionLimiter, contributionsController.create);
router.post('/auth/login', authLimiter, authController.login);
router.use('/admin', adminLimiter, adminRoutes);
```

## Monitoramento

As violações de limite são registradas no log do sistema. Para monitorar utilizações:

1. Verifique os logs do servidor
2. Monitore o Redis usando ferramentas como `redis-cli` ou RedisInsight
3. Execute o seguinte comando no Redis para ver contadores ativos:

```
KEYS rl:*
```

## Solução de Problemas

### Conexão com Redis Falha

Se a conexão com Redis falhar, o middleware recorre à implementação em memória, porém sem compartilhamento entre instâncias. Verifique:

- Configurações de conexão Redis
- Acessibilidade do servidor Redis
- Permissões e autenticação

### Limites Não Estão Sendo Aplicados

Se os limites não parecem estar sendo aplicados:

1. Confirme que o middleware está corretamente registrado nas rotas
2. Verifique se o Redis está funcionando corretamente
3. Certifique-se de que as chaves de configuração existem no banco de dados

## Considerações de Segurança

- Recomenda-se usar um banco de dados Redis separado para rate limiting
- Proteja a conexão Redis com autenticação em ambientes de produção
- Considere adicionar proteções adicionais como WAF para mitigar ataques DDoS 