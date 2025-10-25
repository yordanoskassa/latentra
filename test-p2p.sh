#!/bin/bash

# LocalAI P2P Simulation Script
# This script starts multiple LocalAI instances on a single machine to simulate distributed inference

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}================================${NC}"
echo -e "${BLUE}LocalAI P2P Simulation Setup${NC}"
echo -e "${BLUE}================================${NC}\n"

# Configuration
MODEL_DIR="$(pwd)/test-models"
INSTANCE_1_PORT=8080
INSTANCE_2_PORT=8081
INSTANCE_3_PORT=8082
P2P_PORT_1=9000
P2P_PORT_2=9001
P2P_PORT_3=9002

# Create test models directory if it doesn't exist
mkdir -p "$MODEL_DIR"

echo -e "${YELLOW}Model directory: ${MODEL_DIR}${NC}"
echo -e "${YELLOW}This will start 3 LocalAI instances:${NC}"
echo -e "  - Instance 1: API=${INSTANCE_1_PORT}, P2P=${P2P_PORT_1} (coordinator)"
echo -e "  - Instance 2: API=${INSTANCE_2_PORT}, P2P=${P2P_PORT_2} (peer)"
echo -e "  - Instance 3: API=${INSTANCE_3_PORT}, P2P=${P2P_PORT_3} (peer)\n"

# Check if LocalAI is installed
if ! command -v local-ai &> /dev/null; then
    echo -e "${YELLOW}LocalAI not found. Installing...${NC}"
    curl https://localai.io/install.sh | sh
fi

# Kill any existing instances
echo -e "${YELLOW}Cleaning up any existing LocalAI processes...${NC}"
pkill -f "local-ai" || true
sleep 2

# Start Instance 1 (Coordinator)
echo -e "\n${GREEN}Starting Instance 1 (Coordinator)...${NC}"
local-ai \
  --address 0.0.0.0:${INSTANCE_1_PORT} \
  --models-path "${MODEL_DIR}" \
  --context-size 2048 \
  --threads 4 \
  --p2p \
  --p2p-listen-port ${P2P_PORT_1} \
  > /tmp/localai-instance1.log 2>&1 &
INSTANCE_1_PID=$!
echo "Instance 1 PID: ${INSTANCE_1_PID}"

# Wait for Instance 1 to start
sleep 3

# Start Instance 2 (Peer)
echo -e "${GREEN}Starting Instance 2 (Peer)...${NC}"
local-ai \
  --address 0.0.0.0:${INSTANCE_2_PORT} \
  --models-path "${MODEL_DIR}" \
  --context-size 2048 \
  --threads 4 \
  --p2p \
  --p2p-listen-port ${P2P_PORT_2} \
  --p2p-peer-address localhost:${P2P_PORT_1} \
  > /tmp/localai-instance2.log 2>&1 &
INSTANCE_2_PID=$!
echo "Instance 2 PID: ${INSTANCE_2_PID}"

# Wait for Instance 2 to connect
sleep 3

# Start Instance 3 (Peer)
echo -e "${GREEN}Starting Instance 3 (Peer)...${NC}"
local-ai \
  --address 0.0.0.0:${INSTANCE_3_PORT} \
  --models-path "${MODEL_DIR}" \
  --context-size 2048 \
  --threads 4 \
  --p2p \
  --p2p-listen-port ${P2P_PORT_3} \
  --p2p-peer-address localhost:${P2P_PORT_1} \
  > /tmp/localai-instance3.log 2>&1 &
INSTANCE_3_PID=$!
echo "Instance 3 PID: ${INSTANCE_3_PID}"

# Wait for all instances to initialize
sleep 3

echo -e "\n${GREEN}================================${NC}"
echo -e "${GREEN}All instances started!${NC}"
echo -e "${GREEN}================================${NC}\n"

echo -e "${BLUE}Instance URLs:${NC}"
echo -e "  - Instance 1: http://localhost:${INSTANCE_1_PORT}"
echo -e "  - Instance 2: http://localhost:${INSTANCE_2_PORT}"
echo -e "  - Instance 3: http://localhost:${INSTANCE_3_PORT}"

echo -e "\n${BLUE}Log files:${NC}"
echo -e "  - Instance 1: /tmp/localai-instance1.log"
echo -e "  - Instance 2: /tmp/localai-instance2.log"
echo -e "  - Instance 3: /tmp/localai-instance3.log"

echo -e "\n${BLUE}Test commands:${NC}"
echo -e "  # Check Instance 1 status:"
echo -e "  curl http://localhost:${INSTANCE_1_PORT}/v1/models"
echo -e "\n  # Send a test request (after loading a model):"
echo -e "  curl http://localhost:${INSTANCE_1_PORT}/v1/chat/completions -H 'Content-Type: application/json' -d '{"
echo -e "    \"model\": \"tinyllama\","
echo -e "    \"messages\": [{\"role\": \"user\", \"content\": \"Hello!\"}]"
echo -e "  }'"

echo -e "\n${YELLOW}To stop all instances, run: pkill -f 'local-ai'${NC}"
echo -e "${YELLOW}Or press Ctrl+C if running in foreground${NC}\n"

# Keep script running
echo -e "${GREEN}Press Ctrl+C to stop all instances${NC}"
wait


