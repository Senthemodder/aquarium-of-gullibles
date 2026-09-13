import { world } from '@minecraft/server';

function registerInspectCommand() {
    const command = {
        name: 'inspect',
        description: 'Inspect an entity or block',
        permission: 'command.inspect'
    };

    world.beforeEvents.scriptEventReceive.subscribe(event => {
        if (event.id === 'command_registration') {
            world.getDimension('overworld').runCommandAsync(`/register_command ${JSON.stringify(command)}`);
        }
    });
}

registerInspectCommand();