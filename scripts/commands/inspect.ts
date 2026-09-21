import { world, system, Player, CommandPermissionLevel } from '@minecraft/server';

const INSPECT_COMMAND_NAME = "inspect";
const REQUIRED_PERMISSION_LEVEL = CommandPermissionLevel.Operator;

function registerInspectCommand() {
    world.beforeEvents.chatSend.subscribe(event => {
        const player = event.sender;
        const message = event.message;

        // Check if the message starts with our command
        if (message.startsWith(`/${INSPECT_COMMAND_NAME}`)) {
            event.cancel = true; // Prevent the message from being sent to chat

            // Enforce CommandPermissionLevel permissions gating.
            let hasPermission = false;
            if (REQUIRED_PERMISSION_LEVEL === CommandPermissionLevel.Member) {
                hasPermission = true; // All players are members
            } else if (REQUIRED_PERMISSION_LEVEL === CommandPermissionLevel.Operator) {
                hasPermission = player.isOp;
            }
            // Additional checks for other CommandPermissionLevel values (e.g., Owner) can be added here if needed.

            if (hasPermission) {
                const args = message.slice(`/${INSPECT_COMMAND_NAME}`.length).trim().split(/\s+/).filter(arg => arg.length > 0);

                player.sendMessage(`§a[Inspect] Command received! Arguments: ${args.length > 0 ? args.join(', ') : 'None'}`);
                player.sendMessage(`§a[Inspect] You have the required permission level.`);

                // Placeholder for actual inspection logic
                try {
                    const block = player.getBlockFromViewDirection({ maxDistance: 10 });
                    if (block) {
                        player.sendMessage(`§bLooking at block: ${block.typeId} at ${block.x}, ${block.y}, ${block.z}`);
                    } else {
                        player.sendMessage(`§bNot looking at any block.`);
                    }
                } catch (e) {
                    player.sendMessage(`§cError getting block: ${e}`);
                }

            } else {
                player.sendMessage(`§cYou do not have the required permission level (${CommandPermissionLevel[REQUIRED_PERMISSION_LEVEL]}) to use the /${INSPECT_COMMAND_NAME} command.`);
            }
        }
    });
}

// Call the registration function directly on script load to ensure it's active during startup.
registerInspectCommand();
console.warn(`[Inspect Command] Handler for /${INSPECT_COMMAND_NAME} initialized.`);