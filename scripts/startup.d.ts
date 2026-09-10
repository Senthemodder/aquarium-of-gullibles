import type { System } from '@minecraft/server';

/**
 * Subscribes all early-execution system lifecycle listeners and custom commands.
 * @param systemInstance Optional Bedrock system singleton instance.
 */
export declare function initializeStartupHooks(systemInstance?: System | any): void;
