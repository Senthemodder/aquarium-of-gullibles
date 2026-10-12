import { Player, world, system, Block, BlockRaycastOptions, Vector3, CommandPermissionLevel } from '@minecraft/server';
import { CustomCommand } from '../lib/commandManager';

/**
 * Calculates the distance between two Vector3 points.
 * @param v1 The first vector.
 * @param v2 The second vector.
 * @returns The distance.
 */
function distance(v1: Vector3, v2: Vector3): number {
    const dx = v1.x - v2.x;
    const dy = v1.y - v2.y;
    const dz = v1.z - v2.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * The callback function for the /inspect command.
 * @param player The player who executed the command.
 * @param args The arguments passed to the command.
 */
function inspectCommandCallback(player: Player, args: string[]) {
    const raycastOptions: BlockRaycastOptions = {
        maxDistance: 10, // Adjust as needed
        includeLiquidBlocks: false,
        includePassableBlocks: false
    };

    const blockHit = player.getBlockFromViewDirection(raycastOptions);

    if (blockHit && blockHit.block) {
        const block = blockHit.block;
        const blockLocation = block.location;
        const blockType = block.type;
        const blockPermutation = block.permutation;

        player.sendMessage(`§a--- Inspect Results ---`);
        player.sendMessage(`§eBlock Type:§r ${blockType.id}`);
        player.sendMessage(`§eLocation:§r X:${Math.floor(blockLocation.x)}, Y:${Math.floor(blockLocation.y)}, Z:${Math.floor(blockLocation.z)}`);
        player.sendMessage(`§ePermutation Properties:`);
        
        let hasProperties = false;
        for (const property of blockPermutation.getAllProperties()) {
            player.sendMessage(`  §7- ${property.name}: ${property.value}`);
            hasProperties = true;
        }
        if (!hasProperties) {
            player.sendMessage(`  §7(No unique properties)`);
        }

        // Example of getting inventory if it's a chest, furnace, etc.
        try {
            const inventoryComponent = block.getComponent('minecraft:inventory');
            if (inventoryComponent) {
                player.sendMessage(`§eHas Inventory:§r Yes (Size: ${inventoryComponent.container?.size})`);
            }
        } catch (e) {
            // Block might not have an inventory component
        }

    } else {
        player.sendMessage(`§cNo block found within range (max 10 blocks).`);
    }
}

/**
 * The definition for the /inspect command.
 */
export const inspectCommand: CustomCommand = {
    name: "inspect",
    description: "Inspects the block you are looking at, showing its type, location, and properties.",
    permissionLevel: CommandPermissionLevel.member, // Or CommandPermissionLevel.operator, CommandPermissionLevel.host, etc.
    callback: inspectCommandCallback,
    usage: "/inspect"
};
