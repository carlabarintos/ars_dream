var builder = DistributedApplication.CreateBuilder(args);

// Dev-only orchestration: the actual app is a Firebase-backed React PWA (see ../src),
// not a .NET service. This AppHost just starts the Vite dev server and the Firebase
// emulator suite together and gives them a unified logs/traces dashboard.

var emulators = OperatingSystem.IsWindows()
    ? builder.AddExecutable("firebase-emulators", "cmd", "..", "/c", "npm", "run", "emulators")
    : builder.AddExecutable("firebase-emulators", "npm", "..", "run", "emulators");

builder
    .AddNpmApp("frontend", "..", "dev")
    // Vite ignores PORT and always binds 5173, so an Aspire proxy on that port would collide with it.
    .WithHttpEndpoint(port: 5173, env: "PORT", isProxied: false)
    .WithExternalHttpEndpoints()
    .WaitFor(emulators);

builder.Build().Run();
