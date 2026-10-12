import { world, system, Player, CommandPermissionLevel, BeforeChatEvent } from '@minecraft/server';

/**
 * Represents a custom command definition.
 */
export interface CustomCommand {
    /** The name of the command (e.g., "inspect" for /inspect). */
    name: string;
    /** A brief description of the command. */
    description: string;
    /** The minimum permission level required to execute this command. */
    permissionLevel: CommandPermissionLevel;
    /** The function to execute when the command is triggered. */
    callback: (player: Player, args: string[], event: BeforeChatEvent) => void;
    /** Optional: How to use the command (e.g., "/inspect <target>"). */
    usage?: string;
}

/**
 * Manages custom slash commands by intercepting chat messages.
 */
class CommandManager {
    private commands: Map<string, CustomCommand> = new Map();
    private initialized: boolean = false;

    /**
     * Initializes the command manager by subscribing to chat events.
     * This should only be called once during startup.
     */
    public initialize() {
        if (this.initialized) {
            console.warn("CommandManager already initialized.");
            return;
        }

        world.beforeEvents.chatSend.subscribe(this.handleChatCommand.bind(this));
        this.initialized = true;
        console.log("CommandManager initialized and listening for custom commands.");
    }

    /**
     * Registers a new custom command.
     * @param command The command definition.
     */
    public registerCommand(command: CustomCommand) {
        if (this.commands.has(command.name)) {
            console.warn(`Command '${command.name}' is already registered. Overwriting.`);
        }
        this.commands.set(command.name, command);
        console.log(`Registered custom command: /${command.name}`);
    }

    /**
     * Handles incoming chat messages, checking for custom commands.
     * @param event The BeforeChatEvent.
     */
    private handleChatCommand(event: BeforeChatEvent) {
        const player = event.sender;
        const message = event.message.trim();

        if (!message.startsWith('/')) {
            return; // Not a command
        }

        const parts = message.substring(1).split(' ');
        const commandName = parts[0].toLowerCase();
        const args = parts.slice(1);

        const command = this.commands.get(commandName);

        if (command) {
            event.cancel = true; // Cancel the chat event to prevent it from appearing as a regular message

            // Check permission level
            if (player.permissionLevel < command.permissionLevel) {
                player.sendMessage(`§cYou do not have permission to use the /${command.name} command.`);
                return;
            }

            try {
                command.callback(player, args, event);
            } catch (e: any) {
                player.sendMessage(`§cAn error occurred while executing /${command.name}: ${e.message || e}`);
                console.error(`Error executing command /${command.name} for player ${player.name}:`, e);
            }
        }
        // If it's a slash command but not registered with us, let the game handle it (e.g., /say, /tp)
    }

    /**
     * Generates a help message for all registered commands.
     * @param player The player requesting help.
     */
    public sendHelpMessage(player: Player) {
        let helpMessage = "§a--- Custom Commands ---§r\n";
        let hasCommands = false;
        this.commands.forEach(cmd => {
            if (player.permissionLevel >= cmd.permissionLevel) {
                helpMessage += `§e/${cmd.name}§r - ${cmd.description} ${cmd.usage ? `(Usage: ${cmd.usage})` : ''}\n`;
                hasCommands = true;
            }
        });

        if (!hasCommands) {
            helpMessage += "§7No custom commands available for your permission level.\n";
        }
        player.sendMessage(helpMessage);
    }
}

export const commandManager = new CommandManager();

// Optional: Register a default /help command for custom commands
system.beforeEvents.startup.subscribe(() => {
    commandManager.registerCommand({
        name: "help",
        description: "Displays help for custom commands.",
        permissionLevel: CommandPermissionLevel.member,
        callback: (player: Player) => {
            commandManager.sendHelpMessage(player);
        }
    });
});
