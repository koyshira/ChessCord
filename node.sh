#!/bin/bash

# Configurable parameters with defaults
SCRIPT_NAME="${1:-index.js}"
NODE_EXECUTABLE="node"
SLEEP_INTERVAL_SECONDS="${2:-30}"
LOG_FOLDER="logs"
PID_FILE="$LOG_FOLDER/script.pid"

# Get current date
DATE=$(date '+%Y-%m-%d')

# Make a log file with the current date
LOG_FILE="$DATE.log"

# ANSI color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to cleanup before exit
cleanup() {
    echo -e "\n${RED}Script terminated. Cleaning up...\n${NC}"
    if [ -f "$PID_FILE" ]; then
        pid=$(cat "$PID_FILE")
        pkill -P $pid
        rm "$PID_FILE"
        sleep 1
    fi
    exit 0
}

# Trap script termination
trap cleanup EXIT

# Function to log messages to console and file
log() {
    local message="$1"
    local log_file="$LOG_FOLDER/$LOG_FILE"

    # Append both stdout and stderr to the log file
    {
        echo -e "$(date): " "$message"
    } | tee -a "$log_file"
}

# Check if Node.js executable is available
if ! command -v "$NODE_EXECUTABLE" &> /dev/null; then
    log "${RED}Node.js executable not found. Please install Node.js.${NC}"
    exit 1
fi

# Check if the script file exists
if [ ! -f "$SCRIPT_NAME" ]; then
    log "${RED}Script file '$SCRIPT_NAME' not found.${NC}"
    exit 1
fi

# Initial message
log "${GREEN}Script starting: $SCRIPT_NAME${NC}"
$NODE_EXECUTABLE "$SCRIPT_NAME" 2>&1 | tee -a "$LOG_FOLDER/$LOG_FILE" &
log "${GREEN}Started $SCRIPT_NAME with PID $!.${NC}"

echo $! > "$PID_FILE"

while true; do
    if pgrep -f "$SCRIPT_NAME" > /dev/null; then
        :
    else
        log "${RED}$SCRIPT_NAME is not running. Restarting...${NC}"
        $NODE_EXECUTABLE "$SCRIPT_NAME" 2>&1 | tee -a "$LOG_FOLDER/$LOG_FILE" &
        log "${GREEN}Restarted $SCRIPT_NAME with PID $!.${NC}"
        echo $! > "$PID_FILE"
    fi
    sleep "$SLEEP_INTERVAL_SECONDS"
done
