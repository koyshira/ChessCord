import inquirer
import subprocess
import sys
import os

# Define colors
RED = '\033[1;31m'
GREEN = '\033[1;32m'
NC = '\033[0m'  # No Color

# Function to execute a command and handle exceptions
def execute_command(command):
    try:
        print(f"{GREEN}Executing {command} action...{NC}")
        subprocess.run(command.split(), check=True)
    except subprocess.CalledProcessError:
        print(f"{RED}Error executing {command} action.{NC}")

# Function to display the menu
def show_menu():
    os.system('clear')
    actions = {
        'Pull': 'git pull',
        'Deploy': 'node src/deploy.js',
        'Start': './node.sh',
        'Quit': None
    }

    questions = [
        inquirer.List('action',
                      message="Select an option:",
                      choices=list(actions.keys()),
                      default='Pull'),
    ]

    try:
        answers = inquirer.prompt(questions)
        selected_action = answers['action']

        if selected_action == 'Quit':
            print(f"Exiting script. {RED}Goodbye!{NC}")
            sys.exit()

        execute_command(actions[selected_action])

    except KeyboardInterrupt:
        show_menu()

if __name__ == "__main__":
    while True:
        show_menu()
