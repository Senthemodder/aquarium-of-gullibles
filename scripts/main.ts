/**
 * Script entry point. Installs the custom command surface during the
 * `system.beforeEvents.startup` hook.
 */
import { installInspectCommand } from "./commands/inspect.js";

installInspectCommand();
