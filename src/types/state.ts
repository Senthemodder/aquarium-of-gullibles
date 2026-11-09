--- a/scripts/commands/inspect.ts
+++ b/scripts/commands/inspect.ts
@@
-import { CustomCommandRegistry } from "@minecraft/server";
+import { system, CommandPermissionLevel } from "@minecraft/server";
@@
-// Register command at module load (causes crash on 1.21.70)
-CustomCommandRegistry.registerCommand({
-  name: "inspect",
-  description: "Inspect block or entity",
-  permission: "admin",
-}, (player, args) => {
-  // command implementation
-});
+// Register command during startup using the stable API
+system.events.beforeEvents.startup.subscribe(() => {
+  system.registerCommand(
+    "inspect",
+    {
+      description: "Inspect block or entity",
+      permissionLevel: CommandPermissionLevel.Admin,
+    },
+    (player, args) => {
+      // command implementation
+    }
+  );
+});
