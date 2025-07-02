# ---- Base Image ----
# This is the most important line.
# It tells Docker to use the x86_64 (amd64) version of the Node.js image,
# which will automatically trigger QEMU emulation on your arm64 Pi.
FROM --platform=linux/amd64 node:18-slim

# ---- Setup App Directory ----
# Create and set the working directory inside the container
WORKDIR /app

# ---- Install Dependencies ----
# Copy package.json and package-lock.json first. This is a best practice
# that uses Docker's layer caching. If your dependencies don't change,
# Docker won't re-run "npm install" on every build, saving a lot of time.
COPY package*.json ./
RUN npm install

# ---- Copy App Source Code ----
# Copy the rest of your application code into the container
COPY . .

# ---- Expose Port ----
# Let Docker know which port your application runs on.
# Change 3000 if your app uses a different port.
EXPOSE 3000

# ---- Start Command ----
# The command to start your app.
# IMPORTANT: Replace "server.js" with the actual entrypoint file for your app (e.g., app.js, index.js).
CMD [ "node", "app.js" ]