/**
 * Custom slash command registration for Bedrock 1.21.70+.
 *
 * The crash this fixes: `CustomCommandRegistry.registerCommand is not a function`.
 * `CustomCommandRegistry` is a class with a private constructor in
 * `@minecraft/server` 2.8.0 — `registerCommand` is an instance method, so calling it
 * on the class itself throws. The only stable way to obtain an instance is the
 * `system.beforeEvents.startup` hook, whose event carries `customCommandRegistry`.
 *
 * Registration has to happen inside that hook (early-execution mode); registering
 * later at module top level is what produced the startup crash.
 */
import {
  CommandPermissionLevel,
  CustomCommandStatus,
  PlayerPermissionLevel,
  system,
  type CustomCommandOrigin,
  type CustomCommandRegistry,
  type CustomCommandResult,
  type Player,
} from "@minecraft/server";

export interface InspectCommandDefinition {
  readonly name: string;
  readonly description: string;
  readonly permissionLevel: CommandPermissionLevel;
  readonly optionalParameters: readonly { name: string; type: never }[];
}

/**
 * Command surface. The identifier needs a namespace, and the permission level is
 * the registry-side half of the gate.
 */
export const INSPECT_COMMAND = {
  name: "aog:inspect",
  description: "Inspect the entity nearest to the caller.",
  permissionLevel: CommandPermissionLevel.Admin,
} as const;

/**
 * Runtime half of the permission gate. The registry rejects callers below
 * `INSPECT_COMMAND.permissionLevel`; this map keeps the check explicit and
 * data-driven so raising the level cannot silently leave a stale `if`.
 *
 * `CommandPermissionLevel` is the registry's scale and `PlayerPermissionLevel` is
 * the player's, so the two are mapped rather than compared numerically. Operator
 * covers every level above "any player" in Bedrock.
 */
const REQUIRED_PLAYER_LEVEL: Record<CommandPermissionLevel, PlayerPermissionLevel> = {
  [CommandPermissionLevel.Any]: PlayerPermissionLevel.Visitor,
  [CommandPermissionLevel.GameDirectors]: PlayerPermissionLevel.Operator,
  [CommandPermissionLevel.Admin]: PlayerPermissionLevel.Operator,
  [CommandPermissionLevel.Host]: PlayerPermissionLevel.Operator,
  [CommandPermissionLevel.Owner]: PlayerPermissionLevel.Operator,
};

export function callerIsPermitted(
  player: Player,
  level: CommandPermissionLevel = INSPECT_COMMAND.permissionLevel,
): boolean {
  return player.playerPermissionLevel >= REQUIRED_PLAYER_LEVEL[level];
}

/** Shared guard so every command in this folder gates the same way. */
export function requireOperator(origin: CustomCommandOrigin): { ok: true; player: Player } | { ok: false; result: CustomCommandResult } {
  const player = origin.sourceEntity as Player | undefined;
  if (!player || typeof player.playerPermissionLevel !== "number") {
    return {
      ok: false,
      result: {
        status: CustomCommandStatus.Failure,
        message: "aog:inspect must be run by a player.",
      },
    };
  }
  if (!callerIsPermitted(player)) {
    return {
      ok: false,
      result: {
        status: CustomCommandStatus.Failure,
        message: "aog:inspect requires operator permission.",
      },
    };
  }
  return { ok: true, player };
}

function executeInspect(origin: CustomCommandOrigin): CustomCommandResult {
  const gate = requireOperator(origin);
  if (!gate.ok) return gate.result;

  const nearest = gate.player.dimension.getEntities({
    location: gate.player.location,
    maxDistance: 16,
    closest: 1,
  })[0];

  if (!nearest) {
    return { status: CustomCommandStatus.Success, message: "No entity within 16 blocks." };
  }

  return {
    status: CustomCommandStatus.Success,
    message: `${nearest.typeId} at ${Math.floor(nearest.location.x)}, ${Math.floor(nearest.location.y)}, ${Math.floor(nearest.location.z)}`,
  };
}

/**
 * Register against a concrete registry instance. Kept separate from the event
 * subscription so it can be tested without a world.
 */
export function registerInspectCommand(registry: CustomCommandRegistry): void {
  registry.registerCommand(INSPECT_COMMAND, executeInspect);
}

/**
 * Subscribe once, at startup. Returns the subscription callback so callers can
 * unsubscribe (useful in tests and on hot reload).
 */
export function installInspectCommand(): (event: { customCommandRegistry: CustomCommandRegistry }) => void {
  const onStartup = (event: { customCommandRegistry: CustomCommandRegistry }): void => {
    registerInspectCommand(event.customCommandRegistry);
  };
  system.beforeEvents.startup.subscribe(onStartup);
  return onStartup;
}
