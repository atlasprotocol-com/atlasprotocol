module.exports = {
  apps: [
    {
      name: "atlasprotocol",
      script: "npm",
      args: "start",
      instances: "max", // You can specify the number of instances, 'max' means PM2 will start as many as your CPU cores
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
