#!/bin/bash
set -e

echo "Limpando cache Redis..."

# Opção 1: Limpar todo o cache
if [ "$1" == "all" ]; then
    docker compose exec redis redis-cli FLUSHALL
    echo "Cache Redis completamente limpo."
# Opção 2: Limpar apenas cache de POIs
elif [ "$1" == "pois" ]; then
    docker compose exec redis redis-cli --scan --pattern "pois:*" | xargs -r docker compose exec -T redis redis-cli DEL
    docker compose exec redis redis-cli --scan --pattern "poi:detail:*" | xargs -r docker compose exec -T redis redis-cli DEL
    echo "Cache de POIs limpo."
# Opção 3: Limpar cache por padrão específico
elif [ "$1" == "pattern" ] && [ ! -z "$2" ]; then
    docker compose exec redis redis-cli --scan --pattern "$2" | xargs -r docker compose exec -T redis redis-cli DEL
    echo "Cache com padrão '$2' limpo."
# Ajuda
else
    echo "Uso: $0 [opção] [padrão]"
    echo "Opções:"
    echo "  all                  - Limpa todo o cache Redis"
    echo "  pois                 - Limpa apenas o cache de POIs"
    echo "  pattern [padrão]     - Limpa cache que corresponde ao padrão específico"
    echo ""
    echo "Exemplos:"
    echo "  $0 all"
    echo "  $0 pois"
    echo "  $0 pattern \"user:*\""
    exit 1
fi

echo "Operação concluída." 
