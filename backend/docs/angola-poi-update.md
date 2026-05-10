# Angola POI Weekly Update Process

Este documento descreve o processo automatizado de atualização semanal dos Pontos de Interesse (POIs) de Angola implementado no AGFINDER.

## Visão Geral

O sistema implementa um job cron que executa semanalmente às 3:00 da manhã (horário de Angola) toda segunda-feira. Este processo:

1. Deleta todos os POIs existentes de Angola do banco de dados
2. Importa dados frescos de POIs para Angola 
3. Preserva métricas históricas de interação com os POIs

## Novas Métricas de Interação

Foram adicionados novos campos para rastrear as interações dos usuários com os POIs:

- `contributions`: Total de contribuições feitas para o POI
- `validations`: Total de validações positivas recebidas
- `reports`: Total de reportes/denúncias recebidas
- `total_interactions`: Soma total de todas as interações (soma dos três campos acima)

Estes campos permitem análises estatísticas sobre quais POIs recebem mais interação dos usuários.

## Configuração do Processo

O job cron é configurado em `src/jobs/cron.js` e executa às 3:00 da manhã todas as segundas-feiras. Este horário foi escolhido por ser de baixo tráfego no sistema, minimizando o impacto para os usuários.

Para modificar a programação, edite a expressão cron no arquivo `src/jobs/cron.js`:

```javascript
// Weekly Angola POIs update at 3 AM every Monday
cron.schedule('0 3 * * 1', async () => {
  // Job implementation
});
```

## Execução Manual

Para executar o processo manualmente (por exemplo, em ambientes de teste ou para atualização imediata):

```bash
# Via script NPM
npm run script updateAngolaPOIs

# Ou diretamente
node -e "require('./src/scripts/updateAngolaPOIs')()"
```

## Logs e Monitoramento

O processo gera logs detalhados que são armazenados no formato padrão do sistema. Importante monitorar:

- Logs de início e término do processo
- Quantidade de POIs deletados e importados
- Erros durante a execução

Um registro de sincronização também é criado na tabela `sync_logs` com os detalhes de cada execução.

## Implementação Técnica

O processo consiste em três partes principais:

1. **Coleta de Métricas Antes da Exclusão**: Antes de excluir os POIs, o sistema coleta estatísticas sobre as interações existentes.

2. **Exclusão de POIs Existentes**: Remove todos os POIs dentro das coordenadas geográficas de Angola.

3. **Importação de Novos Dados**: Cria novos POIs com dados atualizados para Angola.

## Migrate para Novos Campos

Para adicionar os novos campos de métricas ao banco de dados, execute:

```bash
npm run migration:interactions
```

Esta migração adiciona os campos necessários e cria os índices apropriados.

## Considerações de Desempenho

- O processo completo leva aproximadamente 30-60 segundos, dependendo da quantidade de dados
- Durante este período, os POIs de Angola podem ficar temporariamente indisponíveis
- O job é executado em horário de baixo tráfego para minimizar impacto

## Troubleshooting

Se o processo falhar:

1. Verifique os logs de erro em `logs/error.log`
2. Verifique o registro na tabela `sync_logs` para detalhes da falha
3. Para reexecutar manualmente, siga as instruções na seção "Execução Manual"

Para interromper temporariamente as atualizações semanais, comente o trecho relevante em `src/jobs/cron.js`. 