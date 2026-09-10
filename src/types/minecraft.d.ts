declare module '@minecraft/server' {
  /**
   * Bedrock permission levels gating command execution.
   */
  export enum CommandPermissionLevel {
    Any = 0,
    GameDirectors = 1,
    Admin = 2,
    Host = 3,
    Owner = 4,
  }

  /**
   * Origin sources initiating command invocation.
   */
  export enum CustomCommandSource {
    Block = 'Block',
    Entity = 'Entity',
    NPCDialogue = 'NPCDialogue',
    Server = 'Server',
  }

  /**
   * Command execution status outcome.
   */
  export enum CustomCommandStatus {
    Success = 0,
    Failure = 1,
  }

  /**
   * Three-dimensional coordinate vector.
   */
  export interface Vector3 {
    x: number;
    y: number;
    z: number;
  }

  /**
   * Base entity contract in Bedrock runtime.
   */
  export interface Entity {
    readonly id: string;
    readonly typeId: string;
    readonly location?: Vector3;
    readonly permissionLevel?: CommandPermissionLevel;
  }

  /**
   * Player entity representation.
   */
  export interface Player extends Entity {
    readonly name: string;
  }

  /**
   * Block instance in Bedrock world space.
   */
  export interface Block {
    readonly typeId: string;
    readonly location: Vector3;
  }

  /**
   * Invocation origin metadata carrying source context.
   */
  export interface CustomCommandOrigin {
    readonly initiator?: Entity;
    readonly sourceBlock?: Block;
    readonly sourceEntity?: Entity;
    readonly sourceType: CustomCommandSource;
    readonly permissionLevel?: CommandPermissionLevel;
  }

  /**
   * Parameter declaration for custom command syntax.
   */
  export interface CustomCommandParameter {
    readonly name: string;
    readonly type: string;
  }

  /**
   * Command specification required by the registration API.
   */
  export interface CustomCommand {
    name: string;
    description: string;
    permissionLevel: CommandPermissionLevel;
    cheatsRequired?: boolean;
    mandatoryParameters?: CustomCommandParameter[];
    optionalParameters?: CustomCommandParameter[];
  }

  /**
   * Result returned by command execution callback.
   */
  export interface CustomCommandResult {
    message?: string;
    status: CustomCommandStatus;
  }

  /**
   * Custom command registry available on startup event.
   */
  export class CustomCommandRegistry {
    private constructor();
    registerCommand(
      customCommand: CustomCommand,
      callback: (origin: CustomCommandOrigin, ...args: any[]) => CustomCommandResult | undefined
    ): void;
  }

  /**
   * Early lifecycle startup event providing system registries.
   */
  export class StartupEvent {
    private constructor();
    readonly customCommandRegistry: CustomCommandRegistry;
  }

  /**
   * Event container for pre-tick lifecycle hooks.
   */
  export interface SystemBeforeEvents {
    readonly startup: {
      subscribe(callback: (event: StartupEvent) => void): (event: StartupEvent) => void;
      unsubscribe(callback: (event: StartupEvent) => void): void;
    };
  }

  /**
   * System manager controlling runtime lifecycle events.
   */
  export class System {
    readonly beforeEvents: SystemBeforeEvents;
    run(callback: () => void): number;
  }

  export const system: System;
}
