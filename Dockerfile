# Use Node.js base image
FROM node:18

# Install required system dependencies
RUN apt-get update && \
    apt-get install -y build-essential autoconf automake libtool pkg-config \
    libgtk-3-dev libjavascriptcoregtk-4.1-dev libwebkit2gtk-4.1-dev && \
    pkg-config --cflags --libs libsoup-3.0 && \
    export PKG_CONFIG_PATH=/usr/lib/x86_64-linux-gnu/pkgconfig/libsoup-3.0.pc

# Install Rust
RUN curl https://sh.rustup.rs -sSf | sh -s -- -y && \
    . "$HOME/.cargo/env" add x86_64-unknown-linux-gnu

# Install pnpm
RUN npm install -g pnpm

# Clone the app and set the working directory
RUN git clone https://github.com/franciscoBSalgueiro/en-croissant /en-croissant

# Set working directory to the cloned repository
WORKDIR /en-croissant

# Install dependencies inside the cloned repository
RUN pnpm install

# Build the app (make sure cargo is available)
RUN . $HOME/.cargo/env && pnpm build

# Copy built app to /output
RUN mkdir -p /output && \
    cp -r /en-croissant/src-tauri/target/release/en-croissant /output

