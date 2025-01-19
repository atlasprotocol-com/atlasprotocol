module.exports = {
  apps: [
    {
      name: "atlasprotocol",
      script: "npm",
      args: "start",
      autorestart: true, // Restart the app if it crashes
      env: {
        NODE_ENV: "production",
      },
      // Optional: Set the port if needed
      env_production: {
        PORT: 3000,
      },
    },
  ],
};
