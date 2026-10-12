import { system, world, Player } from '@minecraft/server';
import { commandManager } from './lib/commandManager';
import { inspectCommand } from './commands/inspect';

// Initialize the command manager and register commands during startup.
system.beforeEvents.startup.subscribe(() => {
    console.log("Initializing Aquarium of Gullibles scripts...");

    // Initialize the command manager
    commandManager.initialize();

    // Register custom commands
    commandManager.registerCommand(inspectCommand);

    console.log("Aquarium of Gullibles scripts initialized.");
});

// Example of a simple chat message handler for demonstration
world.beforeEvents.chatSend.subscribe(event => {
    // This handler will only be called for messages that are NOT custom commands
    // because custom commands cancel the event.
    // You can add other chat-related logic here if needed.
    // console.log(`[Chat] ${event.sender.name}: ${event.message}`);
});

// Example of a player join message
world.afterEvents.playerJoin.subscribe(event => {
    event.player.sendMessage(`§aWelcome, ${event.player.name}, to the Aquarium of Gullibles!`);
    event.player.sendMessage(`§7Use §e/help§7 for a list of custom commands.`);
});
