#!/bin/bash

# Test script for the example chatbot
# This ensures the example runs correctly before publishing

set -e

echo "🧪 Testing Dhiya Example Chatbot..."
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Step 1: Build the package
echo -e "${BLUE}📦 Step 1: Building dhiya-npm package...${NC}"
npm run build
echo -e "${GREEN}✓ Package built successfully${NC}"
echo ""

# Step 2: Install example dependencies
echo -e "${BLUE}📥 Step 2: Installing example dependencies...${NC}"
cd example
npm install
echo -e "${GREEN}✓ Dependencies installed${NC}"
echo ""

# Step 3: Run TypeScript check
echo -e "${BLUE}🔍 Step 3: Type checking example...${NC}"
npx tsc --noEmit
echo -e "${GREEN}✓ No TypeScript errors${NC}"
echo ""

# Step 4: Build example
echo -e "${BLUE}🏗️  Step 4: Building example...${NC}"
npm run build
echo -e "${GREEN}✓ Example built successfully${NC}"
echo ""

echo -e "${GREEN}✅ All tests passed!${NC}"
echo ""
echo "To run the example:"
echo "  cd example"
echo "  npm run dev"
echo ""
echo "Then open http://localhost:3000 in your browser"
