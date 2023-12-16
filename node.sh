#!/bin/bash

# Configurable parameters
SCRIPT_NAME="index.js"
NODE_EXECUTABLE="node"
SLEEP_INTERVAL_SECONDS=30

# Function to cleanup before exit
cleanup() {
    echo "Script terminated. Cleaning up..."
    pkill "$SCRIPT_NAME"
    exit 0
}

# Trap script termination
trap cleanup EXIT

# Initial message
echo "Starting $SCRIPT_NAME..."
$NODE_EXECUTABLE "$SCRIPT_NAME" &

while true; do
    if pgrep -f "$SCRIPT_NAME" > /dev/null; then
        :
    else
        echo "$(date): $SCRIPT_NAME is not running. Restarting..."
        $NODE_EXECUTABLE "$SCRIPT_NAME" &
        echo "$(date): Restarted $SCRIPT_NAME with PID $!."
    fi
    sleep $SLEEP_INTERVAL_SECONDS
done
