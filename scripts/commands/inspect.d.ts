import type {
  CustomCommandOrigin as McCustomCommandOrigin,
  StartupEvent,
  CustomCommandRegistry,
} from '@minecraft/server';
import {
  CommandPermissionLevel,
  InspectionReport,
  CustomCommand,
  CustomCommandResult,
} from './types.js';

/**
 * Builds an inspection report summarizing the command execution context.
 * @param origin Contextual origin metadata for the command invocation.
 * @returns Structured inspection report object.
 */
export declare function buildInspectionReport(
  origin: McCustomCommandOrigin | any
): InspectionReport;

/**
 * Validates whether the command invocation meets the required permission tier.
 * @param origin Invocation origin metadata.
 * @param requiredLevel Minimum permission level necessary for authorization.
 * @returns Boolean representing whether authorization is granted.
 */
export declare function validateCommandPermission(
  origin: McCustomCommandOrigin | any,
  requiredLevel?: CommandPermissionLevel
): boolean;

/**
 * Executes administrative inspection command logic across player and server contexts.
 * @param origin Invocation metadata identifying caller type and position.
 * @param requiredLevel Required permission tier for authorization gating.
 * @returns Result object containing execution status and response message.
 */
export declare function executeInspectCommand(
  origin: McCustomCommandOrigin | any,
  requiredLevel?: CommandPermissionLevel
): CustomCommandResult;

/**
 * Registers the /engine:inspect command using the startup event custom command registry.
 * @param eventOrRegistry StartupEvent carrying customCommandRegistry, or the registry instance directly.
 * @returns Registered CustomCommand definition object.
 */
export declare function registerInspectCommand(
  eventOrRegistry?: StartupEvent | CustomCommandRegistry | any
): CustomCommand;
