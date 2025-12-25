#!/bin/bash
# Supabase Secrets Setup Script for Bash/Linux/Mac
# This script helps manage Edge Function secrets for different environments

set -e

ENVIRONMENT="${1:-dev}"
ACTION="${2:-set}"

show_help() {
    cat << EOF
Supabase Edge Functions Secrets Management

USAGE:
    ./supabase-secrets-setup.sh [ENVIRONMENT] [ACTION]

ENVIRONMENT:
    dev         Development environment (default)
    staging     Staging environment
    production  Production environment

ACTION:
    set         Set secrets from .env file (default)
    list        List all current secrets

EXAMPLES:
    # List all secrets
    ./supabase-secrets-setup.sh dev list

    # Set secrets for development
    ./supabase-secrets-setup.sh dev

    # Set secrets for production
    ./supabase-secrets-setup.sh production

NOTES:
    - Ensure you have Supabase CLI installed: npm install -g supabase
    - Ensure you're logged in: supabase login
    - Ensure you're linked to your project: supabase link --project-ref <your-ref>
    - Never commit .env files to version control
EOF
}

list_secrets() {
    echo ""
    echo "📋 Listing all Edge Function secrets..."
    echo ""
    supabase secrets list || {
        echo ""
        echo "❌ Error: Failed to list secrets. Ensure you're logged in and linked to your project."
        echo "   Run: supabase login"
        echo "   Run: supabase link --project-ref <your-project-ref>"
        echo ""
        exit 1
    }
}

set_secrets_from_file() {
    local env_file="$1"
    
    if [ ! -f "$env_file" ]; then
        echo ""
        echo "❌ Error: Environment file not found: $env_file"
        echo "   Create the file first or use the example: supabase/functions/.env.example"
        echo ""
        exit 1
    fi
    
    echo ""
    echo "🔐 Setting secrets from $env_file..."
    echo ""
    supabase secrets set --env-file "$env_file" || {
        echo ""
        echo "❌ Error: Failed to set secrets. Check your Supabase CLI connection."
        echo ""
        exit 1
    }
    
    echo ""
    echo "✅ Secrets set successfully!"
    echo ""
}

# Main execution
if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
    show_help
    exit 0
fi

# Determine environment file
case "$ENVIRONMENT" in
    dev)
        ENV_FILE="supabase/functions/.env.local"
        ;;
    staging)
        ENV_FILE="supabase/functions/.env.staging"
        ;;
    production)
        ENV_FILE="supabase/functions/.env.production"
        ;;
    *)
        echo "❌ Error: Invalid environment: $ENVIRONMENT"
        echo "   Valid options: dev, staging, production"
        exit 1
        ;;
esac

echo ""
echo "🚀 Supabase Edge Functions Secrets Setup"
echo ""
echo "Environment: $ENVIRONMENT"
echo "Environment file: $ENV_FILE"
echo ""

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Error: Supabase CLI not found!"
    echo "   Install it with: npm install -g supabase"
    echo ""
    exit 1
fi

# Execute action
case "$ACTION" in
    list)
        list_secrets
        ;;
    set)
        set_secrets_from_file "$ENV_FILE"
        ;;
    *)
        echo "❌ Error: Invalid action: $ACTION"
        echo "   Valid options: set, list"
        exit 1
        ;;
esac

