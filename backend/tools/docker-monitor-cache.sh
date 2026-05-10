#!/bin/bash
set -e

echo "Monitorando Redis Cache..."

# Opção 1: Mostrar estatísticas de uso
if [ "$1" == "stats" ]; then
    echo "Estatísticas de uso do Redis:"
    docker compose exec redis redis-cli INFO | grep -E "used_memory|connected_clients|keyspace"
    
    # Contar total de chaves
    echo ""
    echo "Total de chaves por padrão:"
    echo "POIs (pois:*): $(docker compose exec redis redis-cli --scan --pattern "pois:*" | wc -l)"
    echo "Detalhes de POI (poi:detail:*): $(docker compose exec redis redis-cli --scan --pattern "poi:detail:*" | wc -l)"
    echo "Páginas (pois:page:*): $(docker compose exec redis redis-cli --scan --pattern "pois:page:*" | wc -l)"

# Opção 2: Listar todas as chaves 
elif [ "$1" == "keys" ]; then
    if [ ! -z "$2" ]; then
        echo "Listando chaves com padrão: $2"
        docker compose exec redis redis-cli --scan --pattern "$2" | sort
    else
        echo "Listando todas as chaves (limitado a 100):"
        docker compose exec redis redis-cli --scan --pattern "*" | sort | head -n 100
        
        TOTAL=$(docker compose exec redis redis-cli --scan --pattern "*" | wc -l)
        if [ $TOTAL -gt 100 ]; then
            echo "... e mais $(($TOTAL - 100)) chaves (total: $TOTAL)"
        fi
    fi

# Opção 3: Monitor em tempo real
elif [ "$1" == "live" ]; then
    echo "Monitorando comandos Redis em tempo real. Pressione Ctrl+C para sair."
    docker compose exec redis redis-cli MONITOR

# Opção 4: Verificar tamanho das chaves
elif [ "$1" == "size" ]; then
    if [ ! -z "$2" ]; then
        echo "Obtendo tamanho de chave: $2"
        echo "Tipo: $(docker compose exec redis redis-cli TYPE "$2")"
        
        # Verificar o tipo da chave e mostrar tamanho apropriado
        KEY_TYPE=$(docker compose exec redis redis-cli TYPE "$2")
        if [ "$KEY_TYPE" == "string" ]; then
            echo "Tamanho (bytes): $(docker compose exec redis redis-cli MEMORY USAGE "$2")"
        elif [ "$KEY_TYPE" == "hash" ]; then
            echo "Número de campos: $(docker compose exec redis redis-cli HLEN "$2")"
        elif [ "$KEY_TYPE" == "list" ]; then
            echo "Número de elementos: $(docker compose exec redis redis-cli LLEN "$2")"
        elif [ "$KEY_TYPE" == "set" ]; then
            echo "Número de membros: $(docker compose exec redis redis-cli SCARD "$2")"
        elif [ "$KEY_TYPE" == "zset" ]; then
            echo "Número de membros: $(docker compose exec redis redis-cli ZCARD "$2")"
        fi
    else
        echo "Erro: É necessário especificar uma chave."
        echo "Exemplo: $0 size \"pois:atm:123\""
        exit 1
    fi

# Ajuda
else
    echo "Uso: $0 [opção] [argumento]"
    echo "Opções:"
    echo "  stats                - Mostrar estatísticas de uso do Redis"
    echo "  keys [padrão]        - Listar chaves (opcionalmente filtradas por padrão)"
    echo "  live                 - Monitorar comandos Redis em tempo real"
    echo "  size [chave]         - Verificar tamanho/informações de uma chave específica"
    echo ""
    echo "Exemplos:"
    echo "  $0 stats"
    echo "  $0 keys \"pois:*\""
    echo "  $0 live"
    echo "  $0 size \"pois:atm:-8.838_13.234_5km\""
    exit 1
fi 
