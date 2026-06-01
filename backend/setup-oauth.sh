#!/bin/bash

# K-TRASH Google OAuth Setup Script
# Automated setup helper for development environment

echo "🚀 K-TRASH Google OAuth Setup Script"
echo "===================================="

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_step() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC}  $1"
}

print_error() {
    echo -e "${RED}✗${NC}  $1"
}

# Check Node.js
echo -e "\n${YELLOW}Checking prerequisites...${NC}"
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    print_step "Node.js detected: $NODE_VERSION"
else
    print_error "Node.js not found. Please install Node.js v14 or higher."
    exit 1
fi

# Check npm
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm -v)
    print_step "npm detected: v$NPM_VERSION"
else
    print_error "npm not found."
    exit 1
fi

# Check MySQL
if command -v mysql &> /dev/null; then
    print_step "MySQL detected"
else
    print_warning "MySQL not in PATH. Please ensure MySQL is installed."
fi

# Install Backend Dependencies
echo -e "\n${YELLOW}Installing backend dependencies...${NC}"
cd K-TRASHPBL/backend

if [ ! -d "node_modules" ]; then
    npm install
    if [ $? -eq 0 ]; then
        print_step "Backend dependencies installed"
    else
        print_error "Failed to install backend dependencies"
        exit 1
    fi
else
    print_warning "node_modules already exists in backend"
fi

# Check if google-auth-library is installed
if npm list google-auth-library > /dev/null 2>&1; then
    print_step "google-auth-library found"
else
    print_warning "Installing google-auth-library..."
    npm install google-auth-library
fi

# Install Frontend Dependencies
echo -e "\n${YELLOW}Installing frontend dependencies...${NC}"
cd ../pundesari

if [ ! -d "node_modules" ]; then
    npm install
    if [ $? -eq 0 ]; then
        print_step "Frontend dependencies installed"
    else
        print_error "Failed to install frontend dependencies"
        exit 1
    fi
else
    print_warning "node_modules already exists in frontend"
fi

# Check environment files
echo -e "\n${YELLOW}Checking environment files...${NC}"

if [ -f "../backend/.env" ]; then
    print_step "Backend .env found"
else
    print_error "Backend .env not found"
fi

if [ -f ".env" ]; then
    print_step "Frontend .env found"
else
    print_error "Frontend .env not found"
fi

# Summary
echo -e "\n${GREEN}Setup Complete!${NC}"
echo ""
echo "📝 Next steps:"
echo ""
echo "1️⃣  Database Migration:"
echo "   mysql -u root -p bank_sampah < ../backend/google_oauth_migration.sql"
echo ""
echo "2️⃣  Update Google Cloud Console:"
echo "   - Add http://localhost:3000 to Authorized Origins"
echo "   - Add http://localhost:3000 to Authorized Redirect URIs"
echo "   - Copy Client ID to GOOGLE_CLIENT_ID in .env files"
echo ""
echo "3️⃣  Start Backend (Terminal 1):"
echo "   cd K-TRASHPBL/backend"
echo "   npm run dev"
echo ""
echo "4️⃣  Start Frontend (Terminal 2):"
echo "   cd K-TRASHPBL/pundesari"
echo "   npm start"
echo ""
echo "5️⃣  Test Google Login:"
echo "   - Open http://localhost:3000"
echo "   - Click Login"
echo "   - Click Google Login button"
echo "   - Select your Google account"
echo ""
echo "📖 Full guide: cat ../GOOGLE_OAUTH_IMPLEMENTATION_GUIDE.md"
echo ""
